import express from "express";
import helmet from "helmet";
import { requestLogger } from "./middleware/logger.middleware";
import "./types/express"; // Augment Express types
import reportRoutes from "./routes/report.routes";
import { errorHandler } from "./middleware/error.middleware";
import { initializeHandlers } from "./queue/handlers";

// Register job handlers before processing any requests
initializeHandlers();

const app = express();

// Security headers (HSTS, X-Frame-Options, etc.)
app.use(helmet());

// Parse JSON request bodies
app.use(express.json());

// Log all requests with trace IDs
app.use(requestLogger);

// Mount the report API routes
app.use("/reports", reportRoutes);

// Simple health check for load balancers and monitoring
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Centralized error handler - must be last
app.use(errorHandler);

export default app;
