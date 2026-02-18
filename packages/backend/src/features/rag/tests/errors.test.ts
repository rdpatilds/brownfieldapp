import { describe, expect, it } from "bun:test";

import { EmbeddingFailedError, RagError, RetrievalFailedError } from "../errors";

describe("RagError", () => {
  it("creates error with message, code, and status", () => {
    const error = new RagError("Test error", "EMBEDDING_FAILED", 502);
    expect(error.message).toBe("Test error");
    expect(error.code).toBe("EMBEDDING_FAILED");
    expect(error.statusCode).toBe(502);
    expect(error.name).toBe("RagError");
  });

  it("is instanceof Error", () => {
    const error = new RagError("Test", "EMBEDDING_FAILED", 502);
    expect(error).toBeInstanceOf(Error);
  });
});

describe("EmbeddingFailedError", () => {
  it("creates error with message", () => {
    const error = new EmbeddingFailedError("API timeout");
    expect(error.message).toBe("API timeout");
    expect(error.code).toBe("EMBEDDING_FAILED");
    expect(error.statusCode).toBe(502);
    expect(error.name).toBe("EmbeddingFailedError");
  });

  it("is instanceof RagError", () => {
    const error = new EmbeddingFailedError("error");
    expect(error).toBeInstanceOf(RagError);
  });
});

describe("RetrievalFailedError", () => {
  it("creates error with message", () => {
    const error = new RetrievalFailedError("DB connection failed");
    expect(error.message).toBe("DB connection failed");
    expect(error.code).toBe("RETRIEVAL_FAILED");
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe("RetrievalFailedError");
  });

  it("is instanceof RagError", () => {
    const error = new RetrievalFailedError("error");
    expect(error).toBeInstanceOf(RagError);
  });
});
