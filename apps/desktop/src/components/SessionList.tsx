import type { Session } from "@hive/shared";

import { formatTime } from "@/lib/utils";

interface SessionListProps {
  sessions: Session[];
  activeSessionId?: string;
  onSelect: (sessionId: string) => void;
}

export function SessionList({ sessions, activeSessionId, onSelect }: SessionListProps) {
  return (
    <section className="control-panel p-4">
      <div className="mb-4">
        <p className="signal-label">Session History</p>
        <h3 className="font-display text-2xl font-semibold text-white">Replay Queue</h3>
      </div>

      <div className="space-y-3">
        {sessions.map((session) => (
          <button
            className={`w-full rounded-[1.35rem] border px-4 py-3 text-left transition ${
              session.id === activeSessionId
                ? "border-pulse/50 bg-pulse/10"
                : "border-line bg-slate-950/35 hover:bg-white/5"
            }`}
            key={session.id}
            onClick={() => onSelect(session.id)}
            type="button"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-white">{session.title}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                  {formatTime(session.updatedAt)}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
