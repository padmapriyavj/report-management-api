import { logger } from "../middleware/logger.middleware";

interface AuditEntry {
  timestamp: string;
  userId: string;
  reportId: string;
  changes: {
    field: string;
    before: unknown;
    after: unknown;
  }[];
}

// In-memory audit log - in production, this would go to a database
const auditLog: AuditEntry[] = [];

/**
 * Record changes made to a report.
 * Only logs fields that actually changed. Skips if nothing changed.
 */
export function recordAudit(
  userId: string,
  reportId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  traceId?: string
): void {
  const changes: AuditEntry["changes"] = [];

  // Only track meaningful business fields, not timestamps or version
  const trackedFields = [
    "title",
    "description",
    "status",
    "priority",
    "category",
    "tags",
    "entries",
    "metadata",
  ];

  for (const field of trackedFields) {
    const oldVal = JSON.stringify(before[field]);
    const newVal = JSON.stringify(after[field]);

    if (oldVal !== newVal) {
      changes.push({
        field,
        before: before[field],
        after: after[field],
      });
    }
  }

  // Don't create an entry if nothing changed
  if (changes.length === 0) return;

  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    userId,
    reportId,
    changes,
  };

  auditLog.push(entry);

  // Also log to stdout so it shows up in log aggregators
  logger.info({
    type: "audit",
    traceId,
    ...entry,
  });
}

/**
 * Get a copy of the full audit log for debugging.
 */
export function getAuditLog(): AuditEntry[] {
  return [...auditLog];
}
