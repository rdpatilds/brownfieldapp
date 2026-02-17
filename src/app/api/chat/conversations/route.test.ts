import { beforeEach, describe, expect, it, mock } from "bun:test";
import { NextRequest } from "next/server";

import type { Conversation } from "@/features/chat";

const mockConversation: Conversation = {
  id: "conv-123",
  title: "Test Conversation",
  userId: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

// Mock the repository (database layer)
const mockCreateConversation = mock(() => Promise.resolve(mockConversation));

mock.module("@/features/chat/repository", () => ({
  createConversation: mockCreateConversation,
  findConversationById: mock(() => Promise.resolve(mockConversation)),
  updateConversation: mock(() => Promise.resolve(mockConversation)),
  deleteConversation: mock(() => Promise.resolve(true)),
  findMessagesByConversationId: mock(() => Promise.resolve([])),
  createMessage: mock(() => Promise.resolve({})),
}));

// Import routes after mocking
const { POST } = await import("./route");

describe("POST /api/chat/conversations", () => {
  beforeEach(() => {
    mockCreateConversation.mockClear();
  });

  it("creates a conversation with valid title", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat/conversations", {
      method: "POST",
      body: JSON.stringify({ title: "New Conversation" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("conv-123");
    expect(data.title).toBe("Test Conversation");
    expect(mockCreateConversation).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for missing title", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat/conversations", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for empty title", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat/conversations", {
      method: "POST",
      body: JSON.stringify({ title: "" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for title too long", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat/conversations", {
      method: "POST",
      body: JSON.stringify({ title: "a".repeat(201) }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("VALIDATION_ERROR");
  });
});
