import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { handleApiError, unauthorizedResponse } from "@/core/api/errors";
import { getLogger } from "@/core/logging";
import { createClient } from "@/core/supabase/server";
import { PurchaseTokensSchema, TOKEN_PACKS } from "@/features/billing";
import { chargebee } from "@/features/billing/chargebee";

const logger = getLogger("api.billing.checkout");

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { packId } = PurchaseTokensSchema.parse(body);

    const pack = TOKEN_PACKS.find((p) => p.id === packId);
    if (!pack) {
      return NextResponse.json({ error: "Invalid pack" }, { status: 400 });
    }

    const origin = request.nextUrl.origin;
    logger.info({ userId: user.id, packId }, "billing.checkout_started");

    const result = await chargebee.hostedPage.checkoutOneTimeForItems({
      customer: {
        id: user.id,
        email: user.email,
      },
      charges: [
        {
          amount: pack.priceInCents,
          description: pack.description,
        },
      ],
      pass_thru_content: JSON.stringify({ packId, userId: user.id }),
      redirect_url: `${origin}/dashboard/billing/success`,
      cancel_url: `${origin}/dashboard/billing/cancel`,
    });

    logger.info({ userId: user.id, packId }, "billing.checkout_completed");
    return NextResponse.json({ url: result.hosted_page?.url });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : error },
      "billing.checkout_failed",
    );
    return handleApiError(error);
  }
}
