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

// Fetch a single report - readers, editors, and admins
router.get("/:id", authenticate, handleGetReport);

// Create a new report - editors and admins only
router.post(
  "/",
  authenticate,
  authorize(["editor", "admin"]),
  handleCreateReport
);

// Update an existing report - editors and admins only
router.put(
  "/:id",
  authenticate,
  authorize(["editor", "admin"]),
  handleUpdateReport
);

// Upload a file attachment - editors and admins only
router.post(
  "/:id/attachment",
  authenticate,
  authorize(["editor", "admin"]),
  upload.single("file"), // Multer handles multipart parsing
  handleUploadAttachment
);

// Download an attachment - requires valid download token
router.get(
  "/:id/attachments/:attachmentId/download",
  authenticate,
  handleDownloadAttachment
);

export default router;
