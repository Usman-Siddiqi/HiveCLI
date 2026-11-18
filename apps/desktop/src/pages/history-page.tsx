import { lazy, Suspense, useState } from "react";
import { ChevronRight, History } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { AgentEvent, AgentRun } from "@hive/shared";

import { api } from "@/lib/api";
import { formatTime } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

const TerminalPane = lazy(async () => ({
  default: (await import("@/components/terminal-pane")).TerminalPane,
}));
const TRANSCRIPT_LIMIT = 160_000;

function SavedRun({ run, name, events }: { run: AgentRun; name: string; events: AgentEvent[] }) {
  const [transcript, setTranscript] = useState<string>();

  function showTerminal() {
    let output = "";
    for (let index = events.length - 1; index >= 0 && output.length < TRANSCRIPT_LIMIT; index -= 1) {
      const event = events[index];
      if (event.agentRunId === run.id && ["stdout", "stderr", "message"].includes(event.type)) {
        output = event.payload.slice(-(TRANSCRIPT_LIMIT - output.length)) + output;
      }
    }
    setTranscript(output);
  }

  return (
    <details>
      <summary>
        <span>{name}</span>
        <span className="run-status" data-status={run.status}><span aria-hidden="true" />{run.status}</span>
      </summary>
      {run.errorText ? <p className="form-error">{run.errorText}</p> : null}
      <div className="stage-tools">
        <div className="view-switch">
          <button type="button" aria-pressed={transcript === undefined} onClick={() => setTranscript(undefined)}>Summary</button>
          <button type="button" aria-pressed={transcript !== undefined} onClick={showTerminal}>Terminal</button>
        </div>
      </div>
      {transcript === undefined ? <pre tabIndex={0}>{run.finalText ?? "No final response recorded."}</pre>
        : transcript ? (
          <div className="stage-terminal">
            <Suspense fallback={<p className="terminal-label">Opening terminal…</p>}>
              <TerminalPane output={transcript} />
            </Suspense>
          </div>
        ) : <p className="stage-empty">No terminal output recorded.</p>}
    </details>
  );
}

export function HistoryPage() {
  const sessions = useAppStore((state) => state.sessions);
  const agents = useAppStore((state) => state.workspaceDetail?.agents);
  const [chosenId, setChosenId] = useState<string>();
  const sessionId = chosenId ?? sessions[0]?.session.id;
  const { data: replay, isPending, error } = useQuery({
    queryKey: ["session-replay", sessionId, sessions.find(({ session }) => session.id === sessionId)?.session.updatedAt],
    queryFn: () => api.getSession(sessionId!),
    enabled: !!sessionId,
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Run history</h1>
          <p className="page-description">Review saved prompts, agent responses, and failures.</p>
        </div>
      </div>
      {sessions.length === 0 ? (
        <section className="empty-state">
          <History size={22} strokeWidth={1.6} aria-hidden="true" />
          <h2>No saved runs</h2>
          <p>Completed and failed runs will appear here.</p>
        </section>
      ) : (
        <div className="history-layout">
          <nav className="history-list" aria-label="Saved sessions">
            {sessions.map(({ session }) => (
              <button
                type="button"
                key={session.id}
                onClick={() => setChosenId(session.id)}
                aria-current={sessionId === session.id}
              >
                <span>
                  <strong>{session.title}</strong>
                  <small>{formatTime(session.updatedAt)}</small>
                </span>
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            ))}
          </nav>
          <section className="history-detail" aria-label="Session details">
            {isPending ? <p role="status" className="muted">Loading session…</p> : null}
            {error ? <p role="alert" className="form-error">{error.message}</p> : null}
            {replay && [...replay.tasks].reverse().map(({ task, runs }) => (
              <article className="history-task" key={task.id}>
                <time dateTime={task.createdAt}>{formatTime(task.createdAt)}</time>
                <h2>{task.prompt}</h2>
                {runs.map((run) => (
                  <SavedRun
                    key={run.id}
                    run={run}
                    name={agents?.find((agent) => agent.id === run.agentId)?.name ?? String(run.metadata?.role ?? "Agent")}
                    events={replay.events}
                  />
                ))}
              </article>
            ))}
          </section>
        </div>
      )}
    </>
  );
}
