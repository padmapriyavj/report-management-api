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

const auditLog: AuditEntry[] = [];

export function recordAudit(
  userId: string,
  reportId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  traceId?: string
): void {
  const changes: AuditEntry["changes"] = [];

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

  if (changes.length === 0) return;

  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    userId,
    reportId,
    changes,
  };

  auditLog.push(entry);

  logger.info({
    type: "audit",
    traceId,
    ...entry,
  });
}

export function getAuditLog(): AuditEntry[] {
  return [...auditLog];
}
