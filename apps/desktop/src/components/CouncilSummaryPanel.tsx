import type { CouncilSummary } from "@hive/shared";

interface CouncilSummaryPanelProps {
  summary?: CouncilSummary;
}

export function CouncilSummaryPanel({ summary }: CouncilSummaryPanelProps) {
  return (
    <section className="control-panel p-4">
      <div className="mb-4">
        <p className="signal-label">Council Verdict</p>
        <h3 className="font-display text-2xl font-semibold text-white">Judge Synthesis</h3>
      </div>

      <div className="rounded-[1.5rem] border border-line bg-slate-950/40 p-4 text-sm leading-7 text-slate-200">
        <pre className="whitespace-pre-wrap font-body">
          {summary?.summary || "Council mode will auto-run the judge after every source agent reaches a terminal state."}
        </pre>
      </div>
    </section>
  );
}
