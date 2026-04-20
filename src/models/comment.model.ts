import { z } from "zod";

// Schema for creating a comment (what the client sends)
export const createCommentSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1, "Comment text is required")
      .max(5000, "Comment text must not exceed 5000 characters"),
  })
  .strict();

//Full comment as stored in memory
export const commentSchema = createCommentSchema.extend({
  id: z.uuid(),
  authorId: z.string().min(1),
  createdAt: z.iso.datetime(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type Comment = z.infer<typeof commentSchema>;
