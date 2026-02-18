import { NextResponse } from "next/server";

import { handleApiError, unauthorizedResponse } from "@/core/api/errors";
import { getLogger } from "@/core/logging";
import { createClient } from "@/core/supabase/server";
import { listDocuments } from "@/features/documents";

const logger = getLogger("api.documents");

/**
 * GET /api/documents
 * List all document summaries.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return unauthorizedResponse();
    }

    logger.info("documents.list_started");
    const documents = await listDocuments();
    logger.info({ count: documents.length }, "documents.list_completed");

    return NextResponse.json({ documents });
  } catch (error) {
    return handleApiError(error);
  }
}
