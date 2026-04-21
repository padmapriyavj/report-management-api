import { z } from "zod";

// Derived from completion rate: complete (100%), in_progress (>50%), pending (<=50%)
export const derivedStatusEnum = z.enum(["complete", "in_progress", "pending"]);

// Based on recent entry activity compared to the previous week
export const trendIndicatorEnum = z.enum(["up", "down", "stable"]);

export const reportMetricsSchema = z.object({
  totalEntries: z.number().int().nonnegative(),
  totalAmount: z.number(), // Sum of all entry amounts
  completionRate: z.number().min(0).max(100), // Percentage of completed entries
  derivedStatus: derivedStatusEnum,
  trendIndicator: trendIndicatorEnum,
  highPriorityCount: z.number().int().nonnegative(), // Entries with high or critical priority
  commentCount: z.number().int().nonnegative(),
  attachmentCount: z.number().int().nonnegative(),
  lastActivityAt: z.iso.datetime().nullable(), // Most recent activity across all collections
});

export type ReportMetrics = z.infer<typeof reportMetricsSchema>;
