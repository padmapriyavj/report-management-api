import multer from "multer";
import { config, ALLOWED_MIME_TYPES } from "../config";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxFileSize,
  },
  fileFilter: (_req, file, cb) => {
    if (
      ALLOWED_MIME_TYPES.includes(
        file.mimetype as (typeof ALLOWED_MIME_TYPES)[number]
      )
    ) {
      cb(null, true);
    } else {
      cb(new Error(`File type '${file.mimetype}' is not allowed`));
    }
  },
});
