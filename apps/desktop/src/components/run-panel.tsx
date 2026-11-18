import { lazy, Suspense, useState, type ReactNode } from "react";
import { CopyButton } from "@/components/copy-button";
import { workspaceRelativePath } from "@/lib/utils";

const TerminalPane = lazy(async () => ({
  default: (await import("./terminal-pane")).TerminalPane,
}));

interface RunPanelProps {
  id: string;
  label: string;
  icon: ReactNode;
  agentName?: string;
  status: string;
  content: string;
  finalText?: string | null;
  error?: string | null;
  workingDir?: string;
  workspaceRoot?: string | null;
  idleText: string;
}

export function RunPanel({
  id, label, icon, agentName, status, content, finalText, error, workingDir, workspaceRoot, idleText,
}: RunPanelProps) {
  const [showTerminal, setShowTerminal] = useState(false);
  const showSummary = !!finalText && !showTerminal;

  const summary = id === "implementer" && finalText ? formatDecision(finalText) : finalText;

  return (
    <section className="run-panel" data-testid={`panel-${id}`} aria-label={label}>
      <header className="run-panel-heading">
        <span className="stage-icon" data-stage={id} aria-hidden="true">{icon}</span>
        <div className="stage-name">
          <h3>{label}</h3>
          <p data-testid={`path-${id}`} title={workingDir}>{workingDir ? workspaceRelativePath(workingDir, workspaceRoot) : agentName ?? "Agent missing"}</p>
        </div>
        <span className="run-status" data-status={status} data-testid={`status-${id}`}>
          <span aria-hidden="true" />
          {status}
        </span>
      </header>
      {error ? <p className="stage-error" role="alert">{error}</p> : null}
      {content || finalText ? (
        <>
          <div className="stage-tools">
            {finalText ? (
              <div className="view-switch">
                <button type="button" aria-pressed={!showTerminal} onClick={() => setShowTerminal(false)}>Summary</button>
                <button type="button" aria-pressed={showTerminal} onClick={() => setShowTerminal(true)}>Terminal</button>
              </div>
            ) : <span className="terminal-label">Terminal</span>}
            <CopyButton value={showSummary ? summary || "" : content || finalText || ""} label={showSummary ? "summary" : "transcript"} />
          </div>
          {showSummary ? <pre className="stage-summary" tabIndex={0}>{summary}</pre> : (
            <div className="stage-terminal">
              <Suspense fallback={<p className="stage-empty">Opening terminal…</p>}>
                <TerminalPane output={content || finalText || ""} />
              </Suspense>
            </div>
          )}
        </>
      ) : (
        <p className="stage-empty">{status === "running" ? "Waiting for output…" : idleText}</p>
      )}
    </section>
  );
}

function formatDecision(text: string) {
  const decisions: Record<string, string> = {
    COPY_WORKER_A: "Selected Worker A’s changes",
    COPY_WORKER_B: "Selected Worker B’s changes",
    MERGE: "Prepared a combined result",
  };
  return text
    .replace(/^DECISION:\s*(COPY_WORKER_A|COPY_WORKER_B|MERGE)\s*$/m, (_, decision: string) => decisions[decision])
    .replace(/^RATIONALE:\s*/m, "");
}
