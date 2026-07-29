import { defineConfig } from "vitest/config";

/**
 * Node environment, not jsdom: everything under test is IO-free domain logic
 * and prompt assembly. No component renders here, so a DOM would cost startup
 * time and buy nothing.
 *
 * tsconfigPaths resolves the "@/" alias from tsconfig.json rather than
 * duplicating the mapping, so the two cannot drift.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
