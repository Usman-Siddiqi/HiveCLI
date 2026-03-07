import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { SessionList } from "@/components/session-list";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app-store";

export function DashboardPage() {
  const navigate = useNavigate();
  const { workspaces, workspaceDetail, sessions, loadWorkspace, loadSession, boot } = useAppStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rootPath, setRootPath] = useState("");

  async function handleCreate() {
    await api.createWorkspace({ name, rootPath });
    setName("");
    setRootPath("");
    setOpen(false);
    await boot();
  }

  return (
    <div className="grid h-full gap-5 xl:grid-cols-[340px_1fr]">
      <div className="space-y-5">
        <WorkspaceSidebar
          workspaces={workspaces}
          activeWorkspaceId={workspaceDetail?.workspace.id}
          onSelect={(workspaceId) => void loadWorkspace(workspaceId)}
          onCreate={() => setOpen(true)}
        />
        <SessionList
          sessions={sessions}
          onOpen={(sessionId) => {
            void loadSession(sessionId);
            navigate("/swarm");
          }}
        />
      </div>

      <div className="panel rounded-[32px] p-6">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-[0.3em] text-[var(--accent)]">MVP Status</div>
          <h2 className="mt-3 text-4xl font-semibold">
            Broadcast prompts across several terminal-backed agents from one desktop workspace.
          </h2>
          <p className="mt-4 text-base leading-7 text-[var(--muted)]">
            Create a directory-backed workspace, attach Codex CLI or Gemini CLI agents, stream their
            output in parallel, and reopen prior sessions without losing the event timeline.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ["Parallel agents", "Run 2 to 4 terminal agents in the same session."],
              ["Council mode", "Auto-run a judge after all selected agents finish."],
              ["Replayable history", "Persist sessions, runs, events, and final output."],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-[24px] border border-[var(--border)] bg-black/10 p-4">
                <div className="text-sm font-medium">{title}</div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{copy}</p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Button onClick={() => navigate("/swarm")}>Open Swarm View</Button>
          </div>
        </div>
      </div>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Create Workspace"
        description="Each workspace maps to one local root directory. Agents inherit this root as their default working directory."
      >
        <div className="space-y-4">
          <label className="text-sm">
            <div className="mb-2 text-[var(--muted)]">Workspace name</div>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="text-sm">
            <div className="mb-2 text-[var(--muted)]">Root path</div>
            <Input value={rootPath} onChange={(event) => setRootPath(event.target.value)} placeholder="C:\\Users\\you\\Code\\project" />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || !rootPath.trim()}>
            Create
          </Button>
        </div>
      </Modal>
    </div>
  );
}
