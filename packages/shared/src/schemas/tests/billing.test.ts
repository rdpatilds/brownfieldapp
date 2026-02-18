import { describe, expect, it } from "bun:test";

import {
  PurchaseTokensSchema,
  TokenBalanceResponseSchema,
  TokenTransactionResponseSchema,
} from "../billing";

describe("PurchaseTokensSchema", () => {
  it("validates pack-50", () => {
    const result = PurchaseTokensSchema.parse({ packId: "pack-50" });
    expect(result.packId).toBe("pack-50");
  });

  it("validates pack-150", () => {
    const result = PurchaseTokensSchema.parse({ packId: "pack-150" });
    expect(result.packId).toBe("pack-150");
  });

  it("validates pack-500", () => {
    const result = PurchaseTokensSchema.parse({ packId: "pack-500" });
    expect(result.packId).toBe("pack-500");
  });

  it("rejects invalid pack ID", () => {
    expect(() => PurchaseTokensSchema.parse({ packId: "pack-999" })).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => PurchaseTokensSchema.parse({ packId: "" })).toThrow();
  });

  it("rejects missing packId", () => {
    expect(() => PurchaseTokensSchema.parse({})).toThrow();
  });
});

describe("TokenBalanceResponseSchema", () => {
  it("validates valid balance", () => {
    const result = TokenBalanceResponseSchema.parse({ balance: 10 });
    expect(result.balance).toBe(10);
  });

  it("validates zero balance", () => {
    const result = TokenBalanceResponseSchema.parse({ balance: 0 });
    expect(result.balance).toBe(0);
  });

  it("rejects negative balance", () => {
    expect(() => TokenBalanceResponseSchema.parse({ balance: -1 })).toThrow();
  });

  it("rejects non-integer balance", () => {
    expect(() => TokenBalanceResponseSchema.parse({ balance: 1.5 })).toThrow();
  });
});

describe("TokenTransactionResponseSchema", () => {
  it("validates valid transaction", () => {
    const now = new Date();
    const result = TokenTransactionResponseSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      userId: "550e8400-e29b-41d4-a716-446655440001",
      amount: -1,
      type: "chat_message",
      referenceId: "conv-123",
      description: "AI conversation turn",
      balanceAfter: 9,
      createdAt: now,
      updatedAt: now,
    });
    expect(result.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(result.amount).toBe(-1);
    expect(result.type).toBe("chat_message");
  });

  it("accepts null referenceId and description", () => {
    const now = new Date();
    const result = TokenTransactionResponseSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      userId: "550e8400-e29b-41d4-a716-446655440001",
      amount: 10,
      type: "signup_bonus",
      referenceId: null,
      description: null,
      balanceAfter: 10,
      createdAt: now,
      updatedAt: now,
    });
    expect(result.referenceId).toBeNull();
    expect(result.description).toBeNull();
  });

  it("rejects invalid UUID", () => {
    const now = new Date();
    expect(() =>
      TokenTransactionResponseSchema.parse({
        id: "not-a-uuid",
        userId: "550e8400-e29b-41d4-a716-446655440001",
        amount: 10,
        type: "signup_bonus",
        referenceId: null,
        description: null,
        balanceAfter: 10,
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow();
  });
});
