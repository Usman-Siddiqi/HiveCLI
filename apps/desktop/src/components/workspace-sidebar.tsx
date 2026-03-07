import { FolderRoot, Plus } from "lucide-react";

import type { Workspace } from "@hive/shared";

import { Button } from "@/components/ui/button";
import { cn, truncateMiddle } from "@/lib/utils";

export function WorkspaceSidebar({
  workspaces,
  activeWorkspaceId,
  onSelect,
  onCreate,
}: {
  workspaces: Workspace[];
  activeWorkspaceId?: string;
  onSelect: (workspaceId: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="panel rounded-[28px] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent-secondary)]">
            Workspaces
          </div>
          <h2 className="mt-1 text-lg font-semibold">Active Projects</h2>
        </div>
        <Button size="sm" onClick={onCreate}>
          <Plus className="mr-1 h-4 w-4" />
          New
        </Button>
      </div>

      <div className="space-y-2">
        {workspaces.map((workspace) => (
          <button
            key={workspace.id}
            onClick={() => onSelect(workspace.id)}
            className={cn(
              "w-full rounded-2xl border px-3 py-3 text-left transition",
              workspace.id === activeWorkspaceId
                ? "border-[var(--border-strong)] bg-[var(--accent-secondary)]/10"
                : "border-[var(--border)] bg-black/10 hover:border-[var(--border-strong)] hover:bg-white/4",
            )}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <FolderRoot className="h-4 w-4 text-[var(--accent)]" />
              {workspace.name}
            </div>
            <div className="mt-1 text-xs text-[var(--muted)]">
              {truncateMiddle(workspace.rootPath)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
