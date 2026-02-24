# AI Chat

A real-time AI chat application with RAG (Retrieval-Augmented Generation) support. Features streaming responses via WebSocket, conversation management, document ingestion with vector search, markdown rendering with syntax highlighting, token-based billing, and a polished dark theme.

## Features

- **Real-time streaming AI responses** via Socket.IO WebSocket
- **RAG knowledge base** — upload documents, auto-chunk and embed, retrieve relevant context for AI responses with citations
- **Conversation management** — create, rename, delete with confirmation
- **Markdown rendering** with syntax highlighting and copy-to-clipboard on code blocks
- **Dark/light theme** with blue accent colors
- **Responsive mobile layout** with collapsible sidebar
- **Token-based billing** with ChargeBee integration
- **Persistent conversations** stored in Supabase Postgres via Drizzle ORM
- **Keyboard shortcuts** — Enter to send, Shift+Enter for new line

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui |
| Backend | Express 5, Socket.IO 4, Pino (structured logging), Node.js (tsx) |
| Database | Supabase Postgres + Drizzle ORM |
| Auth | Supabase Auth |
| AI | OpenRouter (configurable model) |
| Embeddings | OpenRouter (`text-embedding-3-small`) |
| Billing | ChargeBee |
| Validation | Zod v4 |
| Backend Runtime | Node.js + tsx |
| Frontend Runtime | Node.js |
| Backend Package Manager | pnpm |
| Frontend Package Manager | npm |
| Linting | Biome |
| Backend Testing | Vitest |
| Frontend Testing | Vitest + React Testing Library |
| E2E Testing | Playwright |

## Project Structure

This repo contains two standalone projects sharing a single git repository. There is **no shared workspace** — each project is fully independent.

```
chatapp/
├── backend/              # Node.js + pnpm — Express 5 API + Socket.IO server
│   ├── src/
│   │   ├── index.ts      # Server entry point
│   │   ├── config/       # Environment validation
│   │   ├── database/     # Drizzle client + schema
│   │   ├── middleware/    # Auth, CORS, error handler
│   │   ├── routes/       # REST endpoints
│   │   ├── socket/       # WebSocket handlers
│   │   ├── logging/      # Pino structured logging
│   │   ├── features/     # Vertical slices (billing, chat, documents, projects, rag)
│   │   └── shared/       # Types, Zod schemas, constants (source of truth)
│   ├── drizzle/          # Database migrations
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── biome.json
├── frontend/             # Node.js + npm — Next.js 16 web app
│   ├── src/
│   │   ├── app/          # Next.js App Router pages and layouts
│   │   ├── components/   # Chat UI, theme, shadcn/ui primitives
│   │   ├── contracts/    # Duplicated types/constants from backend (~100 lines)
│   │   ├── core/         # Supabase clients, config
│   │   ├── features/     # Auth actions and hooks
│   │   ├── hooks/        # useChat, useTokens, useDocumentUpload
│   │   └── lib/          # API client, Socket.IO client, utilities
│   ├── package.json
│   ├── tsconfig.json
│   └── biome.json
├── e2e/                  # Playwright E2E tests (28 tests)
│   ├── tests/
│   ├── playwright.config.ts
│   └── package.json
├── .env                  # Shared environment variables
├── .gitignore
├── CLAUDE.md             # AI coding assistant guidance
└── README.md
```

## Quick Start

### 1. Install dependencies

```bash
# Backend
cd backend && pnpm install

# Frontend
cd frontend && npm install

# E2E (optional)
cd e2e && npm install && npx playwright install chromium
```

### 2. Configure environment

```bash
# Copy sample env files and fill in your credentials
cp backend/.env.sample .env
# Edit .env with your Supabase, OpenRouter, and ChargeBee credentials
```

The `.env` file lives at the repo root. Both projects read it via symlinks:
- `backend/.env` → `../.env`
- `frontend/.env` → `../.env`

### 3. Run database migrations

```bash
cd backend && pnpm run db:migrate
```

### 4. Start development servers

```bash
# Terminal 1: Backend (http://localhost:4000)
cd backend && pnpm dev

# Terminal 2: Frontend (http://localhost:3000)
cd frontend && npm run dev
```

## Environment Variables

See `backend/.env.sample` and `frontend/.env.sample` for all required variables.

```bash
# Supabase (required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key

# Database (use transaction pooler port 6543)
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

# OpenRouter (required for AI responses)
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=anthropic/claude-haiku-4.5

# Backend URL (frontend needs this)
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000

# ChargeBee (required for billing)
CHARGEBEE_SITE=your-site
CHARGEBEE_API_KEY=your-api-key
CHARGEBEE_WEBHOOK_USERNAME=your-username
CHARGEBEE_WEBHOOK_PASSWORD=your-password

# RAG settings
RAG_EMBEDDING_MODEL=openai/text-embedding-3-small
RAG_SIMILARITY_THRESHOLD=0.7
RAG_MAX_CHUNKS=5
RAG_MATCH_COUNT=10
RAG_ENABLED=true
```

## Commands

### Backend (`cd backend`)

```bash
pnpm dev              # Start dev server (tsx watch, port 4000)
pnpm start            # Start production server
pnpm run build        # Type check (tsc --noEmit)
pnpm test             # Run tests (Vitest, 163 tests)
pnpm run lint         # Lint + format check (Biome)
pnpm run lint:fix     # Auto-fix lint issues
pnpm run db:generate  # Generate migrations
pnpm run db:migrate   # Run migrations
pnpm run db:push      # Push schema directly (dev only)
pnpm run db:studio    # Open Drizzle Studio GUI
```

### Frontend (`cd frontend`)

```bash
npm run dev           # Start dev server (next dev, port 3000)
npm run build         # Next.js production build
npm run start         # Start production server
npm test              # Run tests (Vitest, 52 tests)
npm run lint          # Lint + format check (Biome)
npm run lint:fix      # Auto-fix lint issues
```

### E2E Tests (`cd e2e`)

```bash
npx playwright test --headed    # Run all 28 tests (browser visible)
npx playwright test --ui        # Playwright UI mode
npx playwright test             # Headless mode
```

## Architecture

### Backend — Vertical Slice Architecture

Features in `backend/src/features/` are self-contained vertical slices. Each slice owns its data model, database operations, business logic, and errors.

```
backend/src/features/{feature}/
├── models.ts      # Drizzle types
├── repository.ts  # Database queries (no business logic)
├── service.ts     # Business logic (orchestrates repo + validation)
├── errors.ts      # Custom error classes with HTTP semantics
├── index.ts       # Public API (controls imports)
└── tests/         # Feature tests
```

**Features**: `billing`, `chat`, `documents`, `projects`, `rag`

### Backend — Shared Code

`backend/src/shared/` is the **source of truth** for all shared types, Zod schemas, constants, and socket event definitions.

```
backend/src/shared/
├── types/            # TypeScript interfaces (billing, chat, documents, projects, rag)
├── schemas/          # Zod validation schemas
├── constants/        # Shared constants (billing, chat, rag)
└── socket-events.ts  # Socket.IO event type definitions
```

### Frontend — Contracts Layer

`frontend/src/contracts/` contains a minimal duplication (~100 lines) of types and constants the frontend needs. This is intentional — the frontend only references a small subset of the backend's shared code.

```
frontend/src/contracts/
├── types.ts          # DocumentSummary, ChatSource, UploadProgressEvent
├── socket-events.ts  # CLIENT_EVENTS, SERVER_EVENTS + payload interfaces
├── constants.ts      # TOKEN_PACKS, LOW_BALANCE_THRESHOLD, MAX_FILE_SIZE
└── index.ts          # Barrel export
```

### Frontend — Page Structure

```
frontend/src/app/
├── page.tsx              # Chat UI (root page)
├── layout.tsx            # Root layout (ThemeProvider, Toaster)
├── global-error.tsx      # Error boundary
├── (auth)/
│   ├── layout.tsx        # Auth layout (redirect if logged in)
│   ├── login/page.tsx    # Login form
│   └── register/page.tsx # Register form
└── (dashboard)/
    ├── layout.tsx        # Dashboard layout (nav, user menu, auth guard)
    └── dashboard/
        ├── page.tsx              # Dashboard home (profile, projects)
        ├── billing/page.tsx      # Token balance, packs, checkout, history
        ├── billing/success/      # Payment success
        ├── billing/cancel/       # Payment cancelled
        └── documents/page.tsx    # Upload, list, delete documents
```

## RAG (Retrieval-Augmented Generation)

The app supports RAG using documents uploaded through the web UI.

### How it works

1. Upload `.md` or `.txt` files via the Documents page
2. Backend extracts the title from the first `# heading` (falls back to filename)
3. Content is split into chunks at paragraph boundaries
4. Each chunk gets an embedding vector via OpenRouter (`text-embedding-3-small`)
5. During chat, relevant chunks are retrieved by vector similarity and injected as context
6. AI responses include citation markers `[1]`, `[2]` referencing source chunks

### Managing documents

Documents are managed through the web UI at `/dashboard/documents`:
- **Upload**: Select a `.md` or `.txt` file (max 2MB)
- **View**: See all documents with chunk count and token totals
- **Delete**: Click the trash icon, confirm in dialog

## Testing

### Unit Tests

| Project | Runner | Tests | Command |
|---------|--------|-------|---------|
| Backend | Vitest | 163 | `cd backend && pnpm test` |
| Frontend | Vitest | 52 | `cd frontend && npm test` |

### E2E Tests

| Suite | Tests | Description |
|-------|-------|-------------|
| auth-flow | 6 | Login, register, logout, navigation |
| chat-message | 5 | Send, stream response, Enter key, new chat |
| billing-checkout | 5 | Balance, packs, checkout, transactions |
| token-consumption | 4 | Balance display, deduction, zero state |
| document-management | 5 | Upload, list, delete, file validation |
| rag-document-upload | 3 | Upload + RAG, metadata, chat with sources |

**Total: 28 E2E tests** — Run with `cd e2e && npx playwright test --headed`

## License

MIT
