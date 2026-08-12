import { Injectable } from '@nestjs/common';
import { CourseStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import {
  CategoryInUseException,
  CategoryNameTakenException,
} from '@/common/exceptions/admin.exceptions';
import { CategoryNotFoundException } from '@/common/exceptions/catalog.exceptions';
import { PrismaService } from '@/infra/prisma.service';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category-request.dto';

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  /** Published courses only, so the sidebar counts match what the grid shows. */
  courseCount: number;
}

/** The admin table counts every course, draft and rejected ones included. */
export interface AdminCategoryDto extends CategoryDto {
  totalCourseCount: number;
  createdAt: string;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(): Promise<CategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { courses: { where: { status: CourseStatus.PUBLISHED } } } },
      },
      orderBy: { name: 'asc' },
    });

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      courseCount: category._count.courses,
    }));
  }

  /**
   * The admin list shows two counts on purpose: how many courses are visible
   * to the public, and how many exist at all. Only the second one decides
   * whether the row can be deleted.
   */
  async listForAdmin(): Promise<AdminCategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: { select: { courses: true } },
        courses: { where: { status: CourseStatus.PUBLISHED }, select: { id: true } },
      },
      orderBy: { name: 'asc' },
    });

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      courseCount: category.courses.length,
      totalCourseCount: category._count.courses,
      createdAt: category.createdAt.toISOString(),
    }));
  }

  async create(dto: CreateCategoryDto): Promise<AdminCategoryDto> {
    let categoryId: string;

    try {
      const category = await this.prisma.category.create({
        data: { name: dto.name.trim(), slug: dto.slug ?? generateSlug() },
        select: { id: true },
      });
      categoryId = category.id;
    } catch (error) {
      throw toBusinessError(error);
    }

    return this.readForAdmin(categoryId);
  }

  async update(categoryId: string, dto: UpdateCategoryDto): Promise<AdminCategoryDto> {
    await this.findOrThrow(categoryId);

    try {
      await this.prisma.category.update({
        where: { id: categoryId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
        },
      });
    } catch (error) {
      throw toBusinessError(error);
    }

    return this.readForAdmin(categoryId);
  }

  /**
   * Deleting is refused while any course points at the category — including
   * drafts, which would otherwise be left referencing a row that is gone.
   * The FK is `onDelete: Restrict`, so this check only turns a database error
   * into a sentence the admin can act on.
   */
  async remove(categoryId: string): Promise<{ message: string }> {
    await this.findOrThrow(categoryId);

    const courseCount = await this.prisma.course.count({ where: { categoryId } });
    if (courseCount > 0) {
      throw new CategoryInUseException(courseCount);
    }

    await this.prisma.category.delete({ where: { id: categoryId } });

    return { message: 'ลบหมวดหมู่เรียบร้อยแล้ว' };
  }

  private async readForAdmin(categoryId: string): Promise<AdminCategoryDto> {
    const category = await this.prisma.category.findUniqueOrThrow({
      where: { id: categoryId },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: { select: { courses: true } },
        courses: { where: { status: CourseStatus.PUBLISHED }, select: { id: true } },
      },
    });

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      courseCount: category.courses.length,
      totalCourseCount: category._count.courses,
      createdAt: category.createdAt.toISOString(),
    };
  }

  private async findOrThrow(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new CategoryNotFoundException();
    }
  }
}

/**
 * A URL-safe stand-in for a Thai name.
 *
 * Transliterating Thai into a readable slug is a problem of its own, and a
 * wrong guess would be baked into a public URL. A short random suffix is
 * honest about knowing nothing, and the admin can set a real slug by hand.
 */
function generateSlug(): string {
  return `category-${randomBytes(4).toString('hex')}`;
}

/** Unique violations on name or slug become one conflict the screen can show. */
function toBusinessError(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return new CategoryNameTakenException();
  }
  return error;
}
