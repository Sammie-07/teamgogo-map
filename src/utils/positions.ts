import type { Agent } from "../types";

/**
 * Spread agents that share an identical (or near-identical) coordinate
 * into a small deterministic ring around the original centroid, so they
 * don't stack on top of each other. Each agent's offset is stable across
 * renders (derived from index in the group).
 *
 * "Accurate" here means the offsets are tiny (~150–400m) — well within
 * the precision of a zip-code centroid, so we're not lying about location.
 */
export function fanOutOverlaps(agents: Agent[]): Agent[] {
  const groups = new Map<string, Agent[]>();
  for (const a of agents) {
    const key = `${a.lat.toFixed(4)}|${a.lng.toFixed(4)}`;
    const arr = groups.get(key) ?? [];
    arr.push(a);
    groups.set(key, arr);
  }

  const out: Agent[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    // Stable order so refresh doesn't re-shuffle
    group.sort((a, b) => a.id.localeCompare(b.id));
    const n = group.length;
    // Approx degrees per ~150m at mid-latitudes
    const baseRadius = 0.0015;
    for (let i = 0; i < n; i++) {
      const ringIndex = Math.floor(i / 8); // 8 per ring
      const slot = i % 8;
      const radius = baseRadius * (1 + ringIndex * 1.4);
      const angle = (slot / 8) * 2 * Math.PI + ringIndex * 0.4;
      const lat = group[i].lat + radius * Math.cos(angle);
      // adjust lng by cos(lat) so circles don't squish near poles
      const latRad = (group[i].lat * Math.PI) / 180;
      const lng = group[i].lng + (radius * Math.sin(angle)) / Math.max(Math.cos(latRad), 0.2);
      out.push({ ...group[i], lat, lng });
    }
  }
  return out;
}
