import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import {
  tokenBalances as balances,
  tokenTransactions as transactions,
} from "@/core/database/schema";

export { balances, transactions };

export type TokenBalance = InferSelectModel<typeof balances>;
export type NewTokenBalance = InferInsertModel<typeof balances>;
export type TokenTransaction = InferSelectModel<typeof transactions>;
export type NewTokenTransaction = InferInsertModel<typeof transactions>;
