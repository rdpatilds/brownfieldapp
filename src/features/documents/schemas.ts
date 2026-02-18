import { z } from "zod/v4";

export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
export const ALLOWED_EXTENSIONS = [".md", ".txt"] as const;

export const UploadDocumentSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
  fileSize: z.number().max(MAX_FILE_SIZE, "File must be under 2MB"),
  fileExtension: z.enum(ALLOWED_EXTENSIONS, {
    message: "Only .md and .txt files are supported",
  }),
  content: z.string().min(1, "File content cannot be empty"),
});

export type UploadDocumentInput = z.infer<typeof UploadDocumentSchema>;
