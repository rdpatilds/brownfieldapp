import { beforeEach, describe, expect, it, mock } from "bun:test";
import { NextRequest } from "next/server";

// Mock user type
type MockUser = { id: string; email: string } | null;
const mockUser: MockUser = { id: "user-123", email: "test@example.com" };

// Mock Supabase auth
const mockGetUser = mock<() => Promise<{ data: { user: MockUser }; error: null }>>(() =>
  Promise.resolve({ data: { user: mockUser }, error: null }),
);
mock.module("@/core/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
      },
    }),
}));

// Mock Chargebee
const mockCheckoutOneTime = mock(() =>
  Promise.resolve({ hosted_page: { url: "https://checkout.chargebee.com/pages/v3/test" } }),
);
mock.module("@/features/billing/chargebee", () => ({
  chargebee: {
    hostedPage: {
      checkoutOneTime: mockCheckoutOneTime,
    },
  },
}));

// Mock billing service (needed because chargebee module imports from billing)
mock.module("@/features/billing/repository", () => ({}));
mock.module("@/features/billing/service", () => ({
  consumeToken: mock(() => Promise.resolve(9)),
  refundToken: mock(() => Promise.resolve()),
  grantSignupTokens: mock(() => Promise.resolve()),
  getTokenBalance: mock(() => Promise.resolve(10)),
  getTransactionHistory: mock(() => Promise.resolve({ transactions: [], total: 0 })),
  creditPurchasedTokens: mock(() => Promise.resolve()),
}));

const { POST } = await import("./route");

describe("POST /api/billing/checkout", () => {
  beforeEach(() => {
    mockGetUser.mockClear();
    mockCheckoutOneTime.mockClear();
  });

  it("returns checkout URL for valid pack", async () => {
    const request = new NextRequest("http://localhost:3000/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ packId: "pack-50" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.url).toBe("https://checkout.chargebee.com/pages/v3/test");
    expect(mockCheckoutOneTime).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for invalid pack", async () => {
    const request = new NextRequest("http://localhost:3000/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ packId: "pack-999" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("VALIDATION_ERROR");
  });

  it("returns 401 for unauthenticated user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const request = new NextRequest("http://localhost:3000/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ packId: "pack-50" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe("UNAUTHORIZED");
  });
});
