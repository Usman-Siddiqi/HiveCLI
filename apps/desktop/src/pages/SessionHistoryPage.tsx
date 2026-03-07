import { useEffect } from "react";
import { useParams } from "react-router-dom";

import { SessionList } from "@/components/SessionList";
import { useAppStore } from "@/stores/app-store";

export function SessionHistoryPage() {
  const { workspaceId } = useParams();
  const { activeWorkspace, activeSession, activeReplay, sessions, selectWorkspace, openSession } = useAppStore(
    (state) => ({
      activeWorkspace: state.activeWorkspace,
      activeSession: state.activeSession,
      activeReplay: state.activeReplay,
      sessions: state.sessions,
      selectWorkspace: state.selectWorkspace,
      openSession: state.openSession,
    }),
  );

  useEffect(() => {
    if (workspaceId && activeWorkspace?.workspace.id !== workspaceId) {
      void selectWorkspace(workspaceId);
    }
  }, [workspaceId, activeWorkspace?.workspace.id, selectWorkspace]);

  return (
    <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
      <SessionList
        activeSessionId={activeSession?.id}
        onSelect={(sessionId) => void openSession(sessionId)}
        sessions={sessions}
      />

      <section className="control-panel p-6">
        <p className="signal-label">Replay</p>
        <h2 className="font-display text-3xl font-semibold text-white">
          {activeSession?.title ?? "Select a session"}
        </h2>
        <div className="mt-6 space-y-4">
          {activeReplay?.tasks.map((task) => (
            <div className="rounded-[1.5rem] border border-line bg-slate-950/35 p-4" key={task.id}>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{task.mode}</p>
              <p className="mt-2 text-base text-slate-100">{task.prompt}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {activeReplay.runs
                  .filter((run) => run.taskId === task.id)
                  .map((run) => (
                    <div className="rounded-2xl border border-line bg-slate-950/50 p-3" key={run.id}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-white">{run.agentId}</span>
                        <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{run.status}</span>
                      </div>
                      <pre className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-300">{run.finalText}</pre>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
