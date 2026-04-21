import { registerHandler } from "./job.queue";
import { logger } from "../middleware/logger.middleware";

export function initializeHandlers(): void {
  registerHandler("report-created", async (payload) => {
    logger.info({
      type: "notification_sent",
      reportId: payload.reportId,
      businessKey: payload.businessKey,
      message: "Report creation notification dispatched",
    });
  });
}
