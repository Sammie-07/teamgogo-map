import { useEffect, useMemo, useState } from "react";
import { MapView } from "./components/MapView";
import { ListView } from "./components/ListView";
import type { Agent } from "./types";

type View = "map" | "list";

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("map");
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}agents.json`)
      .then((r) => r.json())
      .then((data: Agent[]) => {
        setAgents(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const countries = useMemo(() => {
    const set = new Set(agents.map((a) => a.country).filter(Boolean));
    return Array.from(set).sort();
  }, [agents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((a) => {
      if (country && a.country !== country) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.state.toLowerCase().includes(q) ||
        a.zip.toLowerCase().includes(q)
      );
    });
  }, [agents, query, country]);

  return (
    <div className="app">
      <header className="header">
        <h1>#teamgogo map</h1>
        <span className="count">
          {loading ? "Loading…" : `${filtered.length.toLocaleString()} of ${agents.length.toLocaleString()} agents`}
        </span>
        <input
          className="search"
          placeholder="Search name, city, state, zip…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
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
        {view === "map" ? <MapView agents={filtered} /> : <ListView agents={filtered} />}
      </div>
    </div>
  );
}
