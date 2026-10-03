import { createClient } from "@supabase/supabase-js";

import { serverConfig } from "./config";

export function serverDb() {
  const { supabaseUrl, supabaseServiceRoleKey } = serverConfig();
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
