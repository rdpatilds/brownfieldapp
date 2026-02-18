import { asc, eq } from "drizzle-orm";

import { db } from "../../database/client";

import type { Conversation, Message, NewConversation, NewMessage } from "./models";
import { conversations, messages } from "./models";

export async function findConversationById(id: string): Promise<Conversation | undefined> {
  const results = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  return results[0];
}

export async function createConversation(data: NewConversation): Promise<Conversation> {
  const results = await db.insert(conversations).values(data).returning();
  const conversation = results[0];
  if (!conversation) {
    throw new Error("Failed to create conversation");
  }
  return conversation;
}

export async function updateConversation(
  id: string,
  data: Partial<Pick<Conversation, "title">>,
): Promise<Conversation | undefined> {
  const results = await db
    .update(conversations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .returning();
  return results[0];
}

export async function deleteConversation(id: string): Promise<boolean> {
  const results = await db.delete(conversations).where(eq(conversations.id, id)).returning();
  return results.length > 0;
}

export async function findMessagesByConversationId(
  conversationId: string,
  limit?: number,
): Promise<Message[]> {
  const query = db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  if (limit !== undefined) {
    return query.limit(limit);
  }

  return query;
}

export async function createMessage(data: NewMessage): Promise<Message> {
  const results = await db.insert(messages).values(data).returning();
  const message = results[0];
  if (!message) {
    throw new Error("Failed to create message");
  }
  return message;
}
