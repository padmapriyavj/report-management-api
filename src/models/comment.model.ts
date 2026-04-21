import { z } from "zod";

// What clients send when adding a comment
export const createCommentSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1, "Comment text is required")
      .max(5000, "Comment text must not exceed 5000 characters"),
  })
  .strict();

// Full comment with server-generated fields
export const commentSchema = createCommentSchema.extend({
  id: z.uuid(),
  authorId: z.string().min(1),
  createdAt: z.iso.datetime(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type Comment = z.infer<typeof commentSchema>;
