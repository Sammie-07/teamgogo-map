import type { Agent } from "../types";

export function ListView({
  agents,
  onSelect,
}: {
  agents: Agent[];
  onSelect: (a: Agent) => void;
}) {
  if (agents.length === 0) {
    return <div className="empty">No agents match your filters.</div>;
  }
  return (
    <div className="list-wrap">
      {agents.map((a) => (
        <button key={a.id} className="card" onClick={() => onSelect(a)}>
          <h3>{a.name}</h3>
          <div className="loc">
            {[a.city, a.state, a.country].filter(Boolean).join(", ")}
          </div>
          <div className="meta">
            {a.influencer && <span className="tag influencer">{a.influencer}</span>}
            {a.years && <span className="tag">{a.years} yrs</span>}
            {a.level && <span className="tag">L{a.level}</span>}
          </div>
        </button>
      ))}
    </div>
  );
}
