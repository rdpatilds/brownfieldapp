import type { HttpStatusCode } from "@/core/api/errors";

/** Known error codes for billing operations. */
export type BillingErrorCode =
  | "INSUFFICIENT_TOKENS"
  | "INVALID_PACK"
  | "CHARGEBEE_ERROR"
  | "WEBHOOK_VERIFICATION_FAILED";

/**
 * Base error for billing-related errors.
 */
export class BillingError extends Error {
  readonly code: BillingErrorCode;
  readonly statusCode: HttpStatusCode;

  constructor(message: string, code: BillingErrorCode, statusCode: HttpStatusCode) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class InsufficientTokensError extends BillingError {
  constructor() {
    super("Insufficient tokens", "INSUFFICIENT_TOKENS", 402);
  }
}

export class InvalidPackError extends BillingError {
  constructor(packId: string) {
    super(`Invalid token pack: ${packId}`, "INVALID_PACK", 400);
  }
}

export class ChargebeeError extends BillingError {
  constructor(message: string) {
    super(message, "CHARGEBEE_ERROR", 502);
  }
}

export class WebhookVerificationError extends BillingError {
  constructor() {
    super("Webhook verification failed", "WEBHOOK_VERIFICATION_FAILED", 401);
  }
}
