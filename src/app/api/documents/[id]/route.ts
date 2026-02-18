import { type NextRequest, NextResponse } from "next/server";

import { handleApiError, unauthorizedResponse } from "@/core/api/errors";
import { getLogger } from "@/core/logging";
import { createClient } from "@/core/supabase/server";
import { deleteDocument } from "@/features/documents";

const logger = getLogger("api.documents");

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/documents/[id]
 * Delete a document and its chunks.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return unauthorizedResponse();
    }

    logger.info({ documentId: id }, "documents.delete_started");
    await deleteDocument(id);
    logger.info({ documentId: id }, "documents.delete_completed");

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
