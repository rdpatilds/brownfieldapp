import { extname } from "node:path";
import type { NextRequest } from "next/server";

import { handleApiError, unauthorizedResponse } from "@/core/api/errors";
import { getLogger } from "@/core/logging";
import { createClient } from "@/core/supabase/server";
import type { UploadProgressEvent } from "@/features/documents";
import { ingestDocument, UploadDocumentSchema } from "@/features/documents";

const logger = getLogger("api.documents.upload");

/**
 * POST /api/documents/upload
 * Upload a document file with SSE progress streaming.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return unauthorizedResponse();
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const content = await file.text();
    const fileName = file.name;
    const fileExtension = extname(fileName).toLowerCase();

    UploadDocumentSchema.parse({
      fileName,
      fileSize: file.size,
      fileExtension,
      content,
    });

    logger.info({ fileName, fileSize: file.size }, "documents.upload_started");

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: UploadProgressEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        try {
          await ingestDocument(content, fileName, sendEvent);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Upload failed";
          logger.error({ fileName, error: message }, "documents.upload_failed");
          sendEvent({ type: "error", message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
