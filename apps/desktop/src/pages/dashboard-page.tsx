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
    <div className="grid h-full gap-6 xl:grid-cols-[340px_1fr]">
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

      <section className="space-y-6">
        <header className="surface rounded-xl px-6 py-5">
          <h2 className="text-[32px] font-semibold tracking-[-0.03em]">Workspace dashboard</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            HiveCLI keeps multi-agent runs visible, replayable, and local. Start with one workspace,
            attach a small roster of CLI agents, then compare raw outputs against a final council
            synthesis before you decide what to keep.
          </p>
          <div className="meta-strip mt-4">
            <span className="meta-chip">{workspaces.length} workspaces</span>
            <span className="meta-chip">{sessions.length} stored sessions</span>
            <span className="meta-chip">Terminal-first adapters</span>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="surface rounded-xl p-5">
            <h3 className="section-title">Current operating model</h3>
            <div className="subtle-rule mt-4" />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[
                [
                  "Broadcast once",
                  "Send one prompt to several agents and compare their transcripts side by side.",
                ],
                [
                  "Judge later",
                  "Run council mode when you want one agent to synthesize the field after the rest finish.",
                ],
                [
                  "Keep the transcript",
                  "Persist task events, final text, and run metadata for replay and audit.",
                ],
                [
                  "Stay local",
                  "Commands, workspaces, and provider settings remain visible inside one desktop workspace.",
                ],
              ].map(([title, copy]) => (
                <article
                  key={title}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] p-4"
                >
                  <h4 className="text-sm font-medium">{title}</h4>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{copy}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="surface rounded-xl p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="section-title">Operator checklist</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Use this flow to validate the MVP quickly.
                </p>
              </div>
              <Button onClick={() => navigate("/swarm")}>Open swarm view</Button>
            </div>
            <ol className="mt-5 space-y-3">
              {[
                "Create a workspace mapped to the local project directory.",
                "Add 2 to 4 agents, including one judge-capable agent if you want council mode.",
                "Run a broadcast prompt and inspect each transcript independently.",
                "Switch to council mode to trigger a final synthesis after all selected agents settle.",
                "Reopen the saved session later from the history view.",
              ].map((item, index) => (
                <li
                  key={item}
                  className="grid grid-cols-[28px_1fr] gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] p-3"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-6 text-[var(--text)]">{item}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </section>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Create workspace"
        description="Each workspace maps to one local root directory. New agents inherit that root as their default working directory."
      >
        <div className="space-y-4">
          <label className="text-sm">
            <div className="mb-2 text-[var(--muted)]">Workspace name</div>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="text-sm">
            <div className="mb-2 text-[var(--muted)]">Root path</div>
            <Input
              value={rootPath}
              onChange={(event) => setRootPath(event.target.value)}
              placeholder="C:\\Users\\you\\Code\\project"
            />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || !rootPath.trim()}>
            Create workspace
          </Button>
        </div>
      </Modal>
    </div>
  );
}
