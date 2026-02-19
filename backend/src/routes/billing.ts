import { Router } from "express";
import { TOKEN_PACKS } from "@/shared/constants";
import { PurchaseTokensSchema } from "@/shared/schemas/billing";
import { createPaginatedResponse, PaginationParamsSchema } from "@/shared/schemas/pagination";
import { getTokenBalance, getTransactionHistory, grantSignupTokens } from "../features/billing";
import { chargebee } from "../features/billing/chargebee";
import { getLogger } from "../logging";
import type { AuthRequest } from "../middleware/auth";

const router = Router();
const logger = getLogger("api.billing");

/**
 * GET /balance
 * Get the authenticated user's token balance.
 */
router.get("/balance", async (req, res, next) => {
  try {
    const { user } = req as AuthRequest;
    const userId = user.id;

    const balance = await getTokenBalance(userId);

    res.json({ balance });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /checkout
 * Create a Chargebee checkout URL for purchasing tokens.
 */
router.post("/checkout", async (req, res, next) => {
  try {
    const { user } = req as AuthRequest;
    const userId = user.id;
    const userEmail = user.email ?? "";

    const { packId } = PurchaseTokensSchema.parse(req.body);

    const pack = TOKEN_PACKS.find((p) => p.id === packId);
    if (!pack) {
      res.status(400).json({ error: "Invalid pack" });
      return;
    }

    const origin = `${req.protocol}://${req.get("host")}`;
    logger.info({ userId, packId }, "billing.checkout_started");

    const result = await chargebee.hostedPage.checkoutOneTimeForItems({
      customer: {
        id: userId,
        email: userEmail,
      },
      charges: [
        {
          amount: pack.priceInCents,
          description: pack.description,
        },
      ],
      pass_thru_content: JSON.stringify({ packId, userId }),
      redirect_url: `${origin}/dashboard/billing/success`,
      cancel_url: `${origin}/dashboard/billing/cancel`,
    });

    logger.info({ userId, packId }, "billing.checkout_completed");
    res.json({ url: result.hosted_page?.url });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : error },
      "billing.checkout_failed",
    );
    next(error);
  }
});

/**
 * POST /portal
 * Create a Chargebee portal session URL.
 */
router.post("/portal", async (req, res, next) => {
  try {
    const { user } = req as AuthRequest;
    const userId = user.id;

    logger.info({ userId }, "billing.portal_started");

    const result = await chargebee.portalSession.create({
      customer: { id: userId },
    });

    logger.info({ userId }, "billing.portal_completed");
    res.json({ url: result.portal_session?.access_url });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /transactions
 * List transaction history with pagination.
 */
router.get("/transactions", async (req, res, next) => {
  try {
    const { user } = req as AuthRequest;
    const userId = user.id;

    const paginationResult = PaginationParamsSchema.safeParse({
      page: req.query["page"] ? Number(req.query["page"]) : undefined,
      pageSize: req.query["pageSize"] ? Number(req.query["pageSize"]) : undefined,
    });

    const pagination = paginationResult.success ? paginationResult.data : { page: 1, pageSize: 20 };

    const { transactions, total } = await getTransactionHistory(
      userId,
      pagination.page,
      pagination.pageSize,
    );

    res.json(createPaginatedResponse(transactions, total, pagination));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /grant-signup-tokens
 * Grant free signup tokens to the authenticated user.
 */
router.post("/grant-signup-tokens", async (req, res, next) => {
  try {
    const { user } = req as AuthRequest;

    await grantSignupTokens(user.id);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export { router as billingRouter };
