# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Structure

This is a Bun workspaces monorepo with 3 packages:

```
packages/
├── shared/     # @chatapp/shared — Types, Zod schemas, constants, socket events
├── backend/    # @chatapp/backend — Express 5 + Socket.IO 4 server, Drizzle ORM
└── frontend/   # @chatapp/frontend — Next.js 16, React 19, Tailwind CSS 4
```

| Package | Role | Key Tech |
|---------|------|----------|
| `@chatapp/shared` | Shared types, schemas, constants | Zod v4 |
| `@chatapp/backend` | REST API + WebSocket server | Express 5, Socket.IO 4, Drizzle ORM, Pino |
| `@chatapp/frontend` | Web UI | Next.js 16, React 19, Tailwind 4, shadcn/ui |

Packages reference each other via `"@chatapp/shared": "workspace:*"` in their `package.json`.

## Commands

All commands run from the **monorepo root**:

```bash
# Development
bun run dev              # Start backend + frontend in parallel
bun run dev:backend      # Backend only (bun --watch)
bun run dev:frontend     # Frontend only (next dev)

# Build (sequential: shared → backend → frontend)
bun run build            # Full production build
bun run build:shared     # Compile shared types
bun run build:backend    # Type check backend (tsc --noEmit)
bun run build:frontend   # Next.js production build

# Quality
bun run lint             # Check lint/format errors (Biome)
bun run lint:fix         # Auto-fix lint/format issues
bun run format           # Format all files

# Testing
bun run test             # Run all tests (shared + backend + frontend)
bun run test:shared      # Shared package tests only
bun run test:backend     # Backend tests only
bun run test:frontend    # Frontend tests only

# Database (runs in packages/backend)
bun run db:generate      # Generate migrations from schema changes
bun run db:migrate       # Run pending migrations
bun run db:push          # Push schema directly (dev only)
bun run db:studio        # Open Drizzle Studio GUI
```

## Self-Correction Workflow

This project uses strict TypeScript and Biome to create a feedback loop for AI-generated code:

1. **Write code** → 2. **Run checks** → 3. **Read errors** → 4. **Fix issues** → 5. **Repeat until clean**

### After writing or modifying code, always run:
```bash
bun run lint && bun run build
```

### Why this matters for AI development:
- **Type errors are precise**: `Type 'string | undefined' is not assignable to type 'string'` tells you exactly what's wrong
- **Catches bugs before runtime**: No need to run the app to find issues
- **Strict settings catch real bugs**:
  - `noUncheckedIndexedAccess`: Array access returns `T | undefined`, forcing null checks
  - `exactOptionalPropertyTypes`: Stricter optional property handling
  - `verbatimModuleSyntax`: Explicit type imports required
  - `noPropertyAccessFromIndexSignature`: Must use bracket notation for index signatures

### Reading error output:
Errors include file path, line, and column: `packages/backend/src/features/projects/service.ts:15:3`
- Navigate directly to the problem
- The error message describes what's wrong
- Fix and re-run until all checks pass

## Testing

Tests are executable specifications and provide precise feedback for AI-generated code.

**Run tests after implementing features:**
```bash
bun run test
```

**Test file conventions:**
- Backend features: `packages/backend/src/features/{feature}/tests/{name}.test.ts`
- Shared schemas: `packages/shared/src/schemas/tests/{name}.test.ts`
- Frontend components: `packages/frontend/src/components/{name}/tests/{name}.test.tsx`
- Frontend features: `packages/frontend/src/features/{feature}/{name}.test.ts`
- Use `describe` and `it` blocks from `bun:test`
- React components: use `@testing-library/react` with `render`, `screen`, `userEvent`

**Self-correction with tests:**
1. Write test defining expected behavior
2. Implement the feature
3. Run `bun run test`
4. If test fails, read the diff (expected vs actual)
5. Fix and re-run until green

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui
- **Backend**: Express 5, Socket.IO 4, Pino (structured logging)
- **Shared**: Zod v4 (validation), TypeScript types
- **Database**: Supabase (auth + Postgres), Drizzle ORM
- **Tooling**: Bun (runtime + test runner + package manager), Biome (lint + format), TypeScript (strict)

## Package Details

### @chatapp/shared (`packages/shared/`)

Shared types, Zod schemas, constants, and socket event definitions. No runtime dependencies except Zod.

```
packages/shared/src/
├── index.ts          # Re-exports everything
├── types/            # TypeScript interfaces (billing, chat, documents, projects, rag)
├── schemas/          # Zod validation schemas
├── constants/        # Shared constants (billing, chat, rag)
└── socket-events.ts  # Socket.IO event type definitions
```

Import from shared: `import type { DocumentSummary } from "@chatapp/shared";`

### @chatapp/backend (`packages/backend/`)

Express 5 REST API + Socket.IO 4 WebSocket server with vertical slice features.

```
packages/backend/src/
├── index.ts          # Server entry point (Express + Socket.IO setup)
├── config/env.ts     # Validated environment variables
├── database/         # Drizzle client + schema
├── supabase/         # Server-side Supabase client
├── logging/          # Pino logger with context
├── middleware/       # Auth, CORS, error handler
├── routes/           # Express route handlers (billing, chat, documents, projects, webhooks, health)
├── socket/           # Socket.IO handlers (auth, chat)
└── features/         # Vertical slices (billing, chat, documents, projects, rag)
```

### @chatapp/frontend (`packages/frontend/`)

Next.js 16 app with App Router, server/client components, and Supabase auth.

```
packages/frontend/src/
├── app/              # Next.js App Router pages and layouts
│   ├── (auth)/       # Login/register pages
│   └── (dashboard)/  # Authenticated pages (chat, documents, billing)
├── components/       # React components (chat UI, theme, shadcn/ui primitives)
├── core/             # Config, Supabase clients (client, server, proxy)
├── features/auth/    # Auth actions and hooks
├── hooks/            # Custom hooks (use-chat, use-tokens, use-document-upload)
├── lib/              # Utilities (api-client, socket, utils)
└── proxy.ts          # Next.js 16 proxy entry point (replaces middleware.ts)
```

## Vertical Slice Architecture (Backend)

Features in `packages/backend/src/features/` are self-contained vertical slices. Each slice owns its data model, database operations, business logic, and errors.

### Feature Structure

```
packages/backend/src/features/{feature}/
├── models.ts      # Drizzle types (re-export from database/schema)
├── repository.ts  # Database queries (isolated, no business logic)
├── service.ts     # Business logic (orchestrates repository + validation + logging)
├── errors.ts      # Custom error classes (explicit failure modes)
├── index.ts       # Public API (controls what other code can import)
└── tests/         # All tests for this feature
    ├── errors.test.ts
    └── service.test.ts
```

Schemas (Zod validation) live in `@chatapp/shared` since they're used by both frontend and backend.

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
2. **Define the table** in `packages/backend/src/database/schema.ts`
3. **Add Zod schemas** in `packages/shared/src/schemas/`
4. **Add types** in `packages/shared/src/types/`
5. **Implement** `models.ts`, `errors.ts`, `repository.ts`, `service.ts`, `index.ts`
6. **Add Express routes** in `packages/backend/src/routes/`
7. **Write tests** in the feature's `tests/` subfolder

## Environment Variables

The root `.env` file contains all env vars. Backend reads it directly (runs from root). Frontend uses a symlink (`packages/frontend/.env` → `../../.env`).

**Important**: Backend vars use `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. Frontend vars use the `NEXT_PUBLIC_` prefix.

**Next.js env access rule**: Always use string-literal bracket notation for client/Edge env access:
```typescript
// Correct — Next.js can inline this at build time
const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;

// Wrong — dynamic access won't be inlined
const url = process.env[key]; // undefined in client bundle
```

## Supabase + Drizzle Setup

**Key files:**
- `packages/backend/src/config/env.ts` - Validated environment variables
- `packages/backend/src/database/schema.ts` - Drizzle schema definitions
- `packages/backend/src/database/client.ts` - Database client
- `packages/backend/src/supabase/server.ts` - Server-side Supabase client
- `packages/frontend/src/core/supabase/server.ts` - Server-side Supabase client (Next.js)
- `packages/frontend/src/core/supabase/client.ts` - Browser-side Supabase client
- `packages/frontend/src/core/supabase/proxy.ts` - Session refresh logic (Edge Runtime)
- `packages/frontend/src/proxy.ts` - Next.js 16 proxy entry point
- `packages/frontend/src/features/auth/` - Auth actions and hooks

**Important patterns:**

1. **Key naming transition**: Supabase is migrating from `ANON_KEY` to `PUBLISHABLE_KEY`. Our setup supports both.

2. **Server client cookies**: The `setAll` must be wrapped in try/catch because it can be called from Server Components where cookies cannot be set.

3. **Connection pooler for serverless**: Use port 6543 (transaction pooler) with `prepare: false`.

4. **Server Actions with `useActionState`** (React 19): Actions must take `(prevState, formData)`.

5. **Auth route groups**: `(auth)` and `(dashboard)` layouts handle redirects. Check auth in layout, not each page.

6. **Users table trigger**: Run SQL in Supabase dashboard to sync `auth.users` → `public.users`. See `packages/backend/src/database/schema.ts` for the trigger code.

## Frontend API Client

The frontend communicates with the backend via:
- **REST**: `apiFetch()` from `packages/frontend/src/lib/api-client.ts` (adds Bearer token, routes to `NEXT_PUBLIC_BACKEND_URL`)
- **WebSocket**: Socket.IO client from `packages/frontend/src/lib/socket.ts` (real-time chat)

## shadcn/ui Components

Components are in `packages/frontend/src/components/ui/`. Add new ones with:
```bash
cd packages/frontend && bunx shadcn@canary add <component-name>
```

**After adding components, run `bun run lint:fix`** to format them.

**Component locations:**
- `packages/frontend/src/components/ui/` - shadcn primitives (button, dialog, etc.)
- `packages/frontend/src/components/` - app-level components (chat UI, theme)
- `packages/frontend/src/lib/utils.ts` - `cn()` utility for merging Tailwind classes

## Code Style

- 2-space indentation, 100 char line width, double quotes
- Use named exports (default exports only for Next.js pages/layouts/config files)
- Use `type` imports/exports for type-only references
- Use `const` over `let` when possible
- Frontend path aliases: `@/*` maps to `packages/frontend/src/*`

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
