# AI Chat

A real-time AI chat application with RAG (Retrieval-Augmented Generation) support, built as a Bun workspaces monorepo. Features streaming responses via WebSocket, conversation management, document ingestion with vector search, markdown rendering with syntax highlighting, and a polished dark theme.

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

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui |
| Backend | Express 5, Socket.IO 4, Pino (structured logging) |
| Shared | TypeScript types, Zod v4 schemas, constants |
| Database | Supabase Postgres + Drizzle ORM |
| Auth | Supabase Auth |
| AI | OpenRouter (configurable model) |
| Embeddings | OpenRouter (`text-embedding-3-small`) |
| Billing | ChargeBee |
| Runtime | Bun |
| Linting | Biome |
| Testing | Bun test + React Testing Library |

## Monorepo Structure

```
chatapp/
├── packages/
│   ├── shared/       # @chatapp/shared — Types, Zod schemas, constants, socket events
│   ├── backend/      # @chatapp/backend — Express 5 + Socket.IO 4 server
│   └── frontend/     # @chatapp/frontend — Next.js 16 web app
├── documents/        # Sample documents for RAG ingestion
├── package.json      # Root workspace config
├── tsconfig.base.json# Shared TypeScript strict settings
└── CLAUDE.md         # AI coding assistant guidance
```

## Quick Start

```bash
# Install dependencies
bun install

# Set up environment
cp .env.sample .env
# Edit .env with your credentials (see Environment Variables below)

# Create the frontend .env symlink
ln -sf ../../.env packages/frontend/.env

# Run database migrations
bun run db:migrate

# Start development servers (backend + frontend)
bun run dev
```

The backend runs on `http://localhost:4000` and the frontend on `http://localhost:3000`.

## Environment Variables

```bash
# OpenRouter (required for AI responses)
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=anthropic/claude-haiku-4.5

# Supabase (both prefixed and non-prefixed needed)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key

# Database (use transaction pooler port 6543)
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

# Backend URL (frontend needs this to call the API)
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000

# RAG settings
RAG_EMBEDDING_MODEL=openai/text-embedding-3-small
RAG_SIMILARITY_THRESHOLD=0.5
RAG_MAX_CHUNKS=5
RAG_MATCH_COUNT=10
RAG_ENABLED=true

# ChargeBee (optional, for billing)
CHARGEBEE_SITE=your-site
CHARGEBEE_API_KEY=your-api-key
CHARGEBEE_WEBHOOK_SECRET=your-webhook-secret
```

## Commands

All commands run from the monorepo root:

```bash
# Development
bun run dev              # Start backend + frontend in parallel
bun run dev:backend      # Backend only (bun --watch, port 4000)
bun run dev:frontend     # Frontend only (next dev, port 3000)

# Build
bun run build            # Full production build (shared → backend → frontend)

# Quality
bun run lint             # Check lint/format errors (Biome)
bun run lint:fix         # Auto-fix lint/format issues

# Testing
bun run test             # Run all tests (260 total)
bun run test:shared      # Shared package tests (90)
bun run test:backend     # Backend tests (118)
bun run test:frontend    # Frontend tests (52)

# Database
bun run db:generate      # Generate migrations from schema changes
bun run db:migrate       # Run pending migrations
bun run db:push          # Push schema directly (dev only)
bun run db:studio        # Open Drizzle Studio GUI
```

## Architecture

### @chatapp/shared (`packages/shared/`)

Shared types, Zod validation schemas, constants, and Socket.IO event definitions used by both backend and frontend.

```
packages/shared/src/
├── types/            # TypeScript interfaces (billing, chat, documents, projects, rag)
├── schemas/          # Zod validation schemas
├── constants/        # Shared constants (billing, chat, rag)
└── socket-events.ts  # Socket.IO event type definitions
```

### @chatapp/backend (`packages/backend/`)

Express 5 REST API + Socket.IO 4 WebSocket server. Features are organized as vertical slices.

```
packages/backend/src/
├── index.ts          # Server entry point
├── config/           # Environment validation
├── database/         # Drizzle client + schema
├── middleware/       # Auth, CORS, error handler
├── routes/           # REST endpoints (billing, chat, documents, projects, webhooks, health)
├── socket/           # WebSocket handlers (auth, chat streaming)
├── logging/          # Pino structured logging
└── features/         # Vertical slices
    ├── billing/      # Token billing + ChargeBee
    ├── chat/         # Conversations, messages, AI streaming
    ├── documents/    # Document upload + management
    ├── projects/     # CRUD projects
    └── rag/          # Embedding generation + vector search
```

Each feature follows the **vertical slice pattern**:

```
packages/backend/src/features/{feature}/
├── models.ts      # Drizzle types
├── repository.ts  # Database queries
├── service.ts     # Business logic
├── errors.ts      # Custom error classes
├── index.ts       # Public API
└── tests/         # Feature tests
```

### @chatapp/frontend (`packages/frontend/`)

Next.js 16 app with App Router, Supabase auth, and real-time chat UI.

```
packages/frontend/src/
├── app/              # Next.js pages and layouts
│   ├── (auth)/       # Login & register
│   └── (dashboard)/  # Chat, documents, billing
├── components/       # UI components
│   ├── chat/         # Chat layout, input, messages, sidebar
│   └── ui/           # shadcn/ui primitives
├── core/             # Supabase clients, config
├── features/auth/    # Auth actions & hooks
├── hooks/            # useChat, useTokens, useDocumentUpload
└── lib/              # API client, Socket.IO client, utilities
```

## RAG (Retrieval-Augmented Generation)

The app supports RAG using documents uploaded through the web UI. Documents are automatically chunked, embedded, and stored for vector similarity search during chat.

### How it works

1. Upload `.md` or `.txt` files via the Documents page
2. Backend extracts the title from the first `# heading` (falls back to filename)
3. Content is split into chunks at paragraph boundaries
4. Each chunk gets an embedding vector via OpenRouter (`text-embedding-3-small`)
5. During chat, relevant chunks are retrieved by vector similarity and injected as context
6. AI responses include citation markers `[1]`, `[2]` referencing source chunks

### Managing documents

Documents are managed through the web UI at `/dashboard/documents`:
- **Upload**: Click "Choose File" and select a `.md` or `.txt` file
- **View**: See all documents with chunk count and token totals
- **Delete**: Click the trash icon with confirmation dialog

## License

MIT
