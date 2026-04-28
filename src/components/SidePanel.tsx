import { useState } from "react";
import type { Agent } from "../types";

export function SidePanel({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [showContact, setShowContact] = useState(false);
  const loc = [agent.city, agent.state, agent.zip, agent.country]
    .filter(Boolean)
    .join(", ");

  return (
    <aside className="side-panel">
      <button className="close-btn" onClick={onClose} aria-label="Close">
        ×
      </button>
      <h2>{agent.name}</h2>
      <p className="loc">{loc}</p>

      <div className="meta">
        {agent.influencer && (
          <span className="tag influencer">{agent.influencer}</span>
        )}
        {agent.years && <span className="tag">{agent.years} years</span>}
        {agent.level && <span className="tag">Level {agent.level}</span>}
        {agent.status && <span className="tag">{agent.status}</span>}
      </div>

      <div className="panel-section">
        <h3>Contact</h3>
        {!showContact ? (
          <button className="contact-btn" onClick={() => setShowContact(true)}>
            Show contact info
          </button>
        ) : (
          <div className="contact">
            {agent.email && (
              <a href={`mailto:${agent.email}`}>{agent.email}</a>
            )}
            {agent.email2 && (
              <a href={`mailto:${agent.email2}`}>{agent.email2}</a>
            )}
            {agent.phone && (
              <a href={`tel:${agent.phone.replace(/[^0-9+]/g, "")}`}>
                {agent.phone}
              </a>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
