import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { env } from "../config/env";

/**
 * Create a Supabase client authenticated with a user's access token.
 * Used in backend services where cookies are not available.
 *
 * @param accessToken - The user's JWT access token from the Authorization header
 */
export function createClient(accessToken: string) {
  return createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
