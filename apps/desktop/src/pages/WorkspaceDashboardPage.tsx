import { useState } from "react";
import { ArrowRight, FolderInput } from "lucide-react";
import { Link } from "react-router-dom";

import { useAppStore } from "@/stores/app-store";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WorkspaceDashboardPage() {
  const { workspaces, createWorkspace } = useAppStore((state) => ({
    workspaces: state.workspaces,
    createWorkspace: state.createWorkspace,
  }));
  const [name, setName] = useState("");
  const [rootPath, setRootPath] = useState("");

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="control-panel grid-surface p-8">
        <p className="signal-label">Workspace Boot</p>
        <h2 className="mt-3 font-display text-5xl font-semibold text-white">
          Run a council, not a single chat tab.
        </h2>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          HiveCLI is a desktop control room for multiple CLI agents. Point a workspace at a real project directory,
          register Codex and Gemini agents, then watch the swarm stream live.
        </p>

        <div className="mt-10 grid gap-4 rounded-[2rem] border border-line bg-slate-950/45 p-6">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-400">Workspace name</span>
            <Input onChange={(event) => setName(event.target.value)} placeholder="Client platform refactor" value={name} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-400">Root path</span>
            <Input
              onChange={(event) => setRootPath(event.target.value)}
              placeholder={"C:\\Users\\your-name\\Documents\\Code\\project"}
              value={rootPath}
            />
          </label>
          <div className="flex justify-end">
            <Button onClick={() => void createWorkspace({ name, rootPath })}>
              <FolderInput className="mr-2 h-4 w-4" />
              Create Workspace
            </Button>
          </div>
        </div>
      </section>

      <section className="control-panel p-6">
        <p className="signal-label">Existing Rooms</p>
        <h3 className="font-display text-3xl font-semibold text-white">Recent Workspaces</h3>
        <div className="mt-6 space-y-4">
          {workspaces.map((workspace) => (
            <Link
              className="flex items-center justify-between rounded-[1.5rem] border border-line bg-slate-950/35 px-5 py-4 transition hover:bg-white/5"
              key={workspace.id}
              to={`/workspaces/${workspace.id}`}
            >
              <div>
                <p className="font-medium text-white">{workspace.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">{workspace.rootPath}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-pulse" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
