import { describe, expect, it, mock } from "bun:test";

import { MAX_CONTEXT_MESSAGES, RAG_SYSTEM_PROMPT_TEMPLATE } from "@chatapp/shared";
import type { Message } from "../models";

// Mock env and logging to avoid requiring environment variables
mock.module("../../../config/env", () => ({
  env: {
    OPENROUTER_API_KEY: "test-key",
    OPENROUTER_MODEL: "test-model",
  },
}));
mock.module("../../../logging", () => ({
  getLogger: () => ({
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
  }),
}));

const { buildMessages } = await import("../stream");

function createMockMessage(role: string, content: string): Message {
  return {
    id: crypto.randomUUID(),
    conversationId: "550e8400-e29b-41d4-a716-446655440000",
    role,
    content,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("buildMessages", () => {
  it("prepends system prompt", () => {
    const history: Message[] = [createMockMessage("user", "Hello")];

    const result = buildMessages(history);

    expect(result[0]).toEqual({
      role: "system",
      content: "You are a helpful AI assistant. Be concise, accurate, and friendly.",
    });
  });

  it("maps message role and content correctly", () => {
    const history: Message[] = [
      createMockMessage("user", "Hello"),
      createMockMessage("assistant", "Hi there!"),
    ];

    const result = buildMessages(history);

    expect(result).toHaveLength(3); // system + 2 messages
    expect(result[1]).toEqual({ role: "user", content: "Hello" });
    expect(result[2]).toEqual({ role: "assistant", content: "Hi there!" });
  });

  it("limits to MAX_CONTEXT_MESSAGES", () => {
    const history: Message[] = [];
    for (let i = 0; i < MAX_CONTEXT_MESSAGES + 10; i++) {
      history.push(createMockMessage("user", `Message ${i}`));
    }

    const result = buildMessages(history);

    // system prompt + MAX_CONTEXT_MESSAGES
    expect(result).toHaveLength(MAX_CONTEXT_MESSAGES + 1);
    // Should include the last messages, not the first
    expect(result[1]?.content).toBe(`Message 10`);
  });

  it("handles empty history", () => {
    const result = buildMessages([]);

    expect(result).toHaveLength(1);
    expect(result[0]?.role).toBe("system");
  });

  it("uses RAG system prompt when ragContext is provided", () => {
    const history: Message[] = [createMockMessage("user", "Hello")];
    const ragContext = "[1] Doc (source)\nSome content";

    const result = buildMessages(history, ragContext);

    const expected = RAG_SYSTEM_PROMPT_TEMPLATE.replace("{context}", ragContext);
    expect(result[0]?.content).toBe(expected);
  });

  it("RAG system prompt includes citation instructions", () => {
    const history: Message[] = [createMockMessage("user", "Hello")];
    const ragContext = "[1] Test Doc (source.md)\nContent";

    const result = buildMessages(history, ragContext);
    const systemContent = result[0]?.content ?? "";

    expect(systemContent).toContain("Cite your sources using bracketed numbers like [1], [2]");
    expect(systemContent).toContain("Place citations inline");
  });

  it("uses default system prompt when ragContext is undefined", () => {
    const history: Message[] = [createMockMessage("user", "Hello")];

    const result = buildMessages(history, undefined);

    expect(result[0]?.content).toBe(
      "You are a helpful AI assistant. Be concise, accurate, and friendly.",
    );
  });
});
