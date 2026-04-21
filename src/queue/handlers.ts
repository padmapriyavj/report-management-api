import { registerHandler } from "./job.queue";
import { logger } from "../middleware/logger.middleware";

/**
 * Register all job handlers. Call this at app startup.
 */
export function initializeHandlers(): void {
  // Triggered when a new report is created - could send emails, webhooks, etc.
  registerHandler("report-created", async (payload) => {
    logger.info({
      type: "notification_sent",
      reportId: payload.reportId,
      businessKey: payload.businessKey,
      message: "Report creation notification dispatched",
    });
  });
}
