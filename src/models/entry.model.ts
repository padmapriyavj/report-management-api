import { z } from "zod";

export const entryStatusEnum = z.enum(["pending", "completed", "cancelled"]);
export const priorityEnum = z.enum(["low", "medium", "high", "critical"]);

// The Schema for creating a new entry (what the client sends)
export const createEntrySchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1, "Content is required")
      .max(10000, "Content must not exceed 10000 characters"),
    amount: z.number().optional(),
    priority: priorityEnum.optional().default("medium"),
    status: entryStatusEnum.default("pending"),
  })
  .strict();

//Full entry as stores in memory (includes server-generated fields)
export const entrySchema = createEntrySchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  createdBy: z.string().min(1),
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type Entry = z.infer<typeof entrySchema>;
