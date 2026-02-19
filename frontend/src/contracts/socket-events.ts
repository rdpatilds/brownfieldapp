/** Client -> Server events */
export const CLIENT_EVENTS = {
  SEND_MESSAGE: "chat:send_message",
  ABORT_STREAM: "chat:abort_stream",
} as const;

/** Server -> Client events */
export const SERVER_EVENTS = {
  CONVERSATION_CREATED: "chat:conversation_created",
  TOKEN_CONSUMED: "chat:token_consumed",
  SOURCES: "chat:sources",
  STREAM_CHUNK: "chat:stream_chunk",
  STREAM_DONE: "chat:stream_done",
  STREAM_ERROR: "chat:stream_error",
  TOKEN_REFUNDED: "chat:token_refunded",
  ERROR: "chat:error",
} as const;

/** Payload types for client events */
export interface SendMessagePayload {
  content: string;
  conversationId?: string;
}

/** Payload types for server events */
export interface ConversationCreatedPayload {
  conversationId: string;
  title: string;
}

export interface TokenConsumedPayload {
  remainingBalance: number;
}

export interface SourcesPayload {
  sources: Array<{ index: number; title: string; source: string }>;
}

export interface StreamChunkPayload {
  content: string;
}

export interface StreamDonePayload {
  saved: boolean;
}

export interface StreamErrorPayload {
  message: string;
}

export interface TokenRefundedPayload {
  message: string;
}

export interface ChatErrorPayload {
  code: string;
  message: string;
}
