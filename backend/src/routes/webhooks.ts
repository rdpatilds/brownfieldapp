import { Router } from "express";
import { TOKEN_PACKS } from "@/shared/constants";
import { env } from "../config/env";
import { creditPurchasedTokens } from "../features/billing";
import { getLogger } from "../logging";

const router = Router();
const logger = getLogger("api.webhooks.chargebee");

const processedEvents = new Set<string>();

interface ChargebeeLineItem {
  amount?: number;
}

interface ChargebeeInvoice {
  id?: string;
  customer_id?: string;
  pass_thru_content?: string;
  line_items?: ChargebeeLineItem[];
  total?: number;
}

interface ChargebeeWebhookBody {
  id: string;
  event_type: string;
  pass_thru_content?: string;
  content?: {
    invoice?: ChargebeeInvoice;
  };
}

function verifyBasicAuth(authHeader: string | undefined): boolean {
  if (!authHeader?.startsWith("Basic ")) {
    return false;
  }
  const encoded = authHeader.slice(6);
  const decoded = atob(encoded);
  const [username, password] = decoded.split(":");
  return username === env.CHARGEBEE_WEBHOOK_USERNAME && password === env.CHARGEBEE_WEBHOOK_PASSWORD;
}

function resolvePackAndUser(body: ChargebeeWebhookBody): {
  packId: string;
  userId: string;
} | null {
  // Primary: try pass_thru_content from invoice or top-level
  const raw = body.content?.invoice?.pass_thru_content ?? body.pass_thru_content;

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as { packId?: string; userId?: string };
      if (parsed.packId && parsed.userId) {
        return { packId: parsed.packId, userId: parsed.userId };
      }
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback: derive userId from invoice.customer_id and match pack by charge amount
  const invoice = body.content?.invoice;
  if (!invoice) {
    return null;
  }

  const userId = invoice.customer_id;
  if (!userId) {
    return null;
  }

  const chargeAmount = invoice.line_items?.[0]?.amount ?? invoice.total;
  if (chargeAmount === undefined) {
    return null;
  }

  const pack = TOKEN_PACKS.find((p) => p.priceInCents === chargeAmount);
  if (!pack) {
    logger.error({ chargeAmount }, "webhook.no_matching_pack_for_amount");
    return null;
  }

  return { packId: pack.id, userId };
}

/**
 * POST /chargebee
 * Chargebee webhook handler with Basic Auth verification and idempotency.
 */
router.post("/chargebee", async (req, res) => {
  try {
    if (!verifyBasicAuth(req.headers.authorization)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const body = req.body as ChargebeeWebhookBody;
    const eventId = body.id;
    const eventType = body.event_type;

    // Idempotency check
    if (processedEvents.has(eventId)) {
      logger.info({ eventId }, "webhook.duplicate_event_skipped");
      res.json({ status: "ok" });
      return;
    }

    logger.info({ eventId, eventType }, "webhook.received");

    if (eventType === "payment_succeeded") {
      const resolved = resolvePackAndUser(body);

      if (!resolved) {
        logger.error({ eventId }, "webhook.cannot_resolve_pack_and_user");
        res.json({ status: "ok" });
        return;
      }

      const invoiceId = body.content?.invoice?.id ?? eventId;
      await creditPurchasedTokens(resolved.userId, resolved.packId, invoiceId);
      logger.info(
        { eventId, userId: resolved.userId, packId: resolved.packId },
        "webhook.tokens_credited",
      );
    }

    processedEvents.add(eventId);
    res.json({ status: "ok" });
  } catch (error) {
    logger.error({ error }, "webhook.processing_failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export { router as webhooksRouter };
