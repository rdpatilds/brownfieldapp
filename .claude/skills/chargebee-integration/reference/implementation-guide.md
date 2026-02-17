# ChargeBee Implementation Guide

Step-by-step guide for integrating ChargeBee token billing into the agentic-chat application.

---

## Prerequisites

- ChargeBee account (test site): https://app.chargebee.com/signup
- API key from Settings > Configure Chargebee > API Keys
- Node.js 18+ (already satisfied by this project)

---

## Phase 1: Foundation Setup

### 1.1 Install Dependencies

```bash
bun add chargebee
```

### 1.2 Environment Variables

Add to `.env`:
```env
CHARGEBEE_SITE=your-site-test
CHARGEBEE_API_KEY=test_your_full_access_key
CHARGEBEE_WEBHOOK_USERNAME=your-webhook-username
CHARGEBEE_WEBHOOK_PASSWORD=your-webhook-password
NEXT_PUBLIC_CHARGEBEE_SITE=your-site-test
```

Update `src/core/config/env.ts` to validate these variables.

### 1.3 ChargeBee Client

Create `src/features/billing/chargebee.ts`:

```typescript
import Chargebee from "chargebee";

if (!process.env["CHARGEBEE_SITE"] || !process.env["CHARGEBEE_API_KEY"]) {
  throw new Error("CHARGEBEE_SITE and CHARGEBEE_API_KEY are required");
}

export const chargebee = new Chargebee({
  site: process.env["CHARGEBEE_SITE"],
  apiKey: process.env["CHARGEBEE_API_KEY"],
});
```

---

## Phase 2: Database Schema

### 2.1 Add Tables to Schema

Add to `src/core/database/schema.ts`:

```typescript
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const tokenBalances = pgTable("token_balances", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  balance: integer("balance").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tokenTransactions = pgTable("token_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  chargebeeEventId: text("chargebee_event_id"),
  chargebeeInvoiceId: text("chargebee_invoice_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### 2.2 Generate & Run Migration

```bash
bun run db:generate
bun run db:migrate
```

---

## Phase 3: Feature Slice

### 3.1 Models

`src/features/billing/models.ts`:

```typescript
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { tokenBalances, tokenTransactions } from "@/core/database/schema";

export type TokenBalance = InferSelectModel<typeof tokenBalances>;
export type NewTokenBalance = InferInsertModel<typeof tokenBalances>;
export type TokenTransaction = InferSelectModel<typeof tokenTransactions>;
export type NewTokenTransaction = InferInsertModel<typeof tokenTransactions>;
```

### 3.2 Errors

`src/features/billing/errors.ts`:

```typescript
export class BillingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "BillingError";
  }
}

export class InsufficientTokensError extends BillingError {
  constructor(userId: string) {
    super(
      `Insufficient tokens for user: ${userId}`,
      "INSUFFICIENT_TOKENS",
      402,
    );
  }
}

export class TokenPurchaseFailedError extends BillingError {
  constructor(reason: string) {
    super(
      `Token purchase failed: ${reason}`,
      "TOKEN_PURCHASE_FAILED",
      500,
    );
  }
}

export class CheckoutCreationError extends BillingError {
  constructor(reason: string) {
    super(
      `Failed to create checkout: ${reason}`,
      "CHECKOUT_CREATION_FAILED",
      500,
    );
  }
}
```

### 3.3 Constants

`src/features/billing/constants.ts`:

```typescript
/**
 * Mapping from ChargeBee item price IDs to token amounts.
 * Update this when adding new token packs in ChargeBee.
 */
export const TOKEN_PACKS: Record<string, { tokens: number; label: string; priceUsd: number }> = {
  "token-pack-100-USD": { tokens: 100, label: "100 Tokens", priceUsd: 4.99 },
  "token-pack-500-USD": { tokens: 500, label: "500 Tokens", priceUsd: 19.99 },
  "token-pack-1000-USD": { tokens: 1000, label: "1000 Tokens", priceUsd: 34.99 },
};

/** Default tokens given to new users (free tier). */
export const DEFAULT_FREE_TOKENS = 10;

/** Approximate tokens consumed per chat message (input + output). */
export const TOKENS_PER_MESSAGE = 1;
```

### 3.4 Schemas

`src/features/billing/schemas.ts`:

```typescript
import { z } from "zod/v4";

export const CreateCheckoutSchema = z.object({
  itemPriceId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
});

export const WebhookEventSchema = z.object({
  id: z.string(),
  event_type: z.string(),
  occurred_at: z.number(),
  content: z.record(z.string(), z.unknown()),
});

export type CreateCheckoutInput = z.infer<typeof CreateCheckoutSchema>;
```

### 3.5 Repository

`src/features/billing/repository.ts`:

```typescript
import { eq, sql, desc } from "drizzle-orm";
import { db } from "@/core/database";
import { tokenBalances, tokenTransactions } from "@/core/database/schema";
import type { NewTokenTransaction } from "./models";

export async function getBalance(userId: string): Promise<number> {
  const results = await db
    .select({ balance: tokenBalances.balance })
    .from(tokenBalances)
    .where(eq(tokenBalances.userId, userId))
    .limit(1);

  return results[0]?.balance ?? 0;
}

export async function ensureBalanceExists(userId: string): Promise<void> {
  await db
    .insert(tokenBalances)
    .values({ userId, balance: 0 })
    .onConflictDoNothing();
}

export async function addTokens(userId: string, amount: number): Promise<number> {
  await ensureBalanceExists(userId);

  const results = await db
    .update(tokenBalances)
    .set({
      balance: sql`${tokenBalances.balance} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(tokenBalances.userId, userId))
    .returning({ balance: tokenBalances.balance });

  return results[0]?.balance ?? 0;
}

export async function deductTokens(userId: string, amount: number): Promise<number> {
  const results = await db
    .update(tokenBalances)
    .set({
      balance: sql`GREATEST(${tokenBalances.balance} - ${amount}, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(tokenBalances.userId, userId))
    .returning({ balance: tokenBalances.balance });

  return results[0]?.balance ?? 0;
}

export async function createTransaction(data: NewTokenTransaction): Promise<void> {
  await db.insert(tokenTransactions).values(data);
}

export async function findTransactionByEventId(eventId: string): Promise<boolean> {
  const results = await db
    .select({ id: tokenTransactions.id })
    .from(tokenTransactions)
    .where(eq(tokenTransactions.chargebeeEventId, eventId))
    .limit(1);

  return results.length > 0;
}

export async function listTransactions(
  userId: string,
  limit = 20,
  offset = 0,
): Promise<{ transactions: typeof tokenTransactions.$inferSelect[]; total: number }> {
  const [transactions, countResult] = await Promise.all([
    db
      .select()
      .from(tokenTransactions)
      .where(eq(tokenTransactions.userId, userId))
      .orderBy(desc(tokenTransactions.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(tokenTransactions)
      .where(eq(tokenTransactions.userId, userId)),
  ]);

  return {
    transactions,
    total: countResult[0]?.count ?? 0,
  };
}
```

### 3.6 Service

`src/features/billing/service.ts`:

```typescript
import { getLogger } from "@/core/logging";
import { chargebee } from "./chargebee";
import { TOKEN_PACKS, TOKENS_PER_MESSAGE, DEFAULT_FREE_TOKENS } from "./constants";
import { InsufficientTokensError, CheckoutCreationError } from "./errors";
import * as repository from "./repository";

const logger = getLogger("billing.service");

export async function createCheckout(
  itemPriceId: string,
  quantity: number,
  customerId?: string,
) {
  logger.info({ itemPriceId, quantity, customerId }, "checkout.create_started");

  try {
    const result = await chargebee.hostedPage.checkoutOneTimeForItems({
      item_prices: [{ item_price_id: itemPriceId, quantity }],
      customer: customerId ? { id: customerId } : undefined,
    });

    logger.info(
      { hostedPageId: result.hosted_page.id },
      "checkout.create_completed",
    );
    return result.hosted_page;
  } catch (error) {
    logger.error({ itemPriceId, error }, "checkout.create_failed");
    throw new CheckoutCreationError(
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

export async function getBalance(userId: string): Promise<number> {
  return repository.getBalance(userId);
}

export async function initializeBalance(userId: string): Promise<void> {
  await repository.ensureBalanceExists(userId);
  if (DEFAULT_FREE_TOKENS > 0) {
    await repository.addTokens(userId, DEFAULT_FREE_TOKENS);
    await repository.createTransaction({
      userId,
      amount: DEFAULT_FREE_TOKENS,
      type: "bonus",
      description: "Welcome bonus tokens",
    });
  }
}

export async function addTokensForPurchase(
  userId: string,
  itemPriceId: string,
  quantity: number,
  eventId: string,
  invoiceId: string,
): Promise<number> {
  logger.info({ userId, itemPriceId, quantity, eventId }, "tokens.add_started");

  // Idempotency check
  const alreadyProcessed = await repository.findTransactionByEventId(eventId);
  if (alreadyProcessed) {
    logger.info({ eventId }, "tokens.add_duplicate_skipped");
    return repository.getBalance(userId);
  }

  const pack = TOKEN_PACKS[itemPriceId];
  if (!pack) {
    logger.warn({ itemPriceId }, "tokens.unknown_item_price");
    return repository.getBalance(userId);
  }

  const totalTokens = pack.tokens * quantity;

  await repository.ensureBalanceExists(userId);
  const newBalance = await repository.addTokens(userId, totalTokens);

  await repository.createTransaction({
    userId,
    amount: totalTokens,
    type: "purchase",
    description: `Purchased ${totalTokens} tokens (${pack.label} x${quantity})`,
    chargebeeEventId: eventId,
    chargebeeInvoiceId: invoiceId,
  });

  logger.info(
    { userId, totalTokens, newBalance, eventId },
    "tokens.add_completed",
  );
  return newBalance;
}

export async function deductTokensForUsage(
  userId: string,
  tokensUsed: number,
  description: string,
): Promise<number> {
  logger.info({ userId, tokensUsed }, "tokens.deduct_started");

  const currentBalance = await repository.getBalance(userId);
  if (currentBalance < tokensUsed) {
    throw new InsufficientTokensError(userId);
  }

  const newBalance = await repository.deductTokens(userId, tokensUsed);

  await repository.createTransaction({
    userId,
    amount: -tokensUsed,
    type: "usage",
    description,
  });

  logger.info(
    { userId, tokensUsed, newBalance },
    "tokens.deduct_completed",
  );
  return newBalance;
}

export async function checkAndDeductForChat(userId: string): Promise<{
  allowed: boolean;
  balance: number;
}> {
  const balance = await repository.getBalance(userId);

  if (balance < TOKENS_PER_MESSAGE) {
    return { allowed: false, balance };
  }

  const newBalance = await deductTokensForUsage(
    userId,
    TOKENS_PER_MESSAGE,
    "AI chat message",
  );

  return { allowed: true, balance: newBalance };
}

export async function refundTokens(
  userId: string,
  itemPriceId: string,
  quantity: number,
  eventId: string,
  invoiceId: string,
): Promise<number> {
  logger.info({ userId, itemPriceId, eventId }, "tokens.refund_started");

  const alreadyProcessed = await repository.findTransactionByEventId(eventId);
  if (alreadyProcessed) {
    logger.info({ eventId }, "tokens.refund_duplicate_skipped");
    return repository.getBalance(userId);
  }

  const pack = TOKEN_PACKS[itemPriceId];
  if (!pack) return repository.getBalance(userId);

  const totalTokens = pack.tokens * quantity;
  const newBalance = await repository.deductTokens(userId, totalTokens);

  await repository.createTransaction({
    userId,
    amount: -totalTokens,
    type: "refund",
    description: `Refund: ${totalTokens} tokens`,
    chargebeeEventId: eventId,
    chargebeeInvoiceId: invoiceId,
  });

  logger.info(
    { userId, totalTokens, newBalance, eventId },
    "tokens.refund_completed",
  );
  return newBalance;
}

export async function getTransactionHistory(
  userId: string,
  limit = 20,
  offset = 0,
) {
  return repository.listTransactions(userId, limit, offset);
}
```

### 3.7 Index (Public API)

`src/features/billing/index.ts`:

```typescript
// Types
export type { TokenBalance, TokenTransaction } from "./models";

// Schemas
export { CreateCheckoutSchema } from "./schemas";

// Errors
export {
  BillingError,
  InsufficientTokensError,
  TokenPurchaseFailedError,
  CheckoutCreationError,
} from "./errors";

// Service (public API -- NOT repository)
export {
  createCheckout,
  getBalance,
  initializeBalance,
  addTokensForPurchase,
  deductTokensForUsage,
  checkAndDeductForChat,
  refundTokens,
  getTransactionHistory,
} from "./service";

// Constants
export { TOKEN_PACKS, DEFAULT_FREE_TOKENS, TOKENS_PER_MESSAGE } from "./constants";
```

---

## Phase 4: API Routes

### 4.1 Checkout Route

`src/app/api/billing/checkout/route.ts`:

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/core/api/errors";
import { createCheckout, CreateCheckoutSchema } from "@/features/billing";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemPriceId, quantity } = CreateCheckoutSchema.parse(body);

    // TODO: Get customerId from authenticated user session
    const hostedPage = await createCheckout(itemPriceId, quantity);

    return NextResponse.json(hostedPage);
  } catch (error) {
    return handleApiError(error);
  }
}
```

### 4.2 Webhook Route

See `reference/webhooks.md` for the complete webhook handler.

### 4.3 Balance Route

`src/app/api/billing/balance/route.ts`:

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/core/api/errors";
import { getBalance } from "@/features/billing";

export async function GET(request: NextRequest) {
  try {
    // TODO: Get userId from authenticated user session
    const userId = request.headers.get("x-user-id") ?? "";
    const balance = await getBalance(userId);

    return NextResponse.json({ balance });
  } catch (error) {
    return handleApiError(error);
  }
}
```

### 4.4 Transaction History Route

`src/app/api/billing/transactions/route.ts`:

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/core/api/errors";
import { getTransactionHistory } from "@/features/billing";

export async function GET(request: NextRequest) {
  try {
    // TODO: Get userId from authenticated user session
    const userId = request.headers.get("x-user-id") ?? "";
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "20");
    const offset = Number(url.searchParams.get("offset") ?? "0");

    const result = await getTransactionHistory(userId, limit, offset);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## Phase 5: Chat Integration

### 5.1 Add Token Check to Chat Send Route

Modify `src/app/api/chat/send/route.ts` to check and deduct tokens:

```typescript
import { checkAndDeductForChat, InsufficientTokensError } from "@/features/billing";

// Inside the POST handler, before streaming:
const { allowed, balance } = await checkAndDeductForChat(userId);
if (!allowed) {
  return NextResponse.json(
    {
      error: "Insufficient tokens",
      code: "INSUFFICIENT_TOKENS",
      balance,
    },
    { status: 402 },
  );
}

// After successful response, include balance in headers:
response.headers.set("X-Token-Balance", String(balance));
```

### 5.2 Frontend Balance Display

Add token balance to the chat header or sidebar. Fetch from `/api/billing/balance` and update after each message.

---

## Phase 6: Frontend Checkout UI

### 6.1 Add Chargebee.js Script

In `src/app/layout.tsx`, add:

```typescript
import Script from "next/script";

// Inside the layout JSX:
<Script
  src="https://js.chargebee.com/v2/chargebee.js"
  data-cb-site={process.env.NEXT_PUBLIC_CHARGEBEE_SITE}
  strategy="lazyOnload"
/>
```

### 6.2 Token Purchase Component

Create a component that displays token packs and opens checkout:

```typescript
"use client";

import { TOKEN_PACKS } from "@/features/billing/constants";

export function TokenPurchase() {
  async function handlePurchase(itemPriceId: string) {
    const cbInstance = (window as any).Chargebee.getInstance();

    cbInstance.openCheckout({
      hostedPage: async () => {
        const response = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemPriceId, quantity: 1 }),
        });
        if (!response.ok) throw new Error("Failed to create checkout");
        return response.json();
      },
      success: () => {
        // Refresh balance after purchase
        window.location.reload();
      },
      close: () => {
        // User closed without purchasing
      },
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Object.entries(TOKEN_PACKS).map(([id, pack]) => (
        <div key={id} className="rounded-lg border p-4">
          <h3 className="font-semibold">{pack.label}</h3>
          <p className="text-2xl font-bold">${pack.priceUsd}</p>
          <button
            type="button"
            onClick={() => handlePurchase(id)}
            className="mt-2 w-full rounded bg-blue-600 px-4 py-2 text-white"
          >
            Buy Now
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## Phase 7: Testing

### 7.1 Unit Tests

Test the service layer with mocked repository:

```typescript
// src/features/billing/tests/service.test.ts
import { describe, it, expect, mock } from "bun:test";

describe("billing service", () => {
  it("should deduct tokens for chat usage", async () => {
    // Test checkAndDeductForChat
  });

  it("should reject when insufficient balance", async () => {
    // Test InsufficientTokensError
  });

  it("should skip duplicate webhook events", async () => {
    // Test idempotency
  });
});
```

### 7.2 Test Cards

| Card Number | Result |
|-------------|--------|
| `4111 1111 1111 1111` | Success |
| `4000 0000 0000 0002` | Decline |
| Expiry: `12/2028`, CVV: `100` | |

### 7.3 Webhook Testing Locally

```bash
# Install ngrok or hookdeck
ngrok http 3000

# Configure webhook in ChargeBee dashboard with ngrok URL
# https://your-id.ngrok.io/api/billing/webhook
```

---

## Phase 8: Production Checklist

- [ ] Switch `CHARGEBEE_SITE` from test to live site
- [ ] Replace test API key with live API key
- [ ] Configure webhook URL with production domain
- [ ] Set up webhook basic auth with strong credentials
- [ ] Create product catalog (item family, items, item prices) on live site
- [ ] Test end-to-end flow with real payment (small amount)
- [ ] Set up monitoring for webhook failures
- [ ] Implement webhook retry handling
- [ ] Add error alerting for payment failures

---

## Modeling Choices: Token Billing Approaches

### Approach 1: One-Time Charges + Local Balance (Recommended)

**How it works:**
- User buys token packs via ChargeBee checkout (one-time charge)
- Webhook adds tokens to local database
- App deducts tokens on each AI interaction
- No subscription required

**Best for:** Prepaid token purchases, simple billing.

### Approach 2: Promotional Credits

**How it works:**
- ChargeBee maintains a monetary credit balance per customer
- Credits auto-apply to future invoices
- Use `promotional_credit.add/deduct` API

**Best for:** When you want ChargeBee to manage the balance (monetary, not token counts).

### Approach 3: Metered/Usage-Based Billing

**How it works:**
- Customer has a subscription with a metered item
- Record usage via Usages API on each AI interaction
- ChargeBee invoices at end of billing period (postpaid)

**Constraints:**
- Max 5,000 usage records per subscription
- One record per item per date
- Requires a subscription

**Best for:** Postpaid billing, enterprise customers.

### Approach 4: Hybrid (One-Time + Subscription)

**How it works:**
- Free tier: subscription plan with included tokens/month
- Top-up: one-time token pack purchases
- Premium: subscription plan with higher limits + top-up option

**Best for:** SaaS with freemium model.
