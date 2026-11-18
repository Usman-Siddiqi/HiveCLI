import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import * as pty from "node-pty";

import type { AgentDefinition, AgentRunRequest } from "@hive/shared";

import { sanitizeFinalText } from "../utils/ansi";
import type { AdapterEventHandlers, AgentAdapter, RunningAdapter } from "./base";

const MAX_FINAL_CHARS = 256 * 1024;

function interpolateValue(value: string, request: AgentRunRequest) {
  const values: Record<string, string> = {
    prompt: request.prompt,
    sessionId: request.sessionId,
    taskId: request.taskId,
    workspaceRoot: request.workspaceRoot,
    sourceDir: request.sourceDir ?? "",
    workingDir: request.workingDir ?? "",
    runRootDir: request.runRootDir ?? "",
    publishDir: request.publishDir ?? "",
  };
  return value.replace(/\{\{(\w+)\}\}/g, (placeholder, key: string) =>
    Object.hasOwn(values, key) ? values[key] : placeholder,
  );
}

function quoteForCmd(value: string) {
  if (value && !/[\s"&()<>^|]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function resolveWindowsCommand(command: string, env: NodeJS.ProcessEnv) {
  if (command.includes("\\") || command.includes("/")) return command;

  const systemDir = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32");
  const result = spawnSync(path.join(systemDir, "where.exe"), [command], {
    cwd: systemDir,
    env,
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.status !== 0) return command;
  const matches = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const installed = matches.filter((value) => !value.toLowerCase().includes("\\windowsapps\\"));
  const executable = installed.find((value) => /\.(exe|com)$/i.test(value));
  const shim = installed.find((value) => /\.(cmd|bat)$/i.test(value));
  return executable ?? shim ?? matches[0] ?? command;
}

function getSpawnCommand(command: string, args: string[], env: NodeJS.ProcessEnv, usesRequestArguments: boolean) {
  if (process.platform !== "win32") return { command, args, verbatim: false };

  const resolved = resolveWindowsCommand(command, env);
  if (!/\.(cmd|bat)$/i.test(resolved)) return { command: resolved, args, verbatim: false };

  if (usesRequestArguments) {
    throw new Error("Windows batch agents cannot substitute request data into command arguments. Use a native executable or pass the prompt through standard input.");
  }

  const script = [resolved, ...args].map(quoteForCmd).join(" ");
  return {
    command: process.env.ComSpec ?? "cmd.exe",
    args: ["/d", "/s", "/c", `"${script}"`],
    verbatim: true,
  };
}

function recentText(previous: string, chunk: string) {
  return (previous + chunk).slice(-MAX_FINAL_CHARS);
}

function readFinalMessage(file: string | undefined, fallback: string) {
  try {
    if (file && statSync(file).size <= MAX_FINAL_CHARS) {
      const text = readFileSync(file, "utf8").trim();
      if (text) return text;
    }
  } catch {
    // A failed CLI may exit before writing the final message.
  }
  return sanitizeFinalText(fallback, "codex");
}

function runCodex(
  commandTemplate: string,
  configuration: string[],
  request: AgentRunRequest,
  options: { cwd: string; env: NodeJS.ProcessEnv },
  handlers: AdapterEventHandlers,
) {
  const writesOwnMessage = configuration.some((arg) =>
    arg === "-o" || arg.startsWith("-o=") || arg === "--output-last-message" || arg.startsWith("--output-last-message="),
  );
  const tempDir = writesOwnMessage ? undefined : mkdtempSync(path.join(os.tmpdir(), "hivecli-message-"));
  const messageFile = tempDir ? path.join(tempDir, "final.txt") : undefined;
  const cleanup = () => {
    if (!tempDir) return;
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Temporary output cleanup does not affect the completed run.
    }
  };

  const args = configuration.map((arg) => arg === "{{prompt}}" ? "-" : interpolateValue(arg, request));
  if (messageFile) args.splice(1, 0, "--output-last-message", messageFile);

  let child;
  try {
    const usesRequestArguments = /\{\{\w+\}\}/.test(commandTemplate) || configuration.some(
      (arg) => arg !== "{{prompt}}" && /\{\{\w+\}\}/.test(arg),
    );
    const command = interpolateValue(commandTemplate, request);
    const spec = getSpawnCommand(command, args, options.env, usesRequestArguments);
    child = spawn(spec.command, spec.args, {
      ...options,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      windowsVerbatimArguments: spec.verbatim,
    });
  } catch (error) {
    cleanup();
    throw error;
  }

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    stdout = recentText(stdout, chunk);
    handlers.onStdout(chunk);
  });
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    stderr = recentText(stderr, chunk);
    handlers.onStderr(chunk);
  });
  child.on("error", handlers.onError);
  child.stdin.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code !== "EPIPE") handlers.onError(error);
  });
  const done = new Promise<void>((resolve) => {
    child.once("close", (exitCode) => {
      handlers.onExit(exitCode);
      handlers.onFinal(readFinalMessage(messageFile, stdout || stderr));
      cleanup();
      resolve();
    });
  });
  child.stdin.end(request.prompt);
  return { done, stop: async () => { child.kill(); } };
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

    const configuredArgs = agent.args ?? [];
    const options = {
      cwd: request.workingDir || agent.cwd || request.workspaceRoot,
      env: { ...process.env, ...agent.env },
    };

    handlers.onStatus("running");
    if (agent.provider === "codex" && configuredArgs[0] === "exec" && configuredArgs.includes("{{prompt}}")) {
      return runCodex(agent.command!, configuredArgs, request, options, handlers);
    }

    const command = interpolateValue(agent.command!, request);
    const args = configuredArgs.map((arg) => interpolateValue(arg, request));
    const usesRequestArguments = [agent.command!, ...configuredArgs].some((arg) => /\{\{\w+\}\}/.test(arg));
    const spec = getSpawnCommand(command, args, options.env, usesRequestArguments);
    const ptyProcess = pty.spawn(spec.command, spec.verbatim ? spec.args.join(" ") : spec.args, {
      ...options,
      name: "xterm-color",
      cols: 120,
      rows: 40,
    });

    let stdout = "";
    let exited = false;
    const done = new Promise<void>((resolve) => {
      ptyProcess.onData((data) => {
        stdout = recentText(stdout, data);
        handlers.onStdout(data);
      });
      ptyProcess.onExit(({ exitCode, signal }) => {
        exited = true;
        if (signal) handlers.onError(new Error(`Agent was interrupted by signal ${signal}.`));
        handlers.onExit(signal ? null : exitCode);
        handlers.onFinal(sanitizeFinalText(stdout, agent.provider));
        resolve();
      });
    });

    if (![agent.command!, ...configuredArgs].some((part) => part.includes("{{prompt}}"))) {
      try {
        ptyProcess.write(`${request.prompt}\r`);
      } catch (error) {
        handlers.onError(error as Error);
      }
    }

    return {
      done,
      stop: async () => {
        if (!exited) ptyProcess.kill();
      },
    };
  }
}
