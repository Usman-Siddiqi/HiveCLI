import { useState } from "react";
import { FolderGit2, Pencil } from "lucide-react";

import type { WorkspaceRootStatus } from "@/lib/api";
import { pickDirectory } from "@/lib/directory-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/dialog";

interface WorkspaceDirectoryControlProps {
  workspaceName?: string;
  rootStatus?: WorkspaceRootStatus;
  onUpdateRoot: (rootPath: string) => Promise<void>;
  disabled?: boolean;
}

export function WorkspaceDirectoryControl({
  workspaceName,
  rootStatus,
  onUpdateRoot,
  disabled,
}: WorkspaceDirectoryControlProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [manualPath, setManualPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const path = rootStatus?.resolvedPath ?? rootStatus?.rootPath;

  function openEditor() {
    setManualPath(rootStatus?.rootPath ?? "");
    setError(undefined);
    setDialogOpen(true);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const nextPath = manualPath.trim();
    if (!nextPath || saving) return;

    setSaving(true);
    setError(undefined);
    try {
      await onUpdateRoot(nextPath);
      setDialogOpen(false);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Could not save the project directory.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="project-picker"
        onClick={openEditor}
        disabled={disabled}
        aria-label="Change project directory"
      >
        <span className="project-icon"><FolderGit2 size={18} aria-hidden="true" /></span>
        <span className="project-name">
          <strong>{workspaceName ?? "Project directory"}</strong>
          <span data-testid="workspace-root-path" title={path}>{path || "No directory selected"}</span>
        </span>
        <Pencil size={13} aria-hidden="true" />
      </button>

      <Modal
        open={dialogOpen}
        onOpenChange={(open) => { if (!saving) setDialogOpen(open); }}
        title="Project directory"
        description="Choose the folder HiveCLI should copy into each run."
      >
        <form onSubmit={handleSave}>
          <label className="form-field">
            <span>Directory path</span>
            <Input
              value={manualPath}
              onChange={(event) => setManualPath(event.target.value)}
              placeholder="/path/to/project"
              autoComplete="off"
              spellCheck={false}
              required
            />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="form-actions">
            {"__TAURI_INTERNALS__" in window ? (
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  const selected = await pickDirectory();
                  if (selected) setManualPath(selected);
                }}
              >
                Browse
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !manualPath.trim()}>
              {saving ? "Saving…" : "Save directory"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
