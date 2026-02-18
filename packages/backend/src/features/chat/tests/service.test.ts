import { beforeEach, describe, expect, it, mock } from "bun:test";

import type { Conversation, Message } from "../models";

// Mock the repository module with properly typed functions
const mockRepository = {
  findConversationById: mock<(id: string) => Promise<Conversation | undefined>>(() =>
    Promise.resolve(undefined),
  ),
  createConversation: mock<(data: unknown) => Promise<Conversation>>(() =>
    Promise.resolve({} as Conversation),
  ),
  updateConversation: mock<(id: string, data: unknown) => Promise<Conversation | undefined>>(() =>
    Promise.resolve(undefined),
  ),
  deleteConversation: mock<(id: string) => Promise<boolean>>(() => Promise.resolve(false)),
  findMessagesByConversationId: mock<
    (conversationId: string, limit?: number) => Promise<Message[]>
  >(() => Promise.resolve([])),
  createMessage: mock<(data: unknown) => Promise<Message>>(() => Promise.resolve({} as Message)),
};

// Mock the repository before importing service
mock.module("../repository", () => mockRepository);

// Import service after mocking
const {
  addMessage,
  createConversation,
  deleteConversation,
  generateTitleFromMessage,
  getConversation,
  getMessages,
  updateConversation,
} = await import("../service");

const mockConversation: Conversation = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  title: "Test Conversation",
  userId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockMessage: Message = {
  id: "550e8400-e29b-41d4-a716-446655440010",
  conversationId: "550e8400-e29b-41d4-a716-446655440000",
  role: "user",
  content: "Hello, world!",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("createConversation", () => {
  beforeEach(() => {
    mockRepository.createConversation.mockReset();
  });

  it("creates a conversation", async () => {
    mockRepository.createConversation.mockResolvedValue(mockConversation);

    const result = await createConversation("Test Conversation");

    expect(result).toEqual(mockConversation);
    expect(mockRepository.createConversation).toHaveBeenCalledTimes(1);
  });
});

describe("getConversation", () => {
  beforeEach(() => {
    mockRepository.findConversationById.mockReset();
  });

  it("returns conversation when found", async () => {
    mockRepository.findConversationById.mockResolvedValue(mockConversation);

    const result = await getConversation(mockConversation.id);

    expect(result).toEqual(mockConversation);
  });

  it("throws ConversationNotFoundError when not found", async () => {
    mockRepository.findConversationById.mockResolvedValue(undefined);

    await expect(getConversation("non-existent-id")).rejects.toThrow("Conversation not found");
  });
});

describe("updateConversation", () => {
  beforeEach(() => {
    mockRepository.updateConversation.mockReset();
  });

  it("updates conversation when found", async () => {
    const updatedConversation = { ...mockConversation, title: "Updated Title" };
    mockRepository.updateConversation.mockResolvedValue(updatedConversation);

    const result = await updateConversation(mockConversation.id, "Updated Title");

    expect(result.title).toBe("Updated Title");
  });

  it("throws ConversationNotFoundError when not found", async () => {
    mockRepository.updateConversation.mockResolvedValue(undefined);

    await expect(updateConversation("non-existent-id", "New Title")).rejects.toThrow(
      "Conversation not found",
    );
  });
});

describe("deleteConversation", () => {
  beforeEach(() => {
    mockRepository.deleteConversation.mockReset();
  });

  it("deletes conversation when found", async () => {
    mockRepository.deleteConversation.mockResolvedValue(true);

    await expect(deleteConversation(mockConversation.id)).resolves.toBeUndefined();
  });

  it("throws ConversationNotFoundError when not found", async () => {
    mockRepository.deleteConversation.mockResolvedValue(false);

    await expect(deleteConversation("non-existent-id")).rejects.toThrow("Conversation not found");
  });
});

describe("getMessages", () => {
  beforeEach(() => {
    mockRepository.findMessagesByConversationId.mockReset();
  });

  it("returns messages for conversation", async () => {
    mockRepository.findMessagesByConversationId.mockResolvedValue([mockMessage]);

    const result = await getMessages(mockConversation.id);

    expect(result).toEqual([mockMessage]);
    expect(mockRepository.findMessagesByConversationId).toHaveBeenCalledWith(mockConversation.id);
  });

  it("returns empty array when no messages", async () => {
    mockRepository.findMessagesByConversationId.mockResolvedValue([]);

    const result = await getMessages(mockConversation.id);

    expect(result).toEqual([]);
  });
});

describe("addMessage", () => {
  beforeEach(() => {
    mockRepository.createMessage.mockReset();
  });

  it("adds a message to conversation", async () => {
    mockRepository.createMessage.mockResolvedValue(mockMessage);

    const result = await addMessage(mockConversation.id, "user", "Hello, world!");

    expect(result).toEqual(mockMessage);
    expect(mockRepository.createMessage).toHaveBeenCalledTimes(1);
  });
});

describe("generateTitleFromMessage", () => {
  it("returns short text without truncation", () => {
    const result = generateTitleFromMessage("Hello, world!");
    expect(result).toBe("Hello, world!");
  });

  it("truncates long text to 50 characters with ellipsis", () => {
    const longText = "a".repeat(60);
    const result = generateTitleFromMessage(longText);
    expect(result).toBe(`${"a".repeat(50)}...`);
    expect(result.length).toBe(53);
  });

  it("does not truncate text exactly 50 characters", () => {
    const exactText = "a".repeat(50);
    const result = generateTitleFromMessage(exactText);
    expect(result).toBe(exactText);
    expect(result.length).toBe(50);
  });

  it("trims whitespace", () => {
    const result = generateTitleFromMessage("  Hello  ");
    expect(result).toBe("Hello");
  });
});
