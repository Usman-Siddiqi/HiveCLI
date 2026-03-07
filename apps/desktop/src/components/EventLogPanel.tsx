import type { AgentEvent } from "@hive/shared";

import { formatTime } from "@/lib/utils";

interface EventLogPanelProps {
  events: AgentEvent[];
}

export function EventLogPanel({ events }: EventLogPanelProps) {
  return (
    <section className="control-panel p-4">
      <div className="mb-4">
        <p className="signal-label">Event Stream</p>
        <h3 className="font-display text-2xl font-semibold text-white">Live Bus</h3>
      </div>

      <div className="space-y-3">
        {[...events].slice(-12).reverse().map((event) => (
          <div className="rounded-2xl border border-line bg-slate-950/35 p-3" key={event.id}>
            <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.28em] text-slate-500">
              <span>{event.type}</span>
              <span>{formatTime(event.timestamp)}</span>
            </div>
            <pre className="whitespace-pre-wrap text-xs leading-6 text-slate-300">{event.payload}</pre>
          </div>
        ))}
      </div>
    </section>
  );
}
