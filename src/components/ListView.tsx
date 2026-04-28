import type { Agent } from "../types";
import { AgentCard } from "./AgentCard";

export function ListView({ agents }: { agents: Agent[] }) {
  if (agents.length === 0) {
    return <div className="empty">No agents match your filters.</div>;
  }
  return (
    <div className="list-wrap">
      {agents.map((a) => (
        <AgentCard key={a.id} agent={a} />
      ))}
    </div>
  );
}
