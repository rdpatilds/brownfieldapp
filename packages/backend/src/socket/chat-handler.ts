import type {
  ConversationCreatedPayload,
  SourcesPayload,
  StreamChunkPayload,
  StreamDonePayload,
  StreamErrorPayload,
  TokenConsumedPayload,
  TokenRefundedPayload,
} from "@chatapp/shared";
import { CLIENT_EVENTS, SERVER_EVENTS, SendMessageSchema } from "@chatapp/shared";
import type { User } from "@supabase/supabase-js";
import type { Socket } from "socket.io";
import { consumeToken, refundToken } from "../features/billing";
import {
  addMessage,
  createConversation,
  generateTitleFromMessage,
  getMessages,
} from "../features/chat";
import { streamChatCompletion } from "../features/chat/stream";
import { formatContextForPrompt, retrieveContext } from "../features/rag";
import { getLogger } from "../logging";

const logger = getLogger("socket.chat");

/** Map of socket ID to active AbortController for stream cancellation. */
const activeStreams = new Map<string, AbortController>();

/**
 * Register all chat-related event handlers on a connected socket.
 * Converts the HTTP+SSE chat flow into Socket.IO events.
 */
export function registerChatHandlers(socket: Socket): void {
  const user = socket.data.user as User;

  socket.on(CLIENT_EVENTS.SEND_MESSAGE, async (payload: unknown) => {
    let conversationId = "";

    try {
      // 1. Validate payload
      const { content, conversationId: existingConversationId } = SendMessageSchema.parse(payload);

      logger.info(
        { userId: user.id, hasConversation: !!existingConversationId },
        "chat.send_message_started",
      );

      conversationId = existingConversationId ?? "";

      // 2. Consume token (throws if insufficient balance)
      const remainingBalance = await consumeToken(user.id, conversationId || "new");
      socket.emit(SERVER_EVENTS.TOKEN_CONSUMED, {
        remainingBalance,
      } satisfies TokenConsumedPayload);

      // 3. Create conversation if needed
      if (!existingConversationId) {
        const title = generateTitleFromMessage(content);
        const conversation = await createConversation(title, user.id);
        conversationId = conversation.id;
        socket.emit(SERVER_EVENTS.CONVERSATION_CREATED, {
          conversationId: conversation.id,
          title: conversation.title,
        } satisfies ConversationCreatedPayload);
        logger.info({ conversationId }, "chat.conversation_created");
      }

      // 4. Save user message
      await addMessage(conversationId, "user", content);

      // 5. Get message history for context
      const history = await getMessages(conversationId);

      // 6. Retrieve RAG context (non-fatal)
      let ragContext: string | undefined;
      let ragSources: Array<{ index: number; title: string; source: string }> = [];
      try {
        const retrieval = await retrieveContext(content);
        if (retrieval.chunks.length > 0) {
          ragContext = formatContextForPrompt(retrieval.chunks);
          ragSources = retrieval.chunks.map((chunk, i) => ({
            index: i + 1,
            title: chunk.documentTitle,
            source: chunk.documentSource,
          }));
          logger.info(
            { conversationId, chunkCount: retrieval.chunks.length },
            "chat.rag_context_retrieved",
          );
        }
      } catch (ragError) {
        const message = ragError instanceof Error ? ragError.message : "Unknown RAG error";
        logger.warn({ conversationId, error: message }, "chat.rag_retrieval_failed");
      }

      // 7. Emit sources if found
      if (ragSources.length > 0) {
        socket.emit(SERVER_EVENTS.SOURCES, {
          sources: ragSources,
        } satisfies SourcesPayload);
      }

      // 8. Stream chat completion
      const abortController = new AbortController();
      activeStreams.set(socket.id, abortController);

      const { stream, fullResponse } = await streamChatCompletion(
        history,
        ragContext
          ? { ragContext, signal: abortController.signal }
          : { signal: abortController.signal },
      );

      // Read the stream and emit chunks
      const reader = stream.getReader();
      try {
        let reading = true;
        while (reading) {
          const { done, value } = await reader.read();
          if (done) {
            reading = false;
            break;
          }
          // Parse the SSE-formatted chunk to extract content
          const lines = value.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) {
              continue;
            }
            const data = trimmed.slice(6);
            if (data === "[DONE]") {
              continue;
            }
            try {
              const parsed = JSON.parse(data) as { content?: string };
              if (parsed.content) {
                socket.emit(SERVER_EVENTS.STREAM_CHUNK, {
                  content: parsed.content,
                } satisfies StreamChunkPayload);
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // 9. Save assistant message after stream completes
      const fullText = await fullResponse;
      await addMessage(conversationId, "assistant", fullText);
      logger.info({ conversationId }, "chat.assistant_message_saved");

      socket.emit(SERVER_EVENTS.STREAM_DONE, {
        saved: true,
      } satisfies StreamDonePayload);

      activeStreams.delete(socket.id);
    } catch (error) {
      activeStreams.delete(socket.id);
      const message = error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error({ userId: user.id, conversationId, error: message }, "chat.send_message_failed");

      socket.emit(SERVER_EVENTS.STREAM_ERROR, {
        message,
      } satisfies StreamErrorPayload);

      // 10. Attempt token refund on failure
      if (conversationId) {
        try {
          await refundToken(user.id, conversationId);
          socket.emit(SERVER_EVENTS.TOKEN_REFUNDED, {
            message: "Response failed, token refunded",
          } satisfies TokenRefundedPayload);
          logger.info({ userId: user.id, conversationId }, "chat.token_refunded");
        } catch (refundError) {
          const refundMessage =
            refundError instanceof Error ? refundError.message : "Unknown refund error";
          logger.error(
            { userId: user.id, conversationId, error: refundMessage },
            "chat.refund_failed",
          );
        }
      }
    }
  });

  // 11. Handle stream abort requests
  socket.on(CLIENT_EVENTS.ABORT_STREAM, () => {
    const controller = activeStreams.get(socket.id);
    if (controller) {
      logger.info({ socketId: socket.id, userId: user.id }, "chat.abort_stream");
      controller.abort();
      activeStreams.delete(socket.id);
    }
  });

  // Clean up on disconnect
  socket.on("disconnect", () => {
    const controller = activeStreams.get(socket.id);
    if (controller) {
      controller.abort();
      activeStreams.delete(socket.id);
    }
  });
}
