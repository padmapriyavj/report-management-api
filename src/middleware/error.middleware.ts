import { Request, Response, NextFunction } from "express";
import { logger } from "./logger.middleware";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>[]
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        traceId: req.traceId,
        ...(err.details && { details: err.details }),
      },
    });
    return;
  }

  logger.error({
    traceId: req.traceId,
    error: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      traceId: req.traceId,
    },
  });
}
