import { useState } from "react";

import type { AgentDefinition } from "@hive/shared";

import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app-store";

import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import { Input } from "./ui/input";

export function AgentConfigModal({
  open,
  onOpenChange,
  existingAgent,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  existingAgent: AgentDefinition;
}) {
  const loadWorkspace = useAppStore((state) => state.loadWorkspace);
  const [command, setCommand] = useState(existingAgent.command ?? "");
  const [args, setArgs] = useState(JSON.stringify(existingAgent.args ?? [], null, 2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!command.trim() || saving) return;

    let parsedArgs: unknown;
    try {
      parsedArgs = JSON.parse(args);
    } catch {
      setError("Enter the arguments as a valid JSON array.");
      return;
    }
    if (!Array.isArray(parsedArgs) || !parsedArgs.every((argument) => typeof argument === "string")) {
      setError("Each argument must be a string.");
      return;
    }

    setError(undefined);
    setSaving(true);
    try {
      await api.updateAgent(existingAgent.id, { command: command.trim(), args: parsedArgs });
      await loadWorkspace(existingAgent.workspaceId);
      onOpenChange(false);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Could not save the agent.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => { if (!saving) onOpenChange(next); }}
      title={`Edit ${existingAgent.name}`}
      description="Use a CLI you trust. HiveCLI launches it inside the agent’s run directory."
    >
      <form onSubmit={handleSave} className="agent-form">
        <label className="form-field">
          <span>Executable</span>
          <Input value={command} onChange={(event) => setCommand(event.target.value)} spellCheck={false} required />
        </label>
        <label className="form-field">
          <span>Arguments</span>
          <textarea className="argument-editor" value={args} onChange={(event) => setArgs(event.target.value)} rows={9} spellCheck={false} />
          <span className="muted">Enter one JSON string per argument. Use <code>{"{{prompt}}"}</code> where the task brief belongs.</span>
        </label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!command.trim() || saving}>{saving ? "Saving…" : "Save agent"}</Button>
        </div>
      </form>
    </Modal>
  );
}
