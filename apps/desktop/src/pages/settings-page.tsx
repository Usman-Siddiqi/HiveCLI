import { useState } from "react";
import { Pencil, Terminal } from "lucide-react";

import type { AgentDefinition } from "@hive/shared";

import { AgentConfigModal } from "@/components/agent-config-modal";
import { useAppStore } from "@/stores/app-store";

export function SettingsPage() {
  const workspaceDetail = useAppStore((state) => state.workspaceDetail);
  const runningTask = useAppStore((state) => state.runningTask);
  const [editing, setEditing] = useState<AgentDefinition>();
  const agents = workspaceDetail?.agents ?? [];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Agents</h1>
          <p className="page-description">Configure the local CLI commands for this workspace. Each CLI uses its own sign-in and model settings.</p>
        </div>
      </div>
      {runningTask ? <p className="settings-note" role="status">Agent settings can be edited after the run finishes.</p> : null}
      <div className="agent-table">
        {agents.length === 0 ? <p className="settings-note">No agents configured.</p> : null}
        {agents.map((agent) => (
          <article key={agent.id} className="agent-row">
            <span className="stage-icon"><Terminal size={17} strokeWidth={1.8} aria-hidden="true" /></span>
            <div className="agent-identity">
              <h2>{agent.name}</h2>
              <p>{agent.provider}{agent.enabled ? "" : " · Disabled"}</p>
            </div>
            <code title={[agent.command, ...(agent.args ?? [])].filter(Boolean).join(" ")}>
              {[agent.command, ...(agent.args ?? [])].filter(Boolean).join(" ") || "No command set"}
            </code>
            <button type="button" className="quiet-button" aria-label={`Edit ${agent.name}`} disabled={runningTask} onClick={() => setEditing(agent)}>
              <Pencil size={14} aria-hidden="true" /> Edit
            </button>
          </article>
        ))}
      </div>
      {editing ? (
        <AgentConfigModal existingAgent={editing} open onOpenChange={(open) => { if (!open) setEditing(undefined); }} />
      ) : null}
    </>
  );
}
