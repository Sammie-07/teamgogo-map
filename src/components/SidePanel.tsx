import { useState } from "react";
import type { Agent } from "../types";
import { distanceKm, formatDistance } from "../utils/distance";
import { shareUrlForAgent } from "../utils/url";

type Props = {
  agent: Agent;
  onClose: () => void;
  userLocation: { lat: number; lng: number } | null;
};

export function SidePanel({ agent, onClose, userLocation }: Props) {
  const [showContact, setShowContact] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const loc = [agent.city, agent.state, agent.zip, agent.country]
    .filter(Boolean)
    .join(", ");

  const distance = userLocation ? distanceKm(userLocation, agent) : null;

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(shareUrlForAgent(agent.id));
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1500);
    } catch {
      // Fallback for older browsers — open in new tab
      window.prompt("Copy this link:", shareUrlForAgent(agent.id));
    }
  }

  return (
    <aside className="side-panel">
      <button className="close-btn" onClick={onClose} aria-label="Close">
        ×
      </button>
      <h2>{agent.name}</h2>
      <p className="loc">{loc}</p>

      {distance !== null && (
        <div className="distance-pill">{formatDistance(distance)} from you</div>
      )}

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

      <div className="panel-section">
        <button className="share-btn" onClick={copyShareUrl}>
          {shareCopied ? "✓ Link copied" : "Copy share link"}
        </button>
      </div>
    </aside>
  );
}
