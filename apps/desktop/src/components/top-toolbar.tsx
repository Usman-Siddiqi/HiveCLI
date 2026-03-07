import { Activity, PlugZap, ShieldAlert } from "lucide-react";

import type { WorkspaceDetail } from "@hive/shared";

import { Button } from "@/components/ui/button";

export function TopToolbar({
  workspaceDetail,
  connectionState,
  onManageAgents,
}: {
  workspaceDetail?: WorkspaceDetail;
  connectionState: "idle" | "connecting" | "open" | "closed";
  onManageAgents: () => void;
}) {
  return (
    <div className="panel rounded-[28px] px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
            Control Room
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {workspaceDetail?.workspace.name ?? "No workspace selected"}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
            <span className="rounded-full border border-[var(--border)] px-3 py-1">
              {workspaceDetail?.agents.length ?? 0} agents
            </span>
            <span className="rounded-full border border-[var(--border)] px-3 py-1">
              {workspaceDetail?.sessions.length ?? 0} saved sessions
            </span>
            <span className="rounded-full border border-[var(--border)] px-3 py-1">
              Shell access visible
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-[var(--border)] bg-black/10 px-4 py-2 text-sm">
            <div className="flex items-center gap-2">
              <PlugZap className="h-4 w-4 text-[var(--accent-secondary)]" />
              Sidecar: {connectionState}
            </div>
          </div>
          <div className="rounded-full border border-[var(--border)] bg-black/10 px-4 py-2 text-sm">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[var(--accent)]" />
              Streaming ready
            </div>
          </div>
          <Button variant="secondary" onClick={onManageAgents}>
            <ShieldAlert className="mr-2 h-4 w-4" />
            Manage Agents
          </Button>
        </div>
      </div>
    </div>
  );
}
