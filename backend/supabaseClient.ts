import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

// Server-side client used only to verify tokens the frontend sends us
// (auth.getUser) — it never persists a session of its own.
export const supabaseAuth = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
