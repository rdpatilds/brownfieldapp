import { MAX_CONTEXT_MESSAGES, RAG_SYSTEM_PROMPT_TEMPLATE, SYSTEM_PROMPT } from "@chatapp/shared";
import { env } from "../../config/env";
import { getLogger } from "../../logging";

import { OpenRouterError, StreamError } from "./errors";
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

export async function streamChatCompletion(
  history: Message[],
  options?: { signal?: AbortSignal; ragContext?: string },
): Promise<{ stream: ReadableStream; fullResponse: Promise<string> }> {
  logger.info(
    { messageCount: history.length, hasRagContext: !!options?.ragContext },
    "stream.chat_started",
  );

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
        messages: buildMessages(history, options?.ragContext),
        stream: true,
      }),
      signal: options?.signal ?? null,
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
      logger.info({ responseLength: fullText.length }, "stream.chat_completed");
    },
  });

  const stream = response.body.pipeThrough(new TextDecoderStream()).pipeThrough(transformStream);

  return { stream, fullResponse };
}
