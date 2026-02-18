# Architecture Overview

## High-Level Architecture Diagram

```
                                    ┌─────────────────────────────────────────┐
                                    │            External Services            │
                                    │                                         │
                                    │  ┌──────────────┐  ┌────────────────┐  │
                                    │  │  OpenRouter   │  │   Chargebee    │  │
                                    │  │   LLM API     │  │  Billing API   │  │
                                    │  │  (Chat +      │  │  (Checkout,    │  │
                                    │  │   Embeddings) │  │   Webhooks)    │  │
                                    │  └──────┬───────┘  └───────┬────────┘  │
                                    └─────────┼──────────────────┼───────────┘
                                              │                  │
                    ┌─────────────────────────┼──────────────────┼──────────────┐
                    │              Next.js 16 Application (Bun)                │
                    │                                                          │
                    │  ┌────────────────────────────────────────────────────┐  │
                    │  │                  API Layer                         │  │
                    │  │          src/app/api/ (Route Handlers)             │  │
                    │  │                                                    │  │
                    │  │  POST /api/chat/send ─── SSE stream ──────────►   │  │
                    │  │  GET  /api/chat/conversations                     │  │
                    │  │  GET  /api/documents ──── JSON ──────────────►    │  │
                    │  │  POST /api/documents/upload ── SSE progress ──►   │  │
                    │  │  POST /api/billing/checkout                       │  │
                    │  │  POST /api/webhooks/chargebee                     │  │
                    │  └──────────────────────┬────────────────────────────┘  │
                    │                         │                                │
                    │  ┌──────────────────────▼────────────────────────────┐  │
                    │  │              Feature Slices                        │  │
                    │  │         src/features/ (Vertical Slices)            │  │
                    │  │                                                    │  │
                    │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐  │  │
                    │  │  │  chat   │ │   rag   │ │documents│ │billing │  │  │
                    │  │  │         │ │         │ │         │ │        │  │  │
                    │  │  │service  │ │service  │ │service  │ │service │  │  │
                    │  │  │repo     │ │repo     │ │repo     │ │repo    │  │  │
                    │  │  │stream   │ │         │ │         │ │        │  │  │
                    │  │  │schemas  │ │models   │ │schemas  │ │schemas │  │  │
                    │  │  │errors   │ │errors   │ │errors   │ │errors  │  │  │
                    │  │  └─────────┘ └─────────┘ └─────────┘ └────────┘  │  │
                    │  └──────────────────────┬────────────────────────────┘  │
                    │                         │                                │
                    │  ┌──────────────────────▼────────────────────────────┐  │
                    │  │                Core Layer                          │  │
                    │  │             src/core/                              │  │
                    │  │                                                    │  │
                    │  │  ┌──────────┐ ┌──────────┐ ┌─────────┐           │  │
                    │  │  │ database │ │ supabase │ │ logging │           │  │
                    │  │  │ (Drizzle │ │  (Auth)  │ │ (Pino)  │           │  │
                    │  │  │  + SQL)  │ │          │ │         │           │  │
                    │  │  └────┬─────┘ └────┬─────┘ └─────────┘           │  │
                    │  └───────┼────────────┼──────────────────────────────┘  │
                    └──────────┼────────────┼──────────────────────────────────┘
                               │            │
                    ┌──────────▼────────────▼──────────────────────────────────┐
                    │                 Supabase                                 │
                    │                                                          │
                    │  ┌──────────────────┐  ┌─────────────────────────────┐  │
                    │  │   Supabase Auth  │  │     PostgreSQL + pgvector   │  │
                    │  │  (Email/Pass)    │  │                             │  │
                    │  └──────────────────┘  │  users, projects,           │  │
                    │                        │  chat_conversations,        │  │
                    │                        │  chat_messages,             │  │
                    │                        │  token_balances,            │  │
                    │                        │  token_transactions,        │  │
                    │                        │  documents, chunks (vector) │  │
                    │                        └─────────────────────────────┘  │
                    └──────────────────────────────────────────────────────────┘


                    ┌──────────────────────────────────────────────────────────┐
                    │                     Frontend                             │
                    │            React 19 + Tailwind CSS 4 + shadcn/ui        │
                    │                                                          │
                    │  ┌──────────────────┐  ┌─────────────────────────────┐  │
                    │  │    Chat UI       │  │     Dashboard UI            │  │
                    │  │                  │  │                             │  │
                    │  │  ChatLayout      │  │  /dashboard                 │  │
                    │  │  ChatSidebar     │  │  /dashboard/projects        │  │
                    │  │  MessageList     │  │  /dashboard/documents       │  │
                    │  │  ChatInput       │  │  /dashboard/billing         │  │
                    │  │  MarkdownContent │  │                             │  │
                    │  └────────┬─────────┘  └──────────┬──────────────────┘  │
                    │           │                        │                      │
                    │  ┌────────▼────────────────────────▼──────────────────┐  │
                    │  │              React Hooks                           │  │
                    │  │  useChat  useTokens  useDocumentUpload            │  │
                    │  │  (SSE stream reader, state management)            │  │
                    │  └───────────────────────────────────────────────────┘  │
                    └──────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Bun | Package manager, test runner, script executor |
| **Framework** | Next.js 16 (App Router) | Full-stack React framework (SSR + API routes) |
| **Language** | TypeScript (strict mode) | Type safety with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| **Frontend** | React 19 | UI rendering with Server + Client Components |
| **Styling** | Tailwind CSS 4 + shadcn/ui | Utility-first CSS with pre-built Radix-based components |
| **Database** | Supabase PostgreSQL + pgvector | Relational data + vector similarity search for RAG |
| **ORM** | Drizzle ORM + raw SQL | Typed queries for Drizzle-managed tables; raw SQL for `documents`/`chunks` |
| **Auth** | Supabase Auth | Email/password authentication with session cookies |
| **AI / LLM** | OpenRouter API | Chat completions (configurable model, default: Claude Haiku 4.5) |
| **Embeddings** | OpenRouter API | Vector embeddings (text-embedding-3-small) for RAG |
| **Billing** | Chargebee | Token-based billing with checkout, webhooks, and credit management |
| **Logging** | Pino | Structured JSON logging with component namespacing |
| **Linting** | Biome | Linting + formatting (replaces ESLint + Prettier) |
| **Testing** | Bun test + React Testing Library | Unit and component tests with coverage |

---

## Frontend Architecture

The frontend is a React 19 application using Next.js App Router with a mix of Server Components and Client Components.

### Route Structure

```
/                           → Chat UI (ChatLayout - client component)
/login                      → Login form (auth route group)
/register                   → Registration form (auth route group)
/dashboard                  → Dashboard home (protected)
/dashboard/projects         → Project management (CRUD)
/dashboard/documents        → Document upload + management for RAG
/dashboard/billing          → Token balance, purchase, transaction history
```

### Key Frontend Patterns

- **Server Components** for layouts and pages that need auth checks (redirect if not logged in)
- **Client Components** (`"use client"`) for interactive UI: chat, forms, file uploads
- **Custom hooks** encapsulate all data fetching and state: `useChat`, `useTokens`, `useDocumentUpload`
- **Local storage** for conversation list caching (via `useLocalStorage` hook)
- **Sonner toasts** for error/success notifications
- **Markdown rendering** with `react-markdown`, `remark-gfm`, and `rehype-highlight` for code syntax highlighting

---

## Backend Architecture

Next.js API Route Handlers serve as the backend. There is no separate backend server — everything runs in the Next.js process.

### API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat/send` | POST | Send a message, stream AI response via SSE |
| `/api/chat/conversations` | GET/POST | List or create conversations |
| `/api/chat/conversations/[id]` | GET/PATCH/DELETE | Get, rename, or delete a conversation |
| `/api/chat/conversations/[id]/messages` | GET | Get messages for a conversation |
| `/api/documents` | GET | List all document summaries |
| `/api/documents/upload` | POST | Upload a file with SSE progress streaming |
| `/api/documents/[id]` | DELETE | Delete a document and its chunks |
| `/api/billing/checkout` | POST | Create Chargebee checkout session |
| `/api/billing/balance` | GET | Get user's token balance |
| `/api/billing/transactions` | GET | Get transaction history |
| `/api/billing/portal` | POST | Create Chargebee portal session |
| `/api/webhooks/chargebee` | POST | Handle Chargebee payment webhooks |
| `/api/health` | GET | Health check |

### Vertical Slice Architecture

Each feature is a self-contained module under `src/features/`:

```
src/features/{feature}/
├── models.ts       # TypeScript types / Drizzle table re-exports
├── schemas.ts      # Zod v4 validation schemas
├── errors.ts       # Feature-specific error classes with HTTP status codes
├── repository.ts   # Database queries (pure data access, no business logic)
├── service.ts      # Business logic (orchestrates repository + external APIs)
├── constants.ts    # Feature-specific constants
├── index.ts        # Public API (controls what other code can import)
└── tests/          # Co-located tests
```

Features: `chat`, `rag`, `documents`, `billing`, `projects`, `auth`

### Auth Flow

1. Supabase Auth handles email/password registration and login
2. Sessions are stored in HTTP-only cookies managed by `@supabase/ssr`
3. A Next.js proxy (`src/proxy.ts`) refreshes sessions on every request
4. Protected routes check `supabase.auth.getUser()` and redirect to `/login` if unauthenticated
5. API routes check auth and return 401 for unauthenticated requests

---

## Chat Communication: How It Works

### Protocol: Server-Sent Events (SSE) over HTTP

The chat uses **Server-Sent Events (SSE)**, not WebSockets. Here is the complete flow:

```
┌──────────┐         POST /api/chat/send           ┌──────────────┐
│          │ ──────────────────────────────────────► │              │
│  Browser │         { content, conversationId }     │  Next.js API │
│ (useChat │                                         │    Route     │
│   hook)  │ ◄──── text/event-stream (SSE) ──────── │              │
│          │                                         │              │
│          │   data: {"type":"sources",...}           │   Calls      │
│          │   data: {"content":"Meta"}               │  OpenRouter  │
│          │   data: {"content":" invested"}          │   LLM API   │
│          │   data: {"content":"$14.8B"}             │   (stream)   │
│          │   data: {"type":"done","saved":true}     │              │
│          │                                         │              │
└──────────┘                                         └──────────────┘
```

### Step-by-Step Chat Flow

1. **User types message** → `ChatInput` component calls `sendMessage()` from `useChat` hook
2. **Client sends POST** → `fetch("/api/chat/send", { method: "POST", body: { content, conversationId } })`
3. **API route authenticates** → checks Supabase session, consumes 1 token from balance
4. **Creates conversation** if new (auto-generates title from first message)
5. **Saves user message** to `chat_messages` table
6. **RAG retrieval** (non-fatal): generates embedding of the user's query, searches `chunks` table for similar vectors using `match_chunks()` PostgreSQL function, formats top matches as context
7. **Calls OpenRouter** → `POST https://openrouter.ai/api/v1/chat/completions` with `stream: true`, sends conversation history + system prompt (with RAG context injected if available)
8. **Transforms the stream** → OpenRouter returns SSE with `choices[0].delta.content` chunks; the API route re-encodes these as `data: {"content":"..."}\n\n` events and prepends RAG source metadata
9. **Client reads SSE** → `useChat` hook's `readSSEStream()` reads chunks via `response.body.getReader()`, accumulates content, updates React state in real-time for typewriter effect
10. **Stream completes** → API route saves full assistant response to `chat_messages`, sends `data: {"type":"done","saved":true}\n\n`
11. **Client finalizes** → adds complete assistant message (with source citations) to state, stops streaming indicator

### SSE Event Types

| Event | Direction | Payload |
|-------|-----------|---------|
| `sources` | Server → Client | `{ type: "sources", sources: [{ index, title, source }] }` |
| `content` | Server → Client | `{ content: "chunk of text" }` |
| `done` | Server → Client | `{ type: "done", saved: true }` |
| `error` | Server → Client | `{ type: "error", message: "..." }` |
| `refund` | Server → Client | `{ type: "refund", message: "Token refunded" }` |

### Document Upload Also Uses SSE

The document upload endpoint (`POST /api/documents/upload`) uses the same SSE pattern for progress tracking:

```
Client                              Server
  │  POST /api/documents/upload       │
  │  (multipart/form-data)            │
  │──────────────────────────────────►│
  │                                    │ Validate file
  │  data: {"type":"status",...}      │ Insert document
  │◄──────────────────────────────────│
  │  data: {"type":"progress",1/5}    │ Embed chunk 1
  │◄──────────────────────────────────│
  │  data: {"type":"progress",2/5}    │ Embed chunk 2
  │◄──────────────────────────────────│
  │  ...                               │
  │  data: {"type":"complete",...}     │ Done
  │◄──────────────────────────────────│
```

---

## RAG (Retrieval-Augmented Generation) Pipeline

```
┌──────────────┐     ┌──────────────┐     ┌───────────────────┐
│  .md / .txt  │────►│  Chunk Text  │────►│  Generate Vector  │
│   Document   │     │ (paragraph-  │     │   Embeddings      │
│              │     │  based, 1000 │     │ (text-embedding-  │
│              │     │  char chunks │     │  3-small via      │
│              │     │  with 200    │     │  OpenRouter)      │
│              │     │  overlap)    │     │                   │
└──────────────┘     └──────────────┘     └────────┬──────────┘
                                                    │
                                                    ▼
                                          ┌──────────────────┐
                                          │  PostgreSQL +    │
                                          │  pgvector        │
                                          │                  │
                                          │  documents table │
                                          │  chunks table    │
                                          │  (1536-dim       │
                                          │   vectors)       │
                                          └────────┬─────────┘
                                                   │
            User sends chat message                │
                     │                              │
                     ▼                              │
            ┌─────────────────┐                    │
            │ Generate query  │                    │
            │ embedding       │                    │
            └────────┬────────┘                    │
                     │                              │
                     ▼                              ▼
            ┌─────────────────────────────────────────┐
            │  match_chunks(query_vector, match_count) │
            │  (cosine similarity search via pgvector) │
            │  Filter: similarity >= 0.7 threshold     │
            │  Limit: top 5 chunks                     │
            └────────────────────┬────────────────────┘
                                 │
                                 ▼
            ┌─────────────────────────────────────────┐
            │  Inject into system prompt as            │
            │  <reference_material>[1] Title\nContent  │
            │  </reference_material>                   │
            │                                          │
            │  LLM generates response with [1][2]      │
            │  inline citations                        │
            └──────────────────────────────────────────┘
```

Two ingestion paths exist:
- **CLI**: `bun run ingest -- --dir documents/` (batch processing, console output)
- **UI**: Dashboard → Documents → Upload (single file, SSE progress)

Both share the same `chunkText()`, `extractTitle()`, and repository functions from `src/features/documents/`.

---

## Why SSE Instead of WebSockets? Trade-off Analysis

This application uses **Server-Sent Events (SSE)** for all real-time communication. Here is a comparison with WebSockets and why each approach has merit for this use case.

### Current Approach: SSE

**How it works**: Client makes a standard HTTP POST request. Server responds with `Content-Type: text/event-stream` and sends `data: ...\n\n` frames. The connection is one-way (server → client) and closes when the stream is done.

**Advantages for this app**:
- **Simplicity** — Uses standard `fetch()` + `ReadableStream` API. No special client library or connection management needed.
- **Request-scoped** — Each chat message is a self-contained HTTP request. Auth headers, CORS, and error handling work exactly like normal REST calls.
- **Serverless-friendly** — Works with Vercel, Netlify, or any platform that supports streaming responses. No persistent connection infrastructure needed.
- **No connection state** — No heartbeats, reconnection logic, or connection lifecycle to manage. Each request is independent.
- **Proxy/CDN compatible** — SSE over HTTP passes through standard reverse proxies, load balancers, and CDNs without special configuration.
- **Natural fit for LLM streaming** — OpenRouter itself returns SSE, so the server just transforms and forwards the stream. No protocol translation needed.

**Limitations**:
- **Unidirectional** — Server can only send data to the client. Client cannot send data mid-stream (e.g., cannot cancel generation server-side without an abort signal or separate request).
- **One stream per request** — Each message requires a new HTTP request/response cycle. There is no persistent channel for multiple messages.
- **No server push** — The server cannot proactively push updates to the client (e.g., "another user edited this document"). The client must poll or make a new request.

### Alternative: WebSockets

**How it would work**: Client opens a persistent `ws://` connection on page load. Messages are sent as JSON frames in both directions. The connection stays alive across multiple messages.

**Advantages WebSockets would bring**:

| Capability | Current (SSE) | With WebSockets |
|-----------|---------------|-----------------|
| Cancel generation mid-stream | Abort the `fetch()` (tears down TCP) | Send `{"type":"cancel"}` frame (graceful) |
| Multi-user presence | Not possible | "User X is typing..." indicators |
| Real-time notifications | Polling required | Server pushes instantly |
| Bidirectional during stream | Separate request needed | Send on same connection |
| Connection efficiency | New TCP+TLS per message | One persistent connection |
| Collaborative editing | Not feasible | Multiple cursors, live sync |

**Disadvantages of WebSockets for this app**:
- **Complexity** — Requires connection lifecycle management: open, reconnect on drop, heartbeat/ping-pong, session resumption, message queuing during disconnection.
- **Serverless hostile** — WebSockets require persistent server processes. Vercel Edge Functions, AWS Lambda, and similar platforms either don't support them or require workarounds (e.g., AWS API Gateway WebSocket API, Pusher, Ably).
- **Auth complexity** — WebSocket handshake doesn't natively carry cookies/headers the same way. Auth must be handled during upgrade or via initial message.
- **Infrastructure cost** — Persistent connections consume server memory even when idle. A user with a chat tab open but not chatting still holds a connection.
- **Overkill for this pattern** — The chat interaction is strictly request/response: user sends a message, server streams back a reply. There are no multi-user or real-time collaboration features that would justify bidirectional communication.

### Verdict

**SSE is the right choice for this application.** The chat pattern is fundamentally request/response with streaming replies — exactly what SSE is designed for. The app is single-user per conversation, has no collaborative features, and deploys to serverless infrastructure. WebSockets would add complexity without meaningful benefit.

**When to consider switching to WebSockets**:
- Adding multi-user chat rooms or collaborative editing
- Needing server-initiated push notifications (e.g., "your document finished processing in the background")
- Adding real-time presence indicators ("User X is typing...")
- Wanting graceful mid-stream cancellation without aborting the TCP connection
- Moving away from serverless to a persistent server deployment

---

## Database Schema

### Drizzle-Managed Tables (typed, migrated)

| Table | Purpose |
|-------|---------|
| `users` | User profiles (synced from Supabase Auth via trigger) |
| `projects` | User-owned projects (CRUD example) |
| `chat_conversations` | Chat conversation metadata (title, user) |
| `chat_messages` | Individual messages (role, content, timestamps) |
| `token_balances` | Per-user token balance for billing |
| `token_transactions` | Audit log of all credits and debits |

### Raw SQL Tables (not in Drizzle schema, used by RAG)

| Table | Purpose |
|-------|---------|
| `documents` | Ingested document metadata (title, source, content) |
| `chunks` | Document chunks with 1536-dimensional vector embeddings |
| `document_summaries` | Database view joining documents with chunk/token counts |

### Key SQL Function

```sql
match_chunks(query_embedding vector(1536), match_count int)
```
Returns chunks ranked by cosine similarity to the query embedding. Used for RAG retrieval at chat time.

---

## Billing Architecture

```
User clicks "Buy 50 tokens"
         │
         ▼
POST /api/billing/checkout { packId: "pack-50" }
         │
         ▼
Chargebee Hosted Checkout Page ──► User pays
         │
         ▼
Chargebee webhook POST /api/webhooks/chargebee
         │
         ▼
creditPurchasedTokens(userId, amount)
         │
         ▼
token_balances.balance += amount
token_transactions += audit row
```

Token packs: 50, 150, or 500 tokens. Each chat message consumes 1 token. Free signup bonus is granted on first login. If a response fails to save, the token is refunded.

---

## Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Next.js full-stack** (no separate backend) | Simplifies deployment, shares types between client/server, leverages App Router for auth layouts |
| **SSE over WebSocket** | Natural fit for LLM streaming, serverless-compatible, minimal client complexity |
| **Vertical slices over layered architecture** | Each feature is self-contained; easy to add, modify, or delete features without cross-cutting concerns |
| **Raw SQL for RAG tables** | `pgvector` operations (`::vector` cast, `match_chunks` function) are not well-supported by Drizzle ORM |
| **Drizzle over Prisma** | Lighter weight, better raw SQL escape hatch, faster cold starts in serverless |
| **OpenRouter over direct API** | Model-agnostic — switch between Claude, GPT, Llama, etc. by changing one env var |
| **Token-based billing over subscription** | Pay-per-use is simpler for a chat app; no recurring billing complexity |
| **Supabase over self-hosted Postgres** | Managed auth, real-time subscriptions (available if needed), built-in pgvector support |
| **Biome over ESLint+Prettier** | Single tool, faster execution, stricter defaults, consistent formatting |
| **Bun over Node.js** | Faster package install, native TypeScript execution, built-in test runner |
