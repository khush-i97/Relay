import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Moss ships a native addon that must be loaded by Node at runtime, not bundled.
  serverExternalPackages: ["@moss-js/moss"],
  // The repo root has its own lockfile; keep Turbopack resolving from this app.
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  // Don't generate coding-assistant rule files in the app directory on `next dev`.
  agentRules: false,
};

export default nextConfig;
