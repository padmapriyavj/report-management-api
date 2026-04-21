import { Report } from "../models/report.model";
import { ReportMetrics } from "../models/metrics.model";

export function calculateMetrics(report: Report): ReportMetrics {
  const entries = report.entries;
  const totalEntries = entries.length;

  const totalAmount = entries.reduce(
    (sum, entry) => sum + (entry.amount || 0),
    0
  );

  const completedCount = entries.filter((e) => e.status === "completed").length;

  const completionRate =
    totalEntries === 0
      ? 0
      : Math.round((completedCount / totalEntries) * 100 * 10) / 10;

  const derivedStatus =
    totalEntries === 0
      ? "pending"
      : completionRate === 100
      ? "complete"
      : completionRate > 50
      ? "in_progress"
      : "pending";

  const highPriorityCount = entries.filter(
    (e) => e.priority === "high" || e.priority === "critical"
  ).length;

  const trendIndicator = calculateTrend(entries);

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

function calculateTrend(entries: Report["entries"]): "up" | "down" | "stable" {
  if (entries.length < 3) return "stable";

  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  const recentCount = entries.filter(
    (e) => now - new Date(e.createdAt).getTime() < sevenDays
  ).length;

  const previousCount = entries.filter((e) => {
    const age = now - new Date(e.createdAt).getTime();
    return age >= sevenDays && age < sevenDays * 2;
  }).length;

  if (previousCount === 0) return recentCount > 0 ? "up" : "stable";
  if (recentCount > previousCount) return "up";
  if (recentCount < previousCount) return "down";
  return "stable";
}
