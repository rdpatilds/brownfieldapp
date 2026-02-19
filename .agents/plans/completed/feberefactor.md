# Plan: Frontend-Backend Separation Refactor

## Summary

Refactor the Bun workspaces monorepo (`packages/shared`, `packages/backend`, `packages/frontend`) into two standalone projects (`backend/`, `frontend/`) within the same git repo. Eliminate the shared package by moving all shared code into the backend (`backend/src/shared/`) and duplicating only the ~100 lines of types/constants the frontend needs into `frontend/src/contracts/`. Migrate the backend from Bun to Node.js + pnpm + Vitest. Keep the frontend on Bun. Add comprehensive E2E tests using browser-agent CLI in headed mode.

## User Story

As a developer
I want frontend and backend as independent standalone projects
So that each can be deployed, versioned, and developed independently without workspace coupling

## Metadata

| Field | Value |
|-------|-------|
| Type | REFACTOR |
| Complexity | HIGH |
| Systems Affected | backend, frontend, shared (eliminated), root config, tests, CI |

---

## Patterns to Follow

### Backend Service Pattern
```typescript
// SOURCE: packages/backend/src/features/billing/service.ts:1-8
import { FREE_SIGNUP_TOKENS, TOKEN_PACKS } from "@chatapp/shared"; // → becomes @/shared/constants
import { getLogger } from "../../logging";
import { InsufficientTokensError, InvalidPackError } from "./errors";
import type { TokenTransaction } from "./models";
import * as repository from "./repository";
const logger = getLogger("billing.service");
```

### Backend Test Pattern (bun:test → vitest migration)
```typescript
// SOURCE: packages/backend/src/features/billing/tests/service.test.ts:1-10
// BEFORE (bun:test):
import { beforeEach, describe, expect, it, mock } from "bun:test";
mock.module("../repository", () => mockRepository);
const { grantSignupTokens } = await import("../service");

// AFTER (vitest):
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../repository", () => ({ default: undefined, ...mockRepository }));
const { grantSignupTokens } = await import("../service");
```

### Frontend Import Pattern (shared → contracts)
```typescript
// SOURCE: packages/frontend/src/hooks/use-chat.ts:1-12
// BEFORE:
import type { ChatErrorPayload, StreamChunkPayload } from "@chatapp/shared";
import { CLIENT_EVENTS, SERVER_EVENTS } from "@chatapp/shared";

// AFTER:
import type { ChatErrorPayload, StreamChunkPayload } from "@/contracts/socket-events";
import { CLIENT_EVENTS, SERVER_EVENTS } from "@/contracts/socket-events";
```

### Error Handling Pattern
```typescript
// SOURCE: packages/backend/src/middleware/error-handler.ts:63-91
// Uses createErrorResponse() from shared → becomes @/shared/schemas/errors
```

---

## Files to Change

### Phase 1: Directory Restructuring

| File/Dir | Action | Purpose |
|----------|--------|---------|
| `packages/backend/` → `backend/` | MOVE | Flatten monorepo structure |
| `packages/frontend/` → `frontend/` | MOVE | Flatten monorepo structure |
| `packages/shared/src/` → `backend/src/shared/` | MOVE | Backend owns all shared code |
| `packages/` | DELETE | Remove monorepo nesting |

### Phase 2: Backend Node.js Migration

| File | Action | Purpose |
|------|--------|---------|
| `backend/package.json` | UPDATE | Remove workspace dep, add tsx/vitest/pnpm scripts |
| `backend/tsconfig.json` | UPDATE | Standalone config, no base extension |
| `backend/biome.json` | CREATE | Backend-specific Biome config |
| `backend/vitest.config.ts` | CREATE | Vitest configuration |
| `backend/.env.sample` | CREATE | Backend-only env vars |
| `backend/src/shared/index.ts` | UPDATE | Internal barrel export |

### Phase 3: Backend Import Updates (13 files)

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/routes/webhooks.ts` | UPDATE | `@chatapp/shared` → `@/shared/constants` |
| `backend/src/middleware/error-handler.ts` | UPDATE | `@chatapp/shared` → `@/shared/schemas/errors` |
| `backend/src/socket/chat-handler.ts` | UPDATE | `@chatapp/shared` → `@/shared/socket-events` + `@/shared/schemas` |
| `backend/src/routes/projects.ts` | UPDATE | `@chatapp/shared` → `@/shared/schemas` |
| `backend/src/routes/billing.ts` | UPDATE | `@chatapp/shared` → `@/shared/schemas` + `@/shared/constants` |
| `backend/src/routes/documents.ts` | UPDATE | `@chatapp/shared` → `@/shared/types` + `@/shared/schemas` |
| `backend/src/routes/chat.ts` | UPDATE | `@chatapp/shared` → `@/shared/schemas` |
| `backend/src/features/documents/models.ts` | UPDATE | `@chatapp/shared` → `@/shared/types` |
| `backend/src/features/rag/models.ts` | UPDATE | `@chatapp/shared` → `@/shared/types` |
| `backend/src/features/projects/service.ts` | UPDATE | `@chatapp/shared` → `@/shared/schemas` |
| `backend/src/features/billing/service.ts` | UPDATE | `@chatapp/shared` → `@/shared/constants` |
| `backend/src/features/chat/stream.ts` | UPDATE | `@chatapp/shared` → `@/shared/constants` |
| `backend/src/features/chat/tests/stream.test.ts` | UPDATE | `@chatapp/shared` → `@/shared/constants` |

### Phase 4: Backend Test Migration (bun:test → vitest) — 15 files

| File | Action | Difficulty |
|------|--------|------------|
| `backend/src/features/billing/tests/errors.test.ts` | UPDATE | Easy (import swap) |
| `backend/src/features/chat/tests/errors.test.ts` | UPDATE | Easy |
| `backend/src/features/documents/tests/errors.test.ts` | UPDATE | Easy |
| `backend/src/features/projects/tests/errors.test.ts` | UPDATE | Easy |
| `backend/src/features/rag/tests/errors.test.ts` | UPDATE | Easy |
| `backend/src/features/documents/tests/service.test.ts` | UPDATE | Easy |
| `backend/src/features/rag/tests/service.test.ts` | UPDATE | Easy |
| `backend/src/features/billing/tests/service.test.ts` | UPDATE | Hard (mock.module → vi.mock) |
| `backend/src/features/chat/tests/service.test.ts` | UPDATE | Hard (mock.module → vi.mock) |
| `backend/src/features/chat/tests/stream.test.ts` | UPDATE | Hard (mock.module → vi.mock) |
| `backend/src/features/projects/tests/service.test.ts` | UPDATE | Hard (mock.module → vi.mock) |
| `backend/src/shared/schemas/tests/billing.test.ts` | UPDATE | Easy (import swap) |
| `backend/src/shared/schemas/tests/chat.test.ts` | UPDATE | Easy (import swap) |
| `backend/src/shared/schemas/tests/documents.test.ts` | UPDATE | Easy (import swap) |
| `backend/src/shared/schemas/tests/projects.test.ts` | UPDATE | Easy (import swap) |

### Phase 5: Frontend Standalone Setup

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/contracts/types.ts` | CREATE | Duplicated interfaces (DocumentSummary, ChatSource, UploadProgressEvent) |
| `frontend/src/contracts/socket-events.ts` | CREATE | CLIENT_EVENTS, SERVER_EVENTS + all payload interfaces |
| `frontend/src/contracts/constants.ts` | CREATE | TOKEN_PACKS, LOW_BALANCE_THRESHOLD, MAX_FILE_SIZE, ALLOWED_EXTENSIONS |
| `frontend/src/contracts/index.ts` | CREATE | Barrel export |
| `frontend/package.json` | UPDATE | Remove workspace dep |
| `frontend/tsconfig.json` | UPDATE | Remove @chatapp/shared path alias |
| `frontend/biome.json` | CREATE | Frontend-specific Biome config |
| `frontend/.env.sample` | CREATE | Frontend-only env vars |

### Phase 6: Frontend Import Updates (5 files)

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/hooks/use-chat.ts` | UPDATE | `@chatapp/shared` → `@/contracts/socket-events` |
| `frontend/src/hooks/use-tokens.ts` | UPDATE | `@chatapp/shared` → `@/contracts/constants` |
| `frontend/src/hooks/use-document-upload.ts` | UPDATE | `@chatapp/shared` → `@/contracts/types` + `@/contracts/constants` |
| `frontend/src/app/(dashboard)/dashboard/documents/_components/document-list.tsx` | UPDATE | `@chatapp/shared` → `@/contracts/types` |
| `frontend/src/app/(dashboard)/dashboard/billing/page.tsx` | UPDATE | `@chatapp/shared` → `@/contracts/constants` |

### Phase 7: Root Cleanup

| File | Action | Purpose |
|------|--------|---------|
| `package.json` (root) | DELETE | No more workspaces |
| `tsconfig.base.json` | DELETE | Each project has own config |
| `biome.json` (root) | DELETE | Moved into each project |
| `bun.lock` (root) | DELETE | Each project has own lockfile |
| `components.json` | MOVE → `frontend/` | shadcn/ui config belongs to frontend |
| `.gitignore` | UPDATE | Adapt paths for new structure |
| `CLAUDE.md` | UPDATE | Document new architecture |
| `.env.sample` | DELETE | Split into backend/ and frontend/ |

### Phase 8: E2E Tests with browser-agent CLI

| File | Action | Purpose |
|------|--------|---------|
| `e2e/README.md` | CREATE | E2E test documentation and run instructions |
| `e2e/tests/auth-flow.e2e.ts` | CREATE | Login/register E2E test |
| `e2e/tests/chat-message.e2e.ts` | CREATE | Send chat message, receive streamed response |
| `e2e/tests/rag-document-upload.e2e.ts` | CREATE | Upload document, verify RAG ingestion |
| `e2e/tests/token-consumption.e2e.ts` | CREATE | Send message, verify token deduction + balance update |
| `e2e/tests/billing-checkout.e2e.ts` | CREATE | Purchase tokens via Chargebee checkout flow |
| `e2e/tests/document-management.e2e.ts` | CREATE | Upload, list, delete documents |

---

## Tasks

Execute in order. Each task is atomic and verifiable.

---

### Task 1: Create Git Checkpoint

- **Action**: COMMAND
- **Implement**: Create a commit or tag marking the pre-refactor state so we can roll back if needed
- **Validate**: `git log --oneline -1`

---

### Task 2: Move Backend Out of packages/

- **Action**: MOVE
- **Implement**:
  1. Move `packages/backend/` to `backend/` (preserve all files including `drizzle/`, `drizzle.config.ts`)
  2. Verify directory structure matches: `backend/src/`, `backend/package.json`, `backend/tsconfig.json`, `backend/drizzle.config.ts`
- **Validate**: `ls backend/src/index.ts && ls backend/package.json`

---

### Task 3: Move Frontend Out of packages/

- **Action**: MOVE
- **Implement**:
  1. Move `packages/frontend/` to `frontend/` (preserve all files including `happydom.ts`, `testing-library.ts`, `bunfig.toml`)
  2. Verify directory structure matches
- **Validate**: `ls frontend/src/app && ls frontend/package.json`

---

### Task 4: Move Shared Code Into Backend

- **Action**: MOVE + CREATE
- **Implement**:
  1. Copy `packages/shared/src/` to `backend/src/shared/`
  2. Remove the shared package's `package.json`, `tsconfig.json` (backend has its own)
  3. Update `backend/src/shared/index.ts` — keep the barrel export as-is (re-exports constants, schemas, socket-events, types)
  4. Delete `packages/shared/` entirely
  5. Delete the now-empty `packages/` directory
- **Validate**: `ls backend/src/shared/index.ts && ls backend/src/shared/schemas/ && ls backend/src/shared/types/`

---

### Task 5: Create Frontend Contracts Layer

- **Action**: CREATE
- **Implement**:

  **`frontend/src/contracts/types.ts`** — Only the 3 type groups the frontend uses:
  ```typescript
  // Document types
  export interface DocumentSummary { id: string; title: string; source: string; chunk_count: number; total_tokens: number; created_at: string; }

  // Chat types
  export interface ChatSource { index: number; title: string; source: string; }

  // Upload progress (SSE streaming)
  export type UploadProgressEvent =
    | { type: "status"; message: string }
    | { type: "progress"; message: string; chunksProcessed: number; totalChunks: number }
    | { type: "complete"; documentId: string; title: string; chunkCount: number }
    | { type: "error"; message: string };
  ```

  **`frontend/src/contracts/socket-events.ts`** — Event constants + all 9 payload interfaces:
  ```typescript
  // Client-to-server events
  export const CLIENT_EVENTS = { SEND_MESSAGE: "chat:send_message", ABORT_STREAM: "chat:abort_stream" } as const;

  // Server-to-client events
  export const SERVER_EVENTS = { CONVERSATION_CREATED: "chat:conversation_created", TOKEN_CONSUMED: "chat:token_consumed", SOURCES: "chat:sources", STREAM_CHUNK: "chat:stream_chunk", STREAM_DONE: "chat:stream_done", STREAM_ERROR: "chat:stream_error", TOKEN_REFUNDED: "chat:token_refunded", ERROR: "chat:error" } as const;

  // Payload interfaces (all 9)
  export interface SendMessagePayload { content: string; conversationId?: string; }
  export interface ConversationCreatedPayload { conversationId: string; title: string; }
  export interface TokenConsumedPayload { remainingBalance: number; }
  export interface SourcesPayload { sources: Array<{ index: number; title: string; source: string }>; }
  export interface StreamChunkPayload { content: string; }
  export interface StreamDonePayload { saved: boolean; }
  export interface StreamErrorPayload { message: string; }
  export interface TokenRefundedPayload { message: string; }
  export interface ChatErrorPayload { code: string; message: string; }
  ```

  **`frontend/src/contracts/constants.ts`** — Runtime constants used by frontend:
  ```typescript
  export const LOW_BALANCE_THRESHOLD = 3;
  export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
  export const ALLOWED_EXTENSIONS = [".md", ".txt"] as const;

  export interface TokenPack { id: string; name: string; tokens: number; priceInCents: number; description: string; }
  export const TOKEN_PACKS: readonly TokenPack[] = [
    { id: "pack-50", name: "50 Tokens", tokens: 50, priceInCents: 500, description: "50 AI conversation turns" },
    { id: "pack-150", name: "150 Tokens", tokens: 150, priceInCents: 1000, description: "150 AI conversation turns" },
    { id: "pack-500", name: "500 Tokens", tokens: 500, priceInCents: 2500, description: "500 AI conversation turns" },
  ];
  ```

  **`frontend/src/contracts/index.ts`** — Barrel:
  ```typescript
  export * from "./types";
  export * from "./socket-events";
  export * from "./constants";
  ```

- **Mirror**: Copy exact values from `packages/shared/src/` — do NOT deviate
- **Validate**: `cd frontend && bun run tsc --noEmit` (type check passes)

---

### Task 6: Update Backend package.json for Node.js + pnpm

- **File**: `backend/package.json`
- **Action**: UPDATE
- **Implement**:
  1. Remove `"@chatapp/shared": "workspace:*"` from dependencies
  2. Add `zod` `^4.2.1` to dependencies (was previously inherited via shared)
  3. Add dev dependencies: `tsx` (TS execution for Node.js), `vitest` (test runner), `@types/node`
  4. Update scripts:
     ```json
     {
       "dev": "tsx watch src/index.ts",
       "start": "tsx src/index.ts",
       "build": "tsc --noEmit",
       "test": "vitest run",
       "test:watch": "vitest",
       "lint": "biome check .",
       "lint:fix": "biome check --fix .",
       "format": "biome format --write ."
     }
     ```
  5. Remove any Bun-specific fields
  6. Ensure `"type": "module"` is set for ESM
- **Validate**: `cd backend && pnpm install`

---

### Task 7: Create Backend vitest.config.ts

- **File**: `backend/vitest.config.ts`
- **Action**: CREATE
- **Implement**:
  ```typescript
  import { defineConfig } from "vitest/config";
  import path from "node:path";

  export default defineConfig({
    test: {
      globals: false,
      environment: "node",
      include: ["src/**/*.test.ts"],
      coverage: { provider: "v8" },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
  });
  ```
- **Validate**: `cd backend && pnpm vitest --version`

---

### Task 8: Update Backend tsconfig.json (Standalone)

- **File**: `backend/tsconfig.json`
- **Action**: UPDATE
- **Implement**:
  1. Remove `"extends": "../../tsconfig.base.json"` — inline all settings
  2. Full standalone config with all strict flags from the base:
     ```json
     {
       "compilerOptions": {
         "target": "ES2022",
         "lib": ["esnext"],
         "module": "esnext",
         "moduleResolution": "bundler",
         "strict": true,
         "noUncheckedIndexedAccess": true,
         "exactOptionalPropertyTypes": true,
         "noPropertyAccessFromIndexSignature": true,
         "noUnusedLocals": true,
         "noUnusedParameters": true,
         "noFallthroughCasesInSwitch": true,
         "verbatimModuleSyntax": true,
         "resolveJsonModule": true,
         "isolatedModules": true,
         "esModuleInterop": true,
         "skipLibCheck": true,
         "noEmit": true,
         "paths": {
           "@/*": ["./src/*"]
         }
       },
       "include": ["src/**/*.ts"],
       "exclude": ["node_modules", "dist", "drizzle"]
     }
     ```
  3. Remove the `@chatapp/shared` path alias
- **Validate**: `cd backend && pnpm tsc --noEmit`

---

### Task 9: Create Backend biome.json

- **File**: `backend/biome.json`
- **Action**: CREATE
- **Implement**: Copy relevant rules from root `biome.json`, keeping:
  - Same formatter settings (2-space, 100-char, double quotes)
  - Same linter rules (unused imports = error, noConsole = warn, etc.)
  - Remove CSS/Tailwind overrides (backend-only)
  - Remove Next.js page/layout default-export overrides (backend-only)
  - Keep `*.config.*` override for default exports
- **Mirror**: Root `biome.json` rules
- **Validate**: `cd backend && pnpm biome check .`

---

### Task 10: Create Backend .env.sample

- **File**: `backend/.env.sample`
- **Action**: CREATE
- **Implement**: Extract only backend-relevant vars from root `.env.sample`:
  ```env
  # App
  NODE_ENV=development
  LOG_LEVEL=info
  APP_NAME=chatapp-backend

  # Server
  PORT=4000
  FRONTEND_URL=http://localhost:3000

  # Supabase
  SUPABASE_URL=
  SUPABASE_PUBLISHABLE_KEY=

  # Database
  DATABASE_URL=

  # LLM (OpenRouter)
  OPENROUTER_API_KEY=
  OPENROUTER_MODEL=openai/gpt-4.1

  # Chargebee
  CHARGEBEE_SITE=
  CHARGEBEE_API_KEY=
  CHARGEBEE_WEBHOOK_USERNAME=
  CHARGEBEE_WEBHOOK_PASSWORD=

  # RAG
  RAG_EMBEDDING_MODEL=openai/text-embedding-3-small
  RAG_SIMILARITY_THRESHOLD=0.7
  RAG_MAX_CHUNKS=5
  RAG_MATCH_COUNT=10
  RAG_ENABLED=true
  ```
- **Validate**: File exists and has all required backend vars

---

### Task 11: Update All Backend Imports — @chatapp/shared → @/shared/

- **Action**: UPDATE (13 source files + 1 test file)
- **Implement**: For each file, change `from "@chatapp/shared"` to the specific submodule:

  | File | Old Import | New Import |
  |------|-----------|------------|
  | `src/routes/webhooks.ts` | `{ TOKEN_PACKS } from "@chatapp/shared"` | `{ TOKEN_PACKS } from "@/shared/constants"` |
  | `src/middleware/error-handler.ts` | `{ createErrorResponse } from "@chatapp/shared"` | `{ createErrorResponse } from "@/shared/schemas/errors"` |
  | `src/socket/chat-handler.ts` | types from `"@chatapp/shared"` | types from `"@/shared/socket-events"`, schema from `"@/shared/schemas"` |
  | `src/routes/projects.ts` | schemas from `"@chatapp/shared"` | from `"@/shared/schemas"` |
  | `src/routes/billing.ts` | schemas + constants from `"@chatapp/shared"` | schemas from `"@/shared/schemas"`, constants from `"@/shared/constants"` |
  | `src/routes/documents.ts` | type + schema from `"@chatapp/shared"` | type from `"@/shared/types"`, schema from `"@/shared/schemas"` |
  | `src/routes/chat.ts` | schemas from `"@chatapp/shared"` | from `"@/shared/schemas"` |
  | `src/features/documents/models.ts` | types from `"@chatapp/shared"` | from `"@/shared/types"` |
  | `src/features/rag/models.ts` | types from `"@chatapp/shared"` | from `"@/shared/types"` |
  | `src/features/projects/service.ts` | types from `"@chatapp/shared"` | from `"@/shared/schemas/projects"` (inferred types) |
  | `src/features/billing/service.ts` | constants from `"@chatapp/shared"` | from `"@/shared/constants"` |
  | `src/features/chat/stream.ts` | constants from `"@chatapp/shared"` | from `"@/shared/constants"` |
  | `src/features/chat/tests/stream.test.ts` | constants from `"@chatapp/shared"` | from `"@/shared/constants"` |

- **Validate**: `cd backend && pnpm tsc --noEmit`

---

### Task 12: Migrate Backend Tests — bun:test → vitest

- **Action**: UPDATE (15 test files: 11 backend + 4 shared schema tests now in backend)
- **Implement**:

  **For all 15 files — change imports:**
  ```typescript
  // BEFORE:
  import { describe, expect, it } from "bun:test";
  // AFTER:
  import { describe, expect, it } from "vitest";
  ```

  **For 7 easy files (no mocking) — import swap only:**
  - `features/billing/tests/errors.test.ts`
  - `features/chat/tests/errors.test.ts`
  - `features/documents/tests/errors.test.ts`
  - `features/projects/tests/errors.test.ts`
  - `features/rag/tests/errors.test.ts`
  - `features/documents/tests/service.test.ts`
  - `features/rag/tests/service.test.ts`

  **For 4 shared schema tests — import swap only:**
  - `shared/schemas/tests/billing.test.ts`
  - `shared/schemas/tests/chat.test.ts`
  - `shared/schemas/tests/documents.test.ts`
  - `shared/schemas/tests/projects.test.ts`

  **For 4 hard files (mock.module → vi.mock) — pattern migration:**
  - `features/billing/tests/service.test.ts`
  - `features/chat/tests/service.test.ts`
  - `features/chat/tests/stream.test.ts`
  - `features/projects/tests/service.test.ts`

  Migration pattern for hard files:
  ```typescript
  // BEFORE (bun:test):
  import { beforeEach, describe, expect, it, mock } from "bun:test";
  const mockFn = mock<(id: string) => Promise<Thing | undefined>>(() => Promise.resolve(undefined));
  mock.module("../repository", () => ({ findById: mockFn }));
  const { myService } = await import("../service");

  // AFTER (vitest):
  import { beforeEach, describe, expect, it, vi } from "vitest";
  const mockFn = vi.fn<(id: string) => Promise<Thing | undefined>>(() => Promise.resolve(undefined));
  vi.mock("../repository", () => ({ findById: mockFn }));
  const { myService } = await import("../service");
  ```

  Key changes:
  - `mock` → `vi` (namespace)
  - `mock()` → `vi.fn()`
  - `mock<T>()` → `vi.fn<T>()`
  - `mock.module()` → `vi.mock()`
  - `.mockReset()`, `.mockResolvedValue()`, etc. — **stay the same** (Vitest compatible)

- **Validate**: `cd backend && pnpm test`

---

### Task 13: Update Frontend package.json (Remove Workspace Dep)

- **File**: `frontend/package.json`
- **Action**: UPDATE
- **Implement**:
  1. Remove `"@chatapp/shared": "workspace:*"` from dependencies
  2. Add `zod` `^4.2.1` to dependencies (if any frontend code uses it; check first — likely NOT needed since frontend doesn't use Zod schemas)
  3. Update scripts (remove any workspace-dependent scripts)
  4. Keep `bun` as package manager and test runner
- **Validate**: `cd frontend && bun install`

---

### Task 14: Update Frontend tsconfig.json

- **File**: `frontend/tsconfig.json`
- **Action**: UPDATE
- **Implement**:
  1. Remove the `@chatapp/shared` path alias from `"paths"`
  2. Keep `@/*` → `./src/*` alias
  3. Everything else stays (already standalone, doesn't extend base)
- **Validate**: `cd frontend && bun run tsc --noEmit`

---

### Task 15: Update All Frontend Imports — @chatapp/shared → @/contracts/

- **Action**: UPDATE (5 files)
- **Implement**:

  | File | Old Import | New Import |
  |------|-----------|------------|
  | `src/hooks/use-chat.ts` | types from `"@chatapp/shared"` | types from `"@/contracts/socket-events"` |
  | `src/hooks/use-chat.ts` | `{ CLIENT_EVENTS, SERVER_EVENTS }` from `"@chatapp/shared"` | from `"@/contracts/socket-events"` |
  | `src/hooks/use-tokens.ts` | `{ LOW_BALANCE_THRESHOLD }` from `"@chatapp/shared"` | from `"@/contracts/constants"` |
  | `src/hooks/use-document-upload.ts` | `type { UploadProgressEvent }` from `"@chatapp/shared"` | from `"@/contracts/types"` |
  | `src/hooks/use-document-upload.ts` | `{ ALLOWED_EXTENSIONS, MAX_FILE_SIZE }` from `"@chatapp/shared"` | from `"@/contracts/constants"` |
  | `src/app/(dashboard)/dashboard/documents/_components/document-list.tsx` | `type { DocumentSummary }` from `"@chatapp/shared"` | from `"@/contracts/types"` |
  | `src/app/(dashboard)/dashboard/billing/page.tsx` | `{ TOKEN_PACKS }` from `"@chatapp/shared"` | from `"@/contracts/constants"` |

- **Validate**: `cd frontend && bun run tsc --noEmit`

---

### Task 16: Create Frontend biome.json

- **File**: `frontend/biome.json`
- **Action**: CREATE
- **Implement**: Copy from root `biome.json` with:
  - Same formatter settings
  - Same linter rules
  - Keep CSS/Tailwind overrides
  - Keep Next.js page/layout default-export overrides
  - Keep `*.config.*` override
- **Validate**: `cd frontend && bunx biome check .`

---

### Task 17: Create Frontend .env.sample

- **File**: `frontend/.env.sample`
- **Action**: CREATE
- **Implement**:
  ```env
  # Backend API
  NEXT_PUBLIC_BACKEND_URL=http://localhost:4000

  # Supabase (client-side)
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
  ```
- **Validate**: File exists

---

### Task 18: Move shadcn components.json to Frontend

- **File**: `components.json`
- **Action**: MOVE → `frontend/components.json`
- **Implement**: Move root `components.json` into `frontend/`. Update any relative paths inside if needed.
- **Validate**: `ls frontend/components.json`

---

### Task 19: Clean Up Root Directory

- **Action**: DELETE + UPDATE
- **Implement**:
  1. Delete `package.json` (root workspace config — no longer needed)
  2. Delete `tsconfig.base.json` (each project is standalone)
  3. Delete `biome.json` (moved into each project)
  4. Delete `bun.lock` (each project has own lockfile)
  5. Delete `.env.sample` (split into backend/ and frontend/)
  6. Delete `packages/` if still exists
  7. Update `.gitignore`:
     ```gitignore
     # Dependencies
     node_modules/

     # Build
     .next/
     **/dist/
     *.tsbuildinfo

     # Environment
     .env
     backend/.env
     frontend/.env

     # IDE
     .vscode/
     .idea/

     # OS
     .DS_Store

     # Vercel
     .vercel/

     # Next.js
     next-env.d.ts

     # Package managers
     pnpm-lock.yaml
     bun.lock
     ```
- **Validate**: `ls -la` at root shows only `backend/`, `frontend/`, `.git/`, `.gitignore`, `CLAUDE.md`, `README.md`, `.claude/`

---

### Task 20: Verify Backend — Full Build + Lint + Test

- **Action**: COMMAND
- **Implement**:
  ```bash
  cd backend
  pnpm install
  pnpm run lint
  pnpm run build
  pnpm run test
  ```
- **Fix**: Iterate on any type errors, lint violations, or test failures until all pass
- **Validate**: All three commands exit 0

---

### Task 21: Verify Frontend — Full Build + Lint + Test

- **Action**: COMMAND
- **Implement**:
  ```bash
  cd frontend
  bun install
  bun run lint
  bun run build
  bun run test
  ```
- **Fix**: Iterate on any type errors, lint violations, or test failures until all pass
- **Validate**: All three commands exit 0

---

### Task 22: Update CLAUDE.md

- **File**: `CLAUDE.md`
- **Action**: UPDATE
- **Implement**: Rewrite to reflect the new two-project architecture:
  - Remove all monorepo/workspace references
  - Update directory structure diagram
  - Update all commands (backend uses pnpm, frontend uses bun)
  - Update import patterns (no more @chatapp/shared)
  - Document `backend/src/shared/` as the source of truth
  - Document `frontend/src/contracts/` as the duplicated contract layer
  - Update test commands and patterns
  - Update environment variable documentation
- **Validate**: Read and review

---

### Task 23: E2E Test — Auth Flow (Login/Register)

- **File**: `e2e/tests/auth-flow.e2e.ts`
- **Action**: CREATE
- **Implement**: Using browser-agent CLI in headed mode:
  1. **Register flow**:
     - Navigate to `/register`
     - Fill in email, password, confirm password
     - Submit form
     - Verify redirect to email confirmation or dashboard
  2. **Login flow**:
     - Navigate to `/login`
     - Fill in email + password
     - Submit form
     - Verify redirect to dashboard
     - Verify user is authenticated (dashboard content visible)
  3. **Logout flow**:
     - Click logout button/link
     - Verify redirect to login page
  4. **Invalid login**:
     - Navigate to `/login`
     - Enter wrong credentials
     - Verify error message is displayed
- **Validate**: Run test in headed mode, visually confirm all steps pass

---

### Task 24: E2E Test — Chat Message (Send + Stream Response)

- **File**: `e2e/tests/chat-message.e2e.ts`
- **Action**: CREATE
- **Implement**: Using browser-agent CLI in headed mode:
  1. **Prerequisites**: User logged in with tokens available
  2. **Send message**:
     - Navigate to chat page
     - Type "Hello, what is 2+2?" in chat input
     - Click send (or press Enter)
     - Verify message appears in chat as "user" bubble
  3. **Receive streamed response**:
     - Wait for assistant message bubble to appear
     - Verify text content streams in (content length increases over time)
     - Verify streaming completes (send button re-enabled)
  4. **Conversation persistence**:
     - Verify conversation appears in sidebar/list
     - Refresh page
     - Verify messages are still visible
  5. **Abort stream**:
     - Send another message
     - Click abort/stop button during streaming
     - Verify streaming stops
- **Validate**: Run test in headed mode, visually confirm

---

### Task 25: E2E Test — RAG Document Upload + Chat with Context

- **File**: `e2e/tests/rag-document-upload.e2e.ts`
- **Action**: CREATE
- **Implement**: Using browser-agent CLI in headed mode:
  1. **Upload document**:
     - Navigate to documents page
     - Click upload button
     - Select a `.md` test file (create a small test fixture)
     - Verify upload progress (SSE events: status → progress → complete)
     - Verify document appears in document list with chunk count
  2. **Verify RAG ingestion**:
     - Verify document shows in list with title, chunk count, token count
     - Verify created_at timestamp is recent
  3. **Chat with RAG context**:
     - Navigate to chat page
     - Send a message asking about content from the uploaded document
     - Verify assistant response includes citations (e.g., `[1]`)
     - Verify sources panel shows the uploaded document as a reference
  4. **Batch upload**:
     - Upload multiple documents (2-3 `.txt` files)
     - Verify all appear in document list
     - Chat and verify multiple sources can be cited
- **Validate**: Run test in headed mode, visually confirm RAG pipeline works end-to-end

---

### Task 26: E2E Test — Token Consumption

- **File**: `e2e/tests/token-consumption.e2e.ts`
- **Action**: CREATE
- **Implement**: Using browser-agent CLI in headed mode:
  1. **Check initial balance**:
     - Navigate to billing page
     - Note the current token balance (should be > 0)
     - Take screenshot for reference
  2. **Send message and verify deduction**:
     - Navigate to chat page
     - Send a message
     - Wait for response to complete
     - Navigate back to billing page (or check in-page balance indicator)
     - Verify balance decreased by 1
  3. **Low balance indicator**:
     - If balance <= 3 (LOW_BALANCE_THRESHOLD), verify low-balance warning appears
  4. **Token refund on error** (if testable):
     - Trigger a stream error (e.g., send a very specific message that causes an error)
     - Verify token is refunded (balance restored)
  5. **Zero balance behavior**:
     - If balance reaches 0, attempt to send a message
     - Verify appropriate error message (insufficient tokens)
- **Validate**: Run test in headed mode, visually confirm token accounting

---

### Task 27: E2E Test — Billing Checkout (Token Purchase)

- **File**: `e2e/tests/billing-checkout.e2e.ts`
- **Action**: CREATE
- **Implement**: Using browser-agent CLI in headed mode:
  1. **View token packs**:
     - Navigate to billing page
     - Verify 3 token packs are displayed (50, 150, 500 tokens)
     - Verify prices match ($5, $10, $25)
  2. **Initiate checkout**:
     - Click "Buy" on the 50-token pack
     - Verify redirect to Chargebee checkout page (or hosted page opens)
     - Take screenshot of checkout form
  3. **Transaction history**:
     - After purchase (if test environment supports it), verify transaction appears in history
     - Verify transaction shows correct amount and type
  4. **Portal access**:
     - Click "Manage Billing" / portal button
     - Verify Chargebee portal opens
- **Note**: Full purchase flow may require Chargebee test mode credentials
- **Validate**: Run test in headed mode, visually confirm billing UI

---

### Task 28: E2E Test — Document Management (List, Delete)

- **File**: `e2e/tests/document-management.e2e.ts`
- **Action**: CREATE
- **Implement**: Using browser-agent CLI in headed mode:
  1. **List documents**:
     - Navigate to documents page
     - Verify documents list loads (may be empty or have previous uploads)
     - Take screenshot
  2. **Upload and verify**:
     - Upload a test `.md` file
     - Verify it appears in the list with correct title
     - Verify chunk count and token count are shown
  3. **Delete document**:
     - Click delete on a document
     - Confirm deletion (if confirmation dialog exists)
     - Verify document is removed from the list
     - Verify page updates without refresh
  4. **Empty state**:
     - If all documents deleted, verify empty state message is shown
  5. **File validation**:
     - Attempt to upload a `.pdf` file (unsupported)
     - Verify error toast "Only .md and .txt files are supported"
     - Attempt to upload a file > 2MB
     - Verify error toast "File must be under 2MB"
- **Validate**: Run test in headed mode, visually confirm CRUD operations

---

### Task 29: Create E2E Test README

- **File**: `e2e/README.md`
- **Action**: CREATE
- **Implement**: Document how to run E2E tests:
  ```markdown
  # E2E Tests

  End-to-end tests using browser-agent CLI in headed mode.

  ## Prerequisites
  - Backend running on http://localhost:4000
  - Frontend running on http://localhost:3000
  - Test user account created in Supabase
  - Valid .env in both backend/ and frontend/

  ## Running Tests
  Run each test using browser-agent CLI in headed mode:
  - `browser-agent --headed e2e/tests/auth-flow.e2e.ts`
  - `browser-agent --headed e2e/tests/chat-message.e2e.ts`
  - `browser-agent --headed e2e/tests/rag-document-upload.e2e.ts`
  - `browser-agent --headed e2e/tests/token-consumption.e2e.ts`
  - `browser-agent --headed e2e/tests/billing-checkout.e2e.ts`
  - `browser-agent --headed e2e/tests/document-management.e2e.ts`

  ## Test Order
  Recommended execution order:
  1. auth-flow (creates/verifies user session)
  2. billing-checkout (ensures tokens are available)
  3. token-consumption (verifies token deduction)
  4. document-management (upload/delete documents)
  5. rag-document-upload (upload + RAG ingestion)
  6. chat-message (send messages, verify streaming + RAG context)
  ```
- **Validate**: File exists

---

### Task 30: Final Integration Verification

- **Action**: COMMAND
- **Implement**:
  1. Start backend: `cd backend && pnpm dev`
  2. Start frontend: `cd frontend && bun run dev`
  3. Open browser to `http://localhost:3000`
  4. Manually verify:
     - Login works
     - Chat works (send message, receive streamed response)
     - Document upload works (SSE progress, appears in list)
     - Billing page shows token packs and balance
     - Token deduction on chat message
  5. Run all unit tests one final time:
     ```bash
     cd backend && pnpm test
     cd frontend && bun test
     ```
  6. Run E2E tests with browser-agent CLI in headed mode
- **Validate**: All tests pass, all features work end-to-end

---

## Validation

```bash
# Backend
cd backend
pnpm install
pnpm run lint        # Biome check
pnpm run build       # tsc --noEmit
pnpm run test        # Vitest

# Frontend
cd frontend
bun install
bun run lint         # Biome check
bun run build        # next build
bun run test         # bun test

# E2E (requires both servers running)
browser-agent --headed e2e/tests/auth-flow.e2e.ts
browser-agent --headed e2e/tests/chat-message.e2e.ts
browser-agent --headed e2e/tests/rag-document-upload.e2e.ts
browser-agent --headed e2e/tests/token-consumption.e2e.ts
browser-agent --headed e2e/tests/billing-checkout.e2e.ts
browser-agent --headed e2e/tests/document-management.e2e.ts
```

---

## Acceptance Criteria

- [ ] No `packages/` directory exists
- [ ] No `@chatapp/shared` imports anywhere in the codebase
- [ ] `backend/` is a standalone Node.js + pnpm project
- [ ] `frontend/` is a standalone Bun + Next.js project
- [ ] `backend/src/shared/` contains all former shared code
- [ ] `frontend/src/contracts/` contains duplicated types/constants/socket-events
- [ ] All backend tests pass with Vitest (`pnpm test`)
- [ ] All frontend tests pass with Bun (`bun test`)
- [ ] `pnpm run lint && pnpm run build` passes in backend
- [ ] `bun run lint && bun run build` passes in frontend
- [ ] Chat messaging works end-to-end (WebSocket streaming)
- [ ] Document upload works end-to-end (SSE progress)
- [ ] RAG context appears in chat responses with citations
- [ ] Token consumption and balance updates work
- [ ] Billing page displays packs and handles checkout
- [ ] E2E tests cover all critical user flows
- [ ] CLAUDE.md updated for new architecture

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Type drift between frontend contracts and backend shared | Types are simple interfaces that rarely change; any API change requires updating both sides consciously |
| Vitest mock.module behaves differently than bun:test mock.module | vi.mock() is hoisted; deferred `await import()` pattern still works; test each file individually |
| Frontend .env symlink breaks | Create separate .env.sample; frontend reads NEXT_PUBLIC_ vars directly |
| drizzle.config.ts path changes | Update relative paths in drizzle.config.ts to reflect new directory structure |
| bun.lock vs pnpm-lock.yaml in same repo | .gitignore both; each project manages its own lockfile |
| E2E tests require running services | Document prerequisites in e2e/README.md; tests are run manually |
