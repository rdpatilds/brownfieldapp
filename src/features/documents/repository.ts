import { sql } from "drizzle-orm";

import { db } from "@/core/database/client";

import type { Document, DocumentSummary } from "./models";

export async function insertDocument(
  title: string,
  source: string,
  content: string,
  metadata: Record<string, unknown> = {},
): Promise<string> {
  const metadataJson = JSON.stringify(metadata);
  const result = await db.execute(
    sql`INSERT INTO documents (title, source, content, metadata)
        VALUES (${title}, ${source}, ${content}, ${metadataJson}::jsonb)
        RETURNING id`,
  );
  const row = result[0] as { id: string } | undefined;
  if (!row) {
    throw new Error("Failed to insert document — no ID returned");
  }
  return row.id;
}

export async function insertChunk(
  documentId: string,
  content: string,
  embedding: number[],
  chunkIndex: number,
  tokenCount: number,
): Promise<void> {
  const embeddingStr = `[${embedding.join(",")}]`;
  await db.execute(
    sql`INSERT INTO chunks (document_id, content, embedding, chunk_index, metadata, token_count)
        VALUES (${documentId}, ${content}, ${embeddingStr}::vector, ${chunkIndex}, '{}'::jsonb, ${tokenCount})`,
  );
}

export async function findAllDocumentSummaries(): Promise<DocumentSummary[]> {
  const result = await db.execute(
    sql`SELECT id, title, source, chunk_count, total_tokens, created_at
        FROM document_summaries
        ORDER BY created_at DESC`,
  );
  return result as unknown as DocumentSummary[];
}

export async function findDocumentById(id: string): Promise<Document | undefined> {
  const result = await db.execute(
    sql`SELECT id, title, source, content, metadata, created_at, updated_at
        FROM documents
        WHERE id = ${id}
        LIMIT 1`,
  );
  return (result as unknown as Document[])[0];
}

export async function deleteDocumentById(id: string): Promise<boolean> {
  const result = await db.execute(sql`DELETE FROM documents WHERE id = ${id} RETURNING id`);
  return (result as unknown as Array<{ id: string }>).length > 0;
}
