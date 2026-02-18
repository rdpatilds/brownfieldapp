# AI Chat

A real-time AI chat application built with Next.js, Supabase, and OpenRouter. Features streaming responses, conversation management, markdown rendering with syntax-highlighted code blocks, and a polished dark blue theme.

## Features

- **Streaming AI responses** via Server-Sent Events (SSE)
- **Conversation management** — create, rename, delete with confirmation
- **Markdown rendering** with syntax highlighting and copy-to-clipboard on code blocks
- **Dark/light theme** with blue accent colors
- **Responsive mobile layout** with collapsible sidebar
- **Persistent conversations** stored in Supabase Postgres via Drizzle ORM
- **Toast notifications** for error feedback
- **Keyboard shortcuts** — Enter to send, Shift+Enter for new line

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Runtime | Bun |
| UI | React 19, Tailwind CSS 4, shadcn/ui |
| Database | Supabase Postgres + Drizzle ORM |
| Auth | Supabase Auth |
| AI | OpenRouter (configurable model) |
| Linting | Biome |
| Testing | Bun test + React Testing Library |
| Logging | Pino (structured JSON) |

## Quick Start

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Edit .env with your credentials (see Environment Variables below)

# Run database migrations
bun run db:migrate

# Start development server
bun run dev
```

## Environment Variables

```bash
# OpenRouter (required for AI responses)
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=anthropic/claude-haiku-4.5    # or any OpenRouter model

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Database (use transaction pooler port 6543 for serverless)
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

## Commands

```bash
bun run dev          # Start development server
bun run build        # Production build (includes type checking)
bun run lint         # Check for lint/format errors
bun run lint:fix     # Auto-fix lint/format issues
bun test             # Run tests with coverage
bun run db:migrate   # Run pending database migrations
bun run db:studio    # Open Drizzle Studio GUI
```

## Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Login & register pages
│   ├── (dashboard)/       # Protected chat interface
│   └── api/               # API routes (chat, health, projects)
│       └── chat/          # SSE streaming endpoint
├── core/                   # Shared infrastructure
│   ├── config/            # Environment validation (Zod)
│   ├── database/          # Drizzle client & schema
│   ├── logging/           # Pino structured logging
│   └── supabase/          # Server & client Supabase clients
├── features/              # Vertical slices (self-contained)
│   ├── auth/              # Auth actions & hooks
│   ├── chat/              # Conversations, messages, AI streaming
│   └── projects/          # Example CRUD feature
├── hooks/                 # React hooks (useChat, useAutoScroll)
├── shared/                # Cross-feature utilities
└── components/            # UI components
    ├── chat/              # Chat UI (layout, input, messages, sidebar)
    └── ui/                # shadcn/ui primitives
```

Features follow the **vertical slice pattern** — each feature owns its models, schemas, repository, service, errors, and tests:

```
src/features/chat/
├── models.ts      # Drizzle types
├── schemas.ts     # Zod validation
├── repository.ts  # Database queries
├── service.ts     # Business logic
├── stream.ts      # OpenRouter SSE streaming
├── errors.ts      # Custom error classes
├── index.ts       # Public API
└── tests/         # Feature tests
```

## RAG Ingestion

The app supports Retrieval-Augmented Generation (RAG) using documents ingested into the database. The ingestion script reads `.md` or `.txt` files, splits them into chunks, generates embeddings, and stores everything in the `documents` and `chunks` tables.

### Usage

```bash
# Ingest all files from a directory
bun run ingest -- --dir documents/

# Ingest a single file
bun run ingest -- --file path/to/doc.md

# Clean existing data first, then ingest fresh
bun run ingest -- --dir documents/ --clean

# Custom chunk size and overlap
bun run ingest -- --dir documents/ --chunk-size 1000 --chunk-overlap 200
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--dir <path>` | — | Directory to scan recursively for `.md`/`.txt` files |
| `--file <path>` | — | Single file to ingest |
| `--clean` | `false` | Delete all existing documents and chunks before ingesting |
| `--chunk-size <n>` | `1000` | Maximum characters per chunk |
| `--chunk-overlap <n>` | `200` | Character overlap between consecutive chunks |

### How it works

1. Discovers all `.md` and `.txt` files in the target directory
2. Extracts the title from the first `# heading` (falls back to filename)
3. Inserts a row into the `documents` table
4. Splits content into chunks at paragraph boundaries respecting `--chunk-size`
5. Generates an embedding for each chunk via OpenRouter (`text-embedding-3-small`)
6. Stores each chunk with its embedding vector in the `chunks` table

### Environment variables

These are configured in `.env` (all have defaults):

```bash
RAG_EMBEDDING_MODEL=openai/text-embedding-3-small
RAG_SIMILARITY_THRESHOLD=0.5
RAG_MAX_CHUNKS=5
RAG_MATCH_COUNT=10
RAG_ENABLED=true
```

## License

MIT
