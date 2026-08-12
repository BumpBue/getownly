import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role, UserStatus } from '@prisma/client';
import { compare, hash } from 'bcrypt';
import {
  CannotSuspendSelfException,
  CommissionNotApplicableException,
  UserNotFoundException,
  WrongCurrentPasswordException,
} from '@/common/exceptions/admin.exceptions';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PrismaService } from '@/infra/prisma.service';
import { TokenService } from '@/modules/auth/token.service';
import { toUserProfile, type UserProfileDto } from '@/modules/auth/dto/user-profile.dto';
import { MAX_COMMISSION_RATE, type ListUsersQueryDto } from './dto/user-request.dto';
import type { AdminUserDto, PaginatedAdminUsersDto, UserCountsDto } from './dto/user-response.dto';

const DEFAULT_PAGE_SIZE = 20;

/** Everything the admin table shows about one person, and nothing more. */
const adminUserSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  role: true,
  status: true,
  commissionRate: true,
  createdAt: true,
  _count: { select: { courses: true, enrollments: true } },
} satisfies Prisma.UserSelect;

type AdminUserRow = Prisma.UserGetPayload<{ select: typeof adminUserSelect }>;

/**
 * Accounts: the person's own profile, and the admin's view of everyone's.
 *
 * The two halves share one mapper each and never `return user` raw — an
 * admin listing is the single easiest place to spill a password hash
 * (CLAUDE.md, ข้อห้าม 11).
 */
@Injectable()
export class UsersService {
  private readonly bcryptCost: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    config: ConfigService,
  ) {
    this.bcryptCost = Number(config.getOrThrow<string>('BCRYPT_COST'));
  }

  // -------------------------------------------------------------------------
  // The person's own account
  // -------------------------------------------------------------------------

  /**
   * Updates the caller's own profile.
   *
   * Deliberately narrow: role, status, email and commission are not fields
   * here, so no amount of extra keys in the body can reach them. The global
   * ValidationPipe rejects unknown properties outright, and this DTO is the
   * list of what may change.
   */
  async updateProfile(
    userId: string,
    dto: { displayName?: string; bio?: string; expertise?: string },
  ): Promise<UserProfileDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName.trim() } : {}),
        // An emptied field is stored as null rather than as "", so "no bio"
        // has one representation instead of two.
        ...(dto.bio !== undefined ? { bio: dto.bio.trim() || null } : {}),
        ...(dto.expertise !== undefined ? { expertise: dto.expertise.trim() || null } : {}),
      },
    });

    return toUserProfile(user);
  }

  /**
   * Changes the caller's password, then signs every session out.
   *
   * Revoking is the point: changing a password is what someone does when they
   * think a session is not theirs, and leaving the old refresh tokens alive
   * would make the change cosmetic.
   */
  async changePassword(
    userId: string,
    dto: { currentPassword: string; newPassword: string },
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      throw new UserNotFoundException();
    }
    if (!(await compare(dto.currentPassword, user.passwordHash))) {
      throw new WrongCurrentPasswordException();
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hash(dto.newPassword, this.bcryptCost),
        // Dates every access token already out there. Without it the caller's
        // own token would keep working for the rest of its 15 minutes, which
        // is not what "signed out everywhere" means.
        passwordChangedAt: new Date(),
      },
    });
    await this.tokens.revokeAllForUser(userId);

    return { message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กรุณาเข้าสู่ระบบใหม่' };
  }

  // -------------------------------------------------------------------------
  // The admin's view
  // -------------------------------------------------------------------------

  async listForAdmin(query: ListUsersQueryDto): Promise<PaginatedAdminUsersDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    if (query.search) {
      // Searching by email is the point of the box: an admin arrives here from
      // a support message, holding an address and nothing else.
      where.OR = [
        { displayName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { username: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, rows, counts] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: adminUserSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.countByRoleAndStatus(),
    ]);

    return {
      items: rows.map(toAdminUser),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      counts,
    };
  }

  /** Suspends an account, or brings it back. */
  async setStatus(
    userId: string,
    admin: AuthenticatedUser,
    status: UserStatus,
  ): Promise<AdminUserDto> {
    if (userId === admin.id) {
      throw new CannotSuspendSelfException();
    }

    await this.findOrThrow(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: adminUserSelect,
    });

    return toAdminUser(user);
  }

  /**
   * Sets one instructor's platform share.
   *
   * Only future sales are affected: every past sale snapshotted the rate it
   * was made at onto its Enrollment, so reports of past months do not move
   * when this changes (CLAUDE.md, "Snapshot").
   */
  async setCommissionRate(userId: string, commissionRate: string): Promise<AdminUserDto> {
    const existing = await this.findOrThrow(userId);

    if (existing.role !== Role.INSTRUCTOR) {
      throw new CommissionNotApplicableException(existing.role);
    }

    const rate = new Prisma.Decimal(commissionRate);
    if (rate.greaterThan(MAX_COMMISSION_RATE)) {
      throw new CommissionNotApplicableException(existing.role);
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { commissionRate: rate },
      select: adminUserSelect,
    });

    return toAdminUser(user);
  }

  private async findOrThrow(userId: string): Promise<{ role: Role }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw new UserNotFoundException();
    }

    return user;
  }

  /** The tiles above the table: how many of each role, and how many suspended. */
  private async countByRoleAndStatus(): Promise<UserCountsDto> {
    const [byRole, suspended] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
    ]);

    const lookup = new Map(byRole.map((row) => [row.role, row._count._all]));

    return {
      total: [...lookup.values()].reduce((sum, count) => sum + count, 0),
      students: lookup.get(Role.STUDENT) ?? 0,
      instructors: lookup.get(Role.INSTRUCTOR) ?? 0,
      admins: lookup.get(Role.ADMIN) ?? 0,
      suspended,
    };
  }
}

function toAdminUser(user: AdminUserRow): AdminUserDto {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    commissionRate: user.commissionRate.toFixed(4),
    courseCount: user._count.courses,
    enrollmentCount: user._count.enrollments,
    createdAt: user.createdAt.toISOString(),
  };
}
