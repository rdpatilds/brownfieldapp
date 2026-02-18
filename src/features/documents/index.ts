// Types

// Errors
export type { DocumentErrorCode } from "./errors";
export { DocumentError, DocumentNotFoundError, DocumentUploadError } from "./errors";
export type {
  Chunk,
  Document,
  DocumentSummary,
  UploadProgressEvent,
} from "./models";
// Schemas
export type { UploadDocumentInput } from "./schemas";
export { ALLOWED_EXTENSIONS, MAX_FILE_SIZE, UploadDocumentSchema } from "./schemas";

// Service functions (public API)
export {
  chunkText,
  deleteDocument,
  extractTitle,
  ingestDocument,
  listDocuments,
} from "./service";
