import express from "express";
import helmet from "helmet";
import { requestLogger } from "./middleware/logger.middleware";
import "./types/express";
import reportRoutes from "./routes/report.routes";
import jwt from "jsonwebtoken";
import { config } from "./config";

const app = express();

app.use(helmet());

app.use(express.json());

app.use(requestLogger);

//health check endpoint

app.use("/reports", reportRoutes);

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Temporary: test token generator (remove before submission)
app.post("/auth/token", (req, res) => {
  const { userId, role } = req.body;
  const token = jwt.sign({ userId, role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
  res.json({ token });
});

export default app;
