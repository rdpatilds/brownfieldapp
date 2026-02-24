# Chat WebSocket Sequence Flow

This document describes the complete WebSocket-based chat message flow between the frontend and backend.

---

## WebSocket Connection Lifecycle

### 1. Connection Creation (Frontend)

The socket is created as a **singleton** in `frontend/src/lib/socket.ts`. When the chat UI mounts, `getSocket()` is called:

1. Fetches the current Supabase session to get the `access_token`
2. Creates a Socket.IO client pointing at `NEXT_PUBLIC_BACKEND_URL` (default `localhost:4000`)
3. Passes the token via `socket.auth = { token }` — this is how the user identity travels over WebSocket
4. Enables auto-reconnect (1–5 second delays)
5. Listens for `onAuthStateChange` so if the Supabase token refreshes, the socket auth is updated before reconnecting

### 2. Server Accepts Connection (Backend)

In `backend/src/socket/index.ts`, `setupSocket(httpServer)` creates the Socket.IO server and registers middleware:

1. **Auth middleware** (`backend/src/socket/auth.ts`): Extracts the token from `socket.handshake.auth.token`, calls `supabase.auth.getUser()` to verify it. If valid, attaches the user to `socket.data.user` and calls `next()`. If invalid, rejects the connection.
2. On successful connection, `registerChatHandlers(socket)` is called to wire up event listeners for that socket.

---

## Chat Message Flow (Step by Step)

### Event Names

| Direction | Event | Purpose |
|-----------|-------|---------|
| Client → Server | `chat:send_message` | Send a user message |
| Client → Server | `chat:abort_stream` | Cancel mid-stream |
| Server → Client | `chat:token_consumed` | Token deducted |
| Server → Client | `chat:conversation_created` | New conversation ID + title |
| Server → Client | `chat:sources` | RAG document sources |
| Server → Client | `chat:stream_chunk` | Incremental AI text |
| Server → Client | `chat:stream_done` | Stream finished |
| Server → Client | `chat:stream_error` | Error occurred |
| Server → Client | `chat:token_refunded` | Token refunded on failure |

### Sending a Message

**Frontend** (`frontend/src/hooks/use-chat.ts` — `sendMessage()`):

1. User types a message and hits send
2. A temporary user message is added to the UI immediately (optimistic update)
3. `socket.emit("chat:send_message", { content, conversationId? })` is fired
4. `isStreaming` is set to `true`

**Backend** (`backend/src/socket/chat-handler.ts`):

5. **Validate** — payload is parsed against `SendMessageSchema` (content: 1–10,000 chars, optional conversationId UUID)
6. **Consume token** — `consumeToken(userId, conversationId)` deducts from balance → emits `chat:token_consumed` with `remainingBalance`
7. **Create conversation if new** — if no `conversationId` was sent, creates one in the DB using the first 50 chars as title → emits `chat:conversation_created` with the new ID
8. **Save user message** — `addMessage(conversationId, "user", content)` inserts into `chatMessages`
9. **Fetch history** — loads all messages in the conversation (up to last 50) for LLM context
10. **RAG retrieval** — attempts to find relevant document chunks via vector search. If found, emits `chat:sources` with titles and indices. If RAG fails, it's non-fatal — proceeds without context.
11. **Stream LLM response** — calls `streamChatCompletion()` which:
    - Builds a message array with system prompt + history (+ RAG context if available)
    - POSTs to **OpenRouter API** with `stream: true`
    - Gets back an SSE stream
    - Parses SSE `data:` lines, extracts content chunks
12. **Emit chunks** — each parsed content piece is emitted as `chat:stream_chunk` to the client
13. **Finalize** — when the stream ends, the full accumulated text is saved as an assistant message in the DB → emits `chat:stream_done`

### Receiving on Frontend

Back in `use-chat.ts`, socket listeners handle each event:

- `chat:token_consumed` → updates the token balance display
- `chat:conversation_created` → sets the active conversation ID, adds it to the sidebar list, updates temp messages with the real ID
- `chat:sources` → stores RAG sources for citation display
- `chat:stream_chunk` → appends to `streamingContent` string, UI re-renders showing text appearing incrementally
- `chat:stream_done` → creates the final assistant message object, clears streaming state, sets `isStreaming = false`

### Abort Flow

If the user cancels mid-stream:

- Frontend emits `chat:abort_stream`
- Backend looks up the `AbortController` for that socket ID and calls `.abort()`, which cancels the OpenRouter fetch
- Streaming stops, cleanup runs

### Error + Refund Flow

If anything fails (e.g., OpenRouter is down):

- Backend emits `chat:stream_error` with the error message
- Then attempts `refundToken()` to reverse the token deduction
- Emits `chat:token_refunded` so the frontend can notify the user
- Frontend shows a toast error and resets streaming state

---

## Key Architecture Decisions

1. **Token-first**: Tokens are consumed *before* calling the LLM, then refunded if the call fails
2. **Lazy conversation creation**: The conversation is only created in the DB on the first message, not upfront
3. **Streaming via SSE → Socket.IO bridge**: OpenRouter returns Server-Sent Events over HTTP; the backend reads that stream and re-emits each chunk as a `chat:stream_chunk` Socket.IO event
4. **REST for CRUD, WebSocket for chat**: Loading message history, renaming/deleting conversations use REST (`GET/PATCH/DELETE /api/chat/conversations`), but the actual message exchange is entirely over WebSocket
5. **Full context window**: Every LLM call includes the last 50 messages from the conversation as history
6. **RAG is optional**: If vector search fails or returns nothing, the chat still works — just without document citations
