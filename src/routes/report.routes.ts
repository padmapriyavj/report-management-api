import { Router } from "express";
import { authorize, authenticate } from "../middleware/auth.middleware";
import {
  handleGetReport,
  handleCreateReport,
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

export default router;
