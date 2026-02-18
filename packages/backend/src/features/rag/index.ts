// Constants
export {
  EMBEDDING_MODEL,
  MATCH_COUNT,
  MAX_CHUNKS,
  RAG_ENABLED,
  SIMILARITY_THRESHOLD,
} from "./constants";

// Errors
export type { RagErrorCode } from "./errors";
export { EmbeddingFailedError, RagError, RetrievalFailedError } from "./errors";

// Service functions (public API)
export { formatContextForPrompt, generateEmbedding, retrieveContext } from "./service";
