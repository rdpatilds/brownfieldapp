type HttpStatusCode = 400 | 401 | 402 | 403 | 404 | 409 | 500 | 502;

export type DocumentErrorCode = "DOCUMENT_NOT_FOUND" | "DOCUMENT_UPLOAD_ERROR";

export class DocumentError extends Error {
  readonly code: DocumentErrorCode;
  readonly statusCode: HttpStatusCode;

  constructor(message: string, code: DocumentErrorCode, statusCode: HttpStatusCode) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class DocumentNotFoundError extends DocumentError {
  constructor(id: string) {
    super(`Document not found: ${id}`, "DOCUMENT_NOT_FOUND", 404);
  }
}

export class DocumentUploadError extends DocumentError {
  constructor(message: string) {
    super(message, "DOCUMENT_UPLOAD_ERROR", 500);
  }
}
