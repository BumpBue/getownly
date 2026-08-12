// Decorators are evaluated the moment a module is imported, which happens
// before Nest gets a chance to load this itself.
import 'reflect-metadata';
import { testDatabaseUrl } from './env';

// Every PrismaClient created from here on talks to the test database.
// This runs before any test file is imported, so services never see the
// development database.
process.env.DATABASE_URL = testDatabaseUrl();
process.env.NODE_ENV = 'test';
