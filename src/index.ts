import app from "./app";
import { config } from "./config";
import { logger } from "./middleware/logger.middleware";

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, "MedLaunch API running");
});

export default server;
