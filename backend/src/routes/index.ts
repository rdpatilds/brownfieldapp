import type { Express } from "express";

import { authMiddleware } from "../middleware/auth";
import { errorHandler } from "../middleware/error-handler";
import { billingRouter } from "./billing";
import { chatRouter } from "./chat";
import { documentsRouter } from "./documents";
import { healthRouter } from "./health";
import { projectsRouter } from "./projects";
import { webhooksRouter } from "./webhooks";

export function setupRoutes(app: Express): void {
  // Public routes (no auth required)
  app.use("/api/health", healthRouter);
  app.use("/api/webhooks", webhooksRouter);

  // Protected routes (auth required)
  app.use("/api/chat/conversations", authMiddleware, chatRouter);
  app.use("/api/billing", authMiddleware, billingRouter);
  app.use("/api/projects", authMiddleware, projectsRouter);
  app.use("/api/documents", authMiddleware, documentsRouter);

  // Error handler must be registered last
  app.use(errorHandler);
}
