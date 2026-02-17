# ChargeBee API Reference

Complete API reference for all ChargeBee endpoints relevant to token-based billing integration.

---

## Authentication

**Method:** HTTP Basic Authentication
- Username = API key
- Password = empty string

```bash
curl https://{site}.chargebee.com/api/v2/customers \
  -u {api_key}:
```

```typescript
import Chargebee from "chargebee";

const chargebee = new Chargebee({
  site: "your-site",
  apiKey: "your-api-key",
});
```

**API Key Types:**

| Type | Use Case | Client-Safe |
|------|----------|-------------|
| Full Access | Server-side CRUD operations | No |
| Read-Only | Data retrieval only | No |
| Publishable | Client-side Chargebee.js, estimates | Yes |

**Base URL:** `https://{site}.chargebee.com/api/v2/`

---

## Customers

Manage customer records.

### Create Customer

```typescript
const result = await chargebee.customer.create({
  id: "cust_123",                    // optional, auto-generated if omitted
  email: "user@example.com",
  first_name: "John",
  last_name: "Doe",
  auto_collection: "on",            // auto-charge payment method
});
const customer = result.customer;
```

### Retrieve Customer

```typescript
const result = await chargebee.customer.retrieve("cust_123");
const customer = result.customer;
// customer.promotional_credits -- current credit balance in cents
```

### Update Customer

```typescript
const result = await chargebee.customer.update("cust_123", {
  email: "newemail@example.com",
});
```

### List Customers

```typescript
const result = await chargebee.customer.list({
  limit: 10,
  email: { is: "user@example.com" },
});
for (const entry of result.list) {
  console.log(entry.customer);
}
```

### Delete Customer

```typescript
await chargebee.customer.delete("cust_123");
```

---

## Item Families

Group related products/services.

### Create Item Family

```typescript
await chargebee.itemFamily.create({
  id: "ai-tokens",
  name: "AI Chat Tokens",
});
```

### List Item Families

```typescript
const result = await chargebee.itemFamily.list({ limit: 10 });
```

---

## Items

Products or services in the catalog. Three types: `plan`, `addon`, `charge`.

### Create Item

```typescript
// Charge item (for one-time token purchases)
await chargebee.item.create({
  id: "token-pack",
  name: "Token Pack",
  type: "charge",                // "plan" | "addon" | "charge"
  item_family_id: "ai-tokens",
});
```

### Retrieve Item

```typescript
const result = await chargebee.item.retrieve("token-pack");
```

### List Items

```typescript
const result = await chargebee.item.list({
  type: { is: "charge" },
});
```

---

## Item Prices

Pricing configuration for items. Specifies currency, amount, billing period, and pricing model.

### Create Item Price

```typescript
await chargebee.itemPrice.create({
  id: "token-pack-100-USD",
  item_id: "token-pack",
  name: "100 Tokens",
  pricing_model: "flat_fee",      // "flat_fee" | "per_unit" | "tiered" | "volume" | "stairstep"
  price: 499,                     // $4.99 in cents
  currency_code: "USD",
  // For recurring items only:
  // period_unit: "month",
  // period: 1,
});
```

### List Item Prices

```typescript
const result = await chargebee.itemPrice.list({
  item_id: { is: "token-pack" },
  status: { is: "active" },
});
```

### Pricing Models

| Model | Description | Example |
|-------|-------------|---------|
| `flat_fee` | Fixed price regardless of quantity | $4.99 for 100 tokens |
| `per_unit` | Price x quantity | $0.05 per token |
| `tiered` | Different rates per tier | 1-100: $0.05, 101-500: $0.04 |
| `volume` | Single rate based on total tier | 1-100: $0.05 each, 101+: $0.04 each |
| `stairstep` | Fixed price per tier bracket | 1-100: $5, 101-500: $20 |

---

## Hosted Pages (Checkout)

Generate checkout pages for payment collection.

### Checkout for One-Time Items (Token Purchases)

```typescript
const result = await chargebee.hostedPage.checkoutOneTimeForItems({
  item_prices: [
    {
      item_price_id: "token-pack-100-USD",
      quantity: 1,
    },
  ],
  customer: {
    id: "cust_123",               // optional: link to existing customer
    email: "user@example.com",    // optional: prefill email
  },
  redirect_url: "https://yourapp.com/billing/success",
  cancel_url: "https://yourapp.com/billing/cancel",
});

const hostedPage = result.hosted_page;
// hostedPage.id       -- unique page ID
// hostedPage.url      -- checkout URL (expires in 3 hours)
// hostedPage.state    -- "created"
// hostedPage.embed    -- true (can be embedded via Chargebee.js)
```

### Checkout for New Subscription

```typescript
const result = await chargebee.hostedPage.checkoutNewForItems({
  subscription_items: [
    { item_price_id: "pro-plan-USD-monthly", quantity: 1 },
  ],
  customer: { email: "user@example.com" },
  redirect_url: "https://yourapp.com/billing/success",
});
```

### Checkout for Existing Subscription

```typescript
const result = await chargebee.hostedPage.checkoutExistingForItems({
  subscription: { id: "sub_123" },
  subscription_items: [
    { item_price_id: "gold-plan-USD-monthly", quantity: 1 },
  ],
});
```

### Retrieve Hosted Page (Verify Completion)

```typescript
const result = await chargebee.hostedPage.retrieve("hp_123");
const page = result.hosted_page;

if (page.state === "succeeded") {
  const customer = page.content.customer;
  const invoice = page.content.invoice;
  // Process successful checkout
}
```

### Hosted Page States

| State | Description |
|-------|-------------|
| `created` | Page generated, not yet accessed |
| `requested` | Customer accessed the page |
| `succeeded` | Payment completed successfully |
| `cancelled` | Customer cancelled |
| `acknowledged` | Your app confirmed receipt (after retrieve) |

### Hosted Page Types

| Type | Purpose | URL Expiry |
|------|---------|------------|
| `checkout_new` | New subscription | 3 hours |
| `checkout_existing` | Modify subscription | 3 hours |
| `checkout_one_time` | One-time payment | 3 hours |
| `update_payment_method` | Change payment method | 5 days |
| `manage_payment_sources` | Manage payment methods | 5 days |
| `collect_now` | Charge outstanding balance | 5 days |

---

## Promotional Credits

Built-in monetary credit system per customer. Credits are automatically applied to future invoices.

### Add Credits

```typescript
const result = await chargebee.promotionalCredit.add({
  customer_id: "cust_123",
  amount: 1000,                    // $10.00 in cents
  description: "Purchased 100 AI tokens",
  credit_type: "general",         // "loyalty_credits" | "referral_rewards" | "general"
  reference: "token_purchase_order_456",
});
// result.promotional_credit.closing_balance -- balance after this operation
```

### Deduct Credits

```typescript
const result = await chargebee.promotionalCredit.deduct({
  customer_id: "cust_123",
  amount: 50,                     // $0.50 in cents
  description: "Used 5 AI tokens for chat completion",
});
```

### Set Credits (Override Balance)

```typescript
const result = await chargebee.promotionalCredit.set({
  customer_id: "cust_123",
  amount: 500,                    // Set balance to $5.00
});
```

### List Credit Transactions

```typescript
const result = await chargebee.promotionalCredit.list({
  customer_id: { is: "cust_123" },
});
for (const entry of result.list) {
  const credit = entry.promotional_credit;
  // credit.type           -- "increment" or "decrement"
  // credit.amount         -- amount in cents
  // credit.closing_balance -- balance after this transaction
  // credit.created_at     -- timestamp
}
```

### Promotional Credit Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | string (150) | Unique reference ID |
| `customer_id` | string (50) | Associated customer |
| `type` | enum | `increment` or `decrement` |
| `amount` | integer | Value in cents (min=0) |
| `currency_code` | string (3) | ISO 4217 currency code |
| `description` | string (250) | Explanation text |
| `credit_type` | enum | `loyalty_credits`, `referral_rewards`, `general` |
| `closing_balance` | integer | Balance after operation (cents) |
| `created_at` | timestamp | UTC seconds |

---

## Subscriptions

For recurring billing (optional, if adding subscription plans alongside tokens).

### Create Subscription with Items

```typescript
const result = await chargebee.subscription.createWithItems("cust_123", {
  subscription_items: [
    { item_price_id: "pro-plan-USD-monthly", quantity: 1 },
  ],
});
const subscription = result.subscription;
const invoice = result.invoice;
```

### Retrieve Subscription

```typescript
const result = await chargebee.subscription.retrieve("sub_123");
```

### Cancel Subscription

```typescript
const result = await chargebee.subscription.cancel("sub_123", {
  cancel_reason_code: "user_requested",
  end_of_term: true,              // cancel at period end vs immediately
});
```

### Subscription States

```
future → in_trial → active ↔ paused → cancelled
                      ↓                    ↑
                non_renewing ──────────────┘
```

---

## Invoices

### Retrieve Invoice

```typescript
const result = await chargebee.invoice.retrieve("inv_123");
const invoice = result.invoice;
// invoice.total          -- total in cents
// invoice.amount_paid    -- amount paid in cents
// invoice.status         -- "paid" | "posted" | "payment_due" | "not_paid" | "voided"
```

### List Invoices

```typescript
const result = await chargebee.invoice.list({
  customer_id: { is: "cust_123" },
  status: { is: "paid" },
  sort_by: { desc: "date" },
});
```

---

## Events (Polling Alternative to Webhooks)

### List Events

```typescript
const result = await chargebee.event.list({
  event_type: { is: "payment_succeeded" },
  occurred_at: { after: Math.floor(Date.now() / 1000) - 3600 }, // last hour
  sort_by: { asc: "occurred_at" },
});
for (const entry of result.list) {
  const event = entry.event;
  // event.id
  // event.event_type
  // event.content
}
```

---

## Usages (Metered Billing)

For tracking per-use consumption. Requires a metered item with a subscription.

### Record Usage

```typescript
await chargebee.usage.create("sub_123", {
  item_price_id: "api-calls-USD",
  quantity: "150",
  usage_date: Math.floor(Date.now() / 1000),
});
```

### Constraints

- One record per `subscription_id` / `item_price_id` / `usage_date` combination
- Max 5,000 usage records per subscription lifetime
- Postpaid: charged at end of billing term

---

## Portal Sessions (Customer Self-Service)

### Create Portal Session

```typescript
const result = await chargebee.portalSession.create({
  customer_id: "cust_123",
  redirect_url: "https://yourapp.com/dashboard",
});
const accessUrl = result.portal_session.access_url;
// Redirect user to accessUrl (one-time use, expires in 1 hour)
```

---

## Estimates (Preview Charges)

### Estimate for One-Time Invoice

```typescript
const result = await chargebee.estimate.createInvoiceForItems({
  item_prices: [
    { item_price_id: "token-pack-100-USD", quantity: 1 },
  ],
});
const estimate = result.estimate;
// estimate.invoice_estimate.total -- estimated total in cents
```

---

## Pagination

All list endpoints support cursor-based pagination:

```typescript
let offset: string | undefined;

do {
  const result = await chargebee.customer.list({
    limit: 100,
    offset,
  });

  for (const entry of result.list) {
    // process entry.customer
  }

  offset = result.next_offset;
} while (offset);
```

---

## Error Handling

ChargeBee API errors follow this structure:

```typescript
try {
  await chargebee.customer.retrieve("nonexistent");
} catch (error: any) {
  // error.http_status_code  -- HTTP status (400, 404, etc.)
  // error.api_error_code    -- e.g., "resource_not_found"
  // error.message           -- Human-readable description
  // error.param             -- Parameter that caused the error (if applicable)
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `resource_not_found` | 404 | Resource doesn't exist |
| `invalid_request` | 400 | Bad parameters |
| `payment_processing_failed` | 402 | Payment failed |
| `api_authentication_failed` | 401 | Invalid API key |
| `api_authorization_failed` | 403 | Insufficient permissions |
| `resource_limit_exhausted` | 429 | Rate limit exceeded |

---

## Rate Limits

| API Key Type | Limit |
|-------------|-------|
| Full Access | 150 requests/minute |
| Read-Only | 150 requests/minute |

If you hit rate limits, implement exponential backoff with jitter.

---

## Amounts Convention

All monetary amounts are in **minor currency units** (cents for USD, pence for GBP):

| API Value | Display Value |
|-----------|---------------|
| `499` | $4.99 |
| `1000` | $10.00 |
| `3499` | $34.99 |

Convert: `displayAmount = apiAmount / 100`
