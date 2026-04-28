import { useState } from "react";
import type { Agent } from "../types";

export function AgentCard({ agent }: { agent: Agent }) {
  const [open, setOpen] = useState(false);
  const loc = [agent.city, agent.state, agent.country].filter(Boolean).join(", ");

  return (
    <div className="card">
      <h3>{agent.name}</h3>
      <div className="loc">{loc}</div>
      <div className="meta">
        {agent.influencer && <span className="tag influencer">{agent.influencer}</span>}
        {agent.years && <span className="tag">{agent.years} yrs</span>}
        {agent.level && <span className="tag">L{agent.level}</span>}
      </div>
      {!open ? (
        <button className="contact-btn" onClick={() => setOpen(true)}>
          Show contact
        </button>
      ) : (
        <div className="contact">
          {agent.email && <a href={`mailto:${agent.email}`}>{agent.email}</a>}
          {agent.email2 && <a href={`mailto:${agent.email2}`}>{agent.email2}</a>}
          {agent.phone && <a href={`tel:${agent.phone.replace(/[^0-9+]/g, "")}`}>{agent.phone}</a>}
        </div>
      )}
    </div>
  );
}
