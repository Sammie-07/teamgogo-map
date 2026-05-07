import type { Agent } from "../types";

/**
 * Compute a bounding box around the given agents with `degPad` degrees of padding.
 * Returns null if the list is empty.
 */
export function boundsOfAgents(
  agents: Agent[],
  degPad = 0.5
): [[number, number], [number, number]] | null {
  if (agents.length === 0) return null;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const a of agents) {
    if (a.lat < minLat) minLat = a.lat;
    if (a.lat > maxLat) maxLat = a.lat;
    if (a.lng < minLng) minLng = a.lng;
    if (a.lng > maxLng) maxLng = a.lng;
  }
  return [
    [Math.max(-85, minLat - degPad), Math.max(-180, minLng - degPad)],
    [Math.min(85, maxLat + degPad), Math.min(180, maxLng + degPad)],
  ];
}

/**
 * Outer bounding box for all agents, used to clamp the map's max-pan area.
 * Wider padding so edge agents aren't pinned to the map edge.
 */
export function agentsBounds(agents: Agent[]): [[number, number], [number, number]] | null {
  if (agents.length === 0) return null;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const a of agents) {
    if (a.lat < minLat) minLat = a.lat;
    if (a.lat > maxLat) maxLat = a.lat;
    if (a.lng < minLng) minLng = a.lng;
    if (a.lng > maxLng) maxLng = a.lng;
  }
  return [
    [Math.max(-85, minLat - 8), Math.max(-180, minLng - 12)],
    [Math.min(85, maxLat + 8), Math.min(180, maxLng + 12)],
  ];
}
