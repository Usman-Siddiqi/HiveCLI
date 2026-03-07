import { EventLogPanel } from "@/components/event-log-panel";
import { SessionList } from "@/components/session-list";
import { useAppStore } from "@/stores/app-store";

export function HistoryPage() {
  const { sessions, activeSession, workspaceDetail, loadSession } = useAppStore();

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
      <SessionList
        sessions={sessions}
        activeSessionId={activeSession?.session.id}
        onOpen={(sessionId) => void loadSession(sessionId)}
      />
      <div className="space-y-5">
        <section className="surface rounded-xl p-5">
          <h2 className="text-[28px] font-semibold tracking-[-0.02em]">
            {activeSession?.session.title ?? "Select a session"}
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            {activeSession
              ? `Workspace ${workspaceDetail?.workspace.name ?? ""} · ${activeSession.tasks.length} tasks persisted with final outputs and event logs.`
              : "Choose a session to inspect saved agent runs, final outputs, and council results."}
          </p>
        </section>
        <EventLogPanel events={activeSession?.events ?? []} />
      </div>
    </div>
  );
}
