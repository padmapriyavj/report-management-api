import { Router } from "express";
import { authorize, authenticate } from "../middleware/auth.middleware";
import {
  handleGetReport,
  handleCreateReport,
  handleUpdateReport,
  handleDownloadAttachment,
  handleUploadAttachment,
} from "../controllers/report.controller";
import { upload } from "../middleware/upload.middleware";

const router = Router();

// GET /reports/:id — all authenticated users
router.get("/:id", authenticate, handleGetReport);

// POST /reports — only editors and admins
router.post(
  "/",
  authenticate,
  authorize(["editor", "admin"]),
  handleCreateReport
);

// PUT /reports/:id — editors and admins only
router.put(
  "/:id",
  authenticate,
  authorize(["editor", "admin"]),
  handleUpdateReport
);

// POST /reports/:id/attachment — editors and admins only
router.post(
  "/:id/attachment",
  authenticate,
  authorize(["editor", "admin"]),
  upload.single("file"),
  handleUploadAttachment
);

// GET /reports/:id/attachments/:attachmentId/download — all authenticated users
router.get(
  "/:id/attachments/:attachmentId/download",
  authenticate,
  handleDownloadAttachment
);

export default router;
