import { spawnSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import * as pty from "node-pty";

import type { AgentDefinition, AgentRunRequest } from "@hive/shared";

import { sanitizeFinalText } from "../utils/ansi";
import type { AdapterEventHandlers, AgentAdapter, RunningAdapter } from "./base";

function interpolateValue(value: string, request: AgentRunRequest) {
  return value
    .replaceAll("{{prompt}}", request.prompt)
    .replaceAll("{{sessionId}}", request.sessionId)
    .replaceAll("{{taskId}}", request.taskId)
    .replaceAll("{{workspaceRoot}}", request.workspaceRoot)
    .replaceAll("{{sourceDir}}", request.sourceDir ?? "")
    .replaceAll("{{workingDir}}", request.workingDir ?? "")
    .replaceAll("{{runRootDir}}", request.runRootDir ?? "")
    .replaceAll("{{publishDir}}", request.publishDir ?? "");
}

function interpolateArgs(args: string[] | undefined, request: AgentRunRequest) {
  return (args ?? []).map((arg) => interpolateValue(arg, request));
}

function quoteForCmd(value: string) {
  const needsQuotes = /[\s"&()<>^|]/.test(value) || value.includes("\n") || value.includes("\r");
  if (!needsQuotes) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function resolveWindowsCommand(command: string, cwd: string, env: NodeJS.ProcessEnv) {
  const extension = path.extname(command).toLowerCase();
  if (command.includes("\\") || command.includes("/") || extension) {
    return command;
  }

  const result = spawnSync("where.exe", [command], {
    cwd,
    env,
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.status !== 0) {
    return command;
  }

  const matches = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (matches.length === 0) {
    return command;
  }

  const rank = (match: string) => {
    const extension = path.extname(match).toLowerCase();
    const isWindowsApps = match.toLowerCase().includes("\\windowsapps\\");

    if (!isWindowsApps && [".exe", ".com"].includes(extension)) return 0;
    if (!isWindowsApps && [".cmd", ".bat"].includes(extension)) return 1;
    if (!isWindowsApps) return 2;
    if ([".exe", ".com"].includes(extension)) return 3;
    if ([".cmd", ".bat"].includes(extension)) return 4;
    return 5;
  };

  return [...matches].sort((left, right) => rank(left) - rank(right))[0];
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
    const isWindows = process.platform === "win32";
    const shouldUseCodexPromptFile = isWindows && agent.provider === "codex" && (agent.args ?? []).some((arg) => arg.includes("{{prompt}}"));
    const tempPromptFile = shouldUseCodexPromptFile
      ? path.join(os.tmpdir(), `hivecli-prompt-${request.taskId}-${request.agentId}.txt`)
      : null;

    if (tempPromptFile) {
      writeFileSync(tempPromptFile, request.prompt, "utf8");
    }

    const args = shouldUseCodexPromptFile
      ? (agent.args ?? []).map((arg) => (arg.includes("{{prompt}}") ? "-" : interpolateValue(arg, request)))
      : interpolateArgs(agent.args, request);
    const hasPromptPlaceholder = [command, ...args].some((part) => part.includes(request.prompt));

    handlers.onStatus("running");

    const effectiveCwd = request.workingDir || agent.cwd || request.workspaceRoot;

    // On Windows, node-pty cannot resolve PATH on its own, so we spawn
    // through a resolved executable path when possible. Codex uses a
    // temp prompt file + stdin redirection to preserve multiline prompts.
    const runtimeEnv = {
      ...process.env,
      ...(agent.env ?? {}),
    };

    let spawnCommand = command;
    let spawnArgs = args;

    if (isWindows) {
      const resolvedCommand = resolveWindowsCommand(command, effectiveCwd, runtimeEnv);
      const resolvedExtension = path.extname(resolvedCommand).toLowerCase();
      const shouldSpawnDirectly =
        [".exe", ".com"].includes(resolvedExtension) ||
        command.includes("\\") ||
        command.includes("/") ||
        Boolean(path.extname(command));
      const isWindowsAppsBinary = resolvedCommand.toLowerCase().includes("\\windowsapps\\");

      if (shouldSpawnDirectly && !isWindowsAppsBinary) {
        spawnCommand = resolvedCommand;
      } else {
        spawnCommand = "cmd.exe";
        const redirect = tempPromptFile ? ` < ${quoteForCmd(tempPromptFile)}` : "";
        spawnArgs = ["/d", "/c", `call ${quoteForCmd(resolvedCommand)} ${args.map(quoteForCmd).join(" ")}${redirect}`];
      }
    }

    const ptyProcess = pty.spawn(spawnCommand, spawnArgs, {
      name: "xterm-color",
      cols: 120,
      rows: 40,
      cwd: effectiveCwd,
      env: runtimeEnv,
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
        handlers.onFinal(sanitizeFinalText(stdoutBuffer, agent.provider));
        if (tempPromptFile) {
          try {
            unlinkSync(tempPromptFile);
          } catch {
            // Ignore prompt file cleanup failures.
          }
        }
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
        if (tempPromptFile) {
          try {
            unlinkSync(tempPromptFile);
          } catch {
            // Ignore prompt file cleanup failures.
          }
        }
      },
    };
  }
}
