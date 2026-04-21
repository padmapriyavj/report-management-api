import { Request, Response } from "express";
import { createReportSchema } from "../models/report.model";
import * as reportService from "../services/report.service";

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
