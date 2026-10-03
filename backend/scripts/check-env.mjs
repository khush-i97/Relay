const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "APP_ORIGIN"];
const missing = required.filter((name) => !process.env[name]);
const provider = process.env.ADVENTURE_PROVIDER ?? "deterministic";
if (provider === "novita") {
  for (const name of ["NOVITA_API_KEY", "NOVITA_MODEL"]) if (!process.env[name]) missing.push(name);
}
if (provider === "zoowork" && !process.env.ZOODATA_API_KEY && !process.env.ZOOWORK_API_KEY) {
  missing.push("ZOODATA_API_KEY or ZOOWORK_API_KEY");
}
if (missing.length) {
  console.error(`Missing environment values: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(`Environment is configured for ${provider} adventure planning.`);
}
