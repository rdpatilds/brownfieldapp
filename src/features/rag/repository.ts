import { sql } from "drizzle-orm";

import { db } from "@/core/database/client";

import type { MatchedChunk } from "./models";

export async function findSimilarChunks(
  embedding: number[],
  matchCount: number,
): Promise<MatchedChunk[]> {
  const embeddingStr = `[${embedding.join(",")}]`;
  const result = await db.execute(
    sql`SELECT * FROM match_chunks(${embeddingStr}::vector(1536), ${matchCount})`,
  );
  return result as unknown as MatchedChunk[];
}
