import { Sparkles } from "lucide-react";

import type { AgentRun } from "@hive/shared";

export function CouncilSummaryPanel({ judgeRun }: { judgeRun?: AgentRun }) {
  return (
    <section className="surface rounded-xl p-4">
      <div className="mb-4 flex items-center gap-2 border-b border-[var(--border)] pb-3">
        <Sparkles className="h-4 w-4 text-[var(--accent)]" />
        <h2 className="section-title">Council summary</h2>
      </div>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] p-4 text-sm leading-6">
        {judgeRun?.finalText?.trim() ? (
          judgeRun.finalText
        ) : (
          <span className="text-[var(--muted)]">
            Judge output will appear here after all selected agents finish in council mode.
          </span>
        )}
      </div>
    </section>
  );
}
