import { z } from "zod";

// Entry lifecycle: starts pending, can be marked completed or cancelled
export const entryStatusEnum = z.enum(["pending", "completed", "cancelled"]);

// Shared priority levels used by both entries and reports
export const priorityEnum = z.enum(["low", "medium", "high", "critical"]);

// What clients send when creating an entry
export const createEntrySchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1, "Content is required")
      .max(10000, "Content must not exceed 10000 characters"),
    amount: z.number().optional(), // For summing/aggregation in metrics
    priority: priorityEnum.optional().default("medium"),
    status: entryStatusEnum.default("pending"),
  })
  .strict();

// Full entry with server-generated fields (id, timestamps, author)
export const entrySchema = createEntrySchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  createdBy: z.string().min(1),
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type Entry = z.infer<typeof entrySchema>;
