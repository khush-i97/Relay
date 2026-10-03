export function serverConfig() {
  const supabaseUrl = required("SUPABASE_URL");
  const supabaseServiceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    demoMode: process.env.DEMO_MODE === "true",
    appOrigin: process.env.APP_ORIGIN,
  };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
