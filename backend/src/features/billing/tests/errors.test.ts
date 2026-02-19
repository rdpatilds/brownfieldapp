import { describe, expect, it } from "vitest";

import {
  BillingError,
  ChargebeeError,
  InsufficientTokensError,
  InvalidPackError,
  WebhookVerificationError,
} from "../errors";

describe("BillingError", () => {
  it("creates error with message, code, and status", () => {
    const error = new BillingError("Test error", "INSUFFICIENT_TOKENS", 402);
    expect(error.message).toBe("Test error");
    expect(error.code).toBe("INSUFFICIENT_TOKENS");
    expect(error.statusCode).toBe(402);
    expect(error.name).toBe("BillingError");
  });

  it("is instanceof Error", () => {
    const error = new BillingError("Test", "INSUFFICIENT_TOKENS", 402);
    expect(error).toBeInstanceOf(Error);
  });
});

describe("InsufficientTokensError", () => {
  it("creates error with correct defaults", () => {
    const error = new InsufficientTokensError();
    expect(error.message).toBe("Insufficient tokens");
    expect(error.code).toBe("INSUFFICIENT_TOKENS");
    expect(error.statusCode).toBe(402);
    expect(error.name).toBe("InsufficientTokensError");
  });

  it("is instanceof BillingError", () => {
    const error = new InsufficientTokensError();
    expect(error).toBeInstanceOf(BillingError);
  });
});

describe("InvalidPackError", () => {
  it("creates error with pack ID in message", () => {
    const error = new InvalidPackError("pack-999");
    expect(error.message).toBe("Invalid token pack: pack-999");
    expect(error.code).toBe("INVALID_PACK");
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe("InvalidPackError");
  });

  it("is instanceof BillingError", () => {
    const error = new InvalidPackError("id");
    expect(error).toBeInstanceOf(BillingError);
  });
});

describe("ChargebeeError", () => {
  it("creates error with custom message", () => {
    const error = new ChargebeeError("Payment failed");
    expect(error.message).toBe("Payment failed");
    expect(error.code).toBe("CHARGEBEE_ERROR");
    expect(error.statusCode).toBe(502);
    expect(error.name).toBe("ChargebeeError");
  });

  it("is instanceof BillingError", () => {
    const error = new ChargebeeError("msg");
    expect(error).toBeInstanceOf(BillingError);
  });
});

describe("WebhookVerificationError", () => {
  it("creates error with correct defaults", () => {
    const error = new WebhookVerificationError();
    expect(error.message).toBe("Webhook verification failed");
    expect(error.code).toBe("WEBHOOK_VERIFICATION_FAILED");
    expect(error.statusCode).toBe(401);
    expect(error.name).toBe("WebhookVerificationError");
  });

  it("is instanceof BillingError", () => {
    const error = new WebhookVerificationError();
    expect(error).toBeInstanceOf(BillingError);
  });
});
