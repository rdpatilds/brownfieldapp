import { z } from "zod/v4";

export const SendMessageSchema = z.object({
  content: z
    .string()
    .min(1, "Content must be at least 1 character")
    .max(10000, "Content must be at most 10000 characters"),
  conversationId: z.string().uuid().optional(),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;

export const CreateConversationSchema = z.object({
  title: z
    .string()
    .min(1, "Title must be at least 1 character")
    .max(200, "Title must be at most 200 characters"),
});

export type CreateConversationInput = z.infer<typeof CreateConversationSchema>;

export const UpdateConversationSchema = z.object({
  title: z
    .string()
    .min(1, "Title must be at least 1 character")
    .max(200, "Title must be at most 200 characters"),
});

export type UpdateConversationInput = z.infer<typeof UpdateConversationSchema>;
