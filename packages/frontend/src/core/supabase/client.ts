"use client";

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
const supabaseKey =
  process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] ??
  process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!;

/**
 * Create a Supabase client for Client Components.
 * Use this in "use client" components.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}
