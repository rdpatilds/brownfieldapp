import { describe, expect, it } from "bun:test";

import type { RetrievedChunk } from "../models";
import { formatContextForPrompt } from "../service";

function createMockChunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    chunkId: "chunk-1",
    documentId: "doc-1",
    content: "Sample content",
    similarity: 0.9,
    metadata: null,
    documentTitle: "Test Document",
    documentSource: "test.pdf",
    ...overrides,
  };
}

describe("formatContextForPrompt", () => {
  it("returns empty string for empty chunks", () => {
    const result = formatContextForPrompt([]);
    expect(result).toBe("");
  });

  it("formats a single chunk", () => {
    const chunks = [createMockChunk()];
    const result = formatContextForPrompt(chunks);
    expect(result).toBe("[1] Test Document (test.pdf)\nSample content");
  });

  it("formats multiple chunks with numbering", () => {
    const chunks = [
      createMockChunk({ documentTitle: "Doc A", documentSource: "a.pdf", content: "Content A" }),
      createMockChunk({ documentTitle: "Doc B", documentSource: "b.pdf", content: "Content B" }),
    ];
    const result = formatContextForPrompt(chunks);
    expect(result).toContain("[1] Doc A (a.pdf)\nContent A");
    expect(result).toContain("[2] Doc B (b.pdf)\nContent B");
  });

  it("separates chunks with double newlines", () => {
    const chunks = [createMockChunk({ content: "First" }), createMockChunk({ content: "Second" })];
    const result = formatContextForPrompt(chunks);
    expect(result).toContain("\n\n");
  });
});
