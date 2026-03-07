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
    <section className="surface rounded-xl p-4">
      <div className="mb-4 flex items-center gap-2 border-b border-[var(--border)] pb-3">
        <History className="h-4 w-4 text-[var(--accent-secondary)]" />
        <h2 className="section-title">Recent sessions</h2>
      </div>

      <div className="space-y-2">
        {sessions.map((snapshot) => (
          <button
            key={snapshot.session.id}
            onClick={() => onOpen(snapshot.session.id)}
            className={`panel-list-button ${snapshot.session.id === activeSessionId ? "panel-list-button-active" : ""}`}
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
    </section>
  );
}
