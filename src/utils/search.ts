import type { Agent } from "../types";
import { countriesMatchingQuery, statesMatchingQuery } from "./regions";

/** Returns true if the agent matches the (already-lowercased) query. */
export function matchesQuery(agent: Agent, q: string): boolean {
  if (!q) return true;
  if (
    agent.name.toLowerCase().includes(q) ||
    agent.city.toLowerCase().includes(q) ||
    agent.state.toLowerCase().includes(q) ||
    agent.zip.toLowerCase().includes(q) ||
    agent.country.toLowerCase().includes(q)
  ) {
    return true;
  }
  // Allow searching by full state name ("texas" → "TX")
  const states = statesMatchingQuery(q);
  if (states.includes(agent.state.toUpperCase())) return true;
  // Allow searching by full country name ("united states" → "US")
  const countries = countriesMatchingQuery(q);
  if (countries.includes(agent.country.toUpperCase())) return true;
  return false;
}
