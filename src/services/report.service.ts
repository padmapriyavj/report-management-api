import { ReportRepository } from "../repositories/report.repository";
import { v4 as uuidv4 } from "uuid";
import { Entry, CreateEntryInput } from "../models/entry.model";
import { sanitizeObject } from "../utils/sanitize";
import { CreateReportInput, Report } from "../models/report.model";
import { logger } from "../middleware/logger.middleware";

const reportRepository = new ReportRepository();

function buildEntry(input: CreateEntryInput, userId: string): Entry {
  return {
    ...input,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    createdBy: userId,
  };
}

export function createReport(input: CreateReportInput, userId: string): Report {
  const sanitized = sanitizeObject(input);

  const now = new Date().toISOString();
  const businessKey = reportRepository.generateBusinessKey();

  if (reportRepository.existsByBusinessKey(businessKey)) {
    throw new Error("BUSINESS_KEY_CONFLICT");
  }

  const entries = (sanitized.entries || []).map((entry) =>
    buildEntry(entry, userId)
  );
  const report: Report = {
    id: uuidv4(),
    businessKey,
    title: sanitized.title,
    description: sanitized.description,
    status: "draft",
    priority: sanitized.priority,
    category: sanitized.category,
    tags: sanitized.tags || [],
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    updatedBy: userId,
    version: 1,
    entries,
    comments: [],
    attachments: [],
    metadata: sanitized.metadata || {},
  };
  const created = reportRepository.create(report);

  logger.info({
    type: "report_created",
    reportId: created.id,
    businessKey: created.businessKey,
    userId,
  });

  return created;
}
