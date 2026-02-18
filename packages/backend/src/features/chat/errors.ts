type HttpStatusCode = 400 | 401 | 402 | 403 | 404 | 409 | 500 | 502;

/** Known error codes for chat operations. */
export type ChatErrorCode = "CONVERSATION_NOT_FOUND" | "OPENROUTER_ERROR" | "STREAM_ERROR";

/**
 * Base error for chat-related errors.
 */
export class ChatError extends Error {
  readonly code: ChatErrorCode;
  readonly statusCode: HttpStatusCode;

  constructor(message: string, code: ChatErrorCode, statusCode: HttpStatusCode) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ConversationNotFoundError extends ChatError {
  constructor(id: string) {
    super(`Conversation not found: ${id}`, "CONVERSATION_NOT_FOUND", 404);
  }
}

export class OpenRouterError extends ChatError {
  constructor(message: string) {
    super(message, "OPENROUTER_ERROR", 502);
  }
}

export class StreamError extends ChatError {
  constructor(message: string) {
    super(message, "STREAM_ERROR", 500);
  }
}
