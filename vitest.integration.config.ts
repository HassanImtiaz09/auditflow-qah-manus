/**
 * Vitest config for integration tests.
 *
 * Run with: pnpm test:integration
 *
 * Requirements:
 *   - DATABASE_URL must be set (TiDB Cloud or any MySQL 8 instance)
 *   - Tests create and drop isolated prefixed tables, so they are safe to
 *     run against the production DB schema (they never touch existing tables)
 *
 * Tests are skipped automatically when DATABASE_URL is absent.
 */
import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/integration/**/*.int.test.ts"],
    // Integration tests can take longer — allow 60 s per test
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Run sequentially to avoid table-name collisions in the same DB
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
