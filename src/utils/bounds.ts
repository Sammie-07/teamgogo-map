import type { Agent } from "../types";

/**
 * Compute a bounding box around all agents, with light padding. Used to
 * cap how far the map can be panned out, so the user can't see repeated
 * world copies and stays in the region where teamgogo actually operates.
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
  // Pad by 8° lat / 12° lng so the edge agents aren't pinned to the map edge
  return [
    [Math.max(-85, minLat - 8), Math.max(-180, minLng - 12)],
    [Math.min(85, maxLat + 8), Math.min(180, maxLng + 12)],
  ];
}
