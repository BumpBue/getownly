import 'dotenv/config';

/**
 * Tests run against a real PostgreSQL in Docker, never against mocks — a
 * double-entry ledger is only as correct as the transactions and row locks the
 * database actually gives it.
 *
 * They use a sibling database (`<name>_test`) on the same container, so
 * truncating between tests never touches the data seeded for development.
 */

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy backend/.env.example to backend/.env first.');
  }
  return url;
}

/** The development database, used only to issue CREATE DATABASE. */
export function adminDatabaseUrl(): string {
  return requireDatabaseUrl();
}

export function testDatabaseName(): string {
  const name = new URL(requireDatabaseUrl()).pathname.replace(/^\//, '');
  return name.endsWith('_test') ? name : `${name}_test`;
}

export function testDatabaseUrl(): string {
  const url = new URL(requireDatabaseUrl());
  url.pathname = `/${testDatabaseName()}`;
  return url.toString();
}
