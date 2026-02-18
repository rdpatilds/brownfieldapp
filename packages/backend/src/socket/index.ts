import type { Server as HttpServer } from "node:http";

import { Server } from "socket.io";

import { env } from "../config/env";
import { getLogger } from "../logging";
import { socketAuthMiddleware } from "./auth";
import { registerChatHandlers } from "./chat-handler";

const logger = getLogger("socket");

/**
 * Create and configure the Socket.IO server.
 * Attaches auth middleware and registers event handlers for each connection.
 */
export function setupSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.FRONTEND_URL, credentials: true },
  });

  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "socket.connected");

    registerChatHandlers(socket);

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "socket.disconnected");
    });
  });

  return io;
}
