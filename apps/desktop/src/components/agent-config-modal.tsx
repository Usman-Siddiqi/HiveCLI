import { useState } from "react";

import type { AgentDefinition } from "@hive/shared";

import { api } from "@/lib/api";
import { BUILTIN_AGENT_TEMPLATES, useAppStore } from "@/stores/app-store";

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
  existingAgent?: AgentDefinition;
}) {
  const workspaceDetail = useAppStore((state) => state.workspaceDetail);
  const loadWorkspace = useAppStore((state) => state.loadWorkspace);
  const baseTemplate = BUILTIN_AGENT_TEMPLATES[0];
  const [templateId, setTemplateId] = useState<string>(baseTemplate.id);
  const [name, setName] = useState(existingAgent?.name ?? baseTemplate.name);
  const [provider, setProvider] = useState(existingAgent?.provider ?? baseTemplate.provider);
  const [command, setCommand] = useState(existingAgent?.command ?? baseTemplate.command);
  const [args, setArgs] = useState((existingAgent?.args ?? baseTemplate.args).join(" "));
  const [cwd, setCwd] = useState(existingAgent?.cwd ?? "");
  const [env, setEnv] = useState(
    Object.entries(existingAgent?.env ?? {})
      .map(([key, value]) => `${key}=${value}`)
      .join("\n"),
  );
  const [canJudge, setCanJudge] = useState(existingAgent?.canJudge ?? baseTemplate.canJudge);
  const [enabled, setEnabled] = useState(existingAgent?.enabled ?? true);

  function handleTemplateChange(nextTemplateId: string) {
    const template = BUILTIN_AGENT_TEMPLATES.find((item) => item.id === nextTemplateId) ?? baseTemplate;
    setTemplateId(template.id);
    setProvider(template.provider);
    setCommand(template.command);
    setCanJudge(template.canJudge);
  }

  async function handleSave() {
    if (!workspaceDetail) {
      return;
    }

    const envRecord = Object.fromEntries(
      env
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [key, ...rest] = line.split("=");
          return [key, rest.join("=")];
        }),
    );

    const payload = {
      workspaceId: workspaceDetail.workspace.id,
      name,
      type: "cli" as const,
      provider,
      command,
      args: args.split(" ").map((part) => part.trim()).filter(Boolean),
      cwd: cwd || workspaceDetail.workspace.rootPath,
      env: envRecord,
      enabled,
      canJudge,
      shellAccess: true,
      model: null,
    };

    if (existingAgent) {
      await api.updateAgent(existingAgent.id, payload);
    } else {
      await api.createAgent(payload);
    }

    await loadWorkspace(workspaceDetail.workspace.id);
    onOpenChange(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={existingAgent ? "Edit Agent" : "Create Agent"}
      description="CLI-backed agents run as trusted local processes. Commands and working directories stay visible in the UI."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          <div className="mb-2 text-[var(--muted)]">Template</div>
          <select
            className="h-11 w-full rounded-2xl border border-[var(--border)] bg-black/10 px-4 text-sm"
            value={templateId}
            onChange={(event) => handleTemplateChange(event.target.value)}
          >
            {BUILTIN_AGENT_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-2 text-[var(--muted)]">Name</div>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="text-sm">
          <div className="mb-2 text-[var(--muted)]">Provider</div>
          <Input value={provider} onChange={(event) => setProvider(event.target.value)} />
        </label>
        <label className="text-sm">
          <div className="mb-2 text-[var(--muted)]">Command</div>
          <Input value={command} onChange={(event) => setCommand(event.target.value)} />
        </label>
        <label className="text-sm md:col-span-2">
          <div className="mb-2 text-[var(--muted)]">Args</div>
          <Input value={args} onChange={(event) => setArgs(event.target.value)} placeholder="--model fast" />
        </label>
        <label className="text-sm md:col-span-2">
          <div className="mb-2 text-[var(--muted)]">Working directory</div>
          <Input value={cwd} onChange={(event) => setCwd(event.target.value)} placeholder={workspaceDetail?.workspace.rootPath} />
        </label>
        <label className="text-sm md:col-span-2">
          <div className="mb-2 text-[var(--muted)]">Environment variables</div>
          <textarea
            value={env}
            onChange={(event) => setEnv(event.target.value)}
            className="min-h-[120px] w-full rounded-2xl border border-[var(--border)] bg-black/10 px-4 py-3"
            placeholder="OPENAI_API_KEY=..."
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-[var(--muted)]">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          Enabled
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={canJudge} onChange={(event) => setCanJudge(event.target.checked)} />
          Allow as judge
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Save Agent</Button>
      </div>
    </Modal>
  );
}
