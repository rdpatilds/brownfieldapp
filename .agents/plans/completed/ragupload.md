# Plan: Document Upload for RAG Knowledge Base

## Context

The RAG pipeline works end-to-end: documents/chunks are queried at chat time via vector similarity search. However, populating the knowledge base currently requires running a CLI script (`bun run ingest`). This plan adds a UI-based upload flow so authenticated users can upload `.md`/`.txt` files directly from the dashboard. The upload follows the same pipeline as the existing script: chunk text, generate embeddings, insert into `documents` + `chunks` tables.

**Decisions (confirmed by user):**
- Documents are **global/shared** (no `user_id` scoping, no schema changes)
- Only `.md` and `.txt` files
- **Synchronous with SSE progress** (not background processing)
- **No token cost** for uploads

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/features/documents/models.ts` | TypeScript interfaces for `documents`/`chunks` tables and SSE events |
| `src/features/documents/schemas.ts` | Zod validation for upload (file size, extension, content) |
| `src/features/documents/errors.ts` | `DocumentNotFoundError`, `DocumentUploadError` |
| `src/features/documents/repository.ts` | Raw SQL: insert/list/delete documents and chunks |
| `src/features/documents/service.ts` | Ingestion pipeline: `chunkText`, `extractTitle`, `ingestDocument`, `listDocuments`, `deleteDocument` |
| `src/features/documents/index.ts` | Public API exports |
| `src/features/documents/tests/errors.test.ts` | Error class tests |
| `src/features/documents/tests/schemas.test.ts` | Validation tests |
| `src/features/documents/tests/service.test.ts` | `chunkText`, `extractTitle` unit tests + mocked `ingestDocument` |
| `src/app/api/documents/route.ts` | `GET /api/documents` — list all documents |
| `src/app/api/documents/upload/route.ts` | `POST /api/documents/upload` — multipart upload with SSE progress |
| `src/app/api/documents/[id]/route.ts` | `DELETE /api/documents/[id]` — delete document |
| `src/hooks/use-document-upload.ts` | Client hook: upload file, read SSE progress, track state |
| `src/app/(dashboard)/dashboard/documents/page.tsx` | Dashboard page: upload card + document list |
| `src/app/(dashboard)/dashboard/documents/_components/document-upload-card.tsx` | File picker, upload button, progress bar |
| `src/app/(dashboard)/dashboard/documents/_components/document-list.tsx` | Table of documents with delete actions |

## Files to Modify

| File | Change |
|------|--------|
| `src/app/(dashboard)/layout.tsx` | Add "Documents" nav link |
| `scripts/ingest.ts` | Import `chunkText`, `extractTitle`, repository functions from `@/features/documents` instead of defining inline |

## shadcn Components to Add

```bash
bunx shadcn@canary add progress
bun run lint:fix
```

---

## Implementation Details

### 1. Feature Slice: `src/features/documents/`

**`models.ts`** — Interfaces matching the raw SQL tables:
- `Document` (id, title, source, content, metadata, timestamps)
- `DocumentSummary` (from `document_summaries` view — includes chunk_count, total_tokens)
- `Chunk` (content, index — used during ingestion)
- `UploadProgressEvent` — discriminated union: `status | progress | complete | error`

**`schemas.ts`** — Zod v4 validation:
- `MAX_FILE_SIZE = 2 * 1024 * 1024` (2MB)
- `ALLOWED_EXTENSIONS = [".md", ".txt"]`
- `UploadDocumentSchema`: validates fileName, fileSize, fileExtension, content

**`errors.ts`** — Following `ChatError` / `ProjectError` pattern:
- `DocumentError` base class with `code` + `statusCode`
- `DocumentNotFoundError` (404)
- `DocumentUploadError` (500)

**`repository.ts`** — Raw SQL via `db.execute(sql`...`)` (same as `rag/repository.ts` and `scripts/ingest.ts`):
- `insertDocument(title, source, content, metadata)` → returns document ID
- `insertChunk(documentId, content, embedding, chunkIndex, tokenCount)` → raw SQL with `::vector` cast
- `findAllDocumentSummaries()` → queries `document_summaries` view
- `findDocumentById(id)` → single document
- `deleteDocumentById(id)` → returns boolean

These are extracted from `scripts/ingest.ts` lines 148-180.

**`service.ts`** — Business logic with `getLogger("documents.service")`:
- `chunkText(text, chunkSize, chunkOverlap)` — extracted from `scripts/ingest.ts` lines 82-114 (paragraph-based splitting with overlap)
- `extractTitle(content, fileName)` — extracted from `scripts/ingest.ts` lines 118-124 (first `# heading` or filename fallback)
- `ingestDocument(content, fileName, onProgress)` — main pipeline:
  1. `onProgress({ type: "status", message: "Validating..." })`
  2. Extract title, insert document record
  3. `onProgress({ type: "status", message: "Chunking..." })`
  4. Chunk content (default: size 1000, overlap 200)
  5. For each chunk: call `generateEmbedding()` from `@/features/rag/service`, insert chunk, `onProgress({ type: "progress", current, total, ... })`
  6. `onProgress({ type: "complete", documentId, title, chunksCreated })`
  7. On error mid-pipeline: delete the partially-inserted document (cascades to chunks), then rethrow
- `listDocuments()` — calls repository, returns summaries
- `deleteDocument(id)` — calls repository, throws `DocumentNotFoundError` if not found

The `onProgress` callback keeps the service transport-agnostic — the API route provides an SSE writer, the CLI script provides a console writer, tests provide a mock.

### 2. API Routes

**`POST /api/documents/upload`** — the core route:
1. Auth check (Supabase `getUser()`)
2. `request.formData()` → extract `File` from `"file"` field
3. Read file content via `file.text()`, validate with `UploadDocumentSchema`
4. Return `new Response(readableStream)` with `Content-Type: text/event-stream`
5. Inside stream: call `ingestDocument(content, fileName, sendEvent)` where `sendEvent` enqueues `data: JSON\n\n` via `controller.enqueue()`
6. Pattern directly mirrors `src/app/api/chat/send/route.ts` lines 86-148

**`GET /api/documents`** — auth check, then `listDocuments()`, return JSON.

**`DELETE /api/documents/[id]`** — auth check, then `deleteDocument(id)`, return 204. Follows `src/app/api/chat/conversations/[id]/route.ts` DELETE pattern.

### 3. Client-Side Hook: `use-document-upload.ts`

State: `isUploading`, `progress: { current, total } | null`, `status: string`, `error: string | null`

`upload(file)` function:
1. Client-side validation (extension, size)
2. Build `FormData`, POST to `/api/documents/upload`
3. Read SSE stream (same pattern as `readSSEStream` in `use-chat.ts` lines 34-96)
4. Update state per event type: `status` → set status text, `progress` → set progress numbers, `complete` → toast success + call `onComplete`, `error` → toast error
5. Expose `reset()` to clear state

### 4. Dashboard Page: `/dashboard/documents`

**`page.tsx`** — Server component, renders heading + two client components:
- "Upload and manage your RAG knowledge base documents"

**`document-upload-card.tsx`** — Client component:
- `<Card>` with `<input type="file" accept=".md,.txt" />`
- Shows file name + size after selection
- "Upload" button triggers `useDocumentUpload` hook
- During upload: shadcn `<Progress>` bar + status text ("Embedding chunk 3/7...")
- On complete: success message with title + chunk count
- On error: error message + "Try Again" button

**`document-list.tsx`** — Client component:
- Fetches `GET /api/documents` on mount and after successful upload (via callback)
- Table/list: title, chunk count, total tokens, upload date
- Delete button per row → shadcn `<AlertDialog>` confirmation → `DELETE /api/documents/[id]`
- Empty state when no documents
- Loading skeleton while fetching

### 5. Dashboard Layout Modification

Add "Documents" link in `src/app/(dashboard)/layout.tsx` nav (line 39, after "Projects"):
```tsx
<a href="/dashboard/documents" className="text-muted-foreground hover:text-foreground">
  Documents
</a>
```

### 6. Refactor `scripts/ingest.ts`

Replace inline functions with imports from the new feature:
- Import `chunkText`, `extractTitle` from `@/features/documents`
- Import `insertDocument`, `insertChunk` from `@/features/documents/repository`
- Or call `ingestDocument()` directly with a console-based progress callback
- Keep CLI argument parsing + file discovery as script-specific logic

---

## Implementation Order

**Phase 1 — Feature slice (backend):**
1. Create `documents/models.ts`, `schemas.ts`, `errors.ts`
2. Create `documents/repository.ts` (extract from `scripts/ingest.ts`)
3. Create `documents/service.ts` (extract `chunkText`, `extractTitle`, build `ingestDocument`)
4. Create `documents/index.ts`
5. Run `bun run lint && npx tsc --noEmit`

**Phase 2 — Tests:**
6. Create `documents/tests/errors.test.ts`, `schemas.test.ts`, `service.test.ts`
7. Run `bun test`

**Phase 3 — API routes:**
8. Create `api/documents/route.ts` (GET)
9. Create `api/documents/upload/route.ts` (POST with SSE)
10. Create `api/documents/[id]/route.ts` (DELETE)
11. Run `bun run lint && npx tsc --noEmit`

**Phase 4 — UI:**
12. Add shadcn `progress` component
13. Create `hooks/use-document-upload.ts`
14. Create dashboard page + components
15. Modify dashboard layout nav
16. Run `bun run lint && npx tsc --noEmit`

**Phase 5 — Refactor CLI script:**
17. Update `scripts/ingest.ts` to import from `@/features/documents`
18. Verify: `bun run ingest -- --dir documents/`

**Phase 6 — Static verification:**
19. `bun run lint && npx tsc --noEmit && bun test && bun run build`

**Phase 7 — E2E testing with agent-browser (headed mode):**
20. Start dev server: `bun run dev`
21. Run the full E2E test suite using `/agent-browser` skill (see details below)

---

## Verification

1. **Unit tests**: `bun test` — schemas, errors, `chunkText`, `extractTitle`
2. **Type check**: `npx tsc --noEmit`
3. **Lint**: `bun run lint`
4. **Build**: `bun run build` succeeds
5. **CLI still works**: `bun run ingest -- --file testfile.md`
6. **E2E with agent-browser** (see below)

---

## E2E Testing with agent-browser (headed mode)

Use the `/agent-browser` skill to automate full end-to-end validation in a real browser. All commands use `--headed` so the browser window is visible for observation.

### Prerequisites

- Dev server running: `bun run dev`
- A small test markdown file created (e.g., `documents/doc3_meta_scale_acquisition.md`)
- User must be logged in (authenticate first via agent-browser)
- Use credentials to login
  e2e-billing@test.com:testpassword123
  

### Test 1: Navigate to Documents Page

```bash
agent-browser open http://localhost:3000/dashboard/documents --headed
agent-browser wait --load networkidle
agent-browser snapshot -i
agent-browser screenshot screenshots/e2e-documents-empty.png
```

**Verify:**
- Page loads with "Documents" heading
- Upload card is visible with file input
- Document list shows empty state ("No documents yet")
- "Documents" link is active in dashboard nav

### Test 2: Upload a Document

```bash
# Snapshot to find the file input ref
agent-browser snapshot -i

# Upload the test file
agent-browser upload @{file-input-ref} documents/test-upload.md

# Verify file is selected, then click upload
agent-browser snapshot -i
agent-browser click @{upload-button-ref}

# Wait for SSE progress to complete (embedding takes time)
agent-browser wait --text "complete" 60000
agent-browser snapshot -i
agent-browser screenshot screenshots/e2e-upload-complete.png
```

**Verify:**
- Progress bar advances as chunks are embedded
- Status text shows "Embedding chunk X/Y..."
- On completion: success message with document title and chunk count
- Document appears in the list below

### Test 3: Verify Document in List

```bash
agent-browser snapshot -i
```

**Verify:**
- Uploaded document visible in the list
- Shows correct title (extracted from `# heading`)
- Shows chunk count > 0
- Delete button present on the row

### Test 4: Upload Validation — Wrong File Type

```bash
# Try uploading a .pdf or .json file
agent-browser upload @{file-input-ref} package.json
agent-browser snapshot -i
```

**Verify:**
- File input should only accept `.md` and `.txt` (browser-level filter)
- If bypassed, client-side validation shows error toast

### Test 5: Delete a Document

```bash
agent-browser snapshot -i

# Click delete button on the uploaded document
agent-browser click @{delete-button-ref}

# Wait for confirmation dialog
agent-browser wait --text "Are you sure"
agent-browser snapshot -i

# Confirm deletion
agent-browser click @{confirm-delete-ref}
agent-browser wait --load networkidle
agent-browser snapshot -i
agent-browser screenshot screenshots/e2e-after-delete.png
```

**Verify:**
- Confirmation dialog appears before deletion
- After confirming, document is removed from the list
- List returns to empty state (if it was the only document)

### Test 6: RAG Integration — Upload Then Chat

```bash
# Upload a document with known content
agent-browser open http://localhost:3000/dashboard/documents --headed
agent-browser snapshot -i
agent-browser upload @{file-input-ref} documents/test-upload.md
agent-browser snapshot -i
agent-browser click @{upload-button-ref}
agent-browser wait --text "complete" 60000

# Navigate to chat page
agent-browser open http://localhost:3000
agent-browser wait --load networkidle
agent-browser snapshot -i

# Send a message related to the uploaded document content
agent-browser fill @{chat-input-ref} "What does the test document say?"
agent-browser click @{send-button-ref}

# Wait for AI response with citations
agent-browser wait 15000
agent-browser snapshot -i
agent-browser screenshot screenshots/e2e-rag-chat.png
```

**Verify:**
- AI response contains information from the uploaded document
- Source citations ([1], [2]) appear in the response
- Source reference badges appear below the message bubble

### Test 7: Cleanup

```bash
agent-browser close
```

### E2E Checklist

- [ ] Documents page loads at `/dashboard/documents`
- [ ] "Documents" nav link visible in dashboard header
- [ ] File upload with progress bar works
- [ ] Upload completion shows success with title + chunk count
- [ ] Document appears in list after upload
- [ ] Invalid file type rejected
- [ ] Delete with confirmation dialog works
- [ ] RAG retrieval works for uploaded content in chat
- [ ] No console errors (`agent-browser errors`)
