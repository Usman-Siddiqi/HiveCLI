import type { WorkspaceDetail } from "@hive/shared";
import { History, Plus, Shield } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "./ui/button";

interface TopToolbarProps {
  workspace?: WorkspaceDetail;
  onNewSession: () => Promise<void>;
  onOpenAgentModal: () => void;
}

export function TopToolbar({ workspace, onNewSession, onOpenAgentModal }: TopToolbarProps) {
  return (
    <div className="control-panel flex flex-wrap items-center justify-between gap-4 p-4">
      <div>
        <p className="signal-label">Workspace Status</p>
        <h2 className="font-display text-3xl font-semibold text-white">
          {workspace?.workspace.name ?? "No workspace selected"}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {workspace?.workspace.rootPath ?? "Create or select a workspace to activate the swarm."}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void onNewSession()} variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          New Session
        </Button>
        <Button onClick={onOpenAgentModal} variant="ghost">
          <Shield className="mr-2 h-4 w-4" />
          Configure Agents
        </Button>
        {workspace ? (
          <Link to={`/workspaces/${workspace.workspace.id}/history`}>
            <Button variant="ghost">
              <History className="mr-2 h-4 w-4" />
              History
            </Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
