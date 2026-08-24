import "./src/lib/env";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Where the build output goes.
   *
   * `next build` and `next dev` both write to `.next` by default, so running a
   * verification build while the dev server is up pulls the ground out from
   * under it — the running server reads a Turbopack cache that the build has
   * just replaced, and every request after that fails with "Failed to restore
   * task data (corrupted database)". The only fix at that point is a restart,
   * which is not obvious when all you did was reload the page.
   *
   * Setting BUILD_DIR sends a build somewhere else, leaving the dev server's
   * own directory alone. Unset, everything behaves exactly as before.
   */
  distDir: process.env.BUILD_DIR || ".next",
};

export default nextConfig;
