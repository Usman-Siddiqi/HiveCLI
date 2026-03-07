import { ScrollText } from "lucide-react";

import type { AgentEvent } from "@hive/shared";

import { formatTime } from "@/lib/utils";

export function EventLogPanel({ events }: { events: AgentEvent[] }) {
  return (
    <div className="panel rounded-[28px] p-4">
      <div className="mb-4 flex items-center gap-2">
        <ScrollText className="h-4 w-4 text-[var(--accent-secondary)]" />
        <h2 className="text-lg font-semibold">Event Stream</h2>
      </div>

      <div className="max-h-[420px] space-y-2 overflow-auto pr-2">
        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
            No events yet. Run a task to watch live streaming updates.
          </div>
        ) : null}
        {events.map((event) => (
          <div key={event.id} className="rounded-2xl border border-[var(--border)] bg-black/10 px-3 py-3">
            <div className="flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
              <span className="uppercase tracking-[0.18em]">{event.type}</span>
              <span>{formatTime(event.timestamp)}</span>
            </div>
            <div className="mt-2 text-xs text-[var(--muted)]">{event.agentId}</div>
            <pre className="terminal-font mt-3 whitespace-pre-wrap text-xs leading-5 text-[var(--text)]">
              {event.payload}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
