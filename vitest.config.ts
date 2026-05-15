import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

const alias = {
  "@": path.resolve(templateRoot, "client", "src"),
  "@shared": path.resolve(templateRoot, "shared"),
  "@assets": path.resolve(templateRoot, "attached_assets"),
};

/**
 * Default config — unit tests only.
 * Run with: pnpm test
 *
 * Integration tests (server/integration/*.int.test.ts) are excluded here
 * because they require DATABASE_URL and take longer.  Run them separately
 * with: pnpm test:integration
 */
export default defineConfig({
  root: templateRoot,
  resolve: { alias },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    // Exclude integration tests from the default suite
    exclude: ["server/integration/**"],
  },
});
