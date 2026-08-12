import path from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    // Creates and migrates the <db>_test database once per run.
    globalSetup: ['./test/global-setup.ts'],
    // Points every PrismaClient at that database before any test is imported.
    setupFiles: ['./test/setup.ts'],
    // The ledger suites share one database and truncate it between tests, so
    // they must not run side by side.
    fileParallelism: false,
    // Row locks mean a test can legitimately wait on another transaction.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // SWC keeps emitDecoratorMetadata working, which NestJS DI depends on.
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
