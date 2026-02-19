import { describe, expect, it } from "vitest";

import { CreateConversationSchema, SendMessageSchema, UpdateConversationSchema } from "../chat";

describe("SendMessageSchema", () => {
  it("validates valid input with conversationId", () => {
    const result = SendMessageSchema.parse({
      content: "Hello, world!",
      conversationId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.content).toBe("Hello, world!");
    expect(result.conversationId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("validates valid input without conversationId", () => {
    const result = SendMessageSchema.parse({
      content: "Hello, world!",
    });
    expect(result.content).toBe("Hello, world!");
    expect(result.conversationId).toBeUndefined();
  });

  it("rejects empty content", () => {
    expect(() => SendMessageSchema.parse({ content: "" })).toThrow();
  });

  it("rejects content longer than 10000 characters", () => {
    const longContent = "a".repeat(10001);
    expect(() => SendMessageSchema.parse({ content: longContent })).toThrow();
  });

  it("accepts content at max length", () => {
    const maxContent = "a".repeat(10000);
    const result = SendMessageSchema.parse({ content: maxContent });
    expect(result.content.length).toBe(10000);
  });

  it("rejects invalid conversationId UUID", () => {
    expect(() =>
      SendMessageSchema.parse({
        content: "Hello",
        conversationId: "not-a-uuid",
      }),
    ).toThrow();
  });
});

describe("CreateConversationSchema", () => {
  it("validates valid input", () => {
    const result = CreateConversationSchema.parse({
      title: "My Conversation",
    });
    expect(result.title).toBe("My Conversation");
  });

  it("rejects empty title", () => {
    expect(() => CreateConversationSchema.parse({ title: "" })).toThrow();
  });

  it("rejects title longer than 200 characters", () => {
    const longTitle = "a".repeat(201);
    expect(() => CreateConversationSchema.parse({ title: longTitle })).toThrow();
  });

  it("accepts title at max length", () => {
    const maxTitle = "a".repeat(200);
    const result = CreateConversationSchema.parse({ title: maxTitle });
    expect(result.title.length).toBe(200);
  });

  it("accepts single character title", () => {
    const result = CreateConversationSchema.parse({ title: "A" });
    expect(result.title).toBe("A");
  });
});

describe("UpdateConversationSchema", () => {
  it("validates valid input", () => {
    const result = UpdateConversationSchema.parse({
      title: "Updated Title",
    });
    expect(result.title).toBe("Updated Title");
  });

  it("rejects empty title", () => {
    expect(() => UpdateConversationSchema.parse({ title: "" })).toThrow();
  });

  it("rejects title longer than 200 characters", () => {
    const longTitle = "a".repeat(201);
    expect(() => UpdateConversationSchema.parse({ title: longTitle })).toThrow();
  });

  it("accepts title at max length", () => {
    const maxTitle = "a".repeat(200);
    const result = UpdateConversationSchema.parse({ title: maxTitle });
    expect(result.title.length).toBe(200);
  });
});
