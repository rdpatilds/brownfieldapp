"use client";

import { io, type Socket } from "socket.io-client";

import { createClient } from "@/core/supabase/client";

const BACKEND_URL = process.env["NEXT_PUBLIC_BACKEND_URL"] ?? "http://localhost:4000";

let socket: Socket | null = null;
let authSubscription: { unsubscribe: () => void } | null = null;

/**
 * Get or create a singleton Socket.IO client connected to the backend.
 * Authenticates using the current Supabase session token.
 */
export async function getSocket(): Promise<Socket> {
  // Return existing socket even if still connecting — prevents duplicate sockets
  if (socket) {
    return socket;
  }

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("No active session for socket connection");
  }

  socket = io(BACKEND_URL, {
    auth: { token: session.access_token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  // Clean up previous subscription before creating a new one
  authSubscription?.unsubscribe();

  // Handle token refresh on reconnection
  const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
    if (socket && newSession?.access_token) {
      socket.auth = { token: newSession.access_token };
    }
  });
  authSubscription = data.subscription;

  return socket;
}

/**
 * Disconnect and clean up the socket connection.
 */
export function disconnectSocket(): void {
  authSubscription?.unsubscribe();
  authSubscription = null;
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
