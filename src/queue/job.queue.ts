import { logger } from "../middleware/logger.middleware";
import { config } from "../config";

interface Job {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxRetries: number;
  createdAt: string;
  lastError?: string;
}

interface DeadLetterEntry {
  job: Job;
  failedAt: string;
  error: string;
}

const deadLetterQueue: DeadLetterEntry[] = [];

type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

const handlers = new Map<string, JobHandler>();

export function registerHandler(type: string, handler: JobHandler): void {
  handlers.set(type, handler);
}

export async function enqueueJob(
  id: string,
  type: string,
  payload: Record<string, unknown>
): Promise<void> {
  const job: Job = {
    id,
    type,
    payload,
    attempts: 0,
    maxRetries: config.queue.maxRetries,
    createdAt: new Date().toISOString(),
  };

  logger.info({
    type: "job_enqueued",
    jobId: job.id,
    jobType: job.type,
  });

  processJob(job);
}

async function processJob(job: Job): Promise<void> {
  const handler = handlers.get(job.type);

  if (!handler) {
    logger.error({
      type: "job_handler_missing",
      jobId: job.id,
      jobType: job.type,
    });
    return;
  }

  while (job.attempts < job.maxRetries) {
    job.attempts++;

    try {
      await handler(job.payload);

      logger.info({
        type: "job_completed",
        jobId: job.id,
        jobType: job.type,
        attempts: job.attempts,
      });

      return;
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      job.lastError = error;

      logger.warn({
        type: "job_retry",
        jobId: job.id,
        jobType: job.type,
        attempt: job.attempts,
        maxRetries: job.maxRetries,
        error,
      });

      if (job.attempts < job.maxRetries) {
        const delay = config.queue.baseDelayMs * Math.pow(2, job.attempts - 1);
        await sleep(delay);
      }
    }
  }

  const dlqEntry: DeadLetterEntry = {
    job,
    failedAt: new Date().toISOString(),
    error: job.lastError || "Unknown error",
  };

  deadLetterQueue.push(dlqEntry);

  logger.error({
    type: "job_dead_lettered",
    jobId: job.id,
    jobType: job.type,
    attempts: job.attempts,
    error: job.lastError,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getDeadLetterQueue(): DeadLetterEntry[] {
  return [...deadLetterQueue];
}
