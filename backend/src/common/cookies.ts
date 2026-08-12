import type { CookieOptions, Request } from 'express';
import { envFlag } from '@/config/env.validation';

/**
 * Both tokens live in httpOnly cookies, never in localStorage
 * (CLAUDE.md, ข้อห้าม 8).
 */
export const ACCESS_TOKEN_COOKIE = 'getownly_access_token';
export const REFRESH_TOKEN_COOKIE = 'getownly_refresh_token';

export interface CookieSettings {
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
}

/**
 * Note the missing `domain`: leaving it off scopes the cookie to the exact
 * host that set it, so a development cookie can never leak to a sibling
 * subdomain later on.
 *
 * The refresh cookie is scoped to the auth routes, so it is not attached to
 * every ordinary API call.
 */
export function accessTokenCookieOptions(
  settings: CookieSettings,
  maxAgeMs: number,
): CookieOptions {
  return {
    httpOnly: true,
    secure: settings.secure,
    sameSite: settings.sameSite,
    path: '/',
    maxAge: maxAgeMs,
  };
}

export function refreshTokenCookieOptions(
  settings: CookieSettings,
  maxAgeMs: number,
  apiPrefix: string,
): CookieOptions {
  return {
    httpOnly: true,
    secure: settings.secure,
    sameSite: settings.sameSite,
    path: `/${apiPrefix}/auth`,
    maxAge: maxAgeMs,
  };
}

/**
 * Express types `request.cookies` as `any`, so every read goes through here to
 * get back a real `string | undefined`.
 */
export function readCookie(request: Request, name: string): string | undefined {
  const cookies: unknown = request.cookies;
  if (typeof cookies !== 'object' || cookies === null) {
    return undefined;
  }

  const value = (cookies as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : undefined;
}

export function readCookieSettings(env: {
  COOKIE_SECURE?: string;
  COOKIE_SAME_SITE?: string;
}): CookieSettings {
  return {
    secure: envFlag(env.COOKIE_SECURE),
    sameSite: (env.COOKIE_SAME_SITE ?? 'lax') as CookieSettings['sameSite'],
  };
}
