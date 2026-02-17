import { getLogger } from "@/core/logging";

import { ConversationNotFoundError } from "./errors";
import type { Conversation, Message } from "./models";
import * as repository from "./repository";

const logger = getLogger("chat.service");

export async function createConversation(title: string, userId?: string): Promise<Conversation> {
  logger.info({ title, userId }, "conversation.create_started");

  const conversation = await repository.createConversation({ title, userId });

  logger.info({ conversationId: conversation.id }, "conversation.create_completed");
  return conversation;
}

export async function getConversation(id: string): Promise<Conversation> {
  logger.info({ conversationId: id }, "conversation.get_started");

  const conversation = await repository.findConversationById(id);

  if (!conversation) {
    logger.warn({ conversationId: id }, "conversation.get_failed");
    throw new ConversationNotFoundError(id);
  }

  logger.info({ conversationId: id }, "conversation.get_completed");
  return conversation;
}

export async function updateConversation(id: string, title: string): Promise<Conversation> {
  logger.info({ conversationId: id }, "conversation.update_started");

  const updated = await repository.updateConversation(id, { title });

  if (!updated) {
    logger.warn({ conversationId: id }, "conversation.update_failed");
    throw new ConversationNotFoundError(id);
  }

  logger.info({ conversationId: id }, "conversation.update_completed");
  return updated;
}

export async function deleteConversation(id: string): Promise<void> {
  logger.info({ conversationId: id }, "conversation.delete_started");

  const deleted = await repository.deleteConversation(id);

  if (!deleted) {
    logger.warn({ conversationId: id }, "conversation.delete_failed");
    throw new ConversationNotFoundError(id);
  }

  logger.info({ conversationId: id }, "conversation.delete_completed");
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  logger.info({ conversationId }, "messages.get_started");

  const msgs = await repository.findMessagesByConversationId(conversationId);

  logger.info({ conversationId, count: msgs.length }, "messages.get_completed");
  return msgs;
}

export async function addMessage(
  conversationId: string,
  role: string,
  content: string,
): Promise<Message> {
  logger.info({ conversationId, role }, "message.add_started");

  const message = await repository.createMessage({ conversationId, role, content });

  logger.info({ conversationId, messageId: message.id }, "message.add_completed");
  return message;
}

export function generateTitleFromMessage(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= 50) {
    return trimmed;
  }
  return `${trimmed.substring(0, 50)}...`;
}
