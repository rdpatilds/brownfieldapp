import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import {
  chatConversations as conversations,
  chatMessages as messages,
} from "../../database/schema";

export { conversations, messages };

export type Conversation = InferSelectModel<typeof conversations>;
export type NewConversation = InferInsertModel<typeof conversations>;
export type Message = InferSelectModel<typeof messages>;
export type NewMessage = InferInsertModel<typeof messages>;
