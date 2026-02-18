// Errors
export type { DocumentErrorCode } from "./errors";
export { DocumentError, DocumentNotFoundError, DocumentUploadError } from "./errors";

// Service functions (public API)
export {
  chunkText,
  deleteDocument,
  extractTitle,
  ingestDocument,
  listDocuments,
} from "./service";
