import type { Workspace } from "@hive/shared";
import { Bot, FolderKanban, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";

import { truncateMiddle } from "@/lib/utils";

interface WorkspaceSidebarProps {
  workspaces: Workspace[];
  activeWorkspaceId?: string;
  onSelect: (workspaceId: string) => void;
}

export function WorkspaceSidebar({ workspaces, activeWorkspaceId, onSelect }: WorkspaceSidebarProps) {
  return (
    <aside className="control-panel grid-surface flex h-full flex-col p-4">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-pulse/30 bg-pulse/10 text-pulse">
          <Bot className="h-6 w-6" />
        </div>
        <div>
          <p className="signal-label">HiveCLI</p>
          <h1 className="font-display text-3xl font-semibold text-white">Control Room</h1>
        </div>
      </div>

      <div className="flex-1 space-y-2">
        <p className="signal-label">Workspaces</p>
        {workspaces.map((workspace) => (
          <button
            className={`w-full rounded-[1.35rem] border px-4 py-3 text-left transition ${
              workspace.id === activeWorkspaceId
                ? "border-pulse/50 bg-pulse/10 text-white"
                : "border-line bg-slate-950/35 text-slate-300 hover:bg-white/5"
            }`}
            key={workspace.id}
            onClick={() => onSelect(workspace.id)}
            type="button"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{workspace.name}</span>
              <FolderKanban className="h-4 w-4 text-haze" />
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">
              {truncateMiddle(workspace.rootPath)}
            </p>
          </button>
        ))}
      </div>

      <Link
        className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-line bg-slate-950/45 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/5"
        to="/settings"
      >
        <Settings2 className="h-4 w-4" />
        App Settings
      </Link>
    </aside>
  );
}
