import { NextResponse } from "next/server";

import { handleApiError, unauthorizedResponse } from "@/core/api/errors";
import { createClient } from "@/core/supabase/server";
import { getTokenBalance } from "@/features/billing";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return unauthorizedResponse();
    }

    const balance = await getTokenBalance(user.id);
    return NextResponse.json({ balance });
  } catch (error) {
    return handleApiError(error);
  }
}
