import { Sparkles } from "lucide-react";

import type { AgentRun } from "@hive/shared";

export function CouncilSummaryPanel({ judgeRun }: { judgeRun?: AgentRun }) {
  return (
    <div className="panel rounded-[28px] p-4">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[var(--accent)]" />
        <h2 className="text-lg font-semibold">Council Summary</h2>
      </div>
      <div className="rounded-[24px] border border-[var(--border)] bg-black/10 p-4 text-sm leading-6">
        {judgeRun?.finalText?.trim() ? (
          judgeRun.finalText
        ) : (
          <span className="text-[var(--muted)]">
            Judge output will appear here after all selected agents finish in council mode.
          </span>
        )}
      </div>
    </div>
  );
}
