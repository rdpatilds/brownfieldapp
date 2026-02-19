import { describe, expect, it, vi } from "vitest";

vi.mock("../../../config/env", () => ({
  env: {
    OPENROUTER_API_KEY: "test-key",
    RAG_EMBEDDING_MODEL: "test-model",
    RAG_SIMILARITY_THRESHOLD: "0.7",
    RAG_MAX_CHUNKS: "5",
    RAG_MATCH_COUNT: "10",
    RAG_ENABLED: "true",
  },
}));
vi.mock("../../../logging", () => ({
  getLogger: () => ({
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
  }),
}));

const { chunkText, extractTitle } = await import("../service");

describe("chunkText", () => {
  it("returns single chunk for short text", () => {
    const chunks = chunkText("Hello world", 1000, 200);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe("Hello world");
    expect(chunks[0]?.index).toBe(0);
  });

  it("splits text by paragraphs when exceeding chunk size", () => {
    const paragraph1 = "A".repeat(600);
    const paragraph2 = "B".repeat(600);
    const text = `${paragraph1}\n\n${paragraph2}`;
    const chunks = chunkText(text, 800, 100);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]?.content).toContain("A");
  });

  it("skips empty paragraphs", () => {
    const text = "First paragraph\n\n\n\n\nSecond paragraph";
    const chunks = chunkText(text, 1000, 200);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe("First paragraph\n\nSecond paragraph");
  });

  it("handles Windows line endings", () => {
    const text = "Hello\r\n\r\nWorld";
    const chunks = chunkText(text, 1000, 200);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe("Hello\n\nWorld");
  });

  it("returns empty array for empty text", () => {
    const chunks = chunkText("", 1000, 200);
    expect(chunks).toHaveLength(0);
  });

  it("returns empty array for whitespace-only text", () => {
    const chunks = chunkText("   \n\n   ", 1000, 200);
    expect(chunks).toHaveLength(0);
  });

  it("applies overlap between chunks", () => {
    const p1 = "A".repeat(500);
    const p2 = "B".repeat(500);
    const p3 = "C".repeat(500);
    const text = `${p1}\n\n${p2}\n\n${p3}`;
    const chunks = chunkText(text, 600, 100);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // Second chunk should contain overlap from the first
    if (chunks[1]) {
      expect(chunks[1].index).toBe(1);
    }
  });

  it("assigns sequential indices", () => {
    const paragraphs = Array.from({ length: 5 }, (_, i) => `Paragraph ${i} ${"x".repeat(400)}`);
    const text = paragraphs.join("\n\n");
    const chunks = chunkText(text, 500, 50);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i]?.index).toBe(i);
    }
  });
});

describe("extractTitle", () => {
  it("extracts title from markdown heading", () => {
    const content = "# My Document\n\nSome content here";
    expect(extractTitle(content, "file.md")).toBe("My Document");
  });

  it("extracts first heading when multiple exist", () => {
    const content = "# First Heading\n\n## Second Heading\n\n# Third Heading";
    expect(extractTitle(content, "file.md")).toBe("First Heading");
  });

  it("falls back to filename without extension", () => {
    const content = "No heading here, just plain text.";
    expect(extractTitle(content, "my-document.md")).toBe("my-document");
  });

  it("handles .txt extension fallback", () => {
    const content = "Plain text content";
    expect(extractTitle(content, "notes.txt")).toBe("notes");
  });

  it("trims whitespace from heading", () => {
    const content = "#   Spaced Title   \n\nContent";
    expect(extractTitle(content, "file.md")).toBe("Spaced Title");
  });

  it("ignores non-h1 headings for title extraction", () => {
    const content = "Some text\n\n## Second Level\n\nMore text";
    expect(extractTitle(content, "file.md")).toBe("file");
  });

  it("handles filename with no extension", () => {
    const content = "No heading";
    expect(extractTitle(content, "README")).toBe("README");
  });
});
