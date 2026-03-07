import { useMemo, useState } from "react";
import { Send, Sparkles, Users } from "lucide-react";

import type { AgentDefinition, TaskMode } from "@hive/shared";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function PromptComposer({
  agents,
  selectedAgentIds,
  judgeAgentId,
  onJudgeChange,
  onSubmit,
}: {
  agents: AgentDefinition[];
  selectedAgentIds: string[];
  judgeAgentId?: string | null;
  onJudgeChange: (agentId?: string | null) => void;
  onSubmit: (payload: { prompt: string; mode: TaskMode }) => Promise<void>;
}) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<TaskMode>("broadcast");
  const [submitting, setSubmitting] = useState(false);
  const judgeOptions = useMemo(() => agents.filter((agent) => agent.canJudge), [agents]);

  async function handleSubmit() {
    if (!prompt.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ prompt, mode });
      setPrompt("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel rounded-[28px] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent-secondary)]">
            Prompt Composer
          </div>
          <h2 className="mt-1 text-lg font-semibold">Broadcast or run council synthesis</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMode("broadcast")}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              mode === "broadcast"
                ? "border-[var(--border-strong)] bg-[var(--accent-secondary)]/10"
                : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            <Users className="mr-2 inline h-4 w-4" />
            Broadcast
          </button>
          <button
            onClick={() => setMode("council")}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              mode === "council"
                ? "border-[var(--border-strong)] bg-[var(--accent)]/10"
                : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            <Sparkles className="mr-2 inline h-4 w-4" />
            Council
          </button>
        </div>
      </div>

      <Textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Describe the task, prompt, or command objective for the selected agents."
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-[var(--muted)]">Sending to {selectedAgentIds.length} agents</div>
        {mode === "council" ? (
          <select
            className="rounded-full border border-[var(--border)] bg-black/10 px-4 py-2 text-sm text-[var(--text)]"
            value={judgeAgentId ?? ""}
            onChange={(event) => onJudgeChange(event.target.value || null)}
          >
            <option value="">Select judge agent</option>
            {judgeOptions.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        ) : null}
        <Button onClick={handleSubmit} disabled={submitting || !prompt.trim()}>
          <Send className="mr-2 h-4 w-4" />
          {submitting ? "Dispatching..." : "Run Task"}
        </Button>
      </div>
    </div>
  );
}
