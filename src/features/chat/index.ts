// Types

// Constants
export { MAX_CONTEXT_MESSAGES, RAG_SYSTEM_PROMPT_TEMPLATE, SYSTEM_PROMPT } from "./constants";
// Errors
export type { ChatErrorCode } from "./errors";
export {
  ChatError,
  ConversationNotFoundError,
  OpenRouterError,
  StreamError,
} from "./errors";
export type { Conversation, Message, NewConversation, NewMessage } from "./models";
export type {
  CreateConversationInput,
  SendMessageInput,
  UpdateConversationInput,
} from "./schemas";
// Schemas (for validation)
export { CreateConversationSchema, SendMessageSchema, UpdateConversationSchema } from "./schemas";

// Service functions (public API)
export {
  addMessage,
  createConversation,
  deleteConversation,
  generateTitleFromMessage,
  getConversation,
  getMessages,
  updateConversation,
} from "./service";

// Stream functions
export { buildMessages, streamChatCompletion } from "./stream";
