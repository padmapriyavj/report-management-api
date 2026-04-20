import express from "express";
import helmet from "helmet";

const app = express();

app.use(helmet());

app.use(express.json());

//health check endpoint

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default app;
