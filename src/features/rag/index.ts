// Types

// Constants
export { EMBEDDING_MODEL, MAX_CHUNKS, RAG_ENABLED, SIMILARITY_THRESHOLD } from "./constants";
// Errors
export type { RagErrorCode } from "./errors";
export { EmbeddingFailedError, RagError, RetrievalFailedError } from "./errors";
export type { MatchedChunk, RetrievalResult, RetrievedChunk } from "./models";

// Service functions (public API)
export { formatContextForPrompt, generateEmbedding, retrieveContext } from "./service";
