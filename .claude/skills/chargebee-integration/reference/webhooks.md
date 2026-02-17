# ChargeBee Webhooks Reference

Complete reference for handling ChargeBee webhook events.

---

## Setup

### Dashboard Configuration

1. Go to **Settings > Configure Chargebee > API Keys and Webhooks > Webhooks tab**
2. Click **Add Webhook**
3. Enter webhook name and URL: `https://your-domain.com/api/billing/webhook`
4. Configure Basic Authentication (username/password)
5. Select events to subscribe to
6. Save

**Limits:** Maximum 5 webhooks per site.

### Local Development

Use a tunnel to expose your local endpoint:

```bash
# ngrok
ngrok http 3000
# Then set webhook URL to: https://your-ngrok-id.ngrok.io/api/billing/webhook

# Or use Hookdeck (recommended by ChargeBee)
npx hookdeck listen 3000 chargebee --path /api/billing/webhook
```

---

## Webhook Payload Format

Every webhook sends an HTTP POST with `application/json`:

```json
{
  "id": "ev_19yTSMHnJaEBS1T0Z",
  "occurred_at": 1515494821,
  "source": "web",
  "user": "full_access_key_v1",
  "object": "event",
  "api_version": "v2",
  "event_type": "payment_succeeded",
  "webhook_status": "not_configured",
  "content": {
    "customer": {
      "id": "cust_123",
      "email": "user@example.com",
      "first_name": "John",
      "promotional_credits": 5000
    },
    "invoice": {
      "id": "inv_456",
      "subscription_id": "sub_789",
      "total": 499,
      "amount_paid": 499,
      "status": "paid",
      "line_items": [
        {
          "item_price_id": "token-pack-100-USD",
          "quantity": 1,
          "amount": 499
        }
      ]
    },
    "transaction": {
      "id": "txn_abc",
      "amount": 499,
      "status": "success",
      "payment_method": "card"
    }
  }
}
```

---

## Authentication & Security

### Basic Authentication (Primary Method)

ChargeBee sends the configured username/password in the `Authorization` header:

```typescript
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const base64 = authHeader.slice(6);
  const decoded = Buffer.from(base64, "base64").toString();
  const colonIndex = decoded.indexOf(":");
  const username = decoded.slice(0, colonIndex);
  const password = decoded.slice(colonIndex + 1);

  if (
    username !== process.env["CHARGEBEE_WEBHOOK_USERNAME"] ||
    password !== process.env["CHARGEBEE_WEBHOOK_PASSWORD"]
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Process webhook...
}
```

### IP Whitelisting (Additional Layer)

Validate the source IP against ChargeBee's published IP ranges. Check `x-forwarded-for` or `x-real-ip` headers.

---

## Idempotency

ChargeBee may deliver the same event multiple times. Always implement idempotency:

```typescript
async function handleWebhook(event: ChargeBeeEvent) {
  const eventId = event.id;

  // Check if already processed (use database or Redis)
  const existing = await db
    .select()
    .from(tokenTransactions)
    .where(eq(tokenTransactions.chargebeeEventId, eventId))
    .limit(1);

  if (existing.length > 0) {
    logger.info({ eventId }, "webhook.duplicate_skipped");
    return; // Already processed
  }

  // Process the event
  await processEvent(event);
}
```

### Event Ordering

Events may arrive out of order. Use `resource_version` to ensure you only process newer versions:

```typescript
if (event.content.customer.resource_version <= storedResourceVersion) {
  return; // Stale event, skip
}
```

---

## Timeout & Retry Policy

### Timeouts

| Environment | Connection | Read | Total |
|-------------|-----------|------|-------|
| Test Site | 10,000 ms | 10,000 ms | 20,000 ms |
| Live Site | 20,000 ms | 20,000 ms | 60,000 ms |

Your webhook handler must respond within these limits, otherwise ChargeBee considers it failed.

### Retry Schedule

Failed webhooks are retried up to 7 times:

| Retry | Delay |
|-------|-------|
| 1 | 2 minutes |
| 2 | 6 minutes |
| 3 | 30 minutes |
| 4 | 1 hour |
| 5 | 5 hours |
| 6 | 1 day |
| 7 | 2 days |

**Success criterion:** HTTP 2xx response code.

---

## Event Types Reference

### Payment Events (Most Important for Token Billing)

| Event | When | Action |
|-------|------|--------|
| `payment_succeeded` | Payment collected successfully | **Add tokens to user balance** |
| `payment_failed` | Payment attempt failed | Notify user, do NOT add tokens |
| `payment_refunded` | Payment was refunded | **Deduct tokens from balance** |
| `payment_initiated` | Payment processing started | Optional: show pending state |

### Invoice Events

| Event | When |
|-------|------|
| `invoice_generated` | New invoice created |
| `invoice_updated` | Invoice modified |
| `invoice_deleted` | Invoice removed |

### Customer Events

| Event | When |
|-------|------|
| `customer_created` | New customer registered |
| `customer_changed` | Customer details updated |
| `customer_deleted` | Customer removed |
| `promotional_credits_added` | Credits added to customer |
| `promotional_credits_deducted` | Credits deducted from customer |

### Subscription Events

| Event | When |
|-------|------|
| `subscription_created` | New subscription started |
| `subscription_started` | Subscription became active |
| `subscription_activated` | Subscription activated |
| `subscription_changed` | Subscription modified |
| `subscription_cancelled` | Subscription cancelled |
| `subscription_reactivated` | Cancelled subscription reactivated |
| `subscription_renewed` | Subscription renewed for new term |
| `subscription_paused` | Subscription paused |
| `subscription_resumed` | Paused subscription resumed |
| `subscription_trial_end_reminder` | Trial ending soon |
| `mrr_updated` | Monthly recurring revenue changed |

### Credit Note Events

| Event | When |
|-------|------|
| `credit_note_created` | Credit note issued |
| `credit_note_updated` | Credit note modified |
| `credit_note_deleted` | Credit note removed |

---

## Event Content by Type

### payment_succeeded

```typescript
interface PaymentSucceededContent {
  customer: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    promotional_credits: number;  // current balance in cents
  };
  invoice: {
    id: string;
    total: number;               // total in cents
    amount_paid: number;         // paid amount in cents
    status: "paid";
    line_items: Array<{
      item_price_id: string;     // e.g., "token-pack-100-USD"
      quantity: number;
      amount: number;            // line item amount in cents
    }>;
  };
  transaction: {
    id: string;
    amount: number;              // transaction amount in cents
    status: "success";
    payment_method: string;      // "card", "paypal", etc.
  };
}
```

### payment_failed

```typescript
interface PaymentFailedContent {
  customer: {
    id: string;
    email: string;
  };
  invoice: {
    id: string;
    total: number;
    status: "payment_due" | "not_paid";
  };
  transaction: {
    id: string;
    amount: number;
    status: "failure";
    error_code?: string;
    error_text?: string;
  };
}
```

---

## Complete Webhook Handler (Next.js App Router)

```typescript
// src/app/api/billing/webhook/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { getLogger } from "@/core/logging";
import { db } from "@/core/database";
import { tokenBalances, tokenTransactions } from "@/core/database/schema";
import { eq, sql } from "drizzle-orm";

const logger = getLogger("billing.webhook");

const TOKEN_PACKS: Record<string, number> = {
  "token-pack-100-USD": 100,
  "token-pack-500-USD": 500,
  "token-pack-1000-USD": 1000,
};

function verifyAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) return false;

  const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
  const colonIndex = decoded.indexOf(":");
  const username = decoded.slice(0, colonIndex);
  const password = decoded.slice(colonIndex + 1);

  return (
    username === process.env["CHARGEBEE_WEBHOOK_USERNAME"] &&
    password === process.env["CHARGEBEE_WEBHOOK_PASSWORD"]
  );
}

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await request.json();
  const eventId = event.id as string;
  const eventType = event.event_type as string;

  logger.info({ eventId, eventType }, "webhook.received");

  // Idempotency check
  const existing = await db
    .select({ id: tokenTransactions.id })
    .from(tokenTransactions)
    .where(eq(tokenTransactions.chargebeeEventId, eventId))
    .limit(1);

  if (existing.length > 0) {
    logger.info({ eventId }, "webhook.duplicate_skipped");
    return NextResponse.json({ status: "ok" });
  }

  try {
    switch (eventType) {
      case "payment_succeeded":
        await handlePaymentSucceeded(event, eventId);
        break;
      case "payment_failed":
        logger.warn(
          { eventId, customerId: event.content?.customer?.id },
          "webhook.payment_failed"
        );
        break;
      case "payment_refunded":
        await handlePaymentRefunded(event, eventId);
        break;
      default:
        logger.debug({ eventId, eventType }, "webhook.unhandled_event");
    }
  } catch (error) {
    logger.error({ eventId, eventType, error }, "webhook.processing_failed");
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}

async function handlePaymentSucceeded(event: any, eventId: string) {
  const invoice = event.content.invoice;
  const customerId = event.content.customer.id;

  let totalTokens = 0;
  for (const lineItem of invoice.line_items ?? []) {
    const tokens = TOKEN_PACKS[lineItem.item_price_id];
    if (tokens) {
      totalTokens += tokens * (lineItem.quantity ?? 1);
    }
  }

  if (totalTokens === 0) {
    logger.info({ eventId, customerId }, "webhook.no_token_items");
    return;
  }

  // Add tokens to balance
  // NOTE: userId must be mapped from chargebee customerId
  // This assumes customerId matches your user ID or you have a mapping table
  await db.insert(tokenTransactions).values({
    userId: customerId,         // adjust mapping as needed
    amount: totalTokens,
    type: "purchase",
    description: `Purchased ${totalTokens} tokens`,
    chargebeeEventId: eventId,
    chargebeeInvoiceId: invoice.id,
  });

  await db
    .update(tokenBalances)
    .set({
      balance: sql`${tokenBalances.balance} + ${totalTokens}`,
      updatedAt: new Date(),
    })
    .where(eq(tokenBalances.userId, customerId));

  logger.info(
    { eventId, customerId, totalTokens },
    "webhook.tokens_added"
  );
}

async function handlePaymentRefunded(event: any, eventId: string) {
  const customerId = event.content.customer.id;
  const invoice = event.content.invoice;

  let totalTokens = 0;
  for (const lineItem of invoice.line_items ?? []) {
    const tokens = TOKEN_PACKS[lineItem.item_price_id];
    if (tokens) {
      totalTokens += tokens * (lineItem.quantity ?? 1);
    }
  }

  if (totalTokens === 0) return;

  await db.insert(tokenTransactions).values({
    userId: customerId,
    amount: -totalTokens,
    type: "refund",
    description: `Refund: ${totalTokens} tokens`,
    chargebeeEventId: eventId,
    chargebeeInvoiceId: invoice.id,
  });

  await db
    .update(tokenBalances)
    .set({
      balance: sql`GREATEST(${tokenBalances.balance} - ${totalTokens}, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(tokenBalances.userId, customerId));

  logger.info(
    { eventId, customerId, totalTokens },
    "webhook.tokens_refunded"
  );
}
```

---

## Event Sources

| Source | Description |
|--------|-------------|
| `admin_console` | Action from ChargeBee dashboard |
| `api` | Action via API |
| `scheduled_job` | Automated billing action |
| `hosted_page` | Action from checkout page |
| `portal` | Action from self-service portal |
| `system` | Internal ChargeBee action |
| `bulk_operation` | Bulk import/operation |
| `external_service` | Third-party integration |

---

## Recommended Events for Token Billing

Subscribe to these events at minimum:

1. **`payment_succeeded`** -- Add tokens on successful purchase
2. **`payment_failed`** -- Alert user of payment failure
3. **`payment_refunded`** -- Deduct tokens on refund
4. **`customer_created`** -- Sync new customer to local DB
5. **`promotional_credits_added`** -- Track credit additions (if using promotional credits)
6. **`promotional_credits_deducted`** -- Track credit deductions
