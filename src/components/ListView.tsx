import { useMemo } from "react";
import type { Agent } from "../types";
import { distanceKm, formatDistance } from "../utils/distance";

type Props = {
  agents: Agent[];
  onSelect: (a: Agent) => void;
  userLocation: { lat: number; lng: number } | null;
  query: string;
};

export function ListView({ agents, onSelect, userLocation, query }: Props) {
  const sorted = useMemo(() => {
    if (!userLocation) return agents;
    return [...agents].sort(
      (a, b) => distanceKm(userLocation, a) - distanceKm(userLocation, b)
    );
  }, [agents, userLocation]);

  if (agents.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🔍</div>
        <h3>No agents match your search</h3>
        <p>
          {query
            ? `Nothing for "${query}". Try a city, state name, or zip code.`
            : "Adjust the country filter to see more agents."}
        </p>
      </div>
    );
  }

  return (
    <div className="list-wrap">
      {sorted.map((a) => {
        const dist = userLocation ? distanceKm(userLocation, a) : null;
        return (
          <button key={a.id} className="card" onClick={() => onSelect(a)}>
            <div className="card-head">
              <h3>{a.name}</h3>
              {dist !== null && (
                <span className="card-distance">{formatDistance(dist)}</span>
              )}
            </div>
            <div className="loc">
              {[a.city, a.state, a.country].filter(Boolean).join(", ")}
            </div>
            <div className="meta">
              {a.influencer && <span className="tag influencer">{a.influencer}</span>}
              {a.years && <span className="tag">{a.years} yrs</span>}
              {a.level && <span className="tag">L{a.level}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
