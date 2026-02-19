import { count, desc, eq, sql } from "drizzle-orm";

import { db } from "../../database/client";

import type { NewTokenTransaction, TokenBalance, TokenTransaction } from "./models";
import { balances, transactions } from "./models";

export async function getBalance(userId: string): Promise<number | undefined> {
  const results = await db
    .select({ balance: balances.balance })
    .from(balances)
    .where(eq(balances.userId, userId))
    .limit(1);
  return results[0]?.balance;
}

export async function initializeBalance(
  userId: string,
  initialBalance: number,
): Promise<TokenBalance> {
  const results = await db.insert(balances).values({ userId, balance: initialBalance }).returning();
  const row = results[0];
  if (!row) {
    throw new Error("Failed to initialize balance");
  }
  return row;
}

export async function creditTokens(userId: string, amount: number): Promise<number> {
  const results = await db
    .update(balances)
    .set({
      balance: sql`${balances.balance} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(balances.userId, userId))
    .returning({ balance: balances.balance });
  const row = results[0];
  if (!row) {
    throw new Error("Failed to credit tokens: balance row not found");
  }
  return row.balance;
}

export async function debitToken(userId: string): Promise<number | null> {
  const result = await db.execute(
    sql`UPDATE token_balances SET balance = balance - 1, updated_at = now() WHERE user_id = ${userId} AND balance > 0 RETURNING balance`,
  );
  const rows = result as unknown as Array<{ balance: number }>;
  if (rows.length === 0) {
    return null;
  }
  const row = rows[0];
  return row ? row.balance : null;
}

export async function recordTransaction(data: NewTokenTransaction): Promise<TokenTransaction> {
  const results = await db.insert(transactions).values(data).returning();
  const row = results[0];
  if (!row) {
    throw new Error("Failed to record transaction");
  }
  return row;
}

export async function getTransactions(
  userId: string,
  limit: number,
  offset: number,
): Promise<TokenTransaction[]> {
  return db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getTransactionCount(userId: string): Promise<number> {
  const results = await db
    .select({ count: count() })
    .from(transactions)
    .where(eq(transactions.userId, userId));
  return results[0]?.count ?? 0;
}
