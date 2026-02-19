import { describe, expect, it } from "vitest";

import { ChatError, ConversationNotFoundError, OpenRouterError, StreamError } from "../errors";

describe("ChatError", () => {
  it("creates error with message, code, and status", () => {
    const error = new ChatError("Test error", "CONVERSATION_NOT_FOUND", 404);
    expect(error.message).toBe("Test error");
    expect(error.code).toBe("CONVERSATION_NOT_FOUND");
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe("ChatError");
  });

  it("is instanceof Error", () => {
    const error = new ChatError("Test", "CONVERSATION_NOT_FOUND", 404);
    expect(error).toBeInstanceOf(Error);
  });
});

describe("ConversationNotFoundError", () => {
  it("creates error with id in message", () => {
    const error = new ConversationNotFoundError("conv-123");
    expect(error.message).toBe("Conversation not found: conv-123");
    expect(error.code).toBe("CONVERSATION_NOT_FOUND");
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe("ConversationNotFoundError");
  });

  it("is instanceof ChatError", () => {
    const error = new ConversationNotFoundError("id");
    expect(error).toBeInstanceOf(ChatError);
  });
});

describe("OpenRouterError", () => {
  it("creates error with message", () => {
    const error = new OpenRouterError("API rate limited");
    expect(error.message).toBe("API rate limited");
    expect(error.code).toBe("OPENROUTER_ERROR");
    expect(error.statusCode).toBe(502);
    expect(error.name).toBe("OpenRouterError");
  });

  it("is instanceof ChatError", () => {
    const error = new OpenRouterError("error");
    expect(error).toBeInstanceOf(ChatError);
  });
});

describe("StreamError", () => {
  it("creates error with message", () => {
    const error = new StreamError("Connection dropped");
    expect(error.message).toBe("Connection dropped");
    expect(error.code).toBe("STREAM_ERROR");
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe("StreamError");
  });

  it("is instanceof ChatError", () => {
    const error = new StreamError("error");
    expect(error).toBeInstanceOf(ChatError);
  });
});
