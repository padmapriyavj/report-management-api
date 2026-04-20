import { randomBytes } from "crypto";

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  jwt: {
    secret: process.env.JWT_SECRET || randomBytes(32).toString("hex"),
    expiresIn: "1h",
  },

  upload: {
    maxFileSize: 10 * 1024 * 1024, //10 MB
    allowedMimeTypes: ALLOWED_MIME_TYPES,
    maxAttachmentsPerReport: 10,
    storagePath: "./uploads",
  },
  pagination: {
    defaultPage: 1,
    defaultSize: 20,
    maxSize: 100,
  },

  downloadToken: {
    ttlSeconds: parseInt(process.env.DOWNLOAD_TOKEN_TTL || "3600", 10),
  },

  queue: {
    maxRetries: 3,
    baseDelayMs: 1000,
  },
} as const;
