import { pool } from "../../../db/shared/pool.js";

/**
 * LA-UX-REFRESH-001 F4 — "in the new register form ... if the email id
 * already exists it must show a message that the user email already exists."
 *
 * Answers one question and nothing else: is this address already registered?
 * No name, no status, no id — a bare boolean, so the endpoint cannot become
 * a way to read anything about an account it says exists.
 *
 * `auth.users` is the authoritative table: Supabase Auth writes it the moment
 * a signup starts, before this app's own provisioning has created the
 * matching `core.app_user` row. `core.app_user` is still checked as well
 * because a seeded/imported account can exist there first. `exists` on both
 * sides short-circuits — neither query ever reads a row.
 */
export async function isEmailRegistered(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  const result = await pool.query<{ registered: boolean }>(
    `select (
       exists (select 1 from auth.users where lower(email) = $1)
       or exists (select 1 from core.app_user where lower(email) = $1)
     ) as registered`,
    [normalized]
  );

  return result.rows[0]?.registered === true;
}

/**
 * Fixed-window limiter, per client IP, kept in memory.
 *
 * The point is to stop this endpoint being used to enumerate which addresses
 * hold accounts — a normal registration types one address, maybe corrects it
 * a few times; 30 lookups a minute is far beyond that and far below anything
 * useful for a sweep. In memory rather than in Redis because this process is
 * the only thing serving the route, and a limiter that resets on deploy is
 * still the difference between "a script can try 10 addresses a second" and
 * "it cannot".
 */
const WINDOW_MS = 60_000;
const MAX_LOOKUPS_PER_WINDOW = 30;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkEmailLookupAllowed(clientKey: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(clientKey);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(clientKey, { count: 1, resetAt: now + WINDOW_MS });
    // Sweep expired buckets opportunistically so a long-running process
    // doesn't accumulate one entry per IP it has ever seen.
    if (buckets.size > 5000) {
      for (const [key, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(key);
      }
    }
    return true;
  }

  if (bucket.count >= MAX_LOOKUPS_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}
