import { z } from "zod";
import { config, ALLOWED_MIME_TYPES } from "../config";

// No "create" schema here as the attachment comes from the file upload and not JSON bodies

//Full attachemt as stored in memory

export const mimeTypeEnum = z.enum(ALLOWED_MIME_TYPES);

export const attachmentSchema = z.object({
  id: z.uuid(),
  filename: z.string().min(1).max(255),
  mimeType: mimeTypeEnum,
  sizeBytes: z.number().positive().max(config.upload.maxFileSize),
  storagePath: z.string().min(1),
  uploadedBy: z.string().min(1),
  uploadedAt: z.iso.datetime(),
  downloadToken: z.string().min(1),
  tokenExpiresAt: z.iso.datetime(),
});

export type Attachment = z.infer<typeof attachmentSchema>;
