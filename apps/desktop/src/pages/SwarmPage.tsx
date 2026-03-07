import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { AgentConfigModal } from "@/components/AgentConfigModal";
import { AgentGrid } from "@/components/AgentGrid";
import { CouncilSummaryPanel } from "@/components/CouncilSummaryPanel";
import { EventLogPanel } from "@/components/EventLogPanel";
import { PromptComposer } from "@/components/PromptComposer";
import { SessionList } from "@/components/SessionList";
import { StatusBar } from "@/components/StatusBar";
import { TopToolbar } from "@/components/TopToolbar";
import { useAppStore } from "@/stores/app-store";

export function SwarmPage() {
  const { workspaceId } = useParams();
  const [modalOpen, setModalOpen] = useState(false);
  const {
    activeWorkspace,
    activeSession,
    activeReplay,
    sessions,
    realtimeConnected,
    selectWorkspace,
    createSession,
    openSession,
    saveAgent,
    deleteAgent,
    startTask,
    agentTemplates,
  } = useAppStore((state) => ({
    activeWorkspace: state.activeWorkspace,
    activeSession: state.activeSession,
    activeReplay: state.activeReplay,
    sessions: state.sessions,
    realtimeConnected: state.realtimeConnected,
    selectWorkspace: state.selectWorkspace,
    createSession: state.createSession,
    openSession: state.openSession,
    saveAgent: state.saveAgent,
    deleteAgent: state.deleteAgent,
    startTask: state.startTask,
    agentTemplates: state.agentTemplates,
  }));

  useEffect(() => {
    if (workspaceId && activeWorkspace?.workspace.id !== workspaceId) {
      void selectWorkspace(workspaceId);
    }
  }, [workspaceId, activeWorkspace?.workspace.id, selectWorkspace]);

  const agents = activeWorkspace?.agents ?? [];
  const replay = activeReplay;
  const latestSummary = replay?.councilSummaries.at(-1);

  return (
    <div className="space-y-5">
      <TopToolbar
        onNewSession={async () => {
          if (!activeWorkspace) {
            return;
          }
          await createSession(activeWorkspace.workspace.id, `Swarm run ${new Date().toLocaleString()}`);
        }}
        onOpenAgentModal={() => setModalOpen(true)}
        workspace={activeWorkspace}
      />

      <div className="grid gap-5 2xl:grid-cols-[1.1fr_0.7fr]">
        <div className="space-y-5">
          <PromptComposer
            agents={agents}
            onSend={async ({ prompt, agentIds, mode, judgeAgentId }) => {
              if (!activeSession) {
                return;
              }
              await startTask({
                sessionId: activeSession.id,
                prompt,
                agentIds,
                mode,
                judgeAgentId,
              });
            }}
          />
          <AgentGrid agents={agents} events={replay?.events ?? []} runs={replay?.runs ?? []} />
        </div>

        <div className="space-y-5">
          <SessionList
            activeSessionId={activeSession?.id}
            onSelect={(sessionId) => void openSession(sessionId)}
            sessions={sessions}
          />
          <CouncilSummaryPanel summary={latestSummary} />
          <EventLogPanel events={replay?.events ?? []} />
        </div>
      </div>

      <StatusBar realtimeConnected={realtimeConnected} runs={replay?.runs ?? []} />

      <AgentConfigModal
        agents={agents}
        onClose={() => setModalOpen(false)}
        onDelete={deleteAgent}
        onSave={saveAgent}
        open={modalOpen}
        templates={agentTemplates}
        workspaceId={activeWorkspace?.workspace.id}
      />
    </div>
  );
}
