import { Request, Response } from "express";
import { createReportSchema } from "../models/report.model";
import * as reportService from "../services/report.service";
import { config } from "../config";
import { updateReportSchema } from "../models/report.model";
import { getCachedResponse, cacheResponse } from "../utils/idempotency";

/**
 * POST /reports - Create a new report.
 * Validates input with Zod, then hands off to the service layer.
 */
export function handleCreateReport(req: Request, res: Response): void {
  const result = createReportSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        traceId: req.traceId,
        details: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
          code: "FIELD_INVALID",
        })),
      },
    });
    return;
  }
  if (!req.user) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        traceId: req.traceId,
      },
    });
    return;
  }

  const report = reportService.createReport(result.data, req.user.userId);

  res.status(201).header("Location", `/reports/${report.id}`).json(report);
}

/**
 * GET /reports/:id - Fetch a single report.
 * Supports query params for view type, field selection, pagination, sorting, and filtering.
 */
export function handleGetReport(req: Request, res: Response): void {
  const id = req.params.id as string;

  const view = req.query.view === "summary" ? "summary" : "full";

  const includeParam = (req.query.include as string) || "all";
  const include = includeParam.split(",").map((s) => s.trim());

  const page = Math.max(1, parseInt(req.query.page as string) || config.pagination.defaultPage);
  const size = Math.min(
    config.pagination.maxSize,
    Math.max(1, parseInt(req.query.size as string) || config.pagination.defaultSize),
  );

  const validSortFields = ["createdAt", "priority", "amount", "status"];
  const sortBy = validSortFields.includes(req.query.sortBy as string)
    ? (req.query.sortBy as string)
    : "createdAt";

  const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

  const filterPriority = req.query.filterPriority as string | undefined;
  const filterStatus = req.query.filterStatus as string | undefined;

  const result = reportService.getReportById(id, {
    view,
    include,
    page,
    size,
    sortBy,
    sortOrder,
    filterPriority,
    filterStatus,
  });

  if (!result) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: `Report with id '${id}' not found`,
        traceId: req.traceId,
      },
    });
    return;
  }

  res.status(200).json(result);
}

/**
 * PUT /reports/:id - Update an existing report.
 * Uses If-Match header for optimistic concurrency control.
 * Supports idempotency keys to safely handle retries.
 */
export function handleUpdateReport(req: Request, res: Response): void {
  // Strip quotes if present (RFC 7232 ETag format)
  const rawIfMatch = (req.headers["if-match"] as string | undefined)?.replace(/"/g, "");

  if (!rawIfMatch) {
    res.status(428).json({
      error: {
        code: "PRECONDITION_REQUIRED",
        message: "If-Match header with version number is required",
        traceId: req.traceId,
      },
    });
    return;
  }
  const version = parseInt(rawIfMatch, 10);

  if (isNaN(version)) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "If-Match header must be a valid version number",
        traceId: req.traceId,
      },
    });
    return;
  }

  const idempotencyKey = req.headers["idempotency-key"] as string | undefined;

  if (idempotencyKey) {
    const cached = getCachedResponse(idempotencyKey);
    if (cached) {
      res.status(cached.statusCode).json(cached.body);
      return;
    }
  }

  const result = updateReportSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        traceId: req.traceId,
        details: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
          code: "FIELD_INVALID",
        })),
      },
    });
    return;
  }

  if (!req.user) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        traceId: req.traceId,
      },
    });
    return;
  }

  const id = req.params.id as string;

  const updated = reportService.updateReport(id, result.data, {
    userId: req.user.userId,
    role: req.user.role,
    version,
    traceId: req.traceId,
  });

  if (idempotencyKey) {
    cacheResponse(idempotencyKey, 200, updated);
  }

  res.status(200).json(updated);
}

/**
 * POST /reports/:id/attachment - Upload a file to a report.
 * File comes via multipart form data, validated by multer middleware.
 */
export function handleUploadAttachment(req: Request, res: Response): void {
  if (!req.user) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        traceId: req.traceId,
      },
    });
    return;
  }

  if (!req.file) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "No file provided",
        traceId: req.traceId,
      },
    });
    return;
  }

  const id = req.params.id as string;

  const attachment = reportService.addAttachment(id, req.file, req.user.userId);

  res.status(201).json(attachment);
}

/**
 * GET /reports/:id/attachments/:attachmentId/download - Download an attachment.
 * Requires a valid, non-expired download token passed as query param.
 */
export async function handleDownloadAttachment(req: Request, res: Response): Promise<void> {
  const reportId = req.params.id as string;
  const attachmentId = req.params.attachmentId as string;
  const token = req.query.token as string;

  if (!token) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Download token is required",
        traceId: req.traceId,
      },
    });
    return;
  }

  const { buffer, attachment } = reportService.getAttachmentFile(reportId, attachmentId, token);

  const fileBuffer = await buffer;

  if (!fileBuffer) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "File not found on storage",
        traceId: req.traceId,
      },
    });
    return;
  }

  res.setHeader("Content-Type", attachment.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${attachment.filename}"`);
  res.send(fileBuffer);
}
