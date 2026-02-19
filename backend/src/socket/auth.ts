import type { Socket } from "socket.io";

import { getLogger } from "../logging";
import { createClient } from "../supabase/server";

const logger = getLogger("socket.auth");

/**
 * Socket.IO middleware that authenticates connections via Supabase.
 * Extracts the access token from `socket.handshake.auth.token`,
 * verifies it with Supabase, and attaches the user to `socket.data`.
 */
export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
): Promise<void> {
  const token = socket.handshake.auth["token"] as string | undefined;

  if (!token) {
    logger.warn({ socketId: socket.id }, "socket.auth_missing_token");
    next(new Error("Authentication required: no token provided"));
    return;
  }

  try {
    const supabase = createClient(token);
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      logger.warn({ socketId: socket.id, error: error?.message }, "socket.auth_invalid_token");
      next(new Error("Authentication failed: invalid or expired token"));
      return;
    }

    socket.data.user = data.user;
    logger.info({ socketId: socket.id, userId: data.user.id }, "socket.auth_completed");
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown auth error";
    logger.error({ socketId: socket.id, error: message }, "socket.auth_failed");
    next(new Error("Authentication failed: internal error"));
  }
}
