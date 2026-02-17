import { beforeEach, describe, expect, it, mock } from "bun:test";

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

// Mock billing service
const mockGetTokenBalance = mock(() => Promise.resolve(42));

mock.module("@/features/billing/repository", () => ({}));
mock.module("@/features/billing/service", () => ({
  getTokenBalance: mockGetTokenBalance,
  consumeToken: mock(() => Promise.resolve(9)),
  refundToken: mock(() => Promise.resolve()),
  grantSignupTokens: mock(() => Promise.resolve()),
  getTransactionHistory: mock(() => Promise.resolve({ transactions: [], total: 0 })),
  creditPurchasedTokens: mock(() => Promise.resolve()),
}));

const { GET } = await import("./route");

describe("GET /api/billing/balance", () => {
  beforeEach(() => {
    mockGetUser.mockClear();
    mockGetTokenBalance.mockClear();
  });

  it("returns balance for authenticated user", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.balance).toBe(42);
    expect(mockGetTokenBalance).toHaveBeenCalledWith("user-123");
  });

  it("returns 401 for unauthenticated user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe("UNAUTHORIZED");
  });
});
