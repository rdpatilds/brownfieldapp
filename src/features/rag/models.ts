/** Raw row returned by the `match_chunks` SQL function (snake_case). */
export interface MatchedChunk {
  chunk_id: string;
  document_id: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown> | null;
  document_title: string;
  document_source: string;
}

/** Camel-case representation for TypeScript consumers. */
export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown> | null;
  documentTitle: string;
  documentSource: string;
}

/** Result of a RAG retrieval operation. */
export interface RetrievalResult {
  chunks: RetrievedChunk[];
  query: string;
  totalMatches: number;
  filteredCount: number;
}
