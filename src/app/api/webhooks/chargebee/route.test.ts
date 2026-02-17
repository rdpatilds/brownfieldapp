import { beforeEach, describe, expect, it, mock } from "bun:test";
import { NextRequest } from "next/server";

// Mock env
mock.module("@/core/config/env", () => ({
  env: {
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    APP_NAME: "test",
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key",
    DATABASE_URL: "postgres://localhost/test",
    OPENROUTER_API_KEY: "test",
    OPENROUTER_MODEL: "test",
    CHARGEBEE_SITE: "test-site",
    CHARGEBEE_API_KEY: "test-key",
    CHARGEBEE_WEBHOOK_USERNAME: "webhook-user",
    CHARGEBEE_WEBHOOK_PASSWORD: "webhook-pass",
  },
}));

// Mock billing service
const mockCreditPurchasedTokens = mock(() => Promise.resolve());

mock.module("@/features/billing/repository", () => ({}));
mock.module("@/features/billing/service", () => ({
  creditPurchasedTokens: mockCreditPurchasedTokens,
  consumeToken: mock(() => Promise.resolve(9)),
  refundToken: mock(() => Promise.resolve()),
  grantSignupTokens: mock(() => Promise.resolve()),
  getTokenBalance: mock(() => Promise.resolve(10)),
  getTransactionHistory: mock(() => Promise.resolve({ transactions: [], total: 0 })),
}));

const { POST } = await import("./route");

function makeAuthHeader(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

function makeWebhookRequest(body: Record<string, unknown>, authHeader?: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/webhooks/chargebee", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
  });
}

describe("POST /api/webhooks/chargebee", () => {
  beforeEach(() => {
    mockCreditPurchasedTokens.mockClear();
  });

  it("returns 401 for missing auth", async () => {
    const request = makeWebhookRequest({ id: "evt-1", event_type: "payment_succeeded" });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 401 for invalid auth", async () => {
    const request = makeWebhookRequest(
      { id: "evt-1", event_type: "payment_succeeded" },
      makeAuthHeader("wrong", "creds"),
    );

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("processes payment_succeeded event and credits tokens", async () => {
    const request = makeWebhookRequest(
      {
        id: "evt-credit-1",
        event_type: "payment_succeeded",
        content: {
          invoice: {
            id: "inv-123",
            pass_thru_content: JSON.stringify({ packId: "pack-50", userId: "user-abc" }),
          },
        },
      },
      makeAuthHeader("webhook-user", "webhook-pass"),
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(mockCreditPurchasedTokens).toHaveBeenCalledWith("user-abc", "pack-50", "inv-123");
  });

  it("returns 200 for unknown event type without action", async () => {
    const request = makeWebhookRequest(
      { id: "evt-unknown-1", event_type: "subscription_created" },
      makeAuthHeader("webhook-user", "webhook-pass"),
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(mockCreditPurchasedTokens).not.toHaveBeenCalled();
  });

  it("skips duplicate events", async () => {
    const body = {
      id: "evt-dup-test",
      event_type: "payment_succeeded",
      content: {
        invoice: {
          id: "inv-456",
          pass_thru_content: JSON.stringify({ packId: "pack-150", userId: "user-def" }),
        },
      },
    };

    // First call
    const response1 = await POST(
      makeWebhookRequest(body, makeAuthHeader("webhook-user", "webhook-pass")),
    );
    expect(response1.status).toBe(200);

    // Second call with same event ID
    const response2 = await POST(
      makeWebhookRequest(body, makeAuthHeader("webhook-user", "webhook-pass")),
    );
    expect(response2.status).toBe(200);

    // Should only process once
    expect(mockCreditPurchasedTokens).toHaveBeenCalledTimes(1);
  });
});
