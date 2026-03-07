import { Bot, Gauge, ShieldAlert, SquareTerminal } from "lucide-react";

import type { AgentDefinition, AgentRun } from "@hive/shared";

import { formatTime } from "@/lib/utils";

import { ResponsePane } from "./response-pane";
import { TerminalPane } from "./terminal-pane";

export function AgentPanel({
  agent,
  run,
  output,
  selected,
  onToggle,
}: {
  agent: AgentDefinition;
  run?: AgentRun;
  output?: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <section className={`surface rounded-xl p-4 transition-colors ${selected ? "border-[color:var(--accent)]" : ""}`}>
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                selected
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
              }`}
            >
              {selected ? "Selected" : "Standby"}
            </button>
            <span className="meta-chip">
              {agent.provider}
            </span>
            {agent.shellAccess ? (
              <span className="meta-chip text-[var(--warning)]">
                Shell Access
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 text-lg font-semibold">{agent.name}</h3>
          <dl className="mt-3 grid gap-1 text-xs text-[var(--muted)]">
            <div className="grid grid-cols-[84px_1fr] gap-3">
              <dt>Command</dt>
              <dd className="terminal-font text-[var(--text)]">
                {agent.command} {(agent.args ?? []).join(" ")}
              </dd>
            </div>
            <div className="grid grid-cols-[84px_1fr] gap-3">
              <dt>Working dir</dt>
              <dd>{agent.cwd ?? "workspace root"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-right text-xs text-[var(--muted)]">
          <div className="flex items-center justify-end gap-2">
            <Gauge className="h-4 w-4 text-[var(--accent)]" />
            {run?.status ?? "idle"}
          </div>
          <div className="mt-2">Finished {formatTime(run?.finishedAt)}</div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3 text-xs text-[var(--muted)]">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-[var(--accent-secondary)]" />
            Type
          </div>
          <div className="mt-2 text-[var(--text)]">{agent.type}</div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2">
          <div className="flex items-center gap-2">
            <SquareTerminal className="h-4 w-4 text-[var(--accent)]" />
            Exit
          </div>
          <div className="mt-2 text-[var(--text)]">{run?.exitCode ?? "—"}</div>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-[var(--warning)]" />
            Judge
          </div>
          <div className="mt-2 text-[var(--text)]">{agent.canJudge ? "Eligible" : "No"}</div>
        </div>
      </div>

      <div className="space-y-3">
        <TerminalPane output={output ?? ""} />
        <ResponsePane text={run?.finalText} />
      </div>
    </section>
  );
}
