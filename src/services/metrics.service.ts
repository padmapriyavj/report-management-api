import { Report } from "../models/report.model";
import { ReportMetrics } from "../models/metrics.model";

/**
 * Calculate all metrics for a report.
 * Called when fetching a report with metrics included.
 */
export function calculateMetrics(report: Report): ReportMetrics {
  const entries = report.entries;
  const totalEntries = entries.length;

  // Sum all entry amounts (some entries may not have an amount)
  const totalAmount = entries.reduce(
    (sum, entry) => sum + (entry.amount || 0),
    0
  );

  const completedCount = entries.filter((e) => e.status === "completed").length;

  // Round to one decimal place
  const completionRate =
    totalEntries === 0
      ? 0
      : Math.round((completedCount / totalEntries) * 100 * 10) / 10;

  // Derive overall status from completion rate
  const derivedStatus =
    totalEntries === 0
      ? "pending"
      : completionRate === 100
      ? "complete"
      : completionRate > 50
      ? "in_progress"
      : "pending";

  // Count entries that need attention
  const highPriorityCount = entries.filter(
    (e) => e.priority === "high" || e.priority === "critical"
  ).length;

  const trendIndicator = calculateTrend(entries);

  // Find the most recent activity across all collections
  const allTimestamps = [
    ...entries.map((e) => e.createdAt),
    ...report.comments.map((c) => c.createdAt),
    ...report.attachments.map((a) => a.uploadedAt),
  ];

  const lastActivityAt =
    allTimestamps.length === 0
      ? null
      : allTimestamps.reduce((latest, current) =>
          new Date(current).getTime() > new Date(latest).getTime()
            ? current
            : latest
        );

  return {
    totalEntries,
    totalAmount,
    completionRate,
    derivedStatus,
    trendIndicator,
    highPriorityCount,
    commentCount: report.comments.length,
    attachmentCount: report.attachments.length,
    lastActivityAt,
  };
}

/**
 * Determine activity trend by comparing this week to last week.
 * Returns "up" if more entries were created recently, "down" if fewer.
 */
function calculateTrend(entries: Report["entries"]): "up" | "down" | "stable" {
  // Need at least a few entries to establish a trend
  if (entries.length < 3) return "stable";

  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  // Count entries from the last 7 days
  const recentCount = entries.filter(
    (e) => now - new Date(e.createdAt).getTime() < sevenDays
  ).length;

  // Count entries from 7-14 days ago
  const previousCount = entries.filter((e) => {
    const age = now - new Date(e.createdAt).getTime();
    return age >= sevenDays && age < sevenDays * 2;
  }).length;

  if (previousCount === 0) return recentCount > 0 ? "up" : "stable";
  if (recentCount > previousCount) return "up";
  if (recentCount < previousCount) return "down";
  return "stable";
}
