import { defineConfig } from "vitest/config";

/**
 * Two projects rather than one environment for everything.
 *
 * The domain suite is IO-free logic and runs in Node, where it starts in
 * milliseconds. Only the component suite pays for jsdom, and only it loads the
 * jest-dom matchers. Splitting them keeps the fast suite fast.
 *
 * tsconfigPaths resolves the "@/" alias from tsconfig.json rather than
 * duplicating the mapping, so the two cannot drift.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: "domain",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
