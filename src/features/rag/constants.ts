import { env } from "@/core/config/env";

export const EMBEDDING_MODEL = env.RAG_EMBEDDING_MODEL;
export const SIMILARITY_THRESHOLD = Number.parseFloat(env.RAG_SIMILARITY_THRESHOLD);
export const MAX_CHUNKS = Number.parseInt(env.RAG_MAX_CHUNKS, 10);
export const MATCH_COUNT = Number.parseInt(env.RAG_MATCH_COUNT, 10);
export const RAG_ENABLED = env.RAG_ENABLED === "true";
