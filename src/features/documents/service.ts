import { getLogger } from "@/core/logging";
import { generateEmbedding } from "@/features/rag/service";

import { DocumentNotFoundError, DocumentUploadError } from "./errors";
import type { Chunk, DocumentSummary, UploadProgressEvent } from "./models";
import * as repository from "./repository";

const logger = getLogger("documents.service");

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 200;

export function chunkText(
  text: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  chunkOverlap: number = DEFAULT_CHUNK_OVERLAP,
): Chunk[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const paragraphs = normalized.split(/\n\n+/);
  const chunks: Chunk[] = [];
  let current = "";
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      continue;
    }

    const candidate = current ? `${current}\n\n${trimmed}` : trimmed;

    if (candidate.length > chunkSize && current) {
      chunks.push({ content: current, index: chunkIndex++ });

      const overlapText = current.slice(-chunkOverlap);
      current = overlapText ? `${overlapText}\n\n${trimmed}` : trimmed;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) {
    chunks.push({ content: current, index: chunkIndex });
  }

  return chunks;
}

export function extractTitle(content: string, fileName: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match?.[1]) {
    return match[1].trim();
  }
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
}

export async function ingestDocument(
  content: string,
  fileName: string,
  onProgress?: (event: UploadProgressEvent) => void,
): Promise<{ documentId: string; title: string; chunksCreated: number }> {
  logger.info({ fileName }, "document.ingest_started");

  onProgress?.({ type: "status", message: "Validating and preparing..." });

  const title = extractTitle(content, fileName);
  let documentId: string;

  try {
    documentId = await repository.insertDocument(title, fileName, content);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({ fileName, error: message }, "document.insert_failed");
    throw new DocumentUploadError(`Failed to insert document: ${message}`);
  }

  onProgress?.({ type: "status", message: "Chunking text..." });
  const chunks = chunkText(content);

  logger.info({ documentId, title, chunkCount: chunks.length }, "document.chunking_completed");

  try {
    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.content);
      const tokenCount = Math.ceil(chunk.content.length / 4);
      await repository.insertChunk(documentId, chunk.content, embedding, chunk.index, tokenCount);

      onProgress?.({
        type: "progress",
        current: chunk.index + 1,
        total: chunks.length,
        message: `Embedding chunk ${chunk.index + 1}/${chunks.length}...`,
      });
    }
  } catch (error) {
    logger.error({ documentId, error }, "document.embedding_failed");
    // Clean up partially inserted document (cascades to chunks)
    await repository.deleteDocumentById(documentId);
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new DocumentUploadError(`Failed during embedding: ${message}`);
  }

  onProgress?.({
    type: "complete",
    documentId,
    title,
    chunksCreated: chunks.length,
  });

  logger.info({ documentId, title, chunksCreated: chunks.length }, "document.ingest_completed");

  return { documentId, title, chunksCreated: chunks.length };
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  logger.info("document.list_started");
  const summaries = await repository.findAllDocumentSummaries();
  logger.info({ count: summaries.length }, "document.list_completed");
  return summaries;
}

export async function deleteDocument(id: string): Promise<void> {
  logger.info({ documentId: id }, "document.delete_started");
  const deleted = await repository.deleteDocumentById(id);
  if (!deleted) {
    throw new DocumentNotFoundError(id);
  }
  logger.info({ documentId: id }, "document.delete_completed");
}
