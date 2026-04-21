import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { logger } from "./logger.middleware";

/**
 * Custom error class for business logic errors.
 * Includes HTTP status code and error code for client-side handling.
 */
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

/**
 * Express error handler - must be registered last in the middleware chain.
 * Converts various error types into our standard JSON error format.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Multer throws its own errors for file size limits, etc.
  if (err instanceof multer.MulterError) {
    const statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    res.status(statusCode).json({
      error: {
        code:
          err.code === "LIMIT_FILE_SIZE"
            ? "PAYLOAD_TOO_LARGE"
            : "VALIDATION_ERROR",
        message: err.message,
        traceId: req.traceId,
      },
    });
    return;
  }

  // Our custom file filter throws plain errors with "File type" message
  if (err.message?.includes("File type")) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: err.message,
        traceId: req.traceId,
      },
    });
    return;
  }

  // Known business errors - status code and message are safe to expose
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

  // Unexpected error - log the full stack trace for debugging
  // but don't expose internals to the client
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
