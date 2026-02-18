import { extname } from "node:path";
import type { UploadProgressEvent } from "@chatapp/shared";
import { UploadDocumentSchema } from "@chatapp/shared";
import { Router } from "express";
import multer from "multer";
import { deleteDocument, ingestDocument, listDocuments } from "../features/documents";
import { getLogger } from "../logging";

const router = Router();
const logger = getLogger("api.documents");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

/**
 * GET /
 * List all document summaries.
 */
router.get("/", async (_req, res, next) => {
  try {
    logger.info("documents.list_started");

    const documents = await listDocuments();

    logger.info({ count: documents.length }, "documents.list_completed");

    res.json({ documents });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /upload
 * Upload a document file with SSE progress streaming.
 */
router.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const content = file.buffer.toString("utf-8");
    const fileName = file.originalname;
    const fileExtension = extname(fileName).toLowerCase();

    UploadDocumentSchema.parse({
      fileName,
      fileSize: file.size,
      fileExtension,
      content,
    });

    logger.info({ fileName, fileSize: file.size }, "documents.upload_started");

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendEvent = (event: UploadProgressEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      await ingestDocument(content, fileName, sendEvent);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      logger.error({ fileName, error: message }, "documents.upload_failed");
      sendEvent({ type: "error", message });
    } finally {
      res.end();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /:id
 * Delete a document and its chunks.
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.info({ documentId: id }, "documents.delete_started");

    await deleteDocument(id);

    logger.info({ documentId: id }, "documents.delete_completed");

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { router as documentsRouter };
