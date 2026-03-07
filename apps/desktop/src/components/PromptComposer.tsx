import { useEffect, useMemo, useState } from "react";

import type { AgentDefinition } from "@hive/shared";

import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

interface PromptComposerProps {
  agents: AgentDefinition[];
  onSend: (payload: { prompt: string; agentIds: string[]; mode: "broadcast" | "council"; judgeAgentId?: string }) => Promise<void>;
}

export function PromptComposer({ agents, onSend }: PromptComposerProps) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"broadcast" | "council">("broadcast");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const judgeOptions = useMemo(() => agents.filter((agent) => agent.canJudge), [agents]);
  const [judgeAgentId, setJudgeAgentId] = useState<string | undefined>(judgeOptions[0]?.id);

  useEffect(() => {
    setSelectedAgents(agents.filter((agent) => agent.enabled).map((agent) => agent.id));
  }, [agents]);

  useEffect(() => {
    setJudgeAgentId(judgeOptions[0]?.id);
  }, [judgeOptions]);

  function toggleAgent(agentId: string) {
    setSelectedAgents((current) =>
      current.includes(agentId) ? current.filter((entry) => entry !== agentId) : [...current, agentId],
    );
  }

  async function handleSubmit() {
    if (!prompt.trim() || selectedAgents.length === 0) {
      return;
    }

    await onSend({
      prompt,
      agentIds: selectedAgents,
      mode,
      judgeAgentId: mode === "council" ? judgeAgentId : undefined,
    });
    setPrompt("");
  }

  return (
    <section className="control-panel p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="signal-label">Broadcast</p>
          <h3 className="font-display text-2xl font-semibold text-white">Prompt Composer</h3>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setMode("broadcast")} variant={mode === "broadcast" ? "primary" : "outline"}>
            Broadcast
          </Button>
          <Button onClick={() => setMode("council")} variant={mode === "council" ? "primary" : "outline"}>
            Council
          </Button>
        </div>
      </div>

      <Textarea onChange={(event) => setPrompt(event.target.value)} placeholder="Send one prompt to the whole swarm..." value={prompt} />

      <div className="mt-4 flex flex-wrap gap-2">
        {agents.map((agent) => (
          <button
            className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.25em] transition ${
              selectedAgents.includes(agent.id)
                ? "border-pulse bg-pulse/10 text-pulse"
                : "border-line bg-slate-950/40 text-slate-400"
            }`}
            key={agent.id}
            onClick={() => toggleAgent(agent.id)}
            type="button"
          >
            {agent.name}
          </button>
        ))}
      </div>

      {mode === "council" ? (
        <div className="mt-4 rounded-2xl border border-line bg-slate-950/35 p-3">
          <p className="signal-label">Judge Agent</p>
          <select
            className="mt-2 w-full rounded-2xl border border-line bg-slate-950/80 px-4 py-3 text-sm"
            onChange={(event) => setJudgeAgentId(event.target.value)}
            value={judgeAgentId}
          >
            {judgeOptions.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {selectedAgents.length} agents armed
          {mode === "council" && judgeAgentId ? ` • judge ${agents.find((agent) => agent.id === judgeAgentId)?.name}` : ""}
        </p>
        <Button onClick={() => void handleSubmit()}>{mode === "council" ? "Launch Council" : "Broadcast Prompt"}</Button>
      </div>
    </section>
  );
}
