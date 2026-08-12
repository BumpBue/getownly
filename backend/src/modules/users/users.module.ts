import { Module } from '@nestjs/common';
import { AuthModule } from '@/modules/auth/auth.module';
import { AdminUsersController } from './admin-users.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * Accounts, from both sides of the desk. AuthModule is imported for
 * TokenService: changing a password has to revoke every session, and session
 * lifetime belongs to auth.
 */
@Module({
  imports: [AuthModule],
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService],
})
export class UsersModule {}
