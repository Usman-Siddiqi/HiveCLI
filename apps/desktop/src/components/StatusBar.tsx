import type { AgentRun } from "@hive/shared";

interface StatusBarProps {
  runs: AgentRun[];
  realtimeConnected: boolean;
}

export function StatusBar({ runs, realtimeConnected }: StatusBarProps) {
  const activeCount = runs.filter((run) => run.status === "running").length;
  const failedCount = runs.filter((run) => run.status === "failed").length;

  return (
    <footer className="control-panel flex flex-wrap items-center justify-between gap-4 px-4 py-3">
      <div className="flex items-center gap-3 text-sm text-slate-300">
        <span className={`h-2.5 w-2.5 rounded-full ${realtimeConnected ? "bg-pulse" : "bg-alert"}`} />
        Event Bus {realtimeConnected ? "connected" : "offline"}
      </div>
      <div className="flex gap-6 text-sm text-slate-400">
        <span>{activeCount} active runs</span>
        <span>{failedCount} failed</span>
        <span>{runs.length} total executions</span>
      </div>
    </footer>
  );
}
