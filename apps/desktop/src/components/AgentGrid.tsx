import type { AgentDefinition, AgentEvent, AgentRun } from "@hive/shared";

import { AgentPanel } from "./AgentPanel";

interface AgentGridProps {
  agents: AgentDefinition[];
  runs: AgentRun[];
  events: AgentEvent[];
}

export function AgentGrid({ agents, runs, events }: AgentGridProps) {
  return (
    <div className="grid gap-5 2xl:grid-cols-2">
      {agents.map((agent) => {
        const run = [...runs].reverse().find((entry) => entry.agentId === agent.id);
        const runEvents = events.filter((event) => event.agentId === agent.id);

        return <AgentPanel agent={agent} events={runEvents} key={agent.id} run={run} />;
      })}
    </div>
  );
}
