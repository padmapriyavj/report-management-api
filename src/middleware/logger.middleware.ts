import { Request, Response, NextFunction } from "express";
import pino from "pino";
import { v4 as uuidv4 } from "uuid";

// Pino is fast and outputs structured JSON - easy to parse in log aggregators
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

/**
 * Log every request with timing info and trace ID.
 * This should be one of the first middlewares in the chain.
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Generate a unique ID for this request - useful for debugging
  const traceId = uuidv4();
  const start = Date.now();

  // Attach to request so other code can include it in logs/errors
  req.traceId = traceId;

  // Log after response is sent so we have the final status code
  res.on("finish", () => {
    logger.info({
      traceId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      userId: req.user?.userId || "anonymous",
    });
  });

  next();
}
