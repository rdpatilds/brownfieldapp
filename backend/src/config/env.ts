function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

/**
 * Get Supabase anon/publishable key.
 * Supports both legacy ANON_KEY and new PUBLISHABLE_KEY naming.
 */
function getSupabaseKey(): string {
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const anonKey = process.env["SUPABASE_ANON_KEY"];

  const key = publishableKey ?? anonKey;
  if (!key) {
    throw new Error(
      "Missing required environment variable: SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY",
    );
  }
  return key;
}

export const env = {
  // App config
  NODE_ENV: getOptionalEnv("NODE_ENV", "development"),
  LOG_LEVEL: getOptionalEnv("LOG_LEVEL", "info"),
  APP_NAME: getOptionalEnv("APP_NAME", "chatapp-backend"),

  // Server config
  PORT: getOptionalEnv("PORT", "4000"),
  FRONTEND_URL: getOptionalEnv("FRONTEND_URL", "http://localhost:3000"),

  // Supabase config (required)
  SUPABASE_URL: getRequiredEnv("SUPABASE_URL"),
  SUPABASE_ANON_KEY: getSupabaseKey(),

  // Database config (required)
  DATABASE_URL: getRequiredEnv("DATABASE_URL"),

  // LLM provider selection: "openrouter" or "azure"
  LLM_PROVIDER: getOptionalEnv("LLM_PROVIDER", "openrouter"),

  // OpenRouter config (required when LLM_PROVIDER=openrouter)
  OPENROUTER_API_KEY: getOptionalEnv("OPENROUTER_API_KEY", ""),
  OPENROUTER_MODEL: getOptionalEnv("OPENROUTER_MODEL", "anthropic/claude-haiku-4.5"),

  // Azure OpenAI config (required when LLM_PROVIDER=azure)
  AZURE_OPENAI_ENDPOINT: getOptionalEnv("AZURE_OPENAI_API_ENDPOINT", ""),
  AZURE_OPENAI_API_KEY: getOptionalEnv("AZURE_OPENAI_API_KEY", ""),
  AZURE_OPENAI_DEPLOYMENT: getOptionalEnv("AZURE_OPENAI_DEPLOYMENT", ""),
  AZURE_OPENAI_API_VERSION: getOptionalEnv("AZURE_OPENAI_API_VERSION", "2024-10-21"),

  // RAG config (optional)
  RAG_EMBEDDING_MODEL: getOptionalEnv("RAG_EMBEDDING_MODEL", "openai/text-embedding-3-small"),
  RAG_SIMILARITY_THRESHOLD: getOptionalEnv("RAG_SIMILARITY_THRESHOLD", "0.7"),
  RAG_MAX_CHUNKS: getOptionalEnv("RAG_MAX_CHUNKS", "5"),
  RAG_MATCH_COUNT: getOptionalEnv("RAG_MATCH_COUNT", "10"),
  RAG_ENABLED: getOptionalEnv("RAG_ENABLED", "true"),

  // Chargebee config (required)
  CHARGEBEE_SITE: getRequiredEnv("CHARGEBEE_SITE"),
  CHARGEBEE_API_KEY: getRequiredEnv("CHARGEBEE_API_KEY"),
  CHARGEBEE_WEBHOOK_USERNAME: getRequiredEnv("CHARGEBEE_WEBHOOK_USERNAME"),
  CHARGEBEE_WEBHOOK_PASSWORD: getRequiredEnv("CHARGEBEE_WEBHOOK_PASSWORD"),
} as const;

export type Env = typeof env;
