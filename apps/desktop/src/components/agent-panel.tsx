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
    <section className={`panel rounded-[28px] p-4 transition ${selected ? "border-[var(--border-strong)]" : ""}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] transition ${
                selected
                  ? "border-[var(--border-strong)] bg-[var(--accent)]/10 text-[var(--text)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              {selected ? "Armed" : "Idle"}
            </button>
            <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
              {agent.provider}
            </span>
            {agent.shellAccess ? (
              <span className="rounded-full border border-[color:rgba(255,201,120,0.24)] px-3 py-1 text-xs text-[var(--warning)]">
                Shell Access
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 text-lg font-semibold">{agent.name}</h3>
          <div className="mt-1 text-xs text-[var(--muted)]">
            {agent.command} {(agent.args ?? []).join(" ")}
          </div>
          <div className="mt-1 text-xs text-[var(--muted)]">cwd: {agent.cwd ?? "workspace root"}</div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-black/10 px-3 py-2 text-right text-xs text-[var(--muted)]">
          <div className="flex items-center justify-end gap-2">
            <Gauge className="h-4 w-4 text-[var(--accent)]" />
            {run?.status ?? "idle"}
          </div>
          <div className="mt-2">Finished {formatTime(run?.finishedAt)}</div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 text-xs text-[var(--muted)]">
        <div className="rounded-2xl border border-[var(--border)] bg-black/10 px-3 py-2">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-[var(--accent-secondary)]" />
            Type
          </div>
          <div className="mt-2 text-[var(--text)]">{agent.type}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-black/10 px-3 py-2">
          <div className="flex items-center gap-2">
            <SquareTerminal className="h-4 w-4 text-[var(--accent)]" />
            Exit
          </div>
          <div className="mt-2 text-[var(--text)]">{run?.exitCode ?? "—"}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-black/10 px-3 py-2">
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
