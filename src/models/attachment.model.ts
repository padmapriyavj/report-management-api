import { z } from "zod";
import { config, ALLOWED_MIME_TYPES } from "../config";

export const mimeTypeEnum = z.enum(ALLOWED_MIME_TYPES);

export const attachmentSchema = z.object({
  id: z.uuid(),
  filename: z.string().min(1).max(255), // Original filename, sanitized
  mimeType: mimeTypeEnum,
  sizeBytes: z.number().positive().max(config.upload.maxFileSize),
  storagePath: z.string().min(1), // Internal path in the storage service
  uploadedBy: z.string().min(1),
  uploadedAt: z.iso.datetime(),
  downloadToken: z.string().min(1), // Signed token for secure downloads
  tokenExpiresAt: z.iso.datetime(), // Token expires after 1 hour by default
});

export type Attachment = z.infer<typeof attachmentSchema>;
