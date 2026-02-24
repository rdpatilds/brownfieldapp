import { AzureOpenAI } from "openai";
import type {
  ChatCompletionChunk,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import type { Stream } from "openai/streaming";
import {
  MAX_CONTEXT_MESSAGES,
  RAG_SYSTEM_PROMPT_TEMPLATE,
  SYSTEM_PROMPT,
} from "@/shared/constants";
import { env } from "../../config/env";
import { getLogger } from "../../logging";

import { AzureOpenAIError, LLMConfigError, OpenRouterError, StreamError } from "./errors";
import type { Message } from "./models";

const logger = getLogger("chat.stream");

export function buildMessages(
  history: Message[],
  ragContext?: string,
): Array<{ role: string; content: string }> {
  const limitedHistory = history.slice(-MAX_CONTEXT_MESSAGES);
  const systemPrompt = ragContext
    ? RAG_SYSTEM_PROMPT_TEMPLATE.replace("{context}", ragContext)
    : SYSTEM_PROMPT;
  return [
    { role: "system", content: systemPrompt },
    ...limitedHistory.map((m) => ({ role: m.role, content: m.content })),
  ];
}

// ---------------------------------------------------------------------------
// SSE parsing (used by OpenRouter raw fetch path)
// ---------------------------------------------------------------------------

interface ParsedSSELine {
  type: "content" | "done" | "skip";
  content?: string;
}

function parseSSELine(line: string): ParsedSSELine {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith("data: ")) {
    return { type: "skip" };
  }

  const data = trimmed.slice(6);

  if (data === "[DONE]") {
    return { type: "done" };
  }

  try {
    const parsed = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    const content = parsed.choices?.[0]?.delta?.content;
    if (content) {
      return { type: "content", content };
    }
  } catch {
    // Skip malformed JSON lines
  }

  return { type: "skip" };
}

// ---------------------------------------------------------------------------
// Shared return type
// ---------------------------------------------------------------------------

interface StreamResult {
  stream: ReadableStream<string>;
  fullResponse: Promise<string>;
}

// ---------------------------------------------------------------------------
// OpenRouter provider (raw fetch — unchanged)
// ---------------------------------------------------------------------------

function validateOpenRouterConfig(): void {
  if (!env.OPENROUTER_API_KEY) {
    throw new LLMConfigError("OPENROUTER_API_KEY is required when LLM_PROVIDER=openrouter");
  }
}

async function streamViaOpenRouter(
  messages: Array<{ role: string; content: string }>,
  signal?: AbortSignal,
): Promise<StreamResult> {
  validateOpenRouterConfig();

  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL,
        messages,
        stream: true,
      }),
      signal: signal ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch error";
    logger.error({ error: message }, "stream.fetch_failed");
    throw new OpenRouterError(`Failed to connect to OpenRouter: ${message}`);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    logger.error({ status: response.status, body: text }, "stream.api_error");
    throw new OpenRouterError(`OpenRouter API error (${response.status}): ${text}`);
  }

  if (!response.body) {
    throw new OpenRouterError("OpenRouter returned empty response body");
  }

  let resolveFullResponse: (value: string) => void;
  let rejectFullResponse: (reason: unknown) => void;
  const fullResponse = new Promise<string>((resolve, reject) => {
    resolveFullResponse = resolve;
    rejectFullResponse = reject;
  });

  let fullText = "";
  let buffer = "";

  const transformStream = new TransformStream<string, string>({
    transform(chunk, controller) {
      try {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const parsed = parseSSELine(line);

          if (parsed.type === "done") {
            controller.enqueue("data: [DONE]\n\n");
            return;
          }

          if (parsed.type === "content" && parsed.content) {
            fullText += parsed.content;
            controller.enqueue(`data: ${JSON.stringify({ content: parsed.content })}\n\n`);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown stream error";
        rejectFullResponse(new StreamError(`Stream processing error: ${message}`));
        controller.error(new StreamError(`Stream processing error: ${message}`));
      }
    },
    flush() {
      resolveFullResponse(fullText);
    },
  });

  const stream = response.body.pipeThrough(new TextDecoderStream()).pipeThrough(transformStream);

  return { stream, fullResponse };
}

// ---------------------------------------------------------------------------
// Azure OpenAI provider (OpenAI SDK)
// ---------------------------------------------------------------------------

function validateAzureConfig(): void {
  if (!env.AZURE_OPENAI_ENDPOINT) {
    throw new LLMConfigError("AZURE_OPENAI_ENDPOINT is required when LLM_PROVIDER=azure");
  }
  if (!env.AZURE_OPENAI_API_KEY) {
    throw new LLMConfigError("AZURE_OPENAI_API_KEY is required when LLM_PROVIDER=azure");
  }
  if (!env.AZURE_OPENAI_DEPLOYMENT) {
    throw new LLMConfigError("AZURE_OPENAI_DEPLOYMENT is required when LLM_PROVIDER=azure");
  }
}

let azureClient: AzureOpenAI | null = null;

function getAzureClient(): AzureOpenAI {
  if (!azureClient) {
    azureClient = new AzureOpenAI({
      endpoint: env.AZURE_OPENAI_ENDPOINT,
      apiKey: env.AZURE_OPENAI_API_KEY,
      deployment: env.AZURE_OPENAI_DEPLOYMENT,
      apiVersion: env.AZURE_OPENAI_API_VERSION,
    });
  }
  return azureClient;
}

function convertToReadableStream(sdkStream: Stream<ChatCompletionChunk>): StreamResult {
  let resolveFullResponse: (value: string) => void;
  let rejectFullResponse: (reason: unknown) => void;
  const fullResponse = new Promise<string>((resolve, reject) => {
    resolveFullResponse = resolve;
    rejectFullResponse = reject;
  });

  let fullText = "";

  const readable = new ReadableStream<string>({
    async start(controller) {
      try {
        for await (const chunk of sdkStream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            fullText += content;
            controller.enqueue(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
        controller.enqueue("data: [DONE]\n\n");
        controller.close();
        resolveFullResponse(fullText);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown stream error";
        const streamError = new StreamError(`Stream processing error: ${message}`);
        rejectFullResponse(streamError);
        controller.error(streamError);
      }
    },
  });

  return { stream: readable, fullResponse };
}

async function streamViaAzureOpenAI(
  messages: Array<{ role: string; content: string }>,
  signal?: AbortSignal,
): Promise<StreamResult> {
  validateAzureConfig();

  const client = getAzureClient();

  let sdkStream: Stream<ChatCompletionChunk>;
  try {
    sdkStream = await client.chat.completions.create(
      {
        model: env.AZURE_OPENAI_DEPLOYMENT,
        messages: messages as ChatCompletionMessageParam[],
        stream: true,
      },
      { signal },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({ error: message }, "stream.azure_fetch_failed");
    throw new AzureOpenAIError(`Failed to connect to Azure OpenAI: ${message}`);
  }

  return convertToReadableStream(sdkStream);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function streamChatCompletion(
  history: Message[],
  options?: { signal?: AbortSignal; ragContext?: string },
): Promise<StreamResult> {
  const provider = env.LLM_PROVIDER;

  logger.info(
    { messageCount: history.length, hasRagContext: !!options?.ragContext, provider },
    "stream.chat_started",
  );

  if (provider !== "openrouter" && provider !== "azure") {
    throw new LLMConfigError(
      `Invalid LLM_PROVIDER "${provider}". Must be "openrouter" or "azure".`,
    );
  }

  const messages = buildMessages(history, options?.ragContext);

  const result =
    provider === "azure"
      ? await streamViaAzureOpenAI(messages, options?.signal)
      : await streamViaOpenRouter(messages, options?.signal);

  // Wrap fullResponse to log completion
  const loggedFullResponse = result.fullResponse.then((text) => {
    logger.info({ responseLength: text.length, provider }, "stream.chat_completed");
    return text;
  });

  return { stream: result.stream, fullResponse: loggedFullResponse };
}
