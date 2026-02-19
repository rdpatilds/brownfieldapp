"use client";

import { createClient } from "@/core/supabase/client";

const BACKEND_URL = process.env["NEXT_PUBLIC_BACKEND_URL"] ?? "http://localhost:4000";

/**
 * Fetch wrapper that adds Bearer token and points to backend URL.
 * Use this for all REST calls from the frontend to the backend.
 */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${session?.access_token}`,
    },
  });
}
