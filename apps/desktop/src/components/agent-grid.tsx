import type { AgentDefinition, AgentRun } from "@hive/shared";

import { AgentPanel } from "./agent-panel";

export function AgentGrid({
  agents,
  selectedAgentIds,
  outputs,
  onToggle,
}: {
  agents: AgentDefinition[];
  selectedAgentIds: string[];
  outputs: Record<string, { run?: AgentRun; output?: string } | undefined>;
  onToggle: (agentId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {agents.map((agent) => (
        <AgentPanel
          key={agent.id}
          agent={agent}
          run={outputs[agent.id]?.run}
          output={outputs[agent.id]?.output}
          selected={selectedAgentIds.includes(agent.id)}
          onToggle={() => onToggle(agent.id)}
        />
      ))}
    </div>
  );
}
