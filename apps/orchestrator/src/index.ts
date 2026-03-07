import http from "node:http";
import express from "express";

import { config } from "./config";
import { bootstrapDatabase } from "./db/bootstrap";
import { createDatabase } from "./db/client";
import { Repository } from "./db/repository";
import { createApiRouter } from "./routes/api";
import { TaskService } from "./sessions/task-service";
import { EventHub } from "./ws/hub";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  const database = createDatabase();
  bootstrapDatabase(database.sqlite);
  const repository = new Repository(database.db);

  const server = http.createServer(app);
  const hub = new EventHub(server);
  const taskService = new TaskService(repository, hub);
  const apiRouter = createApiRouter(repository, taskService);

  app.use(apiRouter);

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      response.status(500).send(message);
    },
  );

  return { app, server, repository, taskService };
}

if (process.env.NODE_ENV !== "test") {
  const { server } = createApp();
  server.listen(config.port, config.host, () => {
    console.log(`HiveCLI orchestrator listening on http://${config.host}:${config.port}`);
  });
}
