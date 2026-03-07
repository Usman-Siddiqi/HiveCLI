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
    <section className="surface rounded-xl px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[26px] font-semibold tracking-[-0.02em]">
            {workspaceDetail?.workspace.name ?? "No workspace selected"}
          </h2>
          <div className="meta-strip mt-3">
            <span className="meta-chip">
              {workspaceDetail?.agents.length ?? 0} agents
            </span>
            <span className="meta-chip">
              {workspaceDetail?.sessions.length ?? 0} saved sessions
            </span>
            <span className="meta-chip">
              Shell access visible
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="meta-chip text-sm">
            <div className="flex items-center gap-2">
              <PlugZap className="h-4 w-4 text-[var(--accent-secondary)]" />
              Sidecar: {connectionState}
            </div>
          </div>
          <div className="meta-chip text-sm">
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
    </section>
  );
}
