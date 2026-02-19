import { describe, expect, it } from "vitest";

import { DocumentError, DocumentNotFoundError, DocumentUploadError } from "../errors";

describe("DocumentError", () => {
  it("creates error with message, code, and status", () => {
    const error = new DocumentError("Test error", "DOCUMENT_NOT_FOUND", 404);
    expect(error.message).toBe("Test error");
    expect(error.code).toBe("DOCUMENT_NOT_FOUND");
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe("DocumentError");
  });

  it("is instanceof Error", () => {
    const error = new DocumentError("Test", "DOCUMENT_NOT_FOUND", 404);
    expect(error).toBeInstanceOf(Error);
  });
});

describe("DocumentNotFoundError", () => {
  it("creates error with ID in message", () => {
    const error = new DocumentNotFoundError("doc-123");
    expect(error.message).toBe("Document not found: doc-123");
    expect(error.code).toBe("DOCUMENT_NOT_FOUND");
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe("DocumentNotFoundError");
  });

  it("is instanceof DocumentError", () => {
    const error = new DocumentNotFoundError("id");
    expect(error).toBeInstanceOf(DocumentError);
  });
});

describe("DocumentUploadError", () => {
  it("creates error with message", () => {
    const error = new DocumentUploadError("Upload failed");
    expect(error.message).toBe("Upload failed");
    expect(error.code).toBe("DOCUMENT_UPLOAD_ERROR");
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe("DocumentUploadError");
  });

  it("is instanceof DocumentError", () => {
    const error = new DocumentUploadError("msg");
    expect(error).toBeInstanceOf(DocumentError);
  });
});
