import { createErrorResponse } from "@chatapp/shared";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod/v4";

import { getLogger } from "../logging";

const logger = getLogger("middleware.error-handler");

/**
 * Valid HTTP status codes for API errors.
 */
export type HttpStatusCode = 400 | 401 | 402 | 403 | 404 | 409 | 500 | 502;

/**
 * Shape of errors that carry HTTP semantics.
 * Used for type narrowing in error handlers.
 */
interface HttpError {
  message: string;
  code: string;
  statusCode: HttpStatusCode;
}

const VALID_STATUS_CODES = new Set<HttpStatusCode>([400, 401, 402, 403, 404, 409, 500, 502]);

/**
 * Check if an error has HTTP error properties.
 */
function isHttpError(error: unknown): error is HttpError {
  if (!(error instanceof Error)) {
    return false;
  }
  if (!("code" in error) || !("statusCode" in error)) {
    return false;
  }

  const { code, statusCode } = error as { code: unknown; statusCode: unknown };
  return typeof code === "string" && VALID_STATUS_CODES.has(statusCode as HttpStatusCode);
}

/**
 * Format Zod validation errors into a details object.
 */
function formatZodErrors(error: ZodError): Record<string, unknown> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".") || "root";
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(issue.message);
  }

  return { fields: fieldErrors };
}

/**
 * Express error-handling middleware.
 * Maps known error types to HTTP status codes and returns standardized error responses.
 *
 * Must be registered after all routes as Express identifies error middleware
 * by its four-parameter signature (err, req, res, next).
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    logger.warn({ error: err.message }, "api.validation_failed");
    res
      .status(400)
      .json(createErrorResponse("Validation failed", "VALIDATION_ERROR", formatZodErrors(err)));
    return;
  }

  // Handle feature errors with HTTP semantics
  if (isHttpError(err)) {
    const level = err.statusCode >= 500 ? "error" : "warn";
    logger[level]({ error: err.message, code: err.code }, "api.error");
    res.status(err.statusCode).json(createErrorResponse(err.message, err.code));
    return;
  }

  // Handle unknown errors
  const message = err instanceof Error ? err.message : "Unknown error";
  logger.error({ error: message }, "api.internal_error");
  res.status(500).json(createErrorResponse("Internal server error", "INTERNAL_ERROR"));
}
