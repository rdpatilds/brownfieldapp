# Plan: Chargebee Token Billing System

## Summary

Add a prepaid token billing system where users purchase token packs via Chargebee checkout, receive 10 free tokens on signup, and consume 1 token per conversation turn (user message + AI response). Tokens are stored in Supabase (not Chargebee) for fast, atomic balance checks. The chat endpoint gains authentication and token gating. A `/billing` page shows balance, transaction history, and purchase cards. Auto-refund on LLM failure with user notification.

## User Stories

- As a **new user**, I want to receive 10 free tokens on signup so I can try the AI chat
- As a **user**, I want to see my token balance in the header so I always know how many tokens I have
- As a **user**, I want to buy token packs (50/$5, 150/$10, 500/$25) so I can continue using the AI
- As a **user**, I want to be blocked from sending when I have 0 tokens so I don't waste effort
- As a **user**, I want my token refunded when the AI fails so I don't lose tokens unfairly
- As a **user**, I want to see my transaction history so I can track purchases and usage

## Metadata

| Field | Value |
|-------|-------|
| Type | NEW_CAPABILITY |
| Complexity | HIGH |
| Systems Affected | Database schema, chat API, auth flow, UI header, new billing feature, Chargebee integration |

---

## Patterns to Follow

### Vertical Slice (mirror `src/features/chat/`)
```
src/features/billing/
├── models.ts      # Re-export tables, infer types
├── schemas.ts     # Zod validation schemas
├── errors.ts      # BillingError, InsufficientTokensError
├── repository.ts  # Pure DB operations (getBalance, creditTokens, debitToken)
├── service.ts     # Business logic with logging
├── chargebee.ts   # Chargebee SDK client
├── constants.ts   # Pack definitions, free token amount
├── index.ts       # Public API
└── tests/
```

### Error Class Pattern
```typescript
// SOURCE: src/features/chat/errors.ts:8-20
export class ChatError extends Error {
  readonly code: ChatErrorCode;
  readonly statusCode: HttpStatusCode;
  constructor(message: string, code: ChatErrorCode, statusCode: HttpStatusCode) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}
```

### Repository Pattern
```typescript
// SOURCE: src/features/chat/repository.ts:8-11
export async function findConversationById(id: string): Promise<Conversation | undefined> {
  const results = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  return results[0];
}
```

### Service Logging Pattern
```typescript
// SOURCE: src/features/chat/service.ts:9-16
const logger = getLogger("chat.service");
export async function createConversation(title: string): Promise<Conversation> {
  logger.info({ title }, "conversation.create_started");
  const conversation = await repository.createConversation({ title });
  logger.info({ conversationId: conversation.id }, "conversation.create_completed");
  return conversation;
}
```

### Auth in API Routes
```typescript
// SOURCE: src/app/api/projects/route.ts:20-29
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) { return unauthorizedResponse(); }
```

### Database Schema
```typescript
// SOURCE: src/core/database/schema.ts:7-10
export const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
};
```

---

## Files to Change

| File | Action | Purpose |
|------|--------|---------|
| `src/core/database/schema.ts` | UPDATE | Add `tokenBalances` and `tokenTransactions` tables |
| `src/core/config/env.ts` | UPDATE | Add Chargebee env vars (CHARGEBEE_SITE, CHARGEBEE_API_KEY, CHARGEBEE_WEBHOOK_USERNAME, CHARGEBEE_WEBHOOK_PASSWORD) |
| `.env.example` | UPDATE | Add Chargebee env var templates |
| `src/core/api/errors.ts` | UPDATE | Add 402 to HttpStatusCode union and VALID_STATUS_CODES set |
| `src/features/billing/models.ts` | CREATE | Type exports from schema |
| `src/features/billing/schemas.ts` | CREATE | Zod schemas for purchase input |
| `src/features/billing/errors.ts` | CREATE | InsufficientTokensError (402), BillingError |
| `src/features/billing/repository.ts` | CREATE | getBalance, creditTokens, debitToken (atomic), recordTransaction |
| `src/features/billing/service.ts` | CREATE | consumeToken, refundToken, purchaseTokens, getBalance, getTransactions, grantSignupTokens |
| `src/features/billing/chargebee.ts` | CREATE | Chargebee client initialization |
| `src/features/billing/constants.ts` | CREATE | TOKEN_PACKS, FREE_SIGNUP_TOKENS, LOW_BALANCE_THRESHOLD |
| `src/features/billing/index.ts` | CREATE | Public API exports |
| `src/app/api/chat/send/route.ts` | UPDATE | Add auth check + token debit before streaming, auto-refund on failure |
| `src/app/api/billing/checkout/route.ts` | CREATE | POST - create Chargebee checkout session |
| `src/app/api/billing/balance/route.ts` | CREATE | GET - return user token balance |
| `src/app/api/billing/transactions/route.ts` | CREATE | GET - return paginated transaction history |
| `src/app/api/billing/portal/route.ts` | CREATE | POST - create Chargebee portal session |
| `src/app/api/webhooks/chargebee/route.ts` | CREATE | POST - handle payment_succeeded webhook |
| `src/hooks/use-chat.ts` | UPDATE | Handle 402 response (insufficient tokens), update token balance on send |
| `src/hooks/use-tokens.ts` | CREATE | Hook for token balance, low-balance state, fetch/refresh balance |
| `src/components/chat/chat-header.tsx` | UPDATE | Add token balance display with low-balance badge coloring |
| `src/components/chat/chat-layout.tsx` | UPDATE | Pass token state, show buy prompt at 0 balance |
| `src/components/chat/chat-input.tsx` | UPDATE | Disable when tokens = 0, show buy CTA |
| `src/app/(dashboard)/layout.tsx` | UPDATE | Add user dropdown menu with billing link |
| `src/app/(dashboard)/billing/page.tsx` | CREATE | Billing page with balance, packs, transaction history |
| `drizzle/migrations/0002_add_token_tables.sql` | CREATE | Migration SQL for token tables |
| `package.json` | UPDATE | Add `chargebee` dependency |
| `src/features/billing/tests/errors.test.ts` | CREATE | Error class tests |
| `src/features/billing/tests/schemas.test.ts` | CREATE | Schema validation tests |
| `src/features/billing/tests/service.test.ts` | CREATE | Service logic tests |
| `src/app/api/billing/checkout/route.test.ts` | CREATE | Checkout API tests |
| `src/app/api/billing/balance/route.test.ts` | CREATE | Balance API tests |
| `src/app/api/webhooks/chargebee/route.test.ts` | CREATE | Webhook handler tests |

---

## Tasks

### Task 1: Install Chargebee SDK

- **Action**: Add chargebee npm package
- **Implement**: `bun add chargebee`
- **Validate**: `bun install` succeeds

### Task 2: Add Chargebee environment variables and .env.example setup guide

- **File**: `src/core/config/env.ts`
- **Action**: UPDATE
- **Implement**: Add `CHARGEBEE_SITE`, `CHARGEBEE_API_KEY` as required env vars. Add `CHARGEBEE_WEBHOOK_USERNAME` and `CHARGEBEE_WEBHOOK_PASSWORD` as required env vars.
- **Mirror**: `src/core/config/env.ts:1-7` — follow `getRequiredEnv()` pattern

- **File**: `.env.example`
- **Action**: UPDATE
- **Implement**: Add a new `Chargebee Configuration` section with detailed setup instructions:

```bash
# =============================================================================
# Chargebee Configuration (Billing & Token Purchases)
# =============================================================================
# 1. Sign up for a Chargebee account at https://www.chargebee.com/
#    - A test/sandbox site is created automatically on signup
#
# 2. Find your SITE NAME:
#    - It's the subdomain of your Chargebee dashboard URL
#    - Example: if your dashboard is https://myapp-test.chargebee.com, your site is "myapp-test"
#    - Test sites end in "-test" (e.g., "myapp-test"), live sites don't (e.g., "myapp")
#
# 3. Create an API KEY:
#    - Go to: Settings > Configure Chargebee > API Keys and Webhooks > API Keys tab
#    - Click "Add an API Key"
#    - Select "Full-Access Key" (needed for checkout + customer creation)
#    - Name it (e.g., "app-server-key") and click "Create Key"
#    - Copy the key — it won't be shown again
#    - IMPORTANT: Test and Live sites have separate API keys
#
# 4. Set up WEBHOOK credentials:
#    - Go to: Settings > Configure Chargebee > API Keys and Webhooks > Webhooks tab
#    - Click "Add Webhook"
#    - Webhook URL: https://your-domain.com/api/webhooks/chargebee
#      (For local dev, use a tunnel like ngrok: https://xxxx.ngrok.io/api/webhooks/chargebee)
#    - Toggle "Protect webhook URL with basic authentication"
#    - Set a username and password — use those values below
#    - Click "Test Webhook" to verify connectivity

CHARGEBEE_SITE=your-site-name-test
CHARGEBEE_API_KEY=test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CHARGEBEE_WEBHOOK_USERNAME=your-webhook-username
CHARGEBEE_WEBHOOK_PASSWORD=your-webhook-password
```

- **Validate**: `npx tsc --noEmit`

### Task 3: Add 402 to HttpStatusCode

- **File**: `src/core/api/errors.ts`
- **Action**: UPDATE
- **Implement**: Add `402` to the `HttpStatusCode` union type (line 12) and to the `VALID_STATUS_CODES` set (line 24)
- **Validate**: `npx tsc --noEmit`

### Task 4: Add token tables to database schema

- **File**: `src/core/database/schema.ts`
- **Action**: UPDATE
- **Implement**: Add two tables after `chatMessages`:

```typescript
/** Token balances - one row per user, atomic balance tracking. */
export const tokenBalances = pgTable("token_balances", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  ...timestamps,
});

/** Token transactions - audit log of all credits and debits. */
export const tokenTransactions = pgTable("token_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // positive = credit, negative = debit
  type: text("type").notNull(), // 'purchase' | 'consumption' | 'refund' | 'signup_bonus'
  referenceId: text("reference_id"), // chargebee invoice ID or conversation ID
  description: text("description"),
  balanceAfter: integer("balance_after").notNull(),
  ...timestamps,
});
```

- **Mirror**: `src/core/database/schema.ts:52-68` — follow `chatConversations` and `chatMessages` pattern
- **Validate**: `npx tsc --noEmit`

### Task 5: Create migration SQL

- **File**: `drizzle/migrations/0002_add_token_tables.sql`
- **Action**: CREATE
- **Implement**: Write migration SQL matching the schema from Task 4. Include:
  - `CREATE TABLE token_balances` with user_id PK, balance default 0, timestamps
  - `CREATE TABLE token_transactions` with uuid PK, foreign key to users, amount, type, reference_id, description, balance_after, timestamps
  - Foreign key constraints with ON DELETE CASCADE
- **Mirror**: `drizzle/migrations/0001_add_chat_tables.sql` — follow same SQL style
- **Also update**: `drizzle/migrations/meta/_journal.json` to include the new migration entry
- **Validate**: `bun run db:migrate`

### Task 6: Create billing feature — models.ts

- **File**: `src/features/billing/models.ts`
- **Action**: CREATE
- **Implement**: Re-export `tokenBalances` and `tokenTransactions` from schema, infer Select/Insert types
- **Mirror**: `src/features/chat/models.ts:1-14` — exact same pattern
- **Validate**: `npx tsc --noEmit`

### Task 7: Create billing feature — constants.ts

- **File**: `src/features/billing/constants.ts`
- **Action**: CREATE
- **Implement**:
```typescript
export const FREE_SIGNUP_TOKENS = 10;
export const LOW_BALANCE_THRESHOLD = 3;

export const TOKEN_PACKS = [
  { id: "pack-50", name: "50 Tokens", tokens: 50, priceInCents: 500, description: "50 AI conversation turns" },
  { id: "pack-150", name: "150 Tokens", tokens: 150, priceInCents: 1000, description: "150 AI conversation turns" },
  { id: "pack-500", name: "500 Tokens", tokens: 500, priceInCents: 2500, description: "500 AI conversation turns" },
] as const;

export type TokenPackId = (typeof TOKEN_PACKS)[number]["id"];
```
- **Validate**: `npx tsc --noEmit`

### Task 8: Create billing feature — schemas.ts

- **File**: `src/features/billing/schemas.ts`
- **Action**: CREATE
- **Implement**: Zod schemas for:
  - `PurchaseTokensSchema` — validates `{ packId: string }` (must be valid pack ID)
  - `TokenBalanceResponseSchema` — `{ balance: number }`
  - `TokenTransactionResponseSchema` — shape for API responses
- **Mirror**: `src/features/chat/schemas.ts:1-30` — same Zod pattern with `z` from `"zod/v4"`
- **Validate**: `npx tsc --noEmit`

### Task 9: Create billing feature — errors.ts

- **File**: `src/features/billing/errors.ts`
- **Action**: CREATE
- **Implement**:
  - `BillingErrorCode` union type: `"INSUFFICIENT_TOKENS" | "INVALID_PACK" | "CHARGEBEE_ERROR" | "WEBHOOK_VERIFICATION_FAILED"`
  - `BillingError` base class (mirrors `ChatError`)
  - `InsufficientTokensError` — 402 status
  - `InvalidPackError` — 400 status
  - `ChargebeeError` — 502 status
  - `WebhookVerificationError` — 401 status
- **Mirror**: `src/features/chat/errors.ts:1-38` — exact same class structure
- **Validate**: `npx tsc --noEmit`

### Task 10: Create billing feature — chargebee.ts

- **File**: `src/features/billing/chargebee.ts`
- **Action**: CREATE
- **Implement**: Initialize Chargebee client with env vars
```typescript
import Chargebee from "chargebee";
import { env } from "@/core/config/env";

export const chargebee = new Chargebee({
  site: env.CHARGEBEE_SITE,
  apiKey: env.CHARGEBEE_API_KEY,
});
```
- **Validate**: `npx tsc --noEmit`

### Task 11: Create billing feature — repository.ts

- **File**: `src/features/billing/repository.ts`
- **Action**: CREATE
- **Implement**: Pure database operations:
  - `getBalance(userId)` — returns balance number or undefined
  - `initializeBalance(userId, initialBalance)` — insert new row
  - `creditTokens(userId, amount)` — atomic `SET balance = balance + amount` with RETURNING
  - `debitToken(userId)` — atomic `SET balance = balance - 1 WHERE balance > 0` with RETURNING. Returns new balance or null if insufficient
  - `recordTransaction(data)` — insert into tokenTransactions
  - `getTransactions(userId, limit, offset)` — paginated, ordered by createdAt desc
  - `getTransactionCount(userId)` — count for pagination
- **Key**: `debitToken` MUST use raw SQL via `db.execute(sql\`...\`)` for the atomic `WHERE balance > 0` check
- **Mirror**: `src/features/chat/repository.ts:1-64` — same import/export style
- **Validate**: `npx tsc --noEmit`

### Task 12: Create billing feature — service.ts

- **File**: `src/features/billing/service.ts`
- **Action**: CREATE
- **Implement**: Business logic with logging:
  - `grantSignupTokens(userId)` — initializes balance with FREE_SIGNUP_TOKENS, records transaction
  - `getTokenBalance(userId)` — returns balance, creates row with 0 if missing
  - `consumeToken(userId, conversationId)` — calls repository.debitToken, records transaction, throws InsufficientTokensError if debit fails
  - `refundToken(userId, conversationId)` — credits 1 token back, records refund transaction
  - `creditPurchasedTokens(userId, packId, chargebeeInvoiceId)` — validates pack, credits tokens, records transaction
  - `getTransactionHistory(userId, page, pageSize)` — paginated history
- **Mirror**: `src/features/chat/service.ts:1-88` — same logger pattern with `getLogger("billing.service")`
- **Validate**: `npx tsc --noEmit`

### Task 13: Create billing feature — index.ts

- **File**: `src/features/billing/index.ts`
- **Action**: CREATE
- **Implement**: Export types, schemas, errors, service functions, constants. NOT repository or chargebee client.
- **Mirror**: `src/features/chat/index.ts:1-35` — same grouped export pattern
- **Validate**: `npx tsc --noEmit`

### Task 14: Update chat send endpoint with auth + token gating

- **File**: `src/app/api/chat/send/route.ts`
- **Action**: UPDATE
- **Implement**:
  1. After body parse (line 23), add auth check: get user from Supabase, return 401 if missing
  2. Before creating conversation (line 27), call `billing.consumeToken(user.id, conversationId)` — this throws 402 if insufficient
  3. In the `wrappedStream` pull handler, catch LLM errors. When the stream fails or returns empty, call `billing.refundToken(user.id, conversationId)` and send SSE event `{ type: "refund", message: "Response failed, token refunded" }`
  4. Add `X-Token-Balance` response header with remaining balance after debit
- **Mirror**: `src/app/api/projects/route.ts:20-29` for auth pattern
- **Validate**: `bun run lint && npx tsc --noEmit`

### Task 15: Add user ownership to chatConversations

- **File**: `src/core/database/schema.ts`
- **Action**: UPDATE
- **Implement**: Add `userId` column to `chatConversations` table:
```typescript
userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
```
- Make it nullable for backward compatibility with existing conversations.
- **File**: `drizzle/migrations/0002_add_token_tables.sql` — add `ALTER TABLE chat_conversations ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;` to the same migration
- **Also update**: `src/features/chat/repository.ts` — add userId param to `createConversation`
- **Also update**: `src/features/chat/service.ts` — pass userId through
- **Also update**: `src/app/api/chat/send/route.ts` — pass user.id when creating conversation
- **Validate**: `bun run lint && npx tsc --noEmit`

### Task 16: Create billing API routes — checkout

- **File**: `src/app/api/billing/checkout/route.ts`
- **Action**: CREATE
- **Implement**: POST handler:
  1. Auth check (return 401 if not authenticated)
  2. Parse body with `PurchaseTokensSchema`
  3. Look up pack from `TOKEN_PACKS` by packId
  4. Create or reference Chargebee customer (use Supabase user.id as Chargebee customer ID)
  5. Create Chargebee hosted page checkout via `chargebee.hostedPage.checkoutOneTime()`
  6. Include `passThroughContent` with `{ packId, userId }` for webhook to parse
  7. Return `{ url: hosted_page.url }` with 200
- **Mirror**: `src/app/api/projects/route.ts:76-100` — same auth + parse + respond pattern
- **Validate**: `npx tsc --noEmit`

### Task 17: Create billing API routes — balance

- **File**: `src/app/api/billing/balance/route.ts`
- **Action**: CREATE
- **Implement**: GET handler:
  1. Auth check
  2. Call `billing.getTokenBalance(user.id)`
  3. Return `{ balance: number }`
- **Mirror**: `src/app/api/projects/[id]/route.ts:19-37` — simple GET with auth
- **Validate**: `npx tsc --noEmit`

### Task 18: Create billing API routes — transactions

- **File**: `src/app/api/billing/transactions/route.ts`
- **Action**: CREATE
- **Implement**: GET handler:
  1. Auth check
  2. Parse pagination params from query string
  3. Call `billing.getTransactionHistory(user.id, page, pageSize)`
  4. Return paginated response using `createPaginatedResponse()`
- **Mirror**: `src/app/api/projects/route.ts:20-70` — same pagination pattern
- **Validate**: `npx tsc --noEmit`

### Task 19: Create billing API routes — portal

- **File**: `src/app/api/billing/portal/route.ts`
- **Action**: CREATE
- **Implement**: POST handler:
  1. Auth check
  2. Create Chargebee portal session via `chargebee.portalSession.create({ customerId: user.id })`
  3. Return `{ url: portalSession.accessUrl }`
- **Validate**: `npx tsc --noEmit`

### Task 20: Create webhook handler

- **File**: `src/app/api/webhooks/chargebee/route.ts`
- **Action**: CREATE
- **Implement**: POST handler:
  1. Verify Basic Auth header against CHARGEBEE_WEBHOOK_USERNAME/PASSWORD env vars
  2. Parse event body
  3. Store processed event IDs (in-memory Set or DB) for idempotency
  4. Handle `payment_succeeded` event:
     - Extract `passThroughContent` to get `{ packId, userId }`
     - Extract `chargebeeInvoiceId` from event content
     - Call `billing.creditPurchasedTokens(userId, packId, chargebeeInvoiceId)`
  5. Return `{ status: "ok" }` with 200
- **Validate**: `npx tsc --noEmit`

### Task 21: Grant signup tokens on registration

- **File**: `src/app/(auth)/register/actions.ts`
- **Action**: UPDATE
- **Implement**: After successful `supabase.auth.signUp()`, call `billing.grantSignupTokens(user.id)` to initialize the token balance with 10 free tokens. Wrap in try/catch so signup doesn't fail if token grant fails.
- **Validate**: `npx tsc --noEmit`

### Task 22: Create useTokens hook

- **File**: `src/hooks/use-tokens.ts`
- **Action**: CREATE
- **Implement**: Client-side hook:
  - `balance` state (number | null while loading)
  - `isLowBalance` derived (balance !== null && balance <= LOW_BALANCE_THRESHOLD)
  - `hasTokens` derived (balance !== null && balance > 0)
  - `fetchBalance()` — GET `/api/billing/balance`, sets state
  - `decrementBalance()` — optimistic local decrement after successful send
  - `refreshBalance()` — re-fetch from server (after purchase, refund, etc.)
  - Fetch balance on mount
- **Mirror**: `src/features/auth/hooks.ts:1-40` — same `useEffect` + state pattern
- **Validate**: `npx tsc --noEmit`

### Task 23: Update useChat to handle 402 responses

- **File**: `src/hooks/use-chat.ts`
- **Action**: UPDATE
- **Implement**:
  1. Accept an `onTokenConsumed` callback prop (called after successful send to decrement balance)
  2. In `sendMessage()`, after `fetch("/api/chat/send")`, check for 402 status specifically:
     - If 402: parse error body, show toast "Insufficient tokens — purchase more to continue", do NOT add user message to UI
  3. Read `X-Token-Balance` header from response and call `onTokenConsumed` if present
  4. Handle SSE `{ type: "refund" }` events — show toast "Response failed, token refunded" and call `onTokenRefunded` callback
- **Mirror**: Existing error handling at `src/hooks/use-chat.ts:142-144`
- **Validate**: `npx tsc --noEmit`

### Task 24: Update ChatHeader with token balance

- **File**: `src/components/chat/chat-header.tsx`
- **Action**: UPDATE
- **Implement**:
  1. Accept `tokenBalance: number | null` and `isLowBalance: boolean` props
  2. Add a token balance indicator between the title and ThemeToggle:
     - Show coin/zap icon + balance number
     - When `isLowBalance` is true, apply red/warning text color
     - When balance is null (loading), show skeleton
  3. Use `Badge` component from shadcn/ui for the display
- **Mirror**: Existing header structure at `src/components/chat/chat-header.tsx:15-30`
- **Validate**: `npx tsc --noEmit`

### Task 25: Update ChatInput for zero-balance state

- **File**: `src/components/chat/chat-input.tsx`
- **Action**: UPDATE
- **Implement**:
  1. Accept `hasTokens: boolean` prop (in addition to existing `disabled`)
  2. When `hasTokens === false`:
     - Disable the textarea and send button
     - Replace the input area content with a "buy more tokens" CTA card:
       - Message: "You've used all your tokens"
       - Button: "Buy More Tokens" linking to `/billing` (under the dashboard route group)
  3. Use `Card` component from shadcn/ui for the CTA
- **Validate**: `npx tsc --noEmit`

### Task 26: Update ChatLayout to wire token state

- **File**: `src/components/chat/chat-layout.tsx`
- **Action**: UPDATE
- **Implement**:
  1. Import and use `useTokens()` hook
  2. Pass `tokenBalance`, `isLowBalance`, `hasTokens` to ChatHeader and ChatInput
  3. Pass `onTokenConsumed` and `onTokenRefunded` callbacks to useChat that call `decrementBalance()` and `refreshBalance()` respectively
- **Validate**: `npx tsc --noEmit`

### Task 27: Add user dropdown menu to dashboard layout

- **File**: `src/app/(dashboard)/layout.tsx`
- **Action**: UPDATE
- **Implement**: Replace the plain email + sign out button with a `DropdownMenu`:
  - Trigger: user email or avatar
  - Items: "Billing" (links to `/dashboard/billing`), separator, "Sign out" (existing form action)
- **Mirror**: `src/components/chat/conversation-item.tsx:102-124` — DropdownMenu pattern
- **Validate**: `npx tsc --noEmit`

### Task 28: Create billing page

- **File**: `src/app/(dashboard)/billing/page.tsx`
- **Action**: CREATE
- **Implement**: Client component with three sections:
  1. **Balance display** — large number with token icon
  2. **Token packs** — 3 cards (50/$5, 150/$10, 500/$25) with "Buy" buttons that POST to `/api/billing/checkout` and redirect to returned URL
  3. **Transaction history** — table with columns: Date, Type, Amount (+/-), Description, Balance After. Paginated. Fetch from `/api/billing/transactions`
  4. **Manage billing** link — button that POSTs to `/api/billing/portal` and opens returned URL
- **Mirror**: Login/register page patterns for form handling (`src/app/(auth)/login/page.tsx`)
- **Validate**: `npx tsc --noEmit`

### Task 29: Create billing success/cancel pages

- **File**: `src/app/(dashboard)/billing/success/page.tsx`
- **Action**: CREATE
- **Implement**: Simple confirmation page shown after Chargebee checkout completes. Shows "Payment successful! Your tokens will be credited shortly." with a link back to chat. Note: actual token crediting happens via webhook, not on this page.

- **File**: `src/app/(dashboard)/billing/cancel/page.tsx`
- **Action**: CREATE
- **Implement**: Simple page shown when user cancels checkout. "Purchase cancelled" with link back to billing page.
- **Validate**: `npx tsc --noEmit`

### Task 30: Write unit tests — billing errors

- **File**: `src/features/billing/tests/errors.test.ts`
- **Action**: CREATE
- **Implement**: Test each error class: correct message, code, statusCode, instanceof checks
- **Mirror**: `src/features/projects/tests/errors.test.ts:1-69`
- **Validate**: `bun test src/features/billing/tests/errors.test.ts`

### Task 31: Write unit tests — billing schemas

- **File**: `src/features/billing/tests/schemas.test.ts`
- **Action**: CREATE
- **Implement**: Test PurchaseTokensSchema with valid/invalid pack IDs
- **Mirror**: `src/features/projects/tests/schemas.test.ts:1-120`
- **Validate**: `bun test src/features/billing/tests/schemas.test.ts`

### Task 32: Write unit tests — billing service

- **File**: `src/features/billing/tests/service.test.ts`
- **Action**: CREATE
- **Implement**:
  - Mock repository module before importing service
  - Test `grantSignupTokens` — initializes balance, records transaction
  - Test `consumeToken` — success (debit returns new balance), failure (debit returns null → throws InsufficientTokensError)
  - Test `refundToken` — credits 1 token, records refund transaction
  - Test `creditPurchasedTokens` — validates pack, credits correct amount, records transaction
  - Test `creditPurchasedTokens` with invalid pack → throws InvalidPackError
  - Test `getTokenBalance` — returns balance, creates row if missing
- **Mirror**: `src/features/projects/tests/service.test.ts:1-329` — same mock pattern
- **Validate**: `bun test src/features/billing/tests/service.test.ts`

### Task 33: Write unit tests — webhook handler

- **File**: `src/app/api/webhooks/chargebee/route.test.ts`
- **Action**: CREATE
- **Implement**:
  - Test valid Basic Auth header → processes event
  - Test invalid/missing auth → returns 401
  - Test `payment_succeeded` event → calls creditPurchasedTokens
  - Test idempotency (same event ID twice → only credits once)
  - Test unknown event type → returns 200 without action
- **Validate**: `bun test src/app/api/webhooks/chargebee/route.test.ts`

### Task 34: Write unit tests — billing API routes

- **File**: `src/app/api/billing/checkout/route.test.ts`
- **Action**: CREATE
- **Implement**:
  - Test POST with valid pack → returns checkout URL
  - Test POST with invalid pack → returns 400
  - Test POST without auth → returns 401
- **File**: `src/app/api/billing/balance/route.test.ts`
- **Action**: CREATE
- **Implement**:
  - Test GET with auth → returns balance
  - Test GET without auth → returns 401

- **Mirror**: `src/app/api/projects/route.test.ts:1-143` — same mock patterns
- **Validate**: `bun test`

### Task 35: Run full validation suite

- **Validate**:
```bash
bun run lint && npx tsc --noEmit && bun test
```
- Fix any issues before proceeding to e2e validation

### Task 36: STOP — Ask user to configure .env with Chargebee credentials

- **Action**: PAUSE IMPLEMENTATION
- **Implement**: Before ANY e2e testing can proceed, you MUST ask the user to:
  1. Create a Chargebee test site (if they haven't already)
  2. Copy the 4 Chargebee env vars from `.env.example` into their `.env` file
  3. Fill in their real Chargebee credentials:
     - `CHARGEBEE_SITE` — their test site name (e.g., "myapp-test")
     - `CHARGEBEE_API_KEY` — a Full-Access API key from their dashboard
     - `CHARGEBEE_WEBHOOK_USERNAME` — their chosen webhook auth username
     - `CHARGEBEE_WEBHOOK_PASSWORD` — their chosen webhook auth password
  4. Set up a webhook endpoint in Chargebee dashboard pointing to their app URL
  5. Confirm they have run `bun run db:migrate` to apply the token tables migration
- **Why**: The checkout, portal, and webhook endpoints will fail without real Chargebee credentials. The `.env.example` file (updated in Task 2) contains step-by-step instructions.
- **DO NOT SKIP THIS STEP** — e2e validation is impossible without valid credentials.
- **Validate**: User confirms .env is configured, then `bun run dev` starts without errors

---

## E2E Validation with agent-browser

> **THIS SECTION IS MANDATORY — DO NOT SKIP E2E TESTING.**
>
> Unit tests (Tasks 30-35) verify individual functions in isolation. E2E testing verifies the
> **entire system works together** — database, API routes, Chargebee integration, SSE streaming,
> UI state management, and user flows. Many critical bugs (race conditions, missing headers,
> broken redirects, auth edge cases) only surface during e2e testing.
>
> **Every single journey below must be executed and pass.** If a journey fails, fix the issue
> and re-run ALL journeys from the beginning — a fix in one area may break another.

After all code changes pass lint/typecheck/tests AND the user has configured their .env (Task 36),
start the dev server and validate every user journey.

### Pre-flight

```bash
bun run dev &
# Wait for server to start
agent-browser open http://localhost:3000/api/health
agent-browser get text body
# Expected: health check passes
```

### E2E Journey 1: New User Signup + Free Tokens

```bash
# Navigate to register
agent-browser open http://localhost:3000/register
agent-browser wait --load networkidle
agent-browser snapshot -i

# Fill registration form
agent-browser fill @{email-input} "e2e-test@example.com"
agent-browser fill @{password-input} "testpassword123"
agent-browser fill @{confirm-password-input} "testpassword123"
agent-browser click @{submit-button}
agent-browser wait --load networkidle
agent-browser snapshot -i

# Verify: user created, check email confirmation or redirect
```

**Verify after signup (via API)**:
```bash
# After confirming email and logging in:
agent-browser open http://localhost:3000
agent-browser wait --load networkidle
agent-browser snapshot -i

# Check header shows token balance of 10
agent-browser get text @{token-balance-element}
# Expected: "10" (free signup tokens)
```

### E2E Journey 2: Send Messages and Watch Balance Decrease

```bash
# On the chat page, logged in
agent-browser snapshot -i

# Send first message
agent-browser fill @{chat-input} "Hello, what is the capital of France?"
agent-browser click @{send-button}
agent-browser wait --load networkidle
agent-browser wait 3000  # Wait for streaming to complete

# Verify: balance decreased by 1
agent-browser snapshot -i
agent-browser get text @{token-balance-element}
# Expected: "9"

# Verify: AI response appeared
agent-browser snapshot -i
# Should show user message and assistant response

# Send second message
agent-browser fill @{chat-input} "Tell me more about Paris"
agent-browser click @{send-button}
agent-browser wait --load networkidle
agent-browser wait 3000

# Verify: balance is now 8
agent-browser get text @{token-balance-element}
# Expected: "8"
```

### E2E Journey 3: Low Balance Warning (Badge Color Change)

```bash
# Send messages until balance reaches 3 (the threshold)
# After reaching 3 tokens:
agent-browser snapshot -i

# Verify: token balance element has warning/red styling
# Check for CSS class or color change on the badge
agent-browser get attr @{token-balance-element} class
# Should contain a warning/destructive class
```

### E2E Journey 4: Zero Balance — Blocked Input + Buy Prompt

```bash
# Continue sending until balance reaches 0
# After last message at balance = 1:
agent-browser fill @{chat-input} "One more question"
agent-browser click @{send-button}
agent-browser wait --load networkidle
agent-browser wait 3000

# Verify: balance is now 0
agent-browser get text @{token-balance-element}
# Expected: "0"

# Verify: input is now disabled
agent-browser snapshot -i
agent-browser is enabled @{chat-input}
# Expected: false

# Verify: "Buy More Tokens" CTA is visible
agent-browser wait --text "Buy More Tokens"
agent-browser snapshot -i
# Should show buy prompt card
```

### E2E Journey 5: Navigate to Billing Page

```bash
# Click on user menu
agent-browser snapshot -i
agent-browser click @{user-menu-trigger}
agent-browser wait 500
agent-browser snapshot -i

# Click Billing link
agent-browser click @{billing-link}
agent-browser wait --load networkidle
agent-browser snapshot -i

# Verify: billing page loaded
agent-browser get url
# Expected: contains /billing

# Verify: balance shown as 0
# Verify: three token packs displayed (50/$5, 150/$10, 500/$25)
agent-browser wait --text "50 Tokens"
agent-browser wait --text "150 Tokens"
agent-browser wait --text "500 Tokens"

# Verify: transaction history shows signup bonus and consumption entries
agent-browser wait --text "signup_bonus"
agent-browser wait --text "consumption"
```

### E2E Journey 6: Purchase Token Pack via Chargebee

```bash
# On billing page, click Buy on the 50 token pack
agent-browser snapshot -i
agent-browser click @{buy-50-button}
agent-browser wait --load networkidle

# Verify: redirected to Chargebee checkout
agent-browser get url
# Expected: contains chargebee.com or checkout

# Note: Can't complete real payment in e2e test.
# Verify the redirect happened and Chargebee page loaded.
agent-browser snapshot -i
# Should show Chargebee checkout form

# Navigate back to test cancel flow
agent-browser back
agent-browser wait --load networkidle
```

### E2E Journey 7: Webhook Simulates Successful Purchase

```bash
# Simulate a webhook call via curl (separate terminal)
# This tests the webhook handler directly
curl -X POST http://localhost:3000/api/webhooks/chargebee \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'webhook-user:webhook-pass' | base64)" \
  -d '{
    "id": "ev_test_123",
    "event_type": "payment_succeeded",
    "content": {
      "customer": { "id": "USER_ID_HERE" },
      "invoice": { "id": "inv_test_123" }
    },
    "pass_through_content": "{\"packId\": \"pack-50\", \"userId\": \"USER_ID_HERE\"}"
  }'
# Expected: 200 { "status": "ok" }

# Back in browser, refresh billing page
agent-browser reload
agent-browser wait --load networkidle
agent-browser snapshot -i

# Verify: balance updated to 50
agent-browser get text @{token-balance-element}
# Expected: "50"

# Verify: transaction history shows purchase entry
agent-browser wait --text "purchase"
```

### E2E Journey 8: Resume Chatting After Purchase

```bash
# Navigate back to chat
agent-browser open http://localhost:3000
agent-browser wait --load networkidle
agent-browser snapshot -i

# Verify: input is re-enabled
agent-browser is enabled @{chat-input}
# Expected: true

# Verify: buy prompt is gone
# Verify: balance shows 50 in header

# Send a message
agent-browser fill @{chat-input} "I'm back with more tokens!"
agent-browser click @{send-button}
agent-browser wait --load networkidle
agent-browser wait 3000

# Verify: balance is now 49
agent-browser get text @{token-balance-element}
# Expected: "49"
```

### E2E Journey 9: LLM Failure — Auto-Refund

```bash
# To test refund, we can intercept the OpenRouter request to simulate failure
agent-browser network route "https://openrouter.ai/*" --abort

# Send a message that will fail
agent-browser fill @{chat-input} "This should fail and refund"
agent-browser click @{send-button}
agent-browser wait 3000

# Verify: error toast appeared with refund message
agent-browser wait --text "token refunded"

# Verify: balance didn't decrease (or recovered)
agent-browser get text @{token-balance-element}
# Expected: same as before sending (49 if previous test ran)

# Clean up network intercept
agent-browser network unroute "https://openrouter.ai/*"
```

### E2E Journey 10: Unauthenticated Access Blocked

```bash
# Sign out
agent-browser snapshot -i
agent-browser click @{user-menu-trigger}
agent-browser wait 500
agent-browser click @{signout-button}
agent-browser wait --load networkidle

# Try to access chat API directly
agent-browser open http://localhost:3000/api/billing/balance
agent-browser get text body
# Expected: {"error":"Authentication required","code":"UNAUTHORIZED"}

# Try to access billing page
agent-browser open http://localhost:3000/dashboard/billing
agent-browser wait --load networkidle
agent-browser get url
# Expected: redirected to /login
```

### E2E Journey 11: "Buy More Tokens" CTA Links Work

```bash
# Log back in, exhaust tokens to 0
# When the buy prompt appears:
agent-browser snapshot -i
agent-browser click @{buy-more-tokens-button}
agent-browser wait --load networkidle
agent-browser get url
# Expected: /billing page
```

### E2E Journey 12: Chargebee Portal Access

```bash
# On billing page
agent-browser snapshot -i
agent-browser click @{manage-billing-button}
agent-browser wait --load networkidle

# Verify: redirected to Chargebee portal
agent-browser get url
# Expected: contains chargebee.com
agent-browser snapshot -i
# Should show Chargebee self-service portal
```

### E2E Cleanup

```bash
agent-browser close
```

---

## Validation Checklist

```bash
# Type check
npx tsc --noEmit

# Lint
bun run lint

# Tests
bun test

# Dev server smoke test
bun run dev
```

---

## Acceptance Criteria

**Static checks (must pass before e2e):**
- [ ] Type check passes (`npx tsc --noEmit`)
- [ ] Lint passes (`bun run lint`)
- [ ] All unit tests pass (`bun test`)

**User has configured .env (Task 36 — required before e2e):**
- [ ] User confirmed Chargebee credentials are in `.env`
- [ ] `bun run db:migrate` completed successfully
- [ ] `bun run dev` starts without errors

**E2E validation (MANDATORY — every journey must pass):**
- [ ] Journey 1: New user signup grants 10 free tokens
- [ ] Journey 2: Sending messages decrements balance
- [ ] Journey 3: Low balance badge turns red at 3 tokens
- [ ] Journey 4: Zero balance blocks input + shows buy CTA
- [ ] Journey 5: Billing page shows balance, packs, and transaction history
- [ ] Journey 6: Buy button redirects to Chargebee checkout
- [ ] Journey 7: Webhook credits tokens on simulated purchase
- [ ] Journey 8: Chat re-enables after token purchase
- [ ] Journey 9: LLM failure auto-refunds token with notification
- [ ] Journey 10: Unauthenticated access blocked (API + page)
- [ ] Journey 11: "Buy More Tokens" CTA navigates to billing page
- [ ] Journey 12: Chargebee portal accessible from billing page

**The feature is NOT complete until ALL e2e journeys pass. Do not skip any.**
