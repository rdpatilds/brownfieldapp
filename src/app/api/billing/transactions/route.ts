import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { handleApiError, unauthorizedResponse } from "@/core/api/errors";
import { createClient } from "@/core/supabase/server";
import { getTransactionHistory } from "@/features/billing";
import { createPaginatedResponse, PaginationParamsSchema } from "@/shared/schemas/pagination";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return unauthorizedResponse();
    }

    const searchParams = request.nextUrl.searchParams;
    const paginationResult = PaginationParamsSchema.safeParse({
      page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
      pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : undefined,
    });

    const pagination = paginationResult.success ? paginationResult.data : { page: 1, pageSize: 20 };

    const { transactions, total } = await getTransactionHistory(
      user.id,
      pagination.page,
      pagination.pageSize,
    );
    return NextResponse.json(createPaginatedResponse(transactions, total, pagination));
  } catch (error) {
    return handleApiError(error);
  }
}
