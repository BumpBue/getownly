import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Covers pure logic only (frontend/src/lib/**), not React components — this
 * project has no component-render test setup (jsdom, @testing-library). See
 * frontend/src/lib/home/logic.ts for what that split looks like in practice.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
