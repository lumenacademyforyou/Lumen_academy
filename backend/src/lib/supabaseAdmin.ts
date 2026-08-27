import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config/env.js";

// Server-only admin client, separate from backend/supabaseClient.ts (which
// only ever verifies a caller's own token). This one uses the service-role
// key: elevated privileges, bypasses RLS, can call the Auth Admin API
// (createUser, etc.). Never import this from anything that runs per-request
// on a student-facing path — it's for admin scripts only (db/scripts/,
// db/seed/).
//
// IMPORTANT: this client's .from()/.rpc() calls only reach the `public`
// schema via PostgREST — catalog/core/content/assess/learn are deliberately
// NOT exposed to PostgREST (see CLAUDE.md). Data access to those schemas
// goes through db/shared/pool.ts (raw Postgres), not through this client.
// The one thing this client is actually for here is supabaseAdmin.auth.admin.*.
let cached: SupabaseClient | undefined;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  if (!config.supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env (Supabase dashboard -> " +
        "Project Settings -> API -> service_role secret) before running admin scripts."
    );
  }
  cached = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
