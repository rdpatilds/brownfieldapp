import { createServer } from "node:http";
import express from "express";

import { env } from "./config/env";
import { getLogger } from "./logging";
import { corsMiddleware } from "./middleware/cors";
import { setupRoutes } from "./routes";
import { setupSocket } from "./socket";

const logger = getLogger("server");

const app = express();
app.use(corsMiddleware);
app.use(express.json());

setupRoutes(app);

const httpServer = createServer(app);
setupSocket(httpServer);

httpServer.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "server.started");
});
