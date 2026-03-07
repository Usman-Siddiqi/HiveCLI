import { History, PlaySquare } from "lucide-react";

import type { SessionSnapshot } from "@hive/shared";

import { formatTime } from "@/lib/utils";

export function SessionList({
  sessions,
  activeSessionId,
  onOpen,
}: {
  sessions: SessionSnapshot[];
  activeSessionId?: string;
  onOpen: (sessionId: string) => void;
}) {
  return (
    <div className="panel rounded-[28px] p-4">
      <div className="mb-4 flex items-center gap-2">
        <History className="h-4 w-4 text-[var(--accent-secondary)]" />
        <h2 className="text-lg font-semibold">Recent Sessions</h2>
      </div>

      <div className="space-y-2">
        {sessions.map((snapshot) => (
          <button
            key={snapshot.session.id}
            onClick={() => onOpen(snapshot.session.id)}
            className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
              snapshot.session.id === activeSessionId
                ? "border-[var(--border-strong)] bg-white/8"
                : "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-white/4"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">{snapshot.session.title}</div>
              <PlaySquare className="h-4 w-4 text-[var(--muted)]" />
            </div>
            <div className="mt-1 text-xs text-[var(--muted)]">
              Updated {formatTime(snapshot.session.updatedAt)}
            </div>
            {snapshot.latestTask ? (
              <div className="mt-2 line-clamp-2 text-xs text-[var(--muted)]">
                {snapshot.latestTask.task.prompt}
              </div>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
