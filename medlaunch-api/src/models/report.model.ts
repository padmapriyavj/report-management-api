import { z } from "zod";
import { createEntrySchema, entrySchema, priorityEnum } from "./entry.model";
import { commentSchema } from "./comment.model";
import { attachmentSchema } from "./attachment.model";

export const reportStatusEnum = z.enum([
  "draft",
  "in_review",
  "approved",
  "archived",
]);

//Schema for creating a report (what the client sends)

export const createReportSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Title must be at least 3 characters")
      .max(200, "Title must not exceed 200 characters"),
    description: z
      .string()
      .trim()
      .max(5000, "Description must not exceed 5000 characters")
      .optional(),
    priority: priorityEnum.optional().default("medium"),
    category: z.string().trim().max(100).optional(),
    tags: z
      .array(z.string().trim().max(50))
      .max(20, "Maximum 20 tags allowed")
      .optional()
      .default([]),
    entries: z.array(createEntrySchema).optional().default([]),
    metadata: z
      .record(z.string(), z.union([z.string(), z.number()]))
      .refine(
        (obj) => Object.keys(obj).length <= 10,
        "Metadata must not exceed 10 keys"
      )
      .optional()
      .default({}),
  })
  .strict();

//Full report as stored in memory

export const reportSchema = createReportSchema.extend({
  id: z.uuid(),
  businessKey: z
    .string()
    .regex(
      /^RPT-\d{4}-\d{4}$/,
      "Business key must follow RPT-YYYY-NNNN format"
    ),
  status: reportStatusEnum.default("draft"),
  createdBy: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  updatedBy: z.string().min(1),
  version: z.number().int().positive(),
  entries: z.array(entrySchema),
  comments: z.array(commentSchema).default([]),
  attachments: z.array(attachmentSchema).default([]),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type Report = z.infer<typeof reportSchema>;
