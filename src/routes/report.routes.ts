import { Router } from "express";
import { authorize, authenticate } from "../middleware/auth.middleware";
import { handleCreateReport } from "../controllers/report.controller";

const router = Router();

// POST /reports — only editors and admins
router.post(
  "/",
  authenticate,
  authorize(["editor", "admin"]),
  handleCreateReport
);

export default router;
