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

## License

MIT
