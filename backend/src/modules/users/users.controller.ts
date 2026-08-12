import { Body, Controller, Patch } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import type { UserProfileDto } from '@/modules/auth/dto/user-profile.dto';
import { ChangePasswordDto, UpdateProfileDto } from './dto/user-request.dto';
import { UsersService } from './users.service';

/**
 * The signed-in person's own account. No `@Roles`: everybody has one.
 *
 * The id always comes from the token, never from the path or the body, so
 * there is no route here that could be pointed at somebody else
 * (CLAUDE.md, ข้อห้าม 7).
 */
@Controller('users/me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch()
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    return this.users.updateProfile(user.id, dto);
  }

  @Patch('password')
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.users.changePassword(user.id, dto);
  }
}
