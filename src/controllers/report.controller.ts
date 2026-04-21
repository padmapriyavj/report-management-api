import { Request, Response } from "express";
import { createReportSchema } from "../models/report.model";
import * as reportService from "../services/report.service";
import { config } from "../config";

export function handleCreateReport(req: Request, res: Response): void {
  // Validate input
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

export function handleGetReport(req: Request, res: Response): void {
  const id = req.params.id as string;

  const view = req.query.view === "summary" ? "summary" : "full";

  const includeParam = (req.query.include as string) || "all";
  const include = includeParam.split(",").map((s) => s.trim());

  const page = Math.max(
    1,
    parseInt(req.query.page as string) || config.pagination.defaultPage
  );
  const size = Math.min(
    config.pagination.maxSize,
    Math.max(
      1,
      parseInt(req.query.size as string) || config.pagination.defaultSize
    )
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
