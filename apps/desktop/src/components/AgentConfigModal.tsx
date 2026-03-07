import { useEffect, useMemo, useState } from "react";

import type { AgentDefinition, SaveAgentInput } from "@hive/shared";

import type { BootstrapPayload } from "@/types/app";

import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Input } from "./ui/input";

interface AgentConfigModalProps {
  open: boolean;
  workspaceId?: string;
  templates: BootstrapPayload["agentTemplates"];
  agents: AgentDefinition[];
  onClose: () => void;
  onSave: (input: SaveAgentInput) => Promise<void>;
  onDelete: (agentId: string) => Promise<void>;
}

const emptyForm = {
  id: undefined as string | undefined,
  templateId: "codex-cli",
  name: "",
  provider: "codex",
  command: "codex",
  args: "",
  cwd: "",
  canJudge: false,
};

export function AgentConfigModal({
  open,
  workspaceId,
  templates,
  agents,
  onClose,
  onSave,
  onDelete,
}: AgentConfigModalProps) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
    }
  }, [open]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === form.templateId),
    [form.templateId, templates],
  );

  function hydrateTemplate(templateId: string) {
    const template = templates.find((entry) => entry.id === templateId);
    if (!template) {
      return;
    }

    setForm((current) => ({
      ...current,
      templateId,
      name: current.name || template.name,
      provider: template.provider,
      command: template.command,
      args: template.args.join(" "),
    }));
  }

  async function handleSave() {
    if (!workspaceId) {
      return;
    }

    await onSave({
      id: form.id,
      workspaceId,
      name: form.name,
      type: "cli",
      provider: form.provider,
      command: form.command,
      args: form.args.split(" ").filter(Boolean),
      cwd: form.cwd,
      env: {},
      enabled: true,
      canJudge: form.canJudge,
    });
    onClose();
  }

  return (
    <Dialog
      description="Built-in presets cover Codex CLI, Gemini CLI, and a raw custom command. All agents are shell-visible."
      onClose={onClose}
      open={open}
      title="Agent Configuration"
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-3">
          <p className="signal-label">Existing Agents</p>
          {agents.map((agent) => (
            <div className="rounded-[1.5rem] border border-line bg-slate-950/35 p-4" key={agent.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-white">{agent.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.25em] text-slate-500">{agent.command}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      setForm({
                        id: agent.id,
                        templateId: `${agent.provider}-cli`,
                        name: agent.name,
                        provider: agent.provider,
                        command: agent.command ?? "",
                        args: agent.args.join(" "),
                        cwd: agent.cwd ?? "",
                        canJudge: agent.canJudge,
                      })
                    }
                    type="button"
                    variant="outline"
                  >
                    Edit
                  </Button>
                  <Button onClick={() => void onDelete(agent.id)} type="button" variant="danger">
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-[1.75rem] border border-line bg-slate-950/35 p-5">
          <p className="signal-label">Agent Form</p>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm text-slate-400">Template</span>
              <select
                className="w-full rounded-2xl border border-line bg-slate-950/80 px-4 py-3 text-sm"
                onChange={(event) => hydrateTemplate(event.target.value)}
                value={form.templateId}
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-400">Name</span>
              <Input onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} value={form.name} />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-400">Command</span>
              <Input onChange={(event) => setForm((current) => ({ ...current, command: event.target.value }))} value={form.command} />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-400">Arguments</span>
              <Input onChange={(event) => setForm((current) => ({ ...current, args: event.target.value }))} value={form.args} />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-400">Working Directory</span>
              <Input onChange={(event) => setForm((current) => ({ ...current, cwd: event.target.value }))} value={form.cwd} />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-line bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
              <input
                checked={form.canJudge}
                onChange={(event) => setForm((current) => ({ ...current, canJudge: event.target.checked }))}
                type="checkbox"
              />
              Allow this agent to act as the council judge.
            </label>

            {selectedTemplate ? <p className="text-sm text-slate-500">{selectedTemplate.description}</p> : null}

            <div className="flex justify-end gap-3">
              <Button onClick={onClose} type="button" variant="ghost">
                Cancel
              </Button>
              <Button onClick={() => void handleSave()} type="button">
                Save Agent
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
