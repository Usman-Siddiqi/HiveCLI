import * as pty from "node-pty";

import type { AgentDefinition, AgentRunRequest } from "@hive/shared";

import { sanitizeFinalText } from "../utils/ansi";
import type { AdapterEventHandlers, AgentAdapter, RunningAdapter } from "./base";

function interpolateValue(value: string, request: AgentRunRequest) {
  return value
    .replaceAll("{{prompt}}", request.prompt)
    .replaceAll("{{sessionId}}", request.sessionId)
    .replaceAll("{{taskId}}", request.taskId)
    .replaceAll("{{workspaceRoot}}", request.workspaceRoot);
}

function interpolateArgs(args: string[] | undefined, request: AgentRunRequest) {
  return (args ?? []).map((arg) => interpolateValue(arg, request));
}

export class CliAgentAdapter implements AgentAdapter {
  validateConfig(agent: AgentDefinition) {
    if (!agent.command?.trim()) {
      throw new Error(`Agent "${agent.name}" is missing a command.`);
    }
  }

  serializeForReplay(agent: AgentDefinition) {
    return {
      provider: agent.provider,
      command: agent.command,
      args: agent.args ?? [],
      cwd: agent.cwd,
    };
  }

  startRun(
    agent: AgentDefinition,
    request: AgentRunRequest,
    handlers: AdapterEventHandlers,
  ): RunningAdapter {
    this.validateConfig(agent);

    const command = interpolateValue(agent.command!, request);
    const args = interpolateArgs(agent.args, request);
    const hasPromptPlaceholder = [command, ...args].some((part) => part.includes(request.prompt));

    handlers.onStatus("running");

    const ptyProcess = pty.spawn(command, args, {
      name: "xterm-color",
      cols: 120,
      rows: 40,
      cwd: agent.cwd || request.workspaceRoot,
      env: {
        ...process.env,
        ...(agent.env ?? {}),
      },
    });

    let stdoutBuffer = "";
    let exitHandled = false;

    const done = new Promise<void>((resolve) => {
      ptyProcess.onData((data) => {
        stdoutBuffer += data;
        handlers.onStdout(data);
      });

      ptyProcess.onExit(({ exitCode }) => {
        exitHandled = true;
        handlers.onExit(exitCode);
        handlers.onFinal(sanitizeFinalText(stdoutBuffer));
        resolve();
      });
    });

    try {
      if (!hasPromptPlaceholder) {
        ptyProcess.write(`${request.prompt}\r`);
      }
    } catch (error) {
      handlers.onError(error as Error);
    }

    return {
      done,
      stop: async () => {
        if (!exitHandled) {
          ptyProcess.kill();
        }
      },
    };
  }
}
