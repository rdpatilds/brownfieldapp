import { NextResponse } from "next/server";

import { handleApiError, unauthorizedResponse } from "@/core/api/errors";
import { getLogger } from "@/core/logging";
import { createClient } from "@/core/supabase/server";
import { chargebee } from "@/features/billing/chargebee";

const logger = getLogger("api.billing.portal");

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return unauthorizedResponse();
    }

    logger.info({ userId: user.id }, "billing.portal_started");

    const result = await chargebee.portalSession.create({
      customer: { id: user.id },
    });

    logger.info({ userId: user.id }, "billing.portal_completed");
    return NextResponse.json({ url: result.portal_session?.access_url });
  } catch (error) {
    return handleApiError(error);
  }
}
