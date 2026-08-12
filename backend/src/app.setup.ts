import { ValidationPipe, type INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { validationExceptionFactory } from './common/pipes/validation-exception.factory';

/**
 * Everything that has to be true of the running app, in one place so the e2e
 * tests boot an application configured exactly like the real one.
 */
export function configureApp(app: INestApplication, config: ConfigService): void {
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
