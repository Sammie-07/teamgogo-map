import type { Agent } from "../types";
import { countriesMatchingQuery, statesMatchingQuery } from "./regions";

/** Returns true if the agent matches the (already-lowercased) query. */
export function matchesQuery(agent: Agent, q: string): boolean {
  if (!q) return true;
  // 1) Whole-query substring match across the obvious fields
  if (
    agent.name.toLowerCase().includes(q) ||
    agent.city.toLowerCase().includes(q) ||
    agent.state.toLowerCase().includes(q) ||
    agent.zip.toLowerCase().includes(q) ||
    agent.country.toLowerCase().includes(q)
  ) {
    return true;
  }
  // 2) Full state name ("texas" → "TX")
  if (statesMatchingQuery(q).includes(agent.state.toUpperCase())) return true;
  // 3) Full country name ("united states" → "US")
  if (countriesMatchingQuery(q).includes(agent.country.toUpperCase())) return true;
  // 4) Token-based match across name + city — handles middle names, suffixes,
  //    and word reordering. "kaitlyn posey" matches "Kaitlyn N Posey",
  //    "trevor mi foster" matches "Trevor Foster" in MI, etc.
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length >= 2) {
    const haystack = (
      agent.name + " " + agent.city + " " + agent.state + " " + agent.zip
    ).toLowerCase();
    if (tokens.every((t) => haystack.includes(t))) return true;
  }
  return false;
}
