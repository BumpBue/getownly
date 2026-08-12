import { ValidationPipe } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { validationExceptionFactory } from './common/pipes/validation-exception.factory';

/**
 * Every request body in this API is small form data - courses, quiz
 * questions, top-up requests. Real files never touch this path at all
 * (uploads go straight to MinIO via a presigned PUT URL), so this is
 * generous headroom against an oversized payload, not a tight budget.
 */
const JSON_BODY_LIMIT = '256kb';

/**
 * Everything that has to be true of the running app, in one place so the e2e
 * tests boot an application configured exactly like the real one.
 */
export function configureApp(app: NestExpressApplication, config: ConfigService): void {
  app.use(
    helmet({
      // A pure JSON API never serves HTML, so a content security policy
      // protects nothing here and is just header noise.
      contentSecurityPolicy: false,
      // Course covers, the lesson video stream, and presigned slip/material
      // URLs are all fetched cross-origin from the web app's own :3000
      // origin. Helmet's "same-origin" default would have the browser
      // silently refuse every one of those requests.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.useBodyParser('urlencoded', { extended: true, limit: JSON_BODY_LIMIT });

  app.use(cookieParser());

  // Every route lives under /api, e.g. http://localhost:4000/api/auth/me
  app.setGlobalPrefix(config.get<string>('API_PREFIX') ?? 'api');

  app.useGlobalPipes(
    new ValidationPipe({
      // Anything not declared on the DTO is rejected rather than trusted:
      // this is what stops a client from smuggling in `role` or `price`.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: validationExceptionFactory,
    }),
  );

  // Cookies only cross origins when the origin matches exactly and
  // credentials are allowed on both ends.
  app.enableCors({
    origin: config.getOrThrow<string>('FRONTEND_ORIGIN'),
    credentials: true,
  });
}
