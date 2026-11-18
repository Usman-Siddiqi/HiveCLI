import { Braces, FileOutput, FolderOpen, Scale, Terminal } from "lucide-react";
import { Link } from "react-router-dom";

import { CopyButton } from "@/components/copy-button";
import { workspaceRelativePath } from "@/lib/utils";
import { PromptBar } from "@/components/prompt-bar";
import { RunPanel } from "@/components/run-panel";
import { useAppStore } from "@/stores/app-store";

const stages = [
  { id: "worker-a", role: "workerA", path: "workerAPath", label: "Worker A", icon: Terminal, idle: "Develops the first candidate in an isolated copy." },
  { id: "worker-b", role: "workerB", path: "workerBPath", label: "Worker B", icon: Braces, idle: "Develops an independent candidate in parallel." },
  { id: "judge", role: "judge", path: "judgePath", label: "Judge", icon: Scale, idle: "Compares both candidates once the workers finish." },
  { id: "implementer", role: "implementer", path: "implementerPath", label: "Implementer", icon: FileOutput, idle: "Applies the verdict and prepares the result." },
] as const;

export function SwarmPage() {
  const {
    workspaceDetail,
    workspaceRootStatus,
    workspaceError,
    currentTaskPaths,
    activeSession,
    runOutputs,
    roles,
    connectionState,
    runningTask,
    runHiveTask,
  } = useAppStore();

  const agents = workspaceDetail?.agents ?? [];
  const rosterReady = stages.every(({ role }) => agents.some((agent) => agent.id === roles[role] && agent.command?.trim()));
  const disabledReason = connectionState !== "open"
    ? "Waiting for the orchestrator connection."
    : !workspaceRootStatus?.valid
      ? workspaceRootStatus?.error || "Choose a valid project directory in the sidebar."
      : !rosterReady
        ? "Configure a command for every council role in Agents."
        : undefined;
  const outputByAgent = new Map(Object.values(runOutputs).map((entry) => [entry.run.agentId, entry]));
  const hasRun = outputByAgent.size > 0;
  const latestBrief = activeSession?.tasks.at(-1)?.task.prompt;
  const paths = currentTaskPaths;
  const workspaceRoot = workspaceRootStatus?.resolvedPath;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Council</h1>
          <p className="page-description">Two agents propose changes. A judge compares them, then an implementer prepares the result.</p>
        </div>
        <Link to="/settings" className="quiet-button">Configure agents</Link>
      </div>

      <PromptBar
        onSubmit={runHiveTask}
        disabled={!!disabledReason}
        reason={disabledReason}
        error={workspaceError}
        running={runningTask}
      />

      <section className="run-section" aria-labelledby="run-stages">
        <header className="section-heading">
          <h2 id="run-stages">Run stages</h2>
          <span>{runningTask ? "Run in progress" : hasRun ? "Latest run" : "Awaiting a task"}</span>
        </header>
        {latestBrief ? <p className="run-brief" title={latestBrief}>{latestBrief}</p> : null}
        <div className="run-grid">
          {stages.map(({ id, role, path, label, icon: Icon, idle }) => {
            const agent = agents.find(({ id }) => id === roles[role]);
            const entry = agent && outputByAgent.get(agent.id);
            return (
              <RunPanel
                key={`${id}-${entry?.run.id ?? "idle"}`}
                id={id}
                label={label}
                icon={<Icon size={17} strokeWidth={1.8} />}
                agentName={agent?.command ? [agent.command, agent.model].filter(Boolean).join(" · ") : undefined}
                status={entry?.run.status ?? "idle"}
                content={entry?.output ?? ""}
                finalText={entry?.run.finalText}
                error={entry?.run.errorText}
                workingDir={paths?.[path]}
                workspaceRoot={workspaceRoot}
                idleText={idle}
              />
            );
          })}
        </div>
      </section>

      <section className="run-paths" aria-label="Run folders">
        <FolderOpen size={18} strokeWidth={1.7} aria-hidden="true" />
        <dl>
          <div>
            <dt>Run directory</dt>
            <dd>
              <span data-testid="current-run-path" title={paths?.runRootDir}>
                {paths?.runRootDir ? workspaceRelativePath(paths.runRootDir, workspaceRoot) : "Created when a run starts"}
              </span>
              {paths?.runRootDir ? <CopyButton value={paths.runRootDir} label="run directory" /> : null}
            </dd>
          </div>
          <div>
            <dt>{paths?.publishSource ? "Published result" : "Output directory"}</dt>
            <dd>
              <span data-testid="publish-path" title={paths?.publishDir}>
                {paths?.publishDir ? workspaceRelativePath(paths.publishDir, workspaceRoot) : "Available after implementation"}
              </span>
              {paths?.publishDir && paths.publishSource ? <CopyButton value={paths.publishDir} label="published result path" /> : null}
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
}
