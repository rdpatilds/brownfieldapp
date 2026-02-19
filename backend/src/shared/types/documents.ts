export interface Document {
  id: string;
  title: string;
  source: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DocumentSummary {
  id: string;
  title: string;
  source: string;
  chunk_count: number;
  total_tokens: number;
  created_at: string;
}

export interface Chunk {
  content: string;
  index: number;
}

/** Discriminated union for SSE progress events during document upload. */
export type UploadProgressEvent =
  | { type: "status"; message: string }
  | { type: "progress"; current: number; total: number; message: string }
  | { type: "complete"; documentId: string; title: string; chunksCreated: number }
  | { type: "error"; message: string };
