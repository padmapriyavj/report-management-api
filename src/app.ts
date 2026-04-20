import express from "express";
import helmet from "helmet";
import { requestLogger } from "./middleware/logger.middleware";
import "./types/express";

const app = express();

app.use(helmet());

app.use(express.json());

app.use(requestLogger);

//health check endpoint

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default app;
