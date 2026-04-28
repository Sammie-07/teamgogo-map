import { useEffect, useRef } from "react";

export type UrlState = {
  agentId: string | null;
  query: string;
  country: string;
  view: "map" | "list";
};

export function readUrlState(): UrlState {
  const p = new URLSearchParams(window.location.search);
  const view = p.get("view");
  return {
    agentId: p.get("agent"),
    query: p.get("q") ?? "",
    country: p.get("country") ?? "",
    view: view === "list" ? "list" : "map",
  };
}

/** Sync state into the URL (replaceState — no history pollution). */
export function useSyncUrl(state: UrlState) {
  const lastUrl = useRef("");
  useEffect(() => {
    const p = new URLSearchParams();
    if (state.agentId) p.set("agent", state.agentId);
    if (state.query) p.set("q", state.query);
    if (state.country) p.set("country", state.country);
    if (state.view !== "map") p.set("view", state.view);
    const search = p.toString();
    const url = `${window.location.pathname}${search ? "?" + search : ""}`;
    if (url !== lastUrl.current) {
      window.history.replaceState({}, "", url);
      lastUrl.current = url;
    }
  }, [state.agentId, state.query, state.country, state.view]);
}

/** Build a fully-qualified shareable URL for a single agent. */
export function shareUrlForAgent(agentId: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?agent=${encodeURIComponent(agentId)}`;
}
