import type { Agent } from "../types";

/**
 * Unique identifier per agent ROW (not per agent).
 *
 * One agent can have up to two rows in the source sheet — primary +
 * secondary location — and each row is its own pin on the map. So we
 * key on a composite of agent id + location, not just id. Used for
 * React keys, selection comparison, URL share, and dedupe.
 *
 * Two rows with the same composite key are considered exact duplicates
 * (data quality issue) and only one is kept. When id is missing we use
 * the agent's name as the fallback identifier — so two different agents
 * who both lack ids at the same location don't collide.
 */
export function agentRowKey(
  a: Pick<Agent, "id" | "name" | "city" | "zip" | "state" | "country">
): string {
  const slug = (s: string) =>
    (s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const idPart = a.id ? a.id : `name-${slug(a.name) || "x"}`;
  return `${idPart}-${slug(a.country)}-${slug(a.state)}-${slug(a.zip)}-${slug(a.city)}`;
}

/** Same as agentRowKey but accepts null/undefined. */
export function agentRowKeyOrNull(
  a: Pick<Agent, "id" | "name" | "city" | "zip" | "state" | "country"> | null | undefined
): string | null {
  return a ? agentRowKey(a) : null;
}
