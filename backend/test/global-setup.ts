import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { adminDatabaseUrl, testDatabaseName, testDatabaseUrl } from './env';

/**
 * Runs once before the whole suite: makes sure the test database exists and is
 * migrated to the current schema. Individual test files truncate it themselves.
 */
export default async function setup(): Promise<void> {
  const admin = new PrismaClient({ datasourceUrl: adminDatabaseUrl() });

  try {
    // CREATE DATABASE cannot run inside a transaction, which is exactly what
    // $executeRawUnsafe gives us here.
    await admin.$executeRawUnsafe(`CREATE DATABASE "${testDatabaseName()}"`);
  } catch (error) {
    if (!isDatabaseAlreadyExists(error)) {
      throw error;
    }
  } finally {
    await admin.$disconnect();
  }

  execSync('prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
  });
}

/** Postgres 42P04 = duplicate_database. */
function isDatabaseAlreadyExists(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('42P04') || message.includes('already exists');
}
