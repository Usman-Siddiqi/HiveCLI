import { useMemo } from "react";

import { ImplementerPanel } from "@/components/implementer-panel";
import { JudgePanel } from "@/components/judge-panel";
import { PromptBar } from "@/components/prompt-bar";
import { WorkerTerminal } from "@/components/worker-terminal";
import { useAppStore } from "@/stores/app-store";

export function SwarmPage() {
  const {
    workspaceDetail,
    runOutputs,
    roles,
    connectionState,
    runHiveTask,
  } = useAppStore();

  const getAgentOutput = useMemo(() => {
    return (agentId?: string) => {
      if (!agentId) return { status: "idle", output: "" };
      const entry = Object.values(runOutputs).find((e) => e.run.agentId === agentId);
      return {
        status: entry?.run.status ?? "idle",
        output: entry?.output ?? "",
      };
    };
  }, [runOutputs]);

  const getAgentName = (agentId?: string) => {
    if (!agentId || !workspaceDetail) return "—";
    return workspaceDetail.agents.find((a) => a.id === agentId)?.name ?? "—";
  };

  const workerA = getAgentOutput(roles.workerA);
  const workerB = getAgentOutput(roles.workerB);
  const judge = getAgentOutput(roles.judge);
  const implementer = getAgentOutput(roles.implementer);

  if (!workspaceDetail) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted)]">
        Loading workspace…
      </div>
    );
  }

  return (
    <>
      <div className="hive-grid">
        {/* Top-left: Judge */}
        <JudgePanel
          agentName={getAgentName(roles.judge)}
          status={judge.status}
          content={judge.output}
        />

        {/* Top-right: Implementer */}
        <ImplementerPanel
          agentName={getAgentName(roles.implementer)}
          status={implementer.status}
          content={implementer.output}
        />

        {/* Bottom-left: Worker A */}
        <WorkerTerminal
          label="Worker A"
          agentName={getAgentName(roles.workerA)}
          status={workerA.status}
          content={workerA.output}
        />

        {/* Bottom-right: Worker B */}
        <WorkerTerminal
          label="Worker B"
          agentName={getAgentName(roles.workerB)}
          status={workerB.status}
          content={workerB.output}
        />
      </div>

      <PromptBar
        onSubmit={runHiveTask}
        disabled={connectionState !== "open"}
      />
    </>
  );
}
