import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FolderTree, PencilLine, Sparkles, Target, TriangleAlert } from "lucide-react";

import type { WorkspaceRootStatus } from "@/lib/api";
import type { CurrentTaskPaths } from "@/stores/app-store";
import { pickDirectory } from "@/lib/directory-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/dialog";

interface WorkspaceDirectoryControlProps {
  workspaceName?: string;
  rootStatus?: WorkspaceRootStatus;
  taskPaths?: CurrentTaskPaths;
  onUpdateRoot: (rootPath: string) => Promise<void>;
}

function compactPath(value?: string | null) {
  if (!value) {
    return "No directory selected";
  }

  return value.length > 96 ? `...${value.slice(-93)}` : value;
}

export function WorkspaceDirectoryControl({
  workspaceName,
  rootStatus,
  taskPaths,
  onUpdateRoot,
}: WorkspaceDirectoryControlProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [manualPath, setManualPath] = useState(rootStatus?.rootPath ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setManualPath(rootStatus?.rootPath ?? "");
  }, [rootStatus?.rootPath]);

  const rootValid = rootStatus?.valid ?? false;
  const resolvedPath = rootStatus?.resolvedPath ?? rootStatus?.rootPath ?? "";
  const projectLabel = rootValid ? "Ready for folder-backed runs" : "Select a valid project directory";
  const runRoot = taskPaths?.runRootDir;
  const sourceDir = taskPaths?.sourceDir;
  const publishDir = taskPaths?.publishDir;
  const publishSource = taskPaths?.publishSource;
  const artifactCount = taskPaths?.artifactPaths?.length ?? 0;

  const statusTone = useMemo(
    () =>
      rootValid
        ? {
            icon: CheckCircle2,
            className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
            label: "Directory ready",
          }
        : {
            icon: TriangleAlert,
            className: "bg-amber-500/10 text-amber-200 border-amber-500/20",
            label: rootStatus?.rootPath ? "Directory invalid" : "Directory missing",
          },
    [rootStatus?.rootPath, rootValid],
  );

  async function handleDesktopPick() {
    const selected = await pickDirectory();
    if (!selected) {
      setDialogOpen(true);
      return;
    }

    setManualPath(selected);
    setSaving(true);
    try {
      await onUpdateRoot(selected);
    } finally {
      setSaving(false);
    }
  }

  async function handleManualSave() {
    const nextPath = manualPath.trim();
    if (!nextPath) {
      return;
    }

    setSaving(true);
    try {
      await onUpdateRoot(nextPath);
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const StatusIcon = statusTone.icon;

  return (
    <>
      <div className="workspace-rail">
        <div className="workspace-rail-card workspace-rail-card-primary">
          <div className="workspace-rail-heading">
            <div className="workspace-rail-icon">
              <FolderTree className="h-4 w-4" />
            </div>
            <div>
              <div className="workspace-rail-label">Project Directory</div>
              <div className="workspace-rail-caption">
                {workspaceName ?? "Workspace"} · {projectLabel}
              </div>
            </div>
          </div>

          <div className="workspace-rail-path" data-testid="workspace-root-path">
            {compactPath(resolvedPath)}
          </div>

          <div className={`workspace-rail-status ${statusTone.className}`}>
            <StatusIcon className="h-3.5 w-3.5" />
            <span>{statusTone.label}</span>
          </div>

          <div className="workspace-rail-actions">
            <Button
              type="button"
              size="sm"
              onClick={() => void handleDesktopPick()}
              disabled={saving}
            >
              <FolderTree className="h-3.5 w-3.5" />
              {rootStatus?.rootPath ? "Change Directory" : "Select Directory"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setDialogOpen(true)}
              disabled={saving}
            >
              <PencilLine className="h-3.5 w-3.5" />
              Enter Path
            </Button>
          </div>
        </div>

        <div className="workspace-rail-card">
          <div className="workspace-rail-heading">
            <div className="workspace-rail-icon workspace-rail-icon-run">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="workspace-rail-label">Current Run</div>
              <div className="workspace-rail-caption">Fresh worker, judge, and implementer folders</div>
            </div>
          </div>
          <div className="workspace-rail-path" data-testid="current-run-path">
            {compactPath(runRoot)}
          </div>
          <div className="workspace-rail-caption workspace-rail-caption-secondary">
            Source snapshot: {compactPath(sourceDir)}
          </div>
        </div>

        <div className="workspace-rail-card">
          <div className="workspace-rail-heading">
            <div className="workspace-rail-icon workspace-rail-icon-publish">
              <Target className="h-4 w-4" />
            </div>
            <div>
              <div className="workspace-rail-label">Publish Target</div>
              <div className="workspace-rail-caption">Where the final accepted result will be copied</div>
            </div>
          </div>
          <div className="workspace-rail-path" data-testid="publish-path">
            {compactPath(publishDir)}
          </div>
          <div className="workspace-rail-caption workspace-rail-caption-secondary">
            Publish source: {compactPath(publishSource)}{artifactCount > 0 ? ` · ${artifactCount} artifacts` : ""}
          </div>
        </div>
      </div>

      <Modal
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Set project directory"
        description="Desktop mode uses the native picker. In browser/dev mode, paste the absolute path you want this workspace to use."
      >
        <div className="space-y-4">
          <label className="block text-sm">
            <div className="mb-2 text-[var(--muted)]">Absolute project path</div>
            <Input
              value={manualPath}
              onChange={(event) => setManualPath(event.target.value)}
              placeholder="C:\\Users\\your-name\\Documents\\Code\\project"
            />
          </label>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] p-4 text-sm text-[var(--muted)]">
            The orchestrator will validate the path and only enable the run button when it exists and
            is a directory.
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleManualSave()} disabled={saving || !manualPath.trim()}>
              Save Directory
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
