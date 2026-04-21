import { ReportRepository } from "../repositories/report.repository";
import { v4 as uuidv4 } from "uuid";
import { Entry, CreateEntryInput } from "../models/entry.model";
import { sanitizeObject } from "../utils/sanitize";
import { CreateReportInput, Report } from "../models/report.model";
import { logger } from "../middleware/logger.middleware";
import { calculateMetrics } from "./metrics.service";

interface GetReportOptions {
  view: "full" | "summary";
  include: string[];
  page: number;
  size: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
  filterPriority?: string;
  filterStatus?: string;
}

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
export function getReportById(id: string, options: GetReportOptions) {
  const report = reportRepository.findById(id);

  if (!report) {
    return null;
  }

  const metrics = calculateMetrics(report);

  // Summary view — flat object, no nested arrays
  if (options.view === "summary") {
    return {
      id: report.id,
      businessKey: report.businessKey,
      title: report.title,
      status: report.status,
      derivedStatus: metrics.derivedStatus,
      totalEntries: metrics.totalEntries,
      totalAmount: metrics.totalAmount,
      completionRate: metrics.completionRate,
      trendIndicator: metrics.trendIndicator,
      lastActivityAt: metrics.lastActivityAt,
    };
  }

  let filteredEntries = [...report.entries];

  if (options.filterPriority) {
    filteredEntries = filteredEntries.filter(
      (e) => e.priority === options.filterPriority
    );
  }

  if (options.filterStatus) {
    filteredEntries = filteredEntries.filter(
      (e) => e.status === options.filterStatus
    );
  }

  filteredEntries.sort((a, b) => {
    const key = options.sortBy as keyof typeof a;
    const valA = a[key];
    const valB = b[key];

    if (valA === undefined || valB === undefined) return 0;
    if (valA < valB) return options.sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return options.sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const totalItems = filteredEntries.length;
  const totalPages = Math.ceil(totalItems / options.size);
  const start = (options.page - 1) * options.size;
  const paginatedEntries = filteredEntries.slice(start, start + options.size);

  const response: Record<string, unknown> = {
    id: report.id,
    businessKey: report.businessKey,
    title: report.title,
    description: report.description,
    status: report.status,
    priority: report.priority,
    category: report.category,
    tags: report.tags,
    createdBy: report.createdBy,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    updatedBy: report.updatedBy,
    version: report.version,
    metadata: report.metadata,
  };

  if (options.include.includes("entries") || options.include.includes("all")) {
    response.entries = paginatedEntries;
    response.pagination = {
      page: options.page,
      size: options.size,
      totalItems,
      totalPages,
      hasNext: options.page < totalPages,
      hasPrev: options.page > 1,
    };
  }

  if (options.include.includes("comments") || options.include.includes("all")) {
    response.comments = report.comments;
  }

  if (
    options.include.includes("attachments") ||
    options.include.includes("all")
  ) {
    response.attachments = report.attachments;
  }

  if (options.include.includes("metrics") || options.include.includes("all")) {
    response.metrics = metrics;
  }

  return response;
}


