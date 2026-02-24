# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This repo contains two standalone projects sharing a single git repository:

```
backend/      # Node.js + pnpm — Express 5 + Socket.IO 4 server, Drizzle ORM
frontend/     # Node.js + npm — Next.js 16, React 19, Tailwind CSS 4
```

| Project | Runtime | Package Manager | Test Runner | Key Tech |
|---------|---------|-----------------|-------------|----------|
| `backend/` | Node.js (tsx) | pnpm | Vitest | Express 5, Socket.IO 4, Drizzle ORM, Pino |
| `frontend/` | Node.js | npm | Vitest | Next.js 16, React 19, Tailwind 4, shadcn/ui |

There is **no shared package**. Shared code lives in `backend/src/shared/` (source of truth). The frontend duplicates only the ~100 lines it needs in `frontend/src/contracts/`.

## Commands

Commands run from within each project directory:

### Backend (`cd backend`)

```bash
pnpm dev              # Start dev server (tsx watch)
pnpm start            # Start production server
pnpm run build        # Type check (tsc --noEmit)
pnpm test             # Run tests (Vitest)
pnpm test -- --watch  # Watch mode
pnpm run lint         # Check lint/format (Biome)
pnpm run lint:fix     # Auto-fix lint/format
pnpm run format       # Format all files

# Database
pnpm run db:generate  # Generate migrations from schema changes
pnpm run db:migrate   # Run pending migrations
pnpm run db:push      # Push schema directly (dev only)
pnpm run db:studio    # Open Drizzle Studio GUI
```

### Frontend (`cd frontend`)

```bash
npm run dev           # Start dev server (next dev)
npm run build         # Next.js production build
npm run start         # Start production server
npm test              # Run tests (Vitest)
npm test -- --watch   # Watch mode
npm run lint          # Check lint/format (Biome)
npm run lint:fix      # Auto-fix lint/format
npm run format        # Format all files
```

## Self-Correction Workflow

Both projects use strict TypeScript and Biome to create a feedback loop for AI-generated code:

1. **Write code** → 2. **Run checks** → 3. **Read errors** → 4. **Fix issues** → 5. **Repeat until clean**

### After writing or modifying code, always run:

```bash
# Backend
cd backend && pnpm run lint && pnpm run build

# Frontend
cd frontend && npm run lint && npm run build
```

### Strict TypeScript settings catch real bugs:
- `noUncheckedIndexedAccess`: Array access returns `T | undefined`, forcing null checks
- `exactOptionalPropertyTypes`: Stricter optional property handling
- `verbatimModuleSyntax`: Explicit type imports required
- `noPropertyAccessFromIndexSignature`: Must use bracket notation for index signatures

### Reading error output:
Errors include file path, line, and column: `backend/src/features/projects/service.ts:15:3`

## Testing

### Backend (Vitest)

```bash
cd backend && pnpm test
```

- Test files: `backend/src/features/{feature}/tests/{name}.test.ts`
- Schema tests: `backend/src/shared/schemas/tests/{name}.test.ts`
- Use `describe`, `it`, `expect`, `vi` from `vitest`
- Mocking: `vi.fn()`, `vi.mock()` (NOT `mock()` or `mock.module()`)

### Frontend (Vitest)

```bash
cd frontend && npm test
```

- Test files: `frontend/src/features/{feature}/{name}.test.ts`
- Component tests: `frontend/src/components/{name}/tests/{name}.test.tsx`
- Use `describe`, `it`, `expect`, `vi` from `vitest`
- Mocking: `vi.fn()`, `vi.mock()`, `vi.hoisted()` (NOT `mock()` or `mock.module()`)
- React components: use `@testing-library/react` with `render`, `screen`, `userEvent`

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui
- **Backend**: Express 5, Socket.IO 4, Pino (structured logging), Node.js (tsx)
- **Database**: Supabase (auth + Postgres), Drizzle ORM
- **Validation**: Zod v4
- **Tooling**: pnpm (backend), npm (frontend), Biome (lint + format), TypeScript (strict)

## Backend Details (`backend/`)

Express 5 REST API + Socket.IO 4 WebSocket server with vertical slice features.

```
backend/src/
├── index.ts          # Server entry point (Express + Socket.IO setup)
├── config/env.ts     # Validated environment variables
├── database/         # Drizzle client + schema
├── supabase/         # Server-side Supabase client
├── logging/          # Pino logger with context
├── middleware/        # Auth, CORS, error handler
├── routes/           # Express route handlers (billing, chat, documents, projects, webhooks, health)
├── socket/           # Socket.IO handlers (auth, chat)
├── features/         # Vertical slices (billing, chat, documents, projects, rag)
└── shared/           # Types, Zod schemas, constants, socket events (source of truth)
    ├── index.ts
    ├── types/        # TypeScript interfaces
    ├── schemas/      # Zod validation schemas
    ├── constants/    # Shared constants (billing, chat, rag)
    └── socket-events.ts  # Socket.IO event type definitions
```

Import from shared: `import { TOKEN_PACKS } from "@/shared/constants";`

## Frontend Details (`frontend/`)

Next.js 16 app with App Router, server/client components, and Supabase auth.

```
frontend/src/
├── app/              # Next.js App Router pages and layouts
│   ├── (auth)/       # Login/register pages
│   └── (dashboard)/  # Authenticated pages (chat, documents, billing)
├── components/       # React components (chat UI, theme, shadcn/ui primitives)
├── contracts/        # Duplicated types/constants from backend (kept minimal)
│   ├── types.ts      # DocumentSummary, ChatSource, UploadProgressEvent
│   ├── socket-events.ts  # CLIENT_EVENTS, SERVER_EVENTS + payload interfaces
│   ├── constants.ts  # TOKEN_PACKS, LOW_BALANCE_THRESHOLD, MAX_FILE_SIZE, ALLOWED_EXTENSIONS
│   └── index.ts      # Barrel export
├── core/             # Config, Supabase clients (client, server, proxy)
├── features/auth/    # Auth actions and hooks
├── hooks/            # Custom hooks (use-chat, use-tokens, use-document-upload)
├── lib/              # Utilities (api-client, socket, utils)
└── proxy.ts          # Next.js 16 proxy entry point (replaces middleware.ts)
```

Import from contracts: `import type { DocumentSummary } from "@/contracts/types";`

### Frontend Contracts Layer

`frontend/src/contracts/` contains a minimal duplication of types and constants from `backend/src/shared/`. When backend shared types change, update the corresponding contracts file. This is intentional — the frontend only needs a small subset (~100 lines).

## Vertical Slice Architecture (Backend)

Features in `backend/src/features/` are self-contained vertical slices. Each slice owns its data model, database operations, business logic, and errors.

### Feature Structure

```
backend/src/features/{feature}/
├── models.ts      # Drizzle types (re-export from database/schema)
├── repository.ts  # Database queries (isolated, no business logic)
├── service.ts     # Business logic (orchestrates repository + validation + logging)
├── errors.ts      # Custom error classes (explicit failure modes)
├── index.ts       # Public API (controls what other code can import)
└── tests/         # All tests for this feature
    ├── errors.test.ts
    └── service.test.ts
```

Schemas (Zod validation) live in `backend/src/shared/schemas/` and are imported via `@/shared/schemas/`.

### Key Patterns

**Repository vs Service separation:**
```typescript
// repository.ts - Pure database operations, no business logic
export async function findById(id: string): Promise<Project | undefined> {
  const results = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return results[0];
}

// service.ts - Business logic, access control, logging
export async function getProject(id: string, userId: string | null): Promise<Project> {
  logger.info({ projectId: id }, "project.get_started");
  const project = await repository.findById(id);
  if (!project) throw new ProjectNotFoundError(id);
  if (!project.isPublic && project.ownerId !== userId) throw new ProjectAccessDeniedError(id);
  logger.info({ projectId: id }, "project.get_completed");
  return project;
}
```

**Error classes with HTTP semantics:**
```typescript
export class ProjectNotFoundError extends ProjectError {
  constructor(id: string) {
    super(`Project not found: ${id}`, "PROJECT_NOT_FOUND", 404);
  }
}
```

**Public API via index.ts:**
```typescript
export type { Project, NewProject } from "./models";
export { ProjectNotFoundError, ProjectAccessDeniedError } from "./errors";
// Export service functions (NOT repository - keep it internal)
export { createProject, getProject, updateProject, deleteProject } from "./service";
```

### Creating a New Backend Feature

1. **Copy an existing feature** (e.g., `projects/`) as a template
2. **Define the table** in `backend/src/database/schema.ts`
3. **Add Zod schemas** in `backend/src/shared/schemas/`
4. **Add types** in `backend/src/shared/types/`
5. **Implement** `models.ts`, `errors.ts`, `repository.ts`, `service.ts`, `index.ts`
6. **Add Express routes** in `backend/src/routes/`
7. **Write tests** in the feature's `tests/` subfolder

## Environment Variables

Each project has its own `.env` file. See `backend/.env.sample` and `frontend/.env.sample` for required variables.

- The root `.env` file is shared — both `backend/.env` and `frontend/.env` symlink to `../.env`
- Backend vars: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, etc.
- Frontend vars: `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

**Next.js env access rule**: Always use string-literal bracket notation for client/Edge env access:
```typescript
// Correct — Next.js can inline this at build time
const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;

// Wrong — dynamic access won't be inlined
const url = process.env[key]; // undefined in client bundle
```

## Supabase + Drizzle Setup

**Key files:**
- `backend/src/config/env.ts` - Validated environment variables
- `backend/src/database/schema.ts` - Drizzle schema definitions
- `backend/src/database/client.ts` - Database client
- `backend/src/supabase/server.ts` - Server-side Supabase client
- `frontend/src/core/supabase/server.ts` - Server-side Supabase client (Next.js)
- `frontend/src/core/supabase/client.ts` - Browser-side Supabase client
- `frontend/src/core/supabase/proxy.ts` - Session refresh logic (Edge Runtime)
- `frontend/src/proxy.ts` - Next.js 16 proxy entry point
- `frontend/src/features/auth/` - Auth actions and hooks

**Important patterns:**

1. **Key naming transition**: Supabase is migrating from `ANON_KEY` to `PUBLISHABLE_KEY`. Our setup supports both.

2. **Server client cookies**: The `setAll` must be wrapped in try/catch because it can be called from Server Components where cookies cannot be set.

3. **Connection pooler for serverless**: Use port 6543 (transaction pooler) with `prepare: false`.

4. **Server Actions with `useActionState`** (React 19): Actions must take `(prevState, formData)`.

5. **Auth route groups**: `(auth)` and `(dashboard)` layouts handle redirects. Check auth in layout, not each page.

6. **Users table trigger**: Run SQL in Supabase dashboard to sync `auth.users` → `public.users`. See `backend/src/database/schema.ts` for the trigger code.

## Frontend API Client

The frontend communicates with the backend via:
- **REST**: `apiFetch()` from `frontend/src/lib/api-client.ts` (adds Bearer token, routes to `NEXT_PUBLIC_BACKEND_URL`)
- **WebSocket**: Socket.IO client from `frontend/src/lib/socket.ts` (real-time chat)

## shadcn/ui Components

Components are in `frontend/src/components/ui/`. Add new ones with:
```bash
cd frontend && npx shadcn@canary add <component-name>
```

**After adding components, run `npm run lint:fix`** to format them.

**Component locations:**
- `frontend/src/components/ui/` - shadcn primitives (button, dialog, etc.)
- `frontend/src/components/` - app-level components (chat UI, theme)
- `frontend/src/lib/utils.ts` - `cn()` utility for merging Tailwind classes

## Code Style

- 2-space indentation, 100 char line width, double quotes
- Use named exports (default exports only for Next.js pages/layouts/config files)
- Use `type` imports/exports for type-only references
- Use `const` over `let` when possible
- Path aliases: `@/*` maps to `src/*` in both projects

## Rules That Will Fail Checks

**Errors (must fix):**
- Unused imports, variables, or parameters
- Using `==` instead of `===`
- Using `let` when value never changes (use `const`)
- Missing `type` keyword on type-only imports/exports
- Using `dangerouslySetInnerHTML` or `eval()`
- Missing braces on if/else statements

**Warnings (should fix):**
- Using `console.log` (remove or use structured logger)
- Using `any` type (add proper types)
- Default exports in non-Next.js files (use named exports)
- Using `.forEach()` (use `for...of` loop instead)
- Overly complex functions

## Logging (Backend)

Use `getLogger("domain.component")` and the `action_state` message pattern:
```typescript
const logger = getLogger("communities.service");
logger.info({ communityId }, "community.create_started");
logger.info({ communityId }, "community.create_completed");
logger.error({ communityId, error }, "community.create_failed");
```
States: `_started`, `_completed`, `_failed`. This makes logs grep-able and traceable.

## Zod v4

Import from `zod/v4`, not `zod`:
```typescript
import { z } from "zod/v4";
```
`z.record` requires two args: `z.record(z.string(), z.unknown())` not `z.record(z.unknown())`.
