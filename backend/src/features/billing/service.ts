import { FREE_SIGNUP_TOKENS, TOKEN_PACKS } from "@/shared/constants";
import { getLogger } from "../../logging";

import { InsufficientTokensError, InvalidPackError } from "./errors";
import type { TokenTransaction } from "./models";
import * as repository from "./repository";

const logger = getLogger("billing.service");

export async function grantSignupTokens(userId: string): Promise<void> {
  logger.info({ userId }, "billing.grant_signup_started");

  await repository.initializeBalance(userId, FREE_SIGNUP_TOKENS);
  await repository.recordTransaction({
    userId,
    amount: FREE_SIGNUP_TOKENS,
    type: "signup_bonus",
    referenceId: null,
    description: `Free signup bonus: ${FREE_SIGNUP_TOKENS} tokens`,
    balanceAfter: FREE_SIGNUP_TOKENS,
  });

  logger.info({ userId, tokens: FREE_SIGNUP_TOKENS }, "billing.grant_signup_completed");
}

export async function getTokenBalance(userId: string): Promise<number> {
  logger.info({ userId }, "billing.get_balance_started");

  const balance = await repository.getBalance(userId);

  if (balance === undefined) {
    await repository.initializeBalance(userId, 0);
    logger.info({ userId, balance: 0 }, "billing.get_balance_completed");
    return 0;
  }

  logger.info({ userId, balance }, "billing.get_balance_completed");
  return balance;
}

export async function consumeToken(userId: string, conversationId: string): Promise<number> {
  logger.info({ userId, conversationId }, "billing.consume_token_started");

  const newBalance = await repository.debitToken(userId);

  if (newBalance === null) {
    logger.warn({ userId, conversationId }, "billing.consume_token_failed");
    throw new InsufficientTokensError();
  }

  await repository.recordTransaction({
    userId,
    amount: -1,
    type: "chat_message",
    referenceId: conversationId,
    description: "AI conversation turn",
    balanceAfter: newBalance,
  });

  logger.info({ userId, conversationId, remaining: newBalance }, "billing.consume_token_completed");
  return newBalance;
}

export async function refundToken(userId: string, conversationId: string): Promise<void> {
  logger.info({ userId, conversationId }, "billing.refund_token_started");

  const newBalance = await repository.creditTokens(userId, 1);
  await repository.recordTransaction({
    userId,
    amount: 1,
    type: "refund",
    referenceId: conversationId,
    description: "Token refund for failed message",
    balanceAfter: newBalance,
  });

  logger.info({ userId, conversationId, balance: newBalance }, "billing.refund_token_completed");
}

export async function creditPurchasedTokens(
  userId: string,
  packId: string,
  chargebeeInvoiceId: string,
): Promise<void> {
  logger.info({ userId, packId, chargebeeInvoiceId }, "billing.credit_purchase_started");

  const pack = TOKEN_PACKS.find((p) => p.id === packId);
  if (!pack) {
    throw new InvalidPackError(packId);
  }

  const newBalance = await repository.creditTokens(userId, pack.tokens);
  await repository.recordTransaction({
    userId,
    amount: pack.tokens,
    type: "purchase",
    referenceId: chargebeeInvoiceId,
    description: `Purchased ${pack.name}`,
    balanceAfter: newBalance,
  });

  logger.info(
    { userId, packId, tokens: pack.tokens, balance: newBalance },
    "billing.credit_purchase_completed",
  );
}

export async function getTransactionHistory(
  userId: string,
  page: number,
  pageSize: number,
): Promise<{ transactions: TokenTransaction[]; total: number }> {
  logger.info({ userId, page, pageSize }, "billing.get_history_started");

  const offset = (page - 1) * pageSize;
  const [txns, total] = await Promise.all([
    repository.getTransactions(userId, pageSize, offset),
    repository.getTransactionCount(userId),
  ]);

  logger.info({ userId, count: txns.length, total }, "billing.get_history_completed");
  return { transactions: txns, total };
}
