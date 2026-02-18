import { beforeEach, describe, expect, it, mock } from "bun:test";

import type { TokenBalance, TokenTransaction } from "../models";

// Mock the repository module with properly typed functions
const mockRepository = {
  getBalance: mock<(userId: string) => Promise<number | undefined>>(() =>
    Promise.resolve(undefined),
  ),
  initializeBalance: mock<(userId: string, balance: number) => Promise<TokenBalance>>(() =>
    Promise.resolve({} as TokenBalance),
  ),
  creditTokens: mock<(userId: string, amount: number) => Promise<number>>(() => Promise.resolve(0)),
  debitToken: mock<(userId: string) => Promise<number | null>>(() => Promise.resolve(null)),
  recordTransaction: mock<(data: unknown) => Promise<TokenTransaction>>(() =>
    Promise.resolve({} as TokenTransaction),
  ),
  getTransactions: mock<
    (userId: string, limit: number, offset: number) => Promise<TokenTransaction[]>
  >(() => Promise.resolve([])),
  getTransactionCount: mock<(userId: string) => Promise<number>>(() => Promise.resolve(0)),
};

// Mock the repository before importing service
mock.module("../repository", () => mockRepository);

// Import service after mocking
const {
  consumeToken,
  creditPurchasedTokens,
  getTokenBalance,
  getTransactionHistory,
  grantSignupTokens,
  refundToken,
} = await import("../service");

const userId = "550e8400-e29b-41d4-a716-446655440001";
const conversationId = "550e8400-e29b-41d4-a716-446655440010";

describe("grantSignupTokens", () => {
  beforeEach(() => {
    mockRepository.initializeBalance.mockReset();
    mockRepository.recordTransaction.mockReset();
  });

  it("initializes balance with free tokens and records transaction", async () => {
    mockRepository.initializeBalance.mockResolvedValue({
      userId,
      balance: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockRepository.recordTransaction.mockResolvedValue({} as TokenTransaction);

    await grantSignupTokens(userId);

    expect(mockRepository.initializeBalance).toHaveBeenCalledWith(userId, 10);
    expect(mockRepository.recordTransaction).toHaveBeenCalledTimes(1);
  });
});

describe("getTokenBalance", () => {
  beforeEach(() => {
    mockRepository.getBalance.mockReset();
    mockRepository.initializeBalance.mockReset();
  });

  it("returns existing balance", async () => {
    mockRepository.getBalance.mockResolvedValue(42);

    const result = await getTokenBalance(userId);

    expect(result).toBe(42);
  });

  it("creates row with 0 balance when none exists", async () => {
    mockRepository.getBalance.mockResolvedValue(undefined);
    mockRepository.initializeBalance.mockResolvedValue({
      userId,
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await getTokenBalance(userId);

    expect(result).toBe(0);
    expect(mockRepository.initializeBalance).toHaveBeenCalledWith(userId, 0);
  });
});

describe("consumeToken", () => {
  beforeEach(() => {
    mockRepository.debitToken.mockReset();
    mockRepository.recordTransaction.mockReset();
  });

  it("debits one token and records transaction", async () => {
    mockRepository.debitToken.mockResolvedValue(9);
    mockRepository.recordTransaction.mockResolvedValue({} as TokenTransaction);

    const remaining = await consumeToken(userId, conversationId);

    expect(remaining).toBe(9);
    expect(mockRepository.debitToken).toHaveBeenCalledWith(userId);
    expect(mockRepository.recordTransaction).toHaveBeenCalledTimes(1);
  });

  it("throws InsufficientTokensError when debit fails", async () => {
    mockRepository.debitToken.mockResolvedValue(null);

    await expect(consumeToken(userId, conversationId)).rejects.toThrow("Insufficient tokens");
  });
});

describe("refundToken", () => {
  beforeEach(() => {
    mockRepository.creditTokens.mockReset();
    mockRepository.recordTransaction.mockReset();
  });

  it("credits one token and records transaction", async () => {
    mockRepository.creditTokens.mockResolvedValue(10);
    mockRepository.recordTransaction.mockResolvedValue({} as TokenTransaction);

    await refundToken(userId, conversationId);

    expect(mockRepository.creditTokens).toHaveBeenCalledWith(userId, 1);
    expect(mockRepository.recordTransaction).toHaveBeenCalledTimes(1);
  });
});

describe("creditPurchasedTokens", () => {
  beforeEach(() => {
    mockRepository.creditTokens.mockReset();
    mockRepository.recordTransaction.mockReset();
  });

  it("credits tokens for valid pack", async () => {
    mockRepository.creditTokens.mockResolvedValue(60);
    mockRepository.recordTransaction.mockResolvedValue({} as TokenTransaction);

    await creditPurchasedTokens(userId, "pack-50", "inv-123");

    expect(mockRepository.creditTokens).toHaveBeenCalledWith(userId, 50);
    expect(mockRepository.recordTransaction).toHaveBeenCalledTimes(1);
  });

  it("credits correct tokens for pack-150", async () => {
    mockRepository.creditTokens.mockResolvedValue(160);
    mockRepository.recordTransaction.mockResolvedValue({} as TokenTransaction);

    await creditPurchasedTokens(userId, "pack-150", "inv-456");

    expect(mockRepository.creditTokens).toHaveBeenCalledWith(userId, 150);
  });

  it("credits correct tokens for pack-500", async () => {
    mockRepository.creditTokens.mockResolvedValue(510);
    mockRepository.recordTransaction.mockResolvedValue({} as TokenTransaction);

    await creditPurchasedTokens(userId, "pack-500", "inv-789");

    expect(mockRepository.creditTokens).toHaveBeenCalledWith(userId, 500);
  });

  it("throws InvalidPackError for unknown pack", async () => {
    await expect(creditPurchasedTokens(userId, "pack-999", "inv-000")).rejects.toThrow(
      "Invalid token pack: pack-999",
    );
  });
});

describe("getTransactionHistory", () => {
  beforeEach(() => {
    mockRepository.getTransactions.mockReset();
    mockRepository.getTransactionCount.mockReset();
  });

  it("returns transactions and total count", async () => {
    const mockTxns = [
      {
        id: "tx-1",
        userId,
        amount: -1,
        type: "chat_message",
        referenceId: "conv-1",
        description: "AI turn",
        balanceAfter: 9,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as TokenTransaction[];

    mockRepository.getTransactions.mockResolvedValue(mockTxns);
    mockRepository.getTransactionCount.mockResolvedValue(15);

    const result = await getTransactionHistory(userId, 1, 10);

    expect(result.transactions).toEqual(mockTxns);
    expect(result.total).toBe(15);
    expect(mockRepository.getTransactions).toHaveBeenCalledWith(userId, 10, 0);
    expect(mockRepository.getTransactionCount).toHaveBeenCalledWith(userId);
  });

  it("calculates correct offset for page 2", async () => {
    mockRepository.getTransactions.mockResolvedValue([]);
    mockRepository.getTransactionCount.mockResolvedValue(0);

    await getTransactionHistory(userId, 2, 20);

    expect(mockRepository.getTransactions).toHaveBeenCalledWith(userId, 20, 20);
  });

  it("returns empty results", async () => {
    mockRepository.getTransactions.mockResolvedValue([]);
    mockRepository.getTransactionCount.mockResolvedValue(0);

    const result = await getTransactionHistory(userId, 1, 10);

    expect(result.transactions).toEqual([]);
    expect(result.total).toBe(0);
  });
});
