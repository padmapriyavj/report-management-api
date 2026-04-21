import { Router } from "express";
import { authorize, authenticate } from "../middleware/auth.middleware";
import {
  handleGetReport,
  handleCreateReport,
  handleUpdateReport,
} from "../controllers/report.controller";

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

export default router;
