/** Document types — duplicated from backend shared types */
export interface DocumentSummary {
  id: string;
  title: string;
  source: string;
  chunk_count: number;
  total_tokens: number;
  created_at: string;
}

/** Chat types */
export interface ChatSource {
  index: number;
  title: string;
  source: string;
}

/** Discriminated union for SSE progress events during document upload. */
export type UploadProgressEvent =
  | { type: "status"; message: string }
  | { type: "progress"; current: number; total: number; message: string }
  | { type: "complete"; documentId: string; title: string; chunksCreated: number }
  | { type: "error"; message: string };
