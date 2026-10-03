import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const platformName = process.platform === "win32" ? "windows" : process.platform;
const platform = `${platformName}-${process.arch}`;
const extension = process.platform === "win32" ? ".exe" : "";
const supabase = resolve(fileURLToPath(new URL("..", import.meta.url)), `node_modules/@supabase/cli-${platform}/bin/supabase${extension}`);
const status = JSON.parse(execFileSync(supabase, ["status", "-o", "json"], { encoding: "utf8" }));
const apiUrl = status.API_URL ?? status.api_url;
const serviceRoleKey = status.SERVICE_ROLE_KEY ?? status.service_role_key;

if (!apiUrl || !serviceRoleKey) {
  throw new Error("Local Supabase status did not provide API_URL and SERVICE_ROLE_KEY");
}

const root = fileURLToPath(new URL("..", import.meta.url));
const vitest = resolve(root, "node_modules/vitest/vitest.mjs");
const result = spawnSync(process.execPath, [vitest, "run", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: {
    ...process.env,
    SUPABASE_URL: apiUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    DEMO_MODE: process.env.DEMO_MODE ?? "true",
    APP_ORIGIN: process.env.APP_ORIGIN ?? "http://localhost:3000",
  },
});

process.exit(result.status ?? 1);
