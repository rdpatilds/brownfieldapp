import { sql } from "drizzle-orm";
import { Router } from "express";

import { env } from "../config/env";
import { db } from "../database/client";
import { getLogger } from "../logging";

const router = Router();
const logger = getLogger("health");

/**
 * GET /
 * Basic health check endpoint.
 * Always returns 200 - used for load balancer health checks.
 */
router.get("/", (_req, res) => {
  res.json({
    status: "healthy",
    service: "api",
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /db
 * Database health check endpoint.
 * Verifies database connectivity by executing a simple query.
 */
router.get("/db", async (_req, res) => {
  try {
    logger.info("health.db_check_started");

    await db.execute(sql`SELECT 1`);

    logger.info("health.db_check_completed");

    res.json({
      status: "healthy",
      service: "database",
      provider: "supabase",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    logger.error({ error: message }, "health.db_check_failed");

    res.status(503).json({
      status: "unhealthy",
      service: "database",
      error: message,
    });
  }
});

interface CheckResult {
  database: "connected" | "disconnected";
  auth: "configured" | "missing";
}

/**
 * GET /ready
 * Readiness check endpoint.
 * Verifies all dependencies are available before accepting traffic.
 */
router.get("/ready", async (_req, res) => {
  logger.info("health.ready_check_started");

  const checks: CheckResult = {
    database: "disconnected",
    auth: "missing",
  };
  let allHealthy = true;

  // Check database connectivity
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = "connected";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";
    logger.error({ error: message }, "health.ready_db_check_failed");
    allHealthy = false;
  }

  // Check auth configuration
  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
    checks.auth = "configured";
  } else {
    logger.warn("health.ready_auth_config_missing");
    allHealthy = false;
  }

  const status = allHealthy ? "ready" : "not_ready";

  if (allHealthy) {
    logger.info({ checks }, "health.ready_check_completed");
  } else {
    logger.warn({ checks }, "health.ready_check_failed");
  }

  res.status(allHealthy ? 200 : 503).json({
    status,
    environment: env.NODE_ENV,
    checks,
  });
});

export { router as healthRouter };
