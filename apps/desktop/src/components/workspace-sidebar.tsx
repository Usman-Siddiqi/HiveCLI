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
    <section className="surface rounded-xl p-4">
      <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div>
          <h2 className="section-title">Workspaces</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Directory-backed projects and roots.</p>
        </div>
        <Button size="sm" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      <div className="space-y-2">
        {workspaces.map((workspace) => (
          <button
            key={workspace.id}
            onClick={() => onSelect(workspace.id)}
            className={cn(
              "panel-list-button",
              workspace.id === activeWorkspaceId
                ? "panel-list-button-active"
                : "",
            )}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <FolderRoot className="h-4 w-4 text-[var(--accent-secondary)]" />
              {workspace.name}
            </div>
            <div className="mt-1 text-xs text-[var(--muted)]">
              {truncateMiddle(workspace.rootPath)}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
