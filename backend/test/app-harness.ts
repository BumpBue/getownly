import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Response } from 'supertest';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import { PrismaService } from '@/infra/prisma.service';

export interface Harness {
  app: NestExpressApplication;
  prisma: PrismaService;
  server: ReturnType<INestApplication['getHttpServer']>;
  /** Empties the in-memory rate limit counters between tests. */
  resetRateLimits: () => void;
}

/**
 * Boots the real AppModule with the same global pipes, filters and guards that
 * `main.ts` installs, so an e2e test cannot pass because of a setup difference.
 */
export async function createHarness(): Promise<Harness> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app, app.get(ConfigService));
  await app.init();

  const storage = app.get<ThrottlerStorage>(ThrottlerStorage);

  return {
    app,
    prisma: app.get(PrismaService),
    server: app.getHttpServer(),
    resetRateLimits: () => {
      const backing = (storage as unknown as { _storage?: unknown })._storage;
      if (backing instanceof Map) {
        backing.clear();
      }
    },
  };
}

/** Parses `set-cookie` into a name -> value map, ignoring the attributes. */
export function cookiesFrom(response: Response): Record<string, string> {
  const raw = response.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];

  const jar: Record<string, string> = {};
  for (const entry of list) {
    const [pair] = entry.split(';');
    const index = pair.indexOf('=');
    if (index > 0) {
      jar[pair.slice(0, index).trim()] = decodeURIComponent(pair.slice(index + 1).trim());
    }
  }
  return jar;
}

/** Builds a Cookie header from an explicit set of names, so tests control exactly what is sent. */
export function cookieHeader(jar: Record<string, string>, names: string[]): string {
  return names
    .filter((name) => jar[name] !== undefined && jar[name] !== '')
    .map((name) => `${name}=${encodeURIComponent(jar[name])}`)
    .join('; ');
}
