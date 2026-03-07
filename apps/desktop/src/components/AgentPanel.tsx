import type { AgentDefinition, AgentEvent, AgentRun } from "@hive/shared";
import { Cpu, Play, ShieldAlert, Sparkles } from "lucide-react";

import { formatTime } from "@/lib/utils";

import { ResponsePane } from "./ResponsePane";
import { TerminalPane } from "./TerminalPane";
import { Badge } from "./ui/badge";

interface AgentPanelProps {
  agent: AgentDefinition;
  run?: AgentRun;
  events: AgentEvent[];
}

export function AgentPanel({ agent, run, events }: AgentPanelProps) {
  const streamText = events.map((event) => event.payload).join("");
  const isStreaming = run?.status === "running";

  return (
    <article className="control-panel flex min-h-[28rem] flex-col p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-2xl font-semibold text-white">{agent.name}</h3>
            {isStreaming ? <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-pulse" /> : null}
          </div>
          <p className="mt-2 text-sm text-slate-400">{agent.command || agent.provider}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{agent.provider}</Badge>
          <Badge className="text-pulse">{run?.status ?? "idle"}</Badge>
          <Badge className="border-alert/40 text-alert">
            <ShieldAlert className="mr-2 h-3.5 w-3.5" />
            Shell Access
          </Badge>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-slate-950/35 p-3">
          <p className="signal-label">Started</p>
          <p className="mt-2 text-sm text-slate-200">{formatTime(run?.startedAt)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-slate-950/35 p-3">
          <p className="signal-label">Exit</p>
          <p className="mt-2 text-sm text-slate-200">{run?.exitCode ?? "Running"}</p>
        </div>
        <div className="rounded-2xl border border-line bg-slate-950/35 p-3">
          <p className="signal-label">Mode</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-200">
            {agent.canJudge ? <Sparkles className="h-4 w-4 text-pulse" /> : <Cpu className="h-4 w-4 text-haze" />}
            {agent.canJudge ? "Judge Eligible" : "Worker"}
          </p>
        </div>
      </div>

      <div className="grid flex-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-500">
            <Play className="h-3.5 w-3.5" />
            Live Terminal
          </div>
          <TerminalPane content={streamText} />
        </div>
        <div>
          <div className="mb-2 text-xs uppercase tracking-[0.3em] text-slate-500">Final Transcript</div>
          <ResponsePane content={run?.finalText ?? ""} />
        </div>
      </div>
    </article>
  );
}
