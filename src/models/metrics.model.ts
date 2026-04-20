import { z } from "zod";

export const derivedStatusEnum = z.enum(["complete", "in_progress", "pending"]);

export const trendIndicatorEnum = z.enum(["up", "down", "stable"]);

export const reportMetricsSchema = z.object({
  totalEntries: z.number().int().nonnegative(),
  totalAmount: z.number(),
  completionRate: z.number().min(0).max(100),
  derivedStatus: derivedStatusEnum,
  trendIndicator: trendIndicatorEnum,
  highPriorityCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  attachmentCount: z.number().int().nonnegative(),
  lastActivityAt: z.iso.datetime().nullable(),
});

export type ReportMetrics = z.infer<typeof reportMetricsSchema>;
