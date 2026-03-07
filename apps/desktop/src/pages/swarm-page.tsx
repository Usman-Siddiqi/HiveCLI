import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { TaskMode } from "@hive/shared";

import { AgentConfigModal } from "@/components/agent-config-modal";
import { AgentGrid } from "@/components/agent-grid";
import { CouncilSummaryPanel } from "@/components/council-summary-panel";
import { EventLogPanel } from "@/components/event-log-panel";
import { PromptComposer } from "@/components/prompt-composer";
import { StatusBar } from "@/components/status-bar";
import { TopToolbar } from "@/components/top-toolbar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app-store";

export function SwarmPage() {
  const {
    workspaceDetail,
    selectedAgentIds,
    judgeAgentId,
    runOutputs,
    events,
    activeSession,
    connectionState,
    selectAgents,
    setJudgeAgentId,
    refreshSessions,
    loadSession,
  } = useAppStore();
  const [modalOpen, setModalOpen] = useState(false);

  const outputMap = useMemo(() => {
    if (!workspaceDetail) {
      return {};
    }

    return Object.fromEntries(
      workspaceDetail.agents.map((agent) => {
        const state = Object.values(runOutputs).find((entry) => entry.run.agentId === agent.id);
        return [agent.id, state];
      }),
    );
  }, [runOutputs, workspaceDetail]);

  const judgeRun = judgeAgentId
    ? Object.values(runOutputs).find((entry) => entry.run.agentId === judgeAgentId)?.run
    : undefined;

  async function handleSubmit({ prompt, mode }: { prompt: string; mode: TaskMode }) {
    if (!workspaceDetail) {
      return;
    }

    const response = await api.runTask({
      workspaceId: workspaceDetail.workspace.id,
      sessionId: activeSession?.session.id,
      prompt,
      mode,
      agentIds: selectedAgentIds,
      judgeAgentId: mode === "council" ? judgeAgentId : null,
    });

    await refreshSessions(workspaceDetail.workspace.id);
    await loadSession(response.sessionId);
  }

  if (!workspaceDetail) {
    return (
      <div className="panel flex min-h-[70vh] items-center justify-center rounded-[32px] p-6 text-[var(--muted)]">
        Create or open a workspace from the dashboard to start a swarm session.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <TopToolbar
        workspaceDetail={workspaceDetail}
        connectionState={connectionState}
        onManageAgents={() => setModalOpen(true)}
      />

      <div className="grid gap-5 xl:grid-cols-[280px_1fr_340px]">
        <div className="space-y-5">
          <div className="panel rounded-[28px] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent-secondary)]">Agents</div>
                <h2 className="mt-1 text-lg font-semibold">Workspace roster</h2>
              </div>
              <Button size="sm" onClick={() => setModalOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {workspaceDetail.agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() =>
                    selectAgents(
                      selectedAgentIds.includes(agent.id)
                        ? selectedAgentIds.filter((id) => id !== agent.id)
                        : [...selectedAgentIds, agent.id],
                    )
                  }
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    selectedAgentIds.includes(agent.id)
                      ? "border-[var(--border-strong)] bg-[var(--accent)]/10"
                      : "border-[var(--border)] bg-black/10 hover:border-[var(--border-strong)]"
                  }`}
                >
                  <div className="text-sm font-medium">{agent.name}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    {agent.provider} · {agent.command}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <PromptComposer
            agents={workspaceDetail.agents}
            selectedAgentIds={selectedAgentIds}
            judgeAgentId={judgeAgentId}
            onJudgeChange={setJudgeAgentId}
            onSubmit={handleSubmit}
          />

          <StatusBar
            selectedCount={selectedAgentIds.length}
            judgeName={workspaceDetail.agents.find((agent) => agent.id === judgeAgentId)?.name}
          />
        </div>

        <div className="space-y-5">
          <AgentGrid
            agents={workspaceDetail.agents}
            selectedAgentIds={selectedAgentIds}
            outputs={outputMap}
            onToggle={(agentId) =>
              selectAgents(
                selectedAgentIds.includes(agentId)
                  ? selectedAgentIds.filter((id) => id !== agentId)
                  : [...selectedAgentIds, agentId],
              )
            }
          />
        </div>

        <div className="space-y-5">
          <CouncilSummaryPanel judgeRun={judgeRun} />
          <EventLogPanel events={events} />
        </div>
      </div>

      <AgentConfigModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
