import { useEffect, useMemo, useState } from "react";
import { MapView } from "./components/MapView";
import { ListView } from "./components/ListView";
import { SidePanel } from "./components/SidePanel";
import { SearchBar } from "./components/SearchBar";
import { fanOutOverlaps } from "./utils/positions";
import { matchesQuery } from "./utils/search";
import type { Agent } from "./types";

type View = "map" | "list";

export default function App() {
  const [agentsRaw, setAgentsRaw] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("map");
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [selected, setSelected] = useState<Agent | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}agents.json`)
      .then((r) => r.json())
      .then((data: Agent[]) => {
        setAgentsRaw(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const agents = useMemo(() => fanOutOverlaps(agentsRaw), [agentsRaw]);

  const countries = useMemo(() => {
    const set = new Set(agents.map((a) => a.country).filter(Boolean));
    return Array.from(set).sort();
  }, [agents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((a) => {
      if (country && a.country !== country) return false;
      return matchesQuery(a, q);
    });
  }, [agents, query, country]);

  function pickAgent(a: Agent) {
    setSelected(a);
    setFlyTarget({ lat: a.lat, lng: a.lng, zoom: 12 });
  }

  return (
    <div className="app">
      <header className="header">
        <h1>#teamgogo map</h1>
        <span className="count">
          {loading
            ? "Loading…"
            : `${filtered.length.toLocaleString()} of ${agents.length.toLocaleString()} agents`}
        </span>
        <SearchBar
          query={query}
          onQueryChange={setQuery}
          agents={filtered}
          onPick={pickAgent}
        />
        <select
          className="filter"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        >
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <div className="toggle">
          <button
            className={view === "map" ? "active" : ""}
            onClick={() => setView("map")}
          >
            Map
          </button>
          <button
            className={view === "list" ? "active" : ""}
            onClick={() => setView("list")}
          >
            List
          </button>
        </div>
      </header>
      <div className="body">
        {view === "map" ? (
          <MapView
            agents={filtered}
            selectedId={selected?.id ?? null}
            flyTarget={flyTarget}
            onSelect={pickAgent}
          />
        ) : (
          <ListView agents={filtered} onSelect={pickAgent} />
        )}
        {selected && <SidePanel agent={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}
