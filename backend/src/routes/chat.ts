import { Router } from "express";
import { CreateConversationSchema, UpdateConversationSchema } from "@/shared/schemas/chat";
import {
  createConversation,
  deleteConversation,
  getConversation,
  getMessages,
  updateConversation,
} from "../features/chat";
import { getLogger } from "../logging";
import type { AuthRequest } from "../middleware/auth";

const router = Router();
const logger = getLogger("api.chat.conversations");

/**
 * POST /
 * Create a new conversation.
 */
router.post("/", async (req, res, next) => {
  try {
    const _authReq = req as AuthRequest;
    const { title } = CreateConversationSchema.parse(req.body);

    logger.info({ title }, "conversation.create_started");

    const conversation = await createConversation(title, _authReq.user.id);

    logger.info({ conversationId: conversation.id }, "conversation.create_completed");

    res.status(201).json(conversation);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /:id
 * Get a single conversation by ID.
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.info({ conversationId: id }, "conversation.get_started");

    const conversation = await getConversation(id);

    logger.info({ conversationId: id }, "conversation.get_completed");

    res.json(conversation);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /:id
 * Update a conversation title.
 */
router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title } = UpdateConversationSchema.parse(req.body);

    logger.info({ conversationId: id }, "conversation.update_started");

    const conversation = await updateConversation(id, title);

    logger.info({ conversationId: id }, "conversation.update_completed");

    res.json(conversation);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /:id
 * Delete a conversation and its messages.
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.info({ conversationId: id }, "conversation.delete_started");

    await deleteConversation(id);

    logger.info({ conversationId: id }, "conversation.delete_completed");

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * GET /:id/messages
 * Get all messages for a conversation.
 */
router.get("/:id/messages", async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.info({ conversationId: id }, "messages.get_started");

    const messages = await getMessages(id);

    logger.info({ conversationId: id, count: messages.length }, "messages.get_completed");

    res.json({ messages });
  } catch (error) {
    next(error);
  }
});

export { router as chatRouter };
