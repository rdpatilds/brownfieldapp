"use client";

import { io, type Socket } from "socket.io-client";

import { createClient } from "@/core/supabase/client";

const BACKEND_URL = process.env["NEXT_PUBLIC_BACKEND_URL"] ?? "http://localhost:4000";

let socket: Socket | null = null;

/**
 * Get or create a singleton Socket.IO client connected to the backend.
 * Authenticates using the current Supabase session token.
 */
export async function getSocket(): Promise<Socket> {
  if (socket?.connected) {
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

  // Handle token refresh on reconnection
  supabase.auth.onAuthStateChange((_event, newSession) => {
    if (socket && newSession?.access_token) {
      socket.auth = { token: newSession.access_token };
    }
  });

  return socket;
}

/**
 * Disconnect and clean up the socket connection.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
