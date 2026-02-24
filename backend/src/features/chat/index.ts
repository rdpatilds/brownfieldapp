// Errors
export type { ChatErrorCode } from "./errors";
export {
  AzureOpenAIError,
  ChatError,
  ConversationNotFoundError,
  LLMConfigError,
  OpenRouterError,
  StreamError,
} from "./errors";

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
