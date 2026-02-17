---
name: chargebee-integration
description: Integrates ChargeBee payment and billing APIs for token purchases, checkout flows, webhook handling, and credit balance management. Use when implementing billing features, token packs, payment checkout, or subscription management with ChargeBee.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, WebFetch
---

> **Project-Specific Reference**: For API details, webhook events, and implementation patterns, see the `reference/` directory in this skill directory.

# ChargeBee Integration Skill

## Overview

This skill provides everything needed to integrate ChargeBee billing into the agentic-chat application. It covers token purchases (one-time charges), credit balance tracking, checkout flows, webhook handling, and optional subscription management.

## Quick Reference

| Resource | Location |
|----------|----------|
| API Reference | `reference/api-reference.md` |
| Implementation Guide | `reference/implementation-guide.md` |
| Webhook Events | `reference/webhooks.md` |

---

## Architecture Overview

### Token Purchase Flow

```
User clicks "Buy Tokens"
  → Frontend calls POST /api/billing/checkout
  → Server creates ChargeBee hosted page (checkout_one_time)
  → Returns hosted page object to frontend
  → Chargebee.js opens checkout modal
  → User completes payment
  → ChargeBee sends webhook (payment_succeeded)
  → POST /api/billing/webhook validates & processes
  → Tokens added to user's balance in database
  → User can now use tokens for AI chat
```

### Token Consumption Flow

```
User sends chat message
  → POST /api/chat/send checks token balance
  → If balance > 0: proceed with AI streaming
  → After completion: deduct tokens used
  → Return updated balance in response
  → If balance <= 0: return InsufficientTokensError
```

---

## Setup

### 1. Install SDK

```bash
bun add chargebee
```

### 2. Environment Variables

Add to `.env`:
```env
CHARGEBEE_SITE=your-site-test
CHARGEBEE_API_KEY=test_your_api_key
CHARGEBEE_WEBHOOK_USERNAME=webhook-user
CHARGEBEE_WEBHOOK_PASSWORD=webhook-pass
```

Add to `.env.example`:
```env
CHARGEBEE_SITE=your-site-name
CHARGEBEE_API_KEY=your-chargebee-api-key
CHARGEBEE_WEBHOOK_USERNAME=webhook-username
CHARGEBEE_WEBHOOK_PASSWORD=webhook-password
```

### 3. ChargeBee Dashboard Setup

1. Create a test site at https://app.chargebee.com/signup
2. Go to **Settings > Configure Chargebee > API Keys and Webhooks**
3. Copy the Full-Access API key for server-side use
4. Create a webhook pointing to `https://your-domain/api/billing/webhook`
5. Enable **One-time payments** under **Settings > Checkout & Self Serve Portal > Configuration**

### 4. Product Catalog Setup

Create these items in ChargeBee dashboard or via API:

```typescript
// Item Family
await chargebee.itemFamily.create({
  id: "ai-tokens",
  name: "AI Chat Tokens"
});

// Item (charge type for one-time purchase)
await chargebee.item.create({
  id: "token-pack",
  name: "Token Pack",
  type: "charge",
  item_family_id: "ai-tokens"
});

// Item Prices (different token pack sizes)
await chargebee.itemPrice.create({
  id: "token-pack-100-USD",
  item_id: "token-pack",
  name: "100 Tokens",
  pricing_model: "flat_fee",
  price: 499,        // $4.99 in cents
  currency_code: "USD"
});

await chargebee.itemPrice.create({
  id: "token-pack-500-USD",
  item_id: "token-pack",
  name: "500 Tokens",
  pricing_model: "flat_fee",
  price: 1999,       // $19.99 in cents
  currency_code: "USD"
});

await chargebee.itemPrice.create({
  id: "token-pack-1000-USD",
  item_id: "token-pack",
  name: "1000 Tokens",
  pricing_model: "flat_fee",
  price: 3499,       // $34.99 in cents
  currency_code: "USD"
});
```

---

## Feature Slice Structure

Following the project's vertical slice architecture:

```
src/features/billing/
  chargebee.ts       # ChargeBee SDK client initialization
  models.ts          # Drizzle types for token_balances, token_transactions
  schemas.ts         # Zod validation schemas
  repository.ts      # Database operations for balance/transaction tracking
  service.ts         # Business logic: purchase, deduct, check balance
  errors.ts          # BillingError, InsufficientTokensError, etc.
  index.ts           # Public API
  tests/
    service.test.ts
    schemas.test.ts
    errors.test.ts

src/app/api/billing/
  checkout/route.ts           # POST: Create ChargeBee checkout session
  webhook/route.ts            # POST: Handle ChargeBee webhook events
  balance/route.ts            # GET: Check user's token balance
  transactions/route.ts       # GET: List user's token transactions
```

---

## SDK Initialization

```typescript
// src/features/billing/chargebee.ts
import Chargebee from "chargebee";

export const chargebee = new Chargebee({
  site: process.env["CHARGEBEE_SITE"]!,
  apiKey: process.env["CHARGEBEE_API_KEY"]!,
});
```

---

## Database Schema

Add to `src/core/database/schema.ts`:

```typescript
export const tokenBalances = pgTable("token_balances", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tokenTransactions = pgTable("token_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),           // positive = credit, negative = debit
  type: text("type").notNull(),                  // "purchase", "usage", "refund", "bonus"
  description: text("description"),
  chargebeeEventId: text("chargebee_event_id"),  // for idempotency
  chargebeeInvoiceId: text("chargebee_invoice_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

---

## Checkout API Route

```typescript
// src/app/api/billing/checkout/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/core/api/errors";
import { chargebee } from "@/features/billing/chargebee";

export async function POST(request: NextRequest) {
  try {
    const { itemPriceId, quantity = 1, customerId } = await request.json();

    const result = await chargebee.hostedPage.checkoutOneTimeForItems({
      item_prices: [{ item_price_id: itemPriceId, quantity }],
      customer: customerId ? { id: customerId } : undefined,
    });

    return NextResponse.json(result.hosted_page);
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## Webhook Handler

```typescript
// src/app/api/billing/webhook/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { getLogger } from "@/core/logging";
import { addTokensForPurchase } from "@/features/billing";

const logger = getLogger("billing.webhook");

export async function POST(request: NextRequest) {
  // Verify basic auth
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const base64 = authHeader.split(" ")[1] ?? "";
  const [username, password] = Buffer.from(base64, "base64").toString().split(":");

  if (
    username !== process.env["CHARGEBEE_WEBHOOK_USERNAME"] ||
    password !== process.env["CHARGEBEE_WEBHOOK_PASSWORD"]
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await request.json();
  const eventId = event.id as string;
  const eventType = event.event_type as string;

  logger.info({ eventId, eventType }, "webhook.received");

  switch (eventType) {
    case "payment_succeeded":
      await addTokensForPurchase(event);
      break;
    case "payment_failed":
      logger.warn({ eventId }, "webhook.payment_failed");
      break;
    default:
      logger.debug({ eventId, eventType }, "webhook.unhandled_event");
  }

  return NextResponse.json({ status: "ok" });
}
```

---

## Frontend: Chargebee.js Checkout

Add the Chargebee.js script to your layout:

```typescript
// In src/app/layout.tsx or a billing-specific layout
<Script src="https://js.chargebee.com/v2/chargebee.js" data-cb-site={process.env.NEXT_PUBLIC_CHARGEBEE_SITE} />
```

Open checkout from a React component:

```typescript
function handleBuyTokens(itemPriceId: string) {
  const cbInstance = (window as any).Chargebee.getInstance();

  cbInstance.openCheckout({
    hostedPage: async () => {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemPriceId, quantity: 1 }),
      });
      return response.json();
    },
    success: (hostedPageId: string) => {
      // Refresh token balance
      console.log("Purchase complete:", hostedPageId);
    },
    close: () => {
      // User closed checkout
    },
  });
}
```

---

## Token Balance Check in Chat Flow

Integrate with the existing chat send route:

```typescript
// In src/app/api/chat/send/route.ts, before streaming
import { getBalance, deductTokens } from "@/features/billing";

const balance = await getBalance(userId);
if (balance <= 0) {
  return NextResponse.json(
    { error: "Insufficient tokens", code: "INSUFFICIENT_TOKENS" },
    { status: 402 }
  );
}

// After streaming completes
const tokensUsed = calculateTokensFromResponse(response);
await deductTokens(userId, tokensUsed, "chat_completion", conversationId);
```

---

## Testing

### Test Cards

| Card Number | Result |
|-------------|--------|
| `4111 1111 1111 1111` | Success |
| `4000 0000 0000 0002` | Decline |

- Expiry: Any future date (e.g., `12/2028`)
- CVV: `100`

### Webhook Testing (Local Development)

Use a tunnel service to expose your local webhook endpoint:

```bash
# Using ngrok
ngrok http 3000
# Then configure webhook URL in ChargeBee dashboard:
# https://your-ngrok-url.ngrok.io/api/billing/webhook
```

---

## Key API Amounts

All monetary amounts in ChargeBee are in **minor currency units** (cents for USD):
- `price: 499` = $4.99
- `amount: 1000` = $10.00

---

## Token Pack to Tokens Mapping

Define a mapping between ChargeBee item price IDs and token amounts:

```typescript
// src/features/billing/constants.ts
export const TOKEN_PACKS: Record<string, number> = {
  "token-pack-100-USD": 100,
  "token-pack-500-USD": 500,
  "token-pack-1000-USD": 1000,
};
```

This mapping is used in the webhook handler to determine how many tokens to credit when a purchase succeeds.
