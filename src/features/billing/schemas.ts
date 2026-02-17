import { z } from "zod/v4";

import { TOKEN_PACKS } from "./constants";

const validPackIds = TOKEN_PACKS.map((p) => p.id) as [string, ...string[]];

export const PurchaseTokensSchema = z.object({
  packId: z.enum(validPackIds),
});

export type PurchaseTokensInput = z.infer<typeof PurchaseTokensSchema>;

export const TokenBalanceResponseSchema = z.object({
  balance: z.number().int().min(0),
});

export type TokenBalanceResponse = z.infer<typeof TokenBalanceResponseSchema>;

export const TokenTransactionResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  amount: z.number().int(),
  type: z.string(),
  referenceId: z.string().nullable(),
  description: z.string().nullable(),
  balanceAfter: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TokenTransactionResponse = z.infer<typeof TokenTransactionResponseSchema>;
