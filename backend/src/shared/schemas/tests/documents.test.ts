import { describe, expect, it } from "vitest";

import { MAX_FILE_SIZE, UploadDocumentSchema } from "../documents";

describe("UploadDocumentSchema", () => {
  it("validates valid .md file", () => {
    const result = UploadDocumentSchema.parse({
      fileName: "readme.md",
      fileSize: 1024,
      fileExtension: ".md",
      content: "# Hello World",
    });
    expect(result.fileName).toBe("readme.md");
    expect(result.content).toBe("# Hello World");
  });

  it("validates valid .txt file", () => {
    const result = UploadDocumentSchema.parse({
      fileName: "notes.txt",
      fileSize: 512,
      fileExtension: ".txt",
      content: "Some notes",
    });
    expect(result.fileExtension).toBe(".txt");
  });

  it("rejects empty file name", () => {
    expect(() =>
      UploadDocumentSchema.parse({
        fileName: "",
        fileSize: 100,
        fileExtension: ".md",
        content: "content",
      }),
    ).toThrow();
  });

  it("rejects file exceeding max size", () => {
    expect(() =>
      UploadDocumentSchema.parse({
        fileName: "large.md",
        fileSize: MAX_FILE_SIZE + 1,
        fileExtension: ".md",
        content: "content",
      }),
    ).toThrow();
  });

  it("rejects unsupported extension", () => {
    expect(() =>
      UploadDocumentSchema.parse({
        fileName: "doc.pdf",
        fileSize: 100,
        fileExtension: ".pdf",
        content: "content",
      }),
    ).toThrow();
  });

  it("rejects empty content", () => {
    expect(() =>
      UploadDocumentSchema.parse({
        fileName: "empty.md",
        fileSize: 0,
        fileExtension: ".md",
        content: "",
      }),
    ).toThrow();
  });
});
