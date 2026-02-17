import type { NextRequest } from "next/server";

import { handleApiError, unauthorizedResponse } from "@/core/api/errors";
import { getLogger } from "@/core/logging";
import { createClient } from "@/core/supabase/server";
import { consumeToken, refundToken } from "@/features/billing";
import {
  addMessage,
  createConversation,
  generateTitleFromMessage,
  getMessages,
  SendMessageSchema,
  streamChatCompletion,
} from "@/features/chat";

const logger = getLogger("api.chat.send");

/**
 * POST /api/chat/send
 * Send a message and stream the AI response via SSE.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, conversationId: existingConversationId } = SendMessageSchema.parse(body);

    // Auth check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return unauthorizedResponse();
    }

    let conversationId = existingConversationId ?? "";

    // Consume token (throws 402 if insufficient)
    const remainingBalance = await consumeToken(user.id, conversationId || "new");

    // Create conversation if needed
    if (!existingConversationId) {
      const title = generateTitleFromMessage(content);
      const conversation = await createConversation(title, user.id);
      conversationId = conversation.id;
      logger.info({ conversationId }, "chat.conversation_created");
    }

    // Save user message
    await addMessage(conversationId, "user", content);

    // Get history for context
    const history = await getMessages(conversationId);

    // Stream completion
    const { stream, fullResponse } = await streamChatCompletion(history);

    // Wrap the stream to save assistant message after completion
    const reader = stream.getReader();
    const wrappedStream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (!done) {
          controller.enqueue(value);
          return;
        }
        // Stream finished — save assistant message
        const encoder = new TextEncoder();
        try {
          const fullText = await fullResponse;
          await addMessage(conversationId, "assistant", fullText);
          logger.info({ conversationId }, "chat.assistant_message_saved");
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done", saved: true })}\n\n`),
          );
        } catch (err) {
          logger.error({ conversationId, error: err }, "chat.assistant_message_save_failed");
          // Refund the token
          try {
            await refundToken(user.id, conversationId);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "refund", message: "Response failed, token refunded" })}\n\n`,
              ),
            );
          } catch (refundErr) {
            logger.error({ conversationId, error: refundErr }, "chat.refund_failed");
          }
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", message: "Failed to save response" })}\n\n`,
            ),
          );
        }
        controller.close();
      },
    });

    // Return SSE response
    return new Response(wrappedStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Conversation-Id": conversationId,
        "X-Token-Balance": String(remainingBalance),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
