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
    <section className="surface rounded-xl p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div>
          <h2 className="section-title">Prompt composer</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Dispatch one task across the selected agents.</p>
        </div>
        <div className="inline-flex rounded-md border border-[var(--border)] bg-[var(--surface-strong)] p-1">
          <button
            onClick={() => setMode("broadcast")}
            className={`rounded-sm px-3 py-2 text-sm transition-colors ${
              mode === "broadcast"
                ? "bg-[var(--accent-soft)] text-[var(--text)]"
                : "text-[var(--muted)]"
            }`}
          >
            <Users className="mr-2 inline h-4 w-4" />
            Broadcast
          </button>
          <button
            onClick={() => setMode("council")}
            className={`rounded-sm px-3 py-2 text-sm transition-colors ${
              mode === "council"
                ? "bg-[var(--accent-soft)] text-[var(--text)]"
                : "text-[var(--muted)]"
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
            className="h-10 rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
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
          <Send className="h-4 w-4" />
          {submitting ? "Dispatching..." : "Run Task"}
        </Button>
      </div>
    </section>
  );
}
