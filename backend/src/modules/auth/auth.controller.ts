import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { RateLimit } from '@/common/decorators/rate-limit.decorator';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  accessTokenCookieOptions,
  readCookie,
  readCookieSettings,
  refreshTokenCookieOptions,
} from '@/common/cookies';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { AuthService } from './auth.service';
import type { IssuedTokens } from './token.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password.dto';
import type { UserProfileDto } from './dto/user-profile.dto';

/**
 * Tokens travel only in httpOnly cookies, so nothing here ever puts a token in
 * the response body. The controller's job is the cookie plumbing; every rule
 * about who may do what lives in AuthService.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: UserProfileDto }> {
    const result = await this.auth.register(dto);
    this.setAuthCookies(response, result.tokens);
    return { user: result.user };
  }

  @Public()
  @RateLimit('login')
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: UserProfileDto }> {
    const result = await this.auth.login(dto);
    this.setAuthCookies(response, result.tokens);
    return { user: result.user };
  }

  /** Public because the access token is expected to be expired by this point. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ refreshed: true }> {
    const tokens = await this.auth.refresh(readCookie(request, REFRESH_TOKEN_COOKIE));
    this.setAuthCookies(response, tokens);
    return { refreshed: true };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    await this.auth.logout(readCookie(request, REFRESH_TOKEN_COOKIE));
    this.clearAuthCookies(response);
    return { message: 'ออกจากระบบเรียบร้อยแล้ว' };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser): Promise<{ user: UserProfileDto }> {
    return { user: await this.auth.me(user.id) };
  }

  @Public()
  @RateLimit('forgotPassword')
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    const result = await this.auth.resetPassword(dto);
    // Every session died with the reset, including this browser's.
    this.clearAuthCookies(response);
    return result;
  }

  private setAuthCookies(response: Response, tokens: IssuedTokens): void {
    const settings = readCookieSettings({
      COOKIE_SECURE: this.config.get<string>('COOKIE_SECURE'),
      COOKIE_SAME_SITE: this.config.get<string>('COOKIE_SAME_SITE'),
    });

    response.cookie(
      ACCESS_TOKEN_COOKIE,
      tokens.accessToken,
      accessTokenCookieOptions(settings, tokens.accessMaxAgeMs),
    );
    response.cookie(
      REFRESH_TOKEN_COOKIE,
      tokens.refreshToken,
      refreshTokenCookieOptions(settings, tokens.refreshMaxAgeMs, this.apiPrefix()),
    );
  }

  private clearAuthCookies(response: Response): void {
    const settings = readCookieSettings({
      COOKIE_SECURE: this.config.get<string>('COOKIE_SECURE'),
      COOKIE_SAME_SITE: this.config.get<string>('COOKIE_SAME_SITE'),
    });

    // Path must match the one used when setting, or the browser keeps the cookie.
    response.clearCookie(ACCESS_TOKEN_COOKIE, accessTokenCookieOptions(settings, 0));
    response.clearCookie(
      REFRESH_TOKEN_COOKIE,
      refreshTokenCookieOptions(settings, 0, this.apiPrefix()),
    );
  }

  private apiPrefix(): string {
    return this.config.get<string>('API_PREFIX') ?? 'api';
  }
}
