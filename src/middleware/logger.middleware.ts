import { Request, Response, NextFunction } from "express";
import pino from "pino";
import { v4 as uuidv4 } from "uuid";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const traceId = uuidv4();
  const start = Date.now();

  req.traceId = traceId;

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
