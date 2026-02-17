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

const mockUpdatedConversation: Conversation = {
  ...mockConversation,
  title: "Updated Title",
};

// Mock the repository (database layer)
const mockFindConversationById = mock<() => Promise<Conversation | undefined>>(() =>
  Promise.resolve(mockConversation),
);
const mockUpdateConversation = mock<() => Promise<Conversation | undefined>>(() =>
  Promise.resolve(mockUpdatedConversation),
);
const mockDeleteConversation = mock<() => Promise<boolean>>(() => Promise.resolve(true));

mock.module("@/features/chat/repository", () => ({
  findConversationById: mockFindConversationById,
  updateConversation: mockUpdateConversation,
  deleteConversation: mockDeleteConversation,
  createConversation: mock(() => Promise.resolve(mockConversation)),
  findMessagesByConversationId: mock(() => Promise.resolve([])),
  createMessage: mock(() => Promise.resolve({})),
}));

// Import routes after mocking
const { GET, PATCH, DELETE } = await import("./route");

// Helper to create route params
const createParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/chat/conversations/[id]", () => {
  beforeEach(() => {
    mockFindConversationById.mockClear();
    mockFindConversationById.mockImplementation(() => Promise.resolve(mockConversation));
  });

  it("returns conversation by id", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat/conversations/conv-123");
    const response = await GET(request, createParams("conv-123"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("conv-123");
    expect(data.title).toBe("Test Conversation");
  });

  it("returns 404 for non-existent conversation", async () => {
    mockFindConversationById.mockImplementation(() => Promise.resolve(undefined));

    const request = new NextRequest("http://localhost:3000/api/chat/conversations/not-found");
    const response = await GET(request, createParams("not-found"));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe("CONVERSATION_NOT_FOUND");
  });
});

describe("PATCH /api/chat/conversations/[id]", () => {
  beforeEach(() => {
    mockUpdateConversation.mockClear();
    mockUpdateConversation.mockImplementation(() => Promise.resolve(mockUpdatedConversation));
  });

  it("updates conversation title", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat/conversations/conv-123", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated Title" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PATCH(request, createParams("conv-123"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.title).toBe("Updated Title");
  });

  it("returns 400 for invalid input", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat/conversations/conv-123", {
      method: "PATCH",
      body: JSON.stringify({ title: "" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PATCH(request, createParams("conv-123"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for non-existent conversation", async () => {
    mockUpdateConversation.mockImplementation(() => Promise.resolve(undefined));

    const request = new NextRequest("http://localhost:3000/api/chat/conversations/not-found", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PATCH(request, createParams("not-found"));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe("CONVERSATION_NOT_FOUND");
  });
});

describe("DELETE /api/chat/conversations/[id]", () => {
  beforeEach(() => {
    mockDeleteConversation.mockClear();
    mockDeleteConversation.mockImplementation(() => Promise.resolve(true));
  });

  it("deletes conversation", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat/conversations/conv-123", {
      method: "DELETE",
    });

    const response = await DELETE(request, createParams("conv-123"));

    expect(response.status).toBe(204);
  });

  it("returns 404 for non-existent conversation", async () => {
    mockDeleteConversation.mockImplementation(() => Promise.resolve(false));

    const request = new NextRequest("http://localhost:3000/api/chat/conversations/not-found", {
      method: "DELETE",
    });

    const response = await DELETE(request, createParams("not-found"));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe("CONVERSATION_NOT_FOUND");
  });
});
