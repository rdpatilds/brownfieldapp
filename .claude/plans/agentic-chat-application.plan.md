# Plan: Agentic Chat Application

## Summary

Build a ChatGPT/Claude-style chat application on the existing Next.js 16 starter. Replace the root page with a streaming chat UI powered by OpenRouter (Claude Haiku 4.5). No auth required — conversations tracked by localStorage IDs, persisted in Postgres via Drizzle. Sidebar + main chat layout with markdown rendering, code highlighting, and mobile responsiveness.

## User Story

As a visitor
I want to have streaming AI conversations persisted across sessions
So that I can use a ChatGPT-like interface without needing to sign up

## Metadata

| Field | Value |
|-------|-------|
| Type | NEW_CAPABILITY |
| Complexity | HIGH |
| Systems Affected | Database schema, API routes, root page, new feature slice, new UI components |

---

## Agent Team Strategy

### Recommended Team: 3 Agents (Parallel Execution)

| Agent | Domain | Owns |
|-------|--------|------|
| **Backend Agent** | Feature slice (`src/features/chat/`), env config, error handler fix | models, schemas, errors, constants, repository, service, stream, index, unit tests |
| **API Agent** | All `src/app/api/chat/` routes + route tests | HTTP layer, SSE streaming endpoint, conversation CRUD endpoints, route tests |
| **Frontend Agent** | All `src/components/chat/`, hooks, root page, dependencies | UI components, hooks, chat layout, component tests, dependency installation |

### Execution Model: Lead Bootstraps → Agents in Parallel → Lead Validates

```
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 0: Lead Agent (Bootstrap)                                    │
│  - Update schema.ts (conversations + messages tables)               │
│  - Update env.ts (OpenRouter vars)                                  │
│  - Update .env.example                                              │
│  - Fix errors.ts (remove ProjectError coupling)                     │
│  - Run db:generate + db:migrate                                     │
│  - Install UI deps (react-markdown, remark-gfm, etc.)              │
│  - Add shadcn scroll-area                                           │
│  - Publish ALL contracts to agents (below)                          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
            ┌──────────────┼──────────────────┐
            ▼              ▼                  ▼
┌───────────────┐ ┌────────────────┐ ┌────────────────┐
│ Backend Agent │ │  API Agent      │ │ Frontend Agent │
│               │ │                 │ │                │
│ Feature slice │ │ API routes      │ │ Components     │
│ + unit tests  │ │ + route tests   │ │ + hooks        │
│               │ │                 │ │ + page + tests │
│ Validates:    │ │ Validates:      │ │ Validates:     │
│ lint+types+   │ │ lint+types+     │ │ lint+types+    │
│ bun test      │ │ bun test        │ │ bun test       │
└───────┬───────┘ └────────┬────────┘ └───────┬────────┘
        │                  │                   │
        └──────────────────┼───────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 2: Lead Agent (Integration + E2E Validation)                 │
│  - bun run lint && npx tsc --noEmit && bun test && bun run build    │
│  - Start dev server: bun run dev                                    │
│  - Run full E2E validation with agent-browser CLI                   │
│  - If issues found → spawn targeted fix agents → retest             │
│  - Repeat until all E2E scenarios pass                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Why Parallel Works Here

The three agents own **non-overlapping file sets**:
- Backend: `src/features/chat/*` (new directory — no conflicts)
- API: `src/app/api/chat/*` (new directory — no conflicts)
- Frontend: `src/components/chat/*`, `src/hooks/*`, `src/app/page.tsx` (no overlaps)

The lead handles **all shared file modifications** (schema.ts, env.ts, errors.ts, deps) in Phase 0 before spawning agents, so agents never write to the same files.

### Contracts (Published by Lead Before Spawn)

The lead agent defines these contracts upfront so all agents build against the same interfaces simultaneously:

#### Contract A: Database Types (Backend publishes → API + Frontend consume)

```typescript
// Tables: conversations, messages (already in schema.ts after lead bootstrap)
type Conversation = { id: string; title: string; createdAt: Date; updatedAt: Date }
type Message = { id: string; conversationId: string; role: string; content: string; createdAt: Date; updatedAt: Date }
type NewConversation = { title: string }
type NewMessage = { conversationId: string; role: string; content: string }
```

#### Contract B: Service Functions (Backend publishes → API consumes)

```typescript
// src/features/chat/index.ts exports:
function createConversation(title: string): Promise<Conversation>
function getConversation(id: string): Promise<Conversation>  // throws ConversationNotFoundError
function updateConversation(id: string, title: string): Promise<Conversation>
function deleteConversation(id: string): Promise<void>  // throws ConversationNotFoundError
function getMessages(conversationId: string): Promise<Message[]>
function addMessage(conversationId: string, role: string, content: string): Promise<Message>
function generateTitleFromMessage(content: string): string  // truncate to 50 chars + "..."
function streamChatCompletion(history: Message[]): Promise<{ stream: ReadableStream; fullResponse: Promise<string> }>
function buildMessages(history: Message[]): Array<{ role: string; content: string }>
```

#### Contract C: Schemas (Backend publishes → API consumes)

```typescript
// Zod schemas from src/features/chat/index.ts:
SendMessageSchema = z.object({ content: z.string().min(1).max(10000), conversationId: z.string().uuid().optional() })
CreateConversationSchema = z.object({ title: z.string().min(1).max(200) })
UpdateConversationSchema = z.object({ title: z.string().min(1).max(200) })
```

#### Contract D: Error Classes (Backend publishes → API consumes)

```typescript
class ChatError extends Error { code: string; statusCode: HttpStatusCode }
class ConversationNotFoundError extends ChatError  // code: "CONVERSATION_NOT_FOUND", statusCode: 404
class OpenRouterError extends ChatError            // code: "OPENROUTER_ERROR", statusCode: 502
class StreamError extends ChatError                // code: "STREAM_ERROR", statusCode: 500
```

#### Contract E: API Endpoints (API publishes → Frontend consumes)

```
POST   /api/chat/conversations                → 201 { id, title, createdAt, updatedAt }
GET    /api/chat/conversations/[id]            → 200 { id, title, createdAt, updatedAt }
PATCH  /api/chat/conversations/[id]            → 200 { id, title, createdAt, updatedAt }
DELETE /api/chat/conversations/[id]            → 204 (no body)
GET    /api/chat/conversations/[id]/messages   → 200 { messages: Message[] }

POST   /api/chat/send
  Request:  { content: string, conversationId?: string }
  Response: SSE stream (text/event-stream)
  Headers:  X-Conversation-Id (always present, essential for new conversations)
  Events:   data: {"content":"chunk"}\n\n
  Final:    data: [DONE]\n\n
```

#### Contract F: Constants

```typescript
SYSTEM_PROMPT = "You are a helpful AI assistant. Be concise, accurate, and friendly."
MAX_CONTEXT_MESSAGES = 50
```

### Cross-Cutting Concerns

| Concern | Owner | Detail |
|---------|-------|--------|
| SSE chunk format | Backend (stream.ts) | `data: {"content":"..."}\n\n` with `data: [DONE]\n\n` terminator |
| `X-Conversation-Id` header | API Agent | Always set on `/api/chat/send` responses |
| localStorage key format | Frontend | `chat-conversations` key, stores `Array<{ id: string; title: string; updatedAt: string }>` |
| Error response shape | Inherited | Uses existing `ErrorResponse` from `src/shared/schemas/errors.ts` |
| Markdown rendering | Frontend | `react-markdown` + `remark-gfm` + `rehype-highlight` |
| Auto-scroll behavior | Frontend | Scroll to bottom unless user scrolled up >100px |

---

## Patterns to Follow

### Feature Slice (models.ts)
```typescript
// SOURCE: src/features/projects/models.ts:1-8
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { conversations, messages } from "@/core/database/schema";
export { conversations, messages };
export type Conversation = InferSelectModel<typeof conversations>;
export type NewConversation = InferInsertModel<typeof conversations>;
export type Message = InferSelectModel<typeof messages>;
export type NewMessage = InferInsertModel<typeof messages>;
```

### Error Classes
```typescript
// SOURCE: src/features/projects/errors.ts:12-30
// Base error with code + statusCode for automatic HTTP mapping via isHttpError()
export class ChatError extends Error {
  constructor(message: string, public readonly code: string, public readonly statusCode: HttpStatusCode) {
    super(message);
    this.name = "ChatError";
  }
}
```

### Repository Pattern
```typescript
// SOURCE: src/features/projects/repository.ts:8-10
// Pure DB operations, no business logic, return T | undefined for single records
export async function findById(id: string): Promise<Project | undefined> {
  const results = await db.select().from(table).where(eq(table.id, id)).limit(1);
  return results[0];
}
```

### Service Pattern
```typescript
// SOURCE: src/features/projects/service.ts:47-61
// Business logic with logging, access control, throws on not-found
const logger = getLogger("chat.service");
logger.info({ conversationId }, "conversation.create_started");
// ... call repository ...
logger.info({ conversationId }, "conversation.create_completed");
```

### API Route Pattern
```typescript
// SOURCE: src/app/api/projects/[id]/route.ts:10-12
// Dynamic route params are Promise in Next.js 16
interface RouteParams { params: Promise<{ id: string }> }
// Line 21: const { id } = await params;
// All handlers wrapped in try/catch with handleApiError(error)
```

### Test Pattern
```typescript
// SOURCE: src/features/projects/tests/service.test.ts:6-24
// Mock module BEFORE importing service
const mockRepository = { findById: mock(() => Promise.resolve(undefined)) };
mock.module("../repository", () => mockRepository);
// Then import service
const { getConversation } = await import("../service");
```

### Environment Config
```typescript
// SOURCE: src/core/config/env.ts:1-6,9-10
// Required: getRequiredEnv("KEY") — throws if missing
// Optional: getOptionalEnv("KEY", "default") — returns default
```

---

## Files to Change

### Modified Files (5) — Lead Agent Phase 0

| File | Action | Purpose |
|------|--------|---------|
| `src/core/config/env.ts` | UPDATE | Add OPENROUTER_API_KEY (required) and OPENROUTER_MODEL (optional, default "anthropic/claude-haiku-4.5") |
| `src/core/database/schema.ts` | UPDATE | Add `conversations` and `messages` tables |
| `src/core/api/errors.ts` | UPDATE | Remove `ProjectError` import (line 5) and re-export (line 100); `isHttpError()` duck-typing handles all feature errors generically |
| `.env.example` | UPDATE | Add OPENROUTER_API_KEY, OPENROUTER_MODEL vars |

### New Files — Backend Agent (12)

| File | Action | Purpose |
|------|--------|---------|
| `src/features/chat/models.ts` | CREATE | Re-export tables, infer Conversation/Message/NewConversation/NewMessage types |
| `src/features/chat/schemas.ts` | CREATE | SendMessageSchema, CreateConversationSchema, UpdateConversationSchema |
| `src/features/chat/errors.ts` | CREATE | ChatError base, ConversationNotFoundError, OpenRouterError, StreamError |
| `src/features/chat/constants.ts` | CREATE | SYSTEM_PROMPT, MAX_CONTEXT_MESSAGES (50) |
| `src/features/chat/repository.ts` | CREATE | DB queries for conversations and messages |
| `src/features/chat/service.ts` | CREATE | Business logic: CRUD + generateTitleFromMessage |
| `src/features/chat/stream.ts` | CREATE | buildMessages() + streamChatCompletion() — OpenRouter SSE |
| `src/features/chat/index.ts` | CREATE | Public API exports |
| `src/features/chat/tests/schemas.test.ts` | CREATE | Schema validation tests |
| `src/features/chat/tests/errors.test.ts` | CREATE | Error class tests |
| `src/features/chat/tests/service.test.ts` | CREATE | Service logic tests with mocked repository |
| `src/features/chat/tests/stream.test.ts` | CREATE | buildMessages() pure function tests |

### New Files — API Agent (7)

| File | Action | Purpose |
|------|--------|---------|
| `src/app/api/chat/conversations/route.ts` | CREATE | POST — create conversation |
| `src/app/api/chat/conversations/[id]/route.ts` | CREATE | GET, PATCH, DELETE — single conversation CRUD |
| `src/app/api/chat/conversations/[id]/messages/route.ts` | CREATE | GET — list messages for conversation |
| `src/app/api/chat/send/route.ts` | CREATE | POST — send message + stream SSE response |
| `src/app/api/chat/conversations/route.test.ts` | CREATE | POST creation tests |
| `src/app/api/chat/conversations/[id]/route.test.ts` | CREATE | GET/PATCH/DELETE tests |
| `src/app/api/chat/send/route.test.ts` | CREATE | SSE streaming tests |

### New Files — Frontend Agent (12)

| File | Action | Purpose |
|------|--------|---------|
| `src/components/chat/markdown-content.tsx` | CREATE | ReactMarkdown + remark-gfm + rehype-highlight |
| `src/components/chat/message-bubble.tsx` | CREATE | User vs assistant message styling |
| `src/components/chat/message-list.tsx` | CREATE | ScrollArea with auto-scroll, renders messages |
| `src/components/chat/chat-input.tsx` | CREATE | Auto-resize textarea + send button |
| `src/components/chat/chat-header.tsx` | CREATE | Title display, mobile sidebar toggle, theme toggle |
| `src/components/chat/conversation-item.tsx` | CREATE | Sidebar item with rename/delete dropdown |
| `src/components/chat/chat-sidebar.tsx` | CREATE | New Chat button + conversation list |
| `src/components/chat/chat-layout.tsx` | CREATE | Flex container: sidebar (w-72) + main area |
| `src/hooks/use-chat.ts` | CREATE | Core chat state: conversations, messages, streaming, send/receive |
| `src/hooks/use-auto-scroll.ts` | CREATE | Auto-scroll with 100px threshold |
| `src/hooks/use-local-storage.ts` | CREATE | Track conversation IDs + titles in localStorage |
| `src/app/page.tsx` | UPDATE | Replace placeholder with ChatLayout |

### New Files — Frontend Tests (3)

| File | Action | Purpose |
|------|--------|---------|
| `src/components/chat/tests/markdown-content.test.tsx` | CREATE | Renders plain text, code blocks, links |
| `src/components/chat/tests/message-bubble.test.tsx` | CREATE | User vs assistant styling |
| `src/components/chat/tests/chat-input.test.tsx` | CREATE | Type + submit, clear, disabled state |

---

## Tasks

### PHASE 0: Lead Agent Bootstrap (Sequential — Must Complete Before Spawning Agents)

#### Task 1: Add OpenRouter environment variables

- **Files**: `src/core/config/env.ts`, `.env.example`
- **Action**: UPDATE
- **Implement**:
  - Add `OPENROUTER_API_KEY: getRequiredEnv("OPENROUTER_API_KEY")` to env export
  - Add `OPENROUTER_MODEL: getOptionalEnv("OPENROUTER_MODEL", "anthropic/claude-haiku-4.5")` to env export
  - Update `.env.example` with both vars (fix typo `OEPNROUTER_MODEL` → `OPENROUTER_MODEL`)
- **Mirror**: `src/core/config/env.ts:30-42` — follow existing pattern
- **Validate**: `bun run lint && npx tsc --noEmit`

#### Task 2: Add conversations and messages database tables

- **Files**: `src/core/database/schema.ts`
- **Action**: UPDATE
- **Implement**:
  - Add `conversations` table: `id` (uuid pk defaultRandom), `title` (text, not null), `...timestamps`
  - Add `messages` table: `id` (uuid pk defaultRandom), `conversationId` (uuid fk→conversations, onDelete cascade, not null), `role` (text, not null), `content` (text, not null), `...timestamps`
  - `role` is text (not enum) — validated at Zod layer
  - No `ownerId` since no auth
- **Mirror**: `src/core/database/schema.ts:45-55` — follow projects table pattern exactly
- **Validate**: `bun run lint && npx tsc --noEmit`

#### Task 3: Generate and run database migration

- **Action**: RUN
- **Implement**: `bun run db:generate && bun run db:migrate`
- **Validate**: Migration runs without errors

#### Task 4: Generalize API error handler

- **Files**: `src/core/api/errors.ts`
- **Action**: UPDATE
- **Implement**:
  - Remove line 5: `import { ProjectError } from "@/features/projects";`
  - Remove line 100: `export { ProjectError };`
  - Update the comment on line 73 from "Handle feature errors (ProjectError, etc.)" to "Handle feature errors with HTTP semantics"
- **Mirror**: `src/core/api/errors.ts:30-40` — `isHttpError()` already handles all feature errors
- **Validate**: `bun run lint && npx tsc --noEmit`

#### Task 5: Install UI dependencies

- **Action**: RUN
- **Implement**:
  - `bun add react-markdown remark-gfm rehype-highlight highlight.js`
  - `bunx shadcn@canary add scroll-area`
  - `bun run lint:fix`
- **Validate**: `bun run lint && npx tsc --noEmit`

#### Task 6: Publish contracts to all agents

- **Action**: COORDINATE
- **Implement**: Forward Contracts A–F (defined above) to each agent at spawn time. Each agent receives the full contract set plus their specific task list.

---

### PHASE 1: Parallel Agent Execution (All 3 Agents Spawn Simultaneously)

> **All three agents run at the same time.** No file conflicts because they own non-overlapping directories. Each agent validates their own domain before completing.

#### Backend Agent Tasks (src/features/chat/*)

##### Task 7: Create models, schemas, errors, constants

- **Files**: `src/features/chat/models.ts`, `schemas.ts`, `errors.ts`, `constants.ts`
- **Action**: CREATE
- **Implement**:
  - `models.ts`: Re-export `conversations`/`messages` tables from schema, infer `Conversation`, `Message`, `NewConversation`, `NewMessage` types
  - `schemas.ts`: `SendMessageSchema` (content: string min 1 max 10000, conversationId: string uuid optional), `CreateConversationSchema` (title: string min 1 max 200), `UpdateConversationSchema` (title: string min 1 max 200). Import from `zod/v4`.
  - `errors.ts`: `ChatError` base class with `code`/`statusCode`, `ConversationNotFoundError` (404, "CONVERSATION_NOT_FOUND"), `OpenRouterError` (502, "OPENROUTER_ERROR"), `StreamError` (500, "STREAM_ERROR")
  - `constants.ts`: `SYSTEM_PROMPT` = "You are a helpful AI assistant. Be concise, accurate, and friendly.", `MAX_CONTEXT_MESSAGES` = 50
- **Mirror**: `src/features/projects/models.ts`, `schemas.ts`, `errors.ts`
- **Validate**: `bun run lint && npx tsc --noEmit`

##### Task 8: Create repository

- **Files**: `src/features/chat/repository.ts`
- **Action**: CREATE
- **Implement**:
  - `findConversationById(id)` → `Conversation | undefined`
  - `createConversation(data: NewConversation)` → `Conversation`
  - `updateConversation(id, data: Partial<NewConversation>)` → `Conversation | undefined`
  - `deleteConversation(id)` → `boolean`
  - `findMessagesByConversationId(conversationId, limit?)` → `Message[]` (ordered by createdAt asc)
  - `createMessage(data: NewMessage)` → `Message`
- **Mirror**: `src/features/projects/repository.ts:8-62`
- **Validate**: `bun run lint && npx tsc --noEmit`

##### Task 9: Create service

- **Files**: `src/features/chat/service.ts`
- **Action**: CREATE
- **Implement**:
  - `import * as repository from "./repository"`
  - `getLogger("chat.service")` with `_started`/`_completed`/`_failed` pattern
  - `createConversation(title)`, `getConversation(id)`, `updateConversation(id, title)`, `deleteConversation(id)`, `getMessages(conversationId)`, `addMessage(conversationId, role, content)`, `generateTitleFromMessage(content)`
  - Throw `ConversationNotFoundError` when entity not found
  - Update `updatedAt: new Date()` on mutations
- **Mirror**: `src/features/projects/service.ts:47-191`
- **Validate**: `bun run lint && npx tsc --noEmit`

##### Task 10: Create streaming module

- **Files**: `src/features/chat/stream.ts`
- **Action**: CREATE
- **Implement**:
  - `buildMessages(history: Message[])` — prepend system prompt, limit to last `MAX_CONTEXT_MESSAGES`, map to `{ role, content }`
  - `streamChatCompletion(history: Message[])` — POST to `https://openrouter.ai/api/v1/chat/completions` with `stream: true`, returns `{ stream: ReadableStream, fullResponse: Promise<string> }`
  - `TransformStream` parses `data: {...}` lines, re-emits `{"content":"chunk"}` JSON
  - `fullResponse` resolves with accumulated text on `[DONE]`
  - Errors wrapped in `OpenRouterError` / `StreamError`
- **Validate**: `bun run lint && npx tsc --noEmit`

##### Task 11: Create feature index

- **Files**: `src/features/chat/index.ts`
- **Action**: CREATE
- **Implement**: Export types, schemas, errors, service functions, stream functions, constants (NOT repository)
- **Mirror**: `src/features/projects/index.ts:1-23`
- **Validate**: `bun run lint && npx tsc --noEmit`

##### Task 12: Write unit tests

- **Files**: `src/features/chat/tests/schemas.test.ts`, `errors.test.ts`, `service.test.ts`, `stream.test.ts`
- **Action**: CREATE
- **Implement**:
  - `schemas.test.ts`: Valid/invalid inputs for all three schemas
  - `errors.test.ts`: Correct `code`, `statusCode`, `message`; `instanceof` checks
  - `service.test.ts`: Mock repository with `mock.module()`, test all service functions including error paths
  - `stream.test.ts`: `buildMessages()` pure function — system prompt prepended, context limited, roles mapped
- **Mirror**: `src/features/projects/tests/service.test.ts:6-24`
- **Validate**: `bun test src/features/chat/`

##### Backend Agent Final Validation
```bash
bun run lint && npx tsc --noEmit && bun test src/features/chat/
```

---

#### API Agent Tasks (src/app/api/chat/*)

##### Task 13: Create conversation CRUD routes

- **Files**: `src/app/api/chat/conversations/route.ts`, `[id]/route.ts`, `[id]/messages/route.ts`
- **Action**: CREATE
- **Implement**:
  - `POST /api/chat/conversations` — parse `CreateConversationSchema`, call `createConversation()`, return 201
  - `GET /api/chat/conversations/[id]` — call `getConversation(id)`, return 200
  - `PATCH /api/chat/conversations/[id]` — parse `UpdateConversationSchema`, call `updateConversation()`, return 200
  - `DELETE /api/chat/conversations/[id]` — call `deleteConversation()`, return 204
  - `GET /api/chat/conversations/[id]/messages` — call `getMessages(id)`, return 200 `{ messages: [...] }`
  - All handlers: `try/catch` with `handleApiError(error)`
  - Dynamic params: `interface RouteParams { params: Promise<{ id: string }> }`
- **Mirror**: `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts`
- **Validate**: `bun run lint && npx tsc --noEmit`

##### Task 14: Create SSE streaming send endpoint

- **Files**: `src/app/api/chat/send/route.ts`
- **Action**: CREATE
- **Implement**:
  1. Parse `{ content, conversationId? }` with `SendMessageSchema`
  2. If no `conversationId`, create new conversation with `generateTitleFromMessage(content)` as title
  3. Save user message via `addMessage(conversationId, "user", content)`
  4. Fetch history via `getMessages(conversationId)`
  5. Call `streamChatCompletion(history)`
  6. Return `new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Conversation-Id": conversationId } })`
  7. After stream completes (`fullResponse.then()`): save assistant message via `addMessage(conversationId, "assistant", fullText)`
- **Validate**: `bun run lint && npx tsc --noEmit`

##### Task 15: Write API route tests

- **Files**: `src/app/api/chat/conversations/route.test.ts`, `[id]/route.test.ts`, `send/route.test.ts`
- **Action**: CREATE
- **Implement**:
  - `conversations/route.test.ts`: POST creates conversation, 400 on invalid input
  - `[id]/route.test.ts`: GET returns/404s, PATCH renames, DELETE removes with 204
  - `send/route.test.ts`: Mock `streamChatCompletion`, verify user message saved, SSE headers, `X-Conversation-Id` header present
- **Mirror**: `src/app/api/projects/route.test.ts`, `src/app/api/projects/[id]/route.test.ts`
- **Validate**: `bun test src/app/api/chat/`

##### API Agent Final Validation
```bash
bun run lint && npx tsc --noEmit && bun test src/app/api/chat/
```

---

#### Frontend Agent Tasks (src/components/chat/*, src/hooks/*, src/app/page.tsx)

##### Task 16: Create hooks

- **Files**: `src/hooks/use-chat.ts`, `use-auto-scroll.ts`, `use-local-storage.ts`
- **Action**: CREATE
- **Implement**:
  - `useLocalStorage<T>(key)`: Get/set from localStorage, return `{ items, addItem, removeItem, updateItem }`, SSR-safe (initialize as empty, hydrate in useEffect)
  - `useAutoScroll(ref, dependencies)`: Scroll to bottom on new content unless user scrolled up >100px
  - `useChat()`: Core state — `conversations` (from localStorage), `activeConversationId`, `messages` (fetched from GET `/api/chat/conversations/[id]/messages`), `isStreaming`, `streamingContent`, `sendMessage(content)` (POST to `/api/chat/send`, read SSE via `reader.read()` loop), `selectConversation(id)`, `createNewChat()`, `renameConversation(id, title)`, `deleteConversation(id)`. On new conversation: read `X-Conversation-Id` from response header, add to localStorage.
- **Mirror**: `src/features/auth/hooks.ts` — "use client", useState/useEffect
- **Validate**: `bun run lint && npx tsc --noEmit`

##### Task 17: Create chat UI components

- **Files**: All 8 files in `src/components/chat/`
- **Action**: CREATE
- **Implement**:
  - `markdown-content.tsx`: ReactMarkdown with `remarkGfm` and `rehypeHighlight`, prose container, code block styling via highlight.js CSS import
  - `message-bubble.tsx`: User (right-aligned, primary bg) vs assistant (left-aligned, muted bg), avatar, renders `MarkdownContent`
  - `message-list.tsx`: `ScrollArea` from shadcn, renders `MessageBubble` array + streaming bubble with cursor, uses `useAutoScroll`
  - `chat-input.tsx`: `Textarea` (auto-resize via scrollHeight), Send `Button`, Enter sends, Shift+Enter newline, disabled prop for streaming
  - `chat-header.tsx`: Title (or "New Chat"), hamburger for mobile sidebar toggle, `ThemeToggle`
  - `conversation-item.tsx`: Button with title, `DropdownMenu` (Rename/Delete), active state highlight
  - `chat-sidebar.tsx`: "New Chat" `Button`, `ConversationItem` list sorted by updatedAt desc, uses `Sheet` for mobile
  - `chat-layout.tsx`: Flex container — sidebar `div` (w-72, hidden below md) + main area (flex-1). Wires `useChat` to all children. Empty state with welcome message when no active conversation.
- **Mirror**: `src/components/ui/` for shadcn, `src/components/theme-toggle.tsx` for conventions
- **Validate**: `bun run lint && npx tsc --noEmit`

##### Task 18: Replace root page

- **Files**: `src/app/page.tsx`
- **Action**: UPDATE
- **Implement**: Replace with `ChatLayout` client component. Minimal — just `<ChatLayout />`. Update metadata in `layout.tsx` if needed.
- **Validate**: `bun run lint && npx tsc --noEmit`

##### Task 19: Write component tests

- **Files**: `src/components/chat/tests/markdown-content.test.tsx`, `message-bubble.test.tsx`, `chat-input.test.tsx`
- **Action**: CREATE
- **Implement**:
  - `markdown-content.test.tsx`: Renders plain text, code blocks, links, lists
  - `message-bubble.test.tsx`: User vs assistant styling, renders markdown
  - `chat-input.test.tsx`: Type + submit, clear after submit, disabled when streaming, Enter vs Shift+Enter
- **Mirror**: `src/app/(auth)/login/page.test.tsx` — RTL with `render`, `screen`, `userEvent`
- **Validate**: `bun test src/components/chat/`

##### Frontend Agent Final Validation
```bash
bun run lint && npx tsc --noEmit && bun test src/components/chat/ && bun test src/hooks/
```

---

### PHASE 2: Lead Agent — Integration Validation

#### Task 20: Full static validation

- **Action**: RUN (Lead Agent)
- **Implement**:
  ```bash
  bun run lint && npx tsc --noEmit && bun test && bun run build
  ```
- **If failures**: Identify which agent's domain the failure belongs to, spawn that agent with the specific error output to fix. Re-run validation after fix.

---

### PHASE 3: Lead Agent — E2E Validation with Agent Browser CLI

> **Prerequisite**: Start dev server `bun run dev` in background. Wait for it to be ready.

#### Task 21: Initial Load & Layout Verification

- **Action**: E2E (Lead Agent via agent-browser)
- **Steps**:
  1. `agent-browser open http://localhost:3000`
  2. `agent-browser snapshot -i` — capture interactive elements
  3. Verify: page loads without errors
  4. Verify: chat input textarea is visible and focusable
  5. Verify: sidebar is visible on desktop viewport (w-72 panel with "New Chat" button)
  6. Verify: empty state / welcome message displayed in main area
  7. Verify: theme toggle is present in header
  8. `agent-browser screenshot --path /tmp/e2e-initial-load.png`

#### Task 22: Send First Message & Receive Streaming Response

- **Action**: E2E (Lead Agent via agent-browser)
- **Steps**:
  1. `agent-browser snapshot -i` — get textarea ref
  2. `agent-browser fill @{textarea-ref} "Hello! What is 2 + 2?"` — type a message
  3. `agent-browser click @{send-button-ref}` — send the message
  4. `agent-browser wait --text "4" --timeout 30000` — wait for LLM response containing the answer
  5. Verify: user message "Hello! What is 2 + 2?" appears in the chat area (right-aligned, primary styling)
  6. Verify: assistant response appears (left-aligned, muted styling) and contains "4"
  7. Verify: assistant response is non-empty and coherent
  8. `agent-browser snapshot -i` — re-snapshot to check sidebar
  9. Verify: a conversation appears in the sidebar with an auto-generated title (derived from "Hello! What is 2 + 2?")
  10. `agent-browser screenshot --path /tmp/e2e-first-message.png`

#### Task 23: Conversation Persistence (Page Reload)

- **Action**: E2E (Lead Agent via agent-browser)
- **Steps**:
  1. Note the current conversation title from sidebar
  2. `agent-browser reload`
  3. `agent-browser wait --load networkidle`
  4. `agent-browser snapshot -i`
  5. Verify: the conversation still appears in the sidebar after reload
  6. `agent-browser click @{conversation-item-ref}` — click the conversation
  7. `agent-browser wait --timeout 5000` — wait for messages to load
  8. `agent-browser snapshot` — check message content
  9. Verify: both the user message ("Hello! What is 2 + 2?") and the assistant response are loaded from the database
  10. Verify: messages display correctly with proper styling (user right, assistant left)

#### Task 24: Multi-Turn Conversation (Context/History Validation)

- **Action**: E2E (Lead Agent via agent-browser)
- **Steps**:
  1. `agent-browser snapshot -i` — get textarea ref in existing conversation
  2. `agent-browser fill @{textarea-ref} "What is the capital of France?"`
  3. `agent-browser click @{send-button-ref}`
  4. `agent-browser wait --text "Paris" --timeout 30000`
  5. Verify: response contains "Paris"
  6. `agent-browser snapshot -i` — re-get refs after DOM update
  7. `agent-browser fill @{textarea-ref} "And what about Germany?"`
  8. `agent-browser click @{send-button-ref}`
  9. `agent-browser wait --text "Berlin" --timeout 30000`
  10. Verify: response contains "Berlin" — proves conversation history/context is working
  11. Verify: all 4 messages (2 user + 2 assistant) are visible in the chat area in correct order
  12. `agent-browser screenshot --path /tmp/e2e-multi-turn.png`

#### Task 25: Create New Conversation

- **Action**: E2E (Lead Agent via agent-browser)
- **Steps**:
  1. `agent-browser snapshot -i`
  2. `agent-browser click @{new-chat-button-ref}` — click "New Chat"
  3. `agent-browser snapshot`
  4. Verify: main chat area clears (no messages)
  5. Verify: empty state / welcome message reappears
  6. `agent-browser fill @{textarea-ref} "Tell me a fun fact about octopuses"`
  7. `agent-browser click @{send-button-ref}`
  8. `agent-browser wait --text "octop" --timeout 30000` — wait for response mentioning octopus
  9. Verify: response is non-empty and related to octopuses
  10. `agent-browser snapshot -i`
  11. Verify: TWO conversations now appear in the sidebar (the original and the new one)
  12. Verify: the new conversation is highlighted as active
  13. `agent-browser screenshot --path /tmp/e2e-new-conversation.png`

#### Task 26: Switch Between Conversations

- **Action**: E2E (Lead Agent via agent-browser)
- **Steps**:
  1. `agent-browser snapshot -i`
  2. Identify the older conversation in the sidebar (the one about "2+2" / "France" / "Germany")
  3. `agent-browser click @{older-conversation-ref}` — switch to it
  4. `agent-browser wait --timeout 5000` — wait for messages to load
  5. `agent-browser snapshot`
  6. Verify: the previous conversation's messages load (should see "2 + 2", "Paris", "Berlin" messages)
  7. Verify: the older conversation is now highlighted as active in sidebar
  8. Switch back to the newer conversation
  9. Verify: octopus conversation loads correctly

#### Task 27: Rename Conversation

- **Action**: E2E (Lead Agent via agent-browser)
- **Steps**:
  1. `agent-browser snapshot -i`
  2. Find the dropdown trigger (three dots / kebab menu) on a conversation item
  3. `agent-browser click @{dropdown-trigger-ref}`
  4. `agent-browser snapshot -i` — get menu items after dropdown opens
  5. `agent-browser click @{rename-option-ref}` — click rename
  6. `agent-browser snapshot -i` — find the rename input/dialog
  7. Clear the existing title and type a new one: "My Test Conversation"
  8. Submit the rename (Enter or confirm button)
  9. `agent-browser wait --timeout 3000`
  10. `agent-browser snapshot`
  11. Verify: conversation title in sidebar now shows "My Test Conversation"
  12. `agent-browser screenshot --path /tmp/e2e-rename.png`

#### Task 28: Delete Conversation

- **Action**: E2E (Lead Agent via agent-browser)
- **Steps**:
  1. Note how many conversations are in sidebar (should be 2)
  2. `agent-browser snapshot -i`
  3. `agent-browser click @{dropdown-trigger-ref}` on the conversation to delete
  4. `agent-browser snapshot -i`
  5. `agent-browser click @{delete-option-ref}` — click delete
  6. If there's a confirmation dialog, confirm it
  7. `agent-browser wait --timeout 3000`
  8. `agent-browser snapshot -i`
  9. Verify: deleted conversation is removed from sidebar
  10. Verify: sidebar now shows 1 fewer conversation
  11. `agent-browser screenshot --path /tmp/e2e-delete.png`

#### Task 29: Markdown Rendering Validation

- **Action**: E2E (Lead Agent via agent-browser)
- **Steps**:
  1. Create a new conversation or use existing
  2. `agent-browser fill @{textarea-ref} "Show me a Python hello world with a code block, a bulleted list of 3 items, and a **bold** word"`
  3. `agent-browser click @{send-button-ref}`
  4. `agent-browser wait --timeout 30000` — wait for response
  5. `agent-browser snapshot`
  6. Verify: response contains a `<code>` or `<pre>` block (code highlighting working)
  7. Verify: response contains a `<ul>` with `<li>` items (list rendering)
  8. Verify: response contains `<strong>` text (bold rendering)
  9. `agent-browser screenshot --path /tmp/e2e-markdown.png`

#### Task 30: Chat Input Behavior

- **Action**: E2E (Lead Agent via agent-browser)
- **Steps**:
  1. `agent-browser snapshot -i`
  2. `agent-browser fill @{textarea-ref} "Test message"`
  3. Verify: Send button is enabled when textarea has content
  4. `agent-browser click @{send-button-ref}`
  5. Verify: textarea clears after sending
  6. While streaming is in progress (if observable): verify input is disabled or send button is disabled
  7. After streaming completes: verify input is re-enabled

#### Task 31: Mobile Responsiveness

- **Action**: E2E (Lead Agent via agent-browser)
- **Steps**:
  1. `agent-browser set-viewport 375 812` — iPhone viewport
  2. `agent-browser snapshot -i`
  3. Verify: sidebar is hidden (not visible)
  4. Verify: hamburger / menu toggle button is visible in header
  5. `agent-browser click @{menu-toggle-ref}` — open mobile sidebar
  6. `agent-browser snapshot -i`
  7. Verify: sidebar slides in (Sheet component)
  8. Verify: conversations are listed
  9. Verify: "New Chat" button is accessible
  10. Close the sidebar (click outside or close button)
  11. `agent-browser set-viewport 1280 720` — restore desktop viewport
  12. `agent-browser screenshot --path /tmp/e2e-mobile.png`

#### Task 32: Theme Toggle

- **Action**: E2E (Lead Agent via agent-browser)
- **Steps**:
  1. `agent-browser snapshot -i`
  2. Note current theme (light/dark)
  3. `agent-browser click @{theme-toggle-ref}`
  4. `agent-browser snapshot -i` — if dropdown, select opposite theme
  5. `agent-browser wait --timeout 1000`
  6. `agent-browser snapshot`
  7. Verify: theme changed (background color or class on html/body switched)
  8. Verify: chat messages, sidebar, and input are all styled correctly in new theme

#### Task 33: Error Handling — Empty Message

- **Action**: E2E (Lead Agent via agent-browser)
- **Steps**:
  1. `agent-browser snapshot -i`
  2. Try to click send with empty textarea
  3. Verify: no request is made (button disabled or validation prevents sending)
  4. Verify: no error crashes the UI

---

### PHASE 4: Lead Agent — Fix Loop

#### Task 34: Triage and fix issues

- **Action**: COORDINATE (Lead Agent)
- **Implement**:
  1. Collect all failures from Phase 2 (static validation) and Phase 3 (E2E)
  2. Categorize each failure by owning agent domain:
     - Backend failures (feature slice logic, type issues) → spawn Backend fix agent
     - API failures (route errors, SSE issues) → spawn API fix agent
     - Frontend failures (UI bugs, styling, hook issues) → spawn Frontend fix agent
     - Integration failures (contract mismatches) → lead fixes directly or spawns targeted agent
  3. Spawn fix agents in parallel (same parallel model as Phase 1)
  4. Each fix agent receives: the specific error output, the file(s) involved, and what the expected behavior should be
  5. After fix agents complete: re-run full validation pipeline
     ```bash
     bun run lint && npx tsc --noEmit && bun test && bun run build
     ```
  6. If static validation passes: re-run **only the failing E2E scenarios** from Phase 3
  7. **Repeat this loop** until all E2E scenarios pass cleanly
  8. Take a final screenshot: `agent-browser screenshot --path /tmp/e2e-final.png`

---

## Validation Summary

```bash
# Layer 1: Static (each agent runs their own, then lead runs full)
bun run lint && npx tsc --noEmit && bun test && bun run build

# Layer 2: E2E (lead agent only, after Layer 1 passes)
# Start dev server
bun run dev &
# Run all E2E scenarios (Tasks 21-33) via agent-browser CLI
# Screenshots saved to /tmp/e2e-*.png

# Layer 3: Fix loop (lead spawns fix agents → revalidate → repeat)
# Continues until 0 failures across both layers
```

---

## Acceptance Criteria

- [ ] OpenRouter env vars configured and validated
- [ ] Conversations and messages tables created with migration
- [ ] Chat feature slice follows vertical slice architecture
- [ ] API error handler is generic (no feature-specific imports)
- [ ] Streaming endpoint sends SSE with `X-Conversation-Id` header
- [ ] Auto-title from first user message (truncated to 50 chars)
- [ ] Conversation history limited to 50 messages for context
- [ ] Chat UI has sidebar + main area layout
- [ ] Mobile responsive (Sheet sidebar)
- [ ] Markdown rendering with code highlighting
- [ ] Auto-scroll with user-scroll-up detection
- [ ] All unit tests pass
- [ ] `bun run build` succeeds
- [ ] Type check and lint clean
- [ ] E2E: Page loads with empty state
- [ ] E2E: Send message and receive streaming LLM response
- [ ] E2E: Conversations persist across page reload
- [ ] E2E: Multi-turn conversation maintains context (history works)
- [ ] E2E: Create new conversation clears chat
- [ ] E2E: Switch between conversations loads correct messages
- [ ] E2E: Rename conversation updates sidebar
- [ ] E2E: Delete conversation removes from sidebar
- [ ] E2E: Markdown renders code blocks, lists, bold text
- [ ] E2E: Chat input clears after send, disabled during streaming
- [ ] E2E: Mobile sidebar toggle works (Sheet slides in/out)
- [ ] E2E: Theme toggle switches light/dark correctly
- [ ] E2E: Empty message cannot be sent
