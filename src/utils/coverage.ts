import type { Agent } from "../types";

export type RegionStat = {
  key: string; // e.g. "US-TX"
  country: string;
  state: string;
  count: number;
  lat: number;
  lng: number;
};

/**
 * Compute per-state agent counts and centroid (mean lat/lng of agents
 * in that state). Used by the density overlay.
 */
export function regionStats(agents: Agent[]): RegionStat[] {
  const buckets = new Map<string, { sumLat: number; sumLng: number; count: number; country: string; state: string }>();
  for (const a of agents) {
    if (!a.state) continue;
    const key = `${a.country}-${a.state}`;
    const b = buckets.get(key);
    if (b) {
      b.sumLat += a.lat;
      b.sumLng += a.lng;
      b.count += 1;
    } else {
      buckets.set(key, {
        sumLat: a.lat,
        sumLng: a.lng,
        count: 1,
        country: a.country,
        state: a.state,
      });
    }
  }
  const out: RegionStat[] = [];
  for (const [key, b] of buckets) {
    out.push({
      key,
      country: b.country,
      state: b.state,
      count: b.count,
      lat: b.sumLat / b.count,
      lng: b.sumLng / b.count,
    });
  }
  // Sort largest → smallest so big circles render under small ones
  out.sort((a, b) => b.count - a.count);
  return out;
}

/** Pixel radius for a density circle, scaled by count. */
export function densityRadius(count: number): number {
  // Log-scaled so a state with 200 agents isn't 100× bigger than one with 2.
  return Math.min(60, 14 + Math.log2(count + 1) * 8);
}
