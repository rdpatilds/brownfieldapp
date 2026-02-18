import { env } from "../../config/env";
import { getLogger } from "../../logging";

import {
  EMBEDDING_MODEL,
  MATCH_COUNT,
  MAX_CHUNKS,
  RAG_ENABLED,
  SIMILARITY_THRESHOLD,
} from "./constants";
import { EmbeddingFailedError, RetrievalFailedError } from "./errors";
import type { MatchedChunk, RetrievalResult, RetrievedChunk } from "./models";
import * as repository from "./repository";

const logger = getLogger("rag.service");

export async function generateEmbedding(text: string): Promise<number[]> {
  logger.info("rag.embedding_started");

  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch error";
    logger.error({ error: message }, "rag.embedding_failed");
    throw new EmbeddingFailedError(`Failed to connect to embedding API: ${message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "Unknown error");
    logger.error({ status: response.status, body }, "rag.embedding_failed");
    throw new EmbeddingFailedError(`Embedding API error (${response.status}): ${body}`);
  }

  const json = (await response.json()) as { data: Array<{ embedding: number[] }> };
  const embedding = json.data[0]?.embedding;
  if (!embedding) {
    throw new EmbeddingFailedError("Embedding API returned empty data");
  }

  logger.info({ dimensions: embedding.length }, "rag.embedding_completed");
  return embedding;
}

export async function retrieveContext(
  query: string,
  matchCount?: number,
): Promise<RetrievalResult> {
  if (!RAG_ENABLED) {
    return { chunks: [], query, totalMatches: 0, filteredCount: 0 };
  }

  logger.info({ query: query.slice(0, 100) }, "rag.retrieval_started");

  let matched: MatchedChunk[];
  try {
    const embedding = await generateEmbedding(query);
    matched = await repository.findSimilarChunks(embedding, matchCount ?? MATCH_COUNT);
  } catch (error) {
    if (error instanceof EmbeddingFailedError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unknown retrieval error";
    logger.error({ error: message }, "rag.retrieval_failed");
    throw new RetrievalFailedError(`Failed to retrieve chunks: ${message}`);
  }

  const totalMatches = matched.length;

  const filtered = matched
    .filter((chunk) => chunk.similarity >= SIMILARITY_THRESHOLD)
    .slice(0, MAX_CHUNKS);

  const chunks: RetrievedChunk[] = filtered.map((chunk) => ({
    chunkId: chunk.chunk_id,
    documentId: chunk.document_id,
    content: chunk.content,
    similarity: chunk.similarity,
    metadata: chunk.metadata,
    documentTitle: chunk.document_title,
    documentSource: chunk.document_source,
  }));

  logger.info({ totalMatches, filteredCount: chunks.length }, "rag.retrieval_completed");

  return { chunks, query, totalMatches, filteredCount: chunks.length };
}

export function formatContextForPrompt(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return "";
  }

  return chunks
    .map(
      (chunk, i) => `[${i + 1}] ${chunk.documentTitle} (${chunk.documentSource})\n${chunk.content}`,
    )
    .join("\n\n");
}
