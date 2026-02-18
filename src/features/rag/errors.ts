import type { HttpStatusCode } from "@/core/api/errors";

/** Known error codes for RAG operations. */
export type RagErrorCode = "EMBEDDING_FAILED" | "RETRIEVAL_FAILED";

/**
 * Base error for RAG-related errors.
 */
export class RagError extends Error {
  readonly code: RagErrorCode;
  readonly statusCode: HttpStatusCode;

  constructor(message: string, code: RagErrorCode, statusCode: HttpStatusCode) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class EmbeddingFailedError extends RagError {
  constructor(message: string) {
    super(message, "EMBEDDING_FAILED", 502);
  }
}

export class RetrievalFailedError extends RagError {
  constructor(message: string) {
    super(message, "RETRIEVAL_FAILED", 500);
  }
}
