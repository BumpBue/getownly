import { plainToInstance, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Everything the API needs from the environment, checked once at boot.
 *
 * A missing or nonsensical value stops the process immediately instead of
 * surfacing as a confusing runtime error hours later. Variables that later
 * phases need (MinIO, PromptPay) are not listed yet, but still reach
 * ConfigService untouched.
 */
export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  API_PREFIX!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  // --- tokens --------------------------------------------------------------

  @IsString()
  @MinLength(16, {
    message: 'JWT_ACCESS_SECRET ต้องยาวอย่างน้อย 16 ตัวอักษร',
  })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(16, {
    message: 'JWT_REFRESH_SECRET ต้องยาวอย่างน้อย 16 ตัวอักษร',
  })
  JWT_REFRESH_SECRET!: string;

  /** Vercel-style duration accepted by @nestjs/jwt, e.g. "15m". */
  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_EXPIRES_IN!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN!: string;

  // --- cookies -------------------------------------------------------------
  // No COOKIE_DOMAIN on purpose: leaving the attribute off scopes the cookie
  // to the exact host that set it, which is what we want in every environment.

  @IsIn(['true', 'false'])
  COOKIE_SECURE!: string;

  @IsIn(['lax', 'strict', 'none'])
  COOKIE_SAME_SITE!: string;

  // --- passwords -----------------------------------------------------------

  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(15)
  BCRYPT_COST!: number;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  PASSWORD_RESET_EXPIRES_MINUTES!: number;

  // --- rate limiting -------------------------------------------------------

  @Type(() => Number)
  @IsInt()
  @Min(1)
  RATE_LIMIT_LOGIN_LIMIT!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  RATE_LIMIT_LOGIN_TTL_SECONDS!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  RATE_LIMIT_FORGOT_PASSWORD_LIMIT!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  RATE_LIMIT_FORGOT_PASSWORD_TTL_SECONDS!: number;

  // --- object storage ------------------------------------------------------

  @IsString()
  @IsNotEmpty()
  MINIO_ENDPOINT!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  MINIO_PORT!: number;

  @IsIn(['true', 'false'])
  MINIO_USE_SSL!: string;

  @IsString()
  @IsNotEmpty()
  MINIO_ACCESS_KEY!: string;

  @IsString()
  @IsNotEmpty()
  MINIO_SECRET_KEY!: string;

  @IsString()
  @IsNotEmpty()
  MINIO_BUCKET!: string;

  /**
   * Where the **browser** reaches MinIO, which is not always where the API
   * does. Presigned URLs are signed over this host, so it has to be an
   * address a person's browser can actually open.
   *
   * On a developer machine these three match the MINIO_* values above. Under
   * `docker compose --profile full` the API talks to `minio` while the browser
   * talks to `localhost`. Required rather than defaulted: a wrong value here
   * breaks nothing until the first upload.
   */
  @IsString()
  @IsNotEmpty()
  MINIO_PUBLIC_ENDPOINT!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  MINIO_PUBLIC_PORT!: number;

  @IsIn(['true', 'false'])
  MINIO_PUBLIC_USE_SSL!: string;

  /** Lifetime of a presigned GET handed to the browser. */
  @Type(() => Number)
  @IsInt()
  @Min(60)
  MINIO_PRESIGN_EXPIRY_SECONDS!: number;

  /** Lifetime of a presigned PUT. Longer, because a 500MB video takes a while. */
  @Type(() => Number)
  @IsInt()
  @Min(60)
  MINIO_PRESIGN_UPLOAD_EXPIRY_SECONDS!: number;

  // Upload size ceilings are deliberately absent. They are fixed by the scope
  // document (ทก.01 A6) rather than by a deployment, so they live in
  // packages/shared/src/limits.ts where the web app reads the same numbers.
  // A UPLOAD_MAX_* left over in an old .env is simply ignored.

  // --- top-up and PromptPay ------------------------------------------------

  /**
   * The account every top-up QR pays into: a 10-digit phone number, or a
   * 13-digit national / tax ID. `.env.example` ships zeroes deliberately, so a
   * fresh clone cannot print QR codes pointing at somebody's real account.
   */
  @Matches(/^\d{10}$|^\d{13}$/, {
    message: 'PROMPTPAY_ID ต้องเป็นตัวเลข 10 หลัก (เบอร์โทร) หรือ 13 หลัก (เลขประจำตัวประชาชน)',
  })
  PROMPTPAY_ID!: string;

  @IsString()
  @IsNotEmpty()
  PROMPTPAY_DISPLAY_NAME!: string;

  /** true makes every screen showing a QR warn that it is a demo, not a real payee. */
  @IsIn(['true', 'false'])
  DEMO_MODE!: string;

  /** Smallest and largest single top-up, in whole baht. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  TOPUP_MIN_AMOUNT!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  TOPUP_MAX_AMOUNT!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  TOPUP_QUOTE_EXPIRY_MINUTES!: number;

  // --- outside world -------------------------------------------------------

  @IsString()
  @IsNotEmpty()
  FRONTEND_ORIGIN!: string;

  @IsString()
  @IsNotEmpty()
  MAIL_HOST!: string;

  @Type(() => Number)
  @IsInt()
  MAIL_PORT!: number;

  @IsIn(['true', 'false'])
  MAIL_SECURE!: string;

  @IsOptional()
  @IsString()
  MAIL_USER?: string;

  @IsOptional()
  @IsString()
  MAIL_PASSWORD?: string;

  @IsString()
  @IsNotEmpty()
  MAIL_FROM_NAME!: string;

  @IsString()
  @IsNotEmpty()
  MAIL_FROM_ADDRESS!: string;
}

export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  // Extra keys are kept, so ConfigService still sees the whole environment.
  const parsed = plainToInstance(EnvironmentVariables, raw);
  const errors = validateSync(parsed, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => `  - ${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`ตัวแปรสภาพแวดล้อมไม่ถูกต้อง ตรวจไฟล์ backend/.env\n${details}`);
  }

  return parsed;
}

/** COOKIE_SECURE / MAIL_SECURE arrive as strings; this is the one place they turn into booleans. */
export function envFlag(value: string | undefined): boolean {
  return value === 'true';
}
