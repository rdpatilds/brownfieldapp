import type { User } from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";

import { getLogger } from "../logging";
import { createClient } from "../supabase/server";

const logger = getLogger("middleware.auth");

/**
 * Express Request extended with authenticated user information.
 */
export interface AuthRequest extends Request {
  user: User;
  accessToken: string;
}

/**
 * Extract Bearer token from the Authorization header.
 */
function extractBearerToken(authHeader: string | undefined): string | undefined {
  if (!authHeader) {
    return undefined;
  }
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return undefined;
  }
  return parts[1];
}

/**
 * Express middleware that validates the Bearer token via Supabase Auth.
 * Attaches the authenticated user and access token to the request.
 *
 * Returns 401 JSON response if no token is provided or if the token is invalid.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    logger.warn("auth.missing_token");
    res.status(401).json({ error: "Authentication required", code: "UNAUTHORIZED" });
    return;
  }

  const supabase = createClient(token);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    logger.warn({ error: error?.message }, "auth.invalid_token");
    res.status(401).json({ error: "Invalid or expired token", code: "UNAUTHORIZED" });
    return;
  }

  (req as AuthRequest).user = data.user;
  (req as AuthRequest).accessToken = token;

  next();
}
