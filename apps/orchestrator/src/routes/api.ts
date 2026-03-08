import express from "express";
import {
  createAgentSchema,
  createWorkspaceSchema,
  runTaskInputSchema,
  updateWorkspaceSchema,
} from "@hive/shared";

import { Repository } from "../db/repository";
import { TaskService } from "../sessions/task-service";
import { getWorkspaceRootStatus } from "../utils/workspace-root";

export function createApiRouter(repository: Repository, taskService: TaskService) {
  const router = express.Router();

  router.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  router.get("/api/workspaces", async (_request, response) => {
    response.json(await repository.listWorkspaces());
  });

  router.post("/api/workspaces", async (request, response) => {
    const input = createWorkspaceSchema.parse(request.body);
    response.status(201).json(await repository.createWorkspace(input));
  });

  router.put("/api/workspaces/:workspaceId", async (request, response) => {
    const input = updateWorkspaceSchema.parse(request.body);
    const value = await repository.updateWorkspace(request.params.workspaceId, input);
    if (!value) {
      response.status(404).send("Workspace not found.");
      return;
    }
    response.json(value);
  });

  router.get("/api/workspaces/:workspaceId", async (request, response) => {
    const value = await repository.getWorkspace(request.params.workspaceId);
    if (!value) {
      response.status(404).send("Workspace not found.");
      return;
    }
    response.json(value);
  });

  router.get("/api/workspaces/:workspaceId/root-status", async (request, response) => {
    const workspace = await repository.getWorkspace(request.params.workspaceId);
    if (!workspace) {
      response.status(404).send("Workspace not found.");
      return;
    }
    response.json(await getWorkspaceRootStatus(workspace.workspace.rootPath));
  });

  router.get("/api/workspaces/:workspaceId/sessions", async (request, response) => {
    response.json(await repository.listSessionSnapshots(request.params.workspaceId));
  });

  router.get("/api/sessions/:sessionId", async (request, response) => {
    const value = await repository.getSessionReplay(request.params.sessionId);
    if (!value) {
      response.status(404).send("Session not found.");
      return;
    }
    response.json(value);
  });

  router.post("/api/agents", async (request, response) => {
    const input = createAgentSchema.parse(request.body);
    response.status(201).json(await repository.createAgent(input));
  });

  router.put("/api/agents/:agentId", async (request, response) => {
    const value = await repository.updateAgent(request.params.agentId, request.body);
    if (!value) {
      response.status(404).send("Agent not found.");
      return;
    }
    response.json(value);
  });

  router.delete("/api/agents/:agentId", async (request, response) => {
    await repository.deleteAgent(request.params.agentId);
    response.json({ ok: true });
  });

  router.post("/api/tasks/run", async (request, response, next) => {
    try {
      const input = runTaskInputSchema.parse(request.body);
      response.status(201).json(await taskService.runTask(input));
    } catch (err) {
      console.error("[tasks/run] Error:", err);
      next(err);
    }
  });

  router.get("/api/settings", async (_request, response) => {
    response.json(await repository.listSettings());
  });

  router.put("/api/settings/:key", async (request, response) => {
    response.json(await repository.upsertSetting(request.params.key, String(request.body.value ?? "")));
  });

  return router;
}
