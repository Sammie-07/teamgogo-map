import { useCallback, useEffect, useMemo, useState } from "react";
import { MapView } from "./components/MapView";
import { ListView } from "./components/ListView";
import { SidePanel } from "./components/SidePanel";
import { SearchBar } from "./components/SearchBar";
import { MapSkeleton, ListSkeleton } from "./components/LoadingSkeleton";
import { fanOutOverlaps } from "./utils/positions";
import { matchesQuery } from "./utils/search";
import { agentsBounds } from "./utils/bounds";
import { readUrlState, useSyncUrl } from "./utils/url";
import type { Agent } from "./types";
import type { LatLngBoundsExpression } from "leaflet";

type View = "map" | "list";

const DEFAULT_VIEW = { center: [39.5, -98.35] as [number, number], zoom: 4 };

function readDarkPref(): boolean {
  const stored = localStorage.getItem("teamgogo-dark");
  if (stored !== null) return stored === "1";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function App() {
  const [agentsRaw, setAgentsRaw] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const initialUrl = useMemo(readUrlState, []);
  const [view, setView] = useState<View>(initialUrl.view);
  const [query, setQuery] = useState(initialUrl.query);
  const [country, setCountry] = useState(initialUrl.country);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [showDensity, setShowDensity] = useState(false);
  const [darkMode, setDarkMode] = useState(readDarkPref);

  // Theme — apply class to <html> so CSS variables flip
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("teamgogo-dark", darkMode ? "1" : "0");
  }, [darkMode]);

  // Load data
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}agents.json`)
      .then((r) => r.json())
      .then((data: Agent[]) => {
        setAgentsRaw(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Dedupe + spread overlapping pins
  const agents = useMemo(() => {
    const seen = new Set<string>();
    const unique = agentsRaw.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
    return fanOutOverlaps(unique);
  }, [agentsRaw]);

  // After data loads, if URL had ?agent=, open that agent
  useEffect(() => {
    if (initialUrl.agentId && agents.length > 0 && !selected) {
      const found = agents.find((a) => a.id === initialUrl.agentId);
      if (found) {
        setSelected(found);
        setFlyTarget({ lat: found.lat, lng: found.lng, zoom: 12 });
      }
    }
  }, [agents, initialUrl.agentId, selected]);

  // Sync state → URL
  useSyncUrl({
    agentId: selected?.id ?? null,
    query,
    country,
    view,
  });

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

  const maxBounds = useMemo<LatLngBoundsExpression | null>(() => {
    return agentsBounds(agents);
  }, [agents]);

  const pickAgent = useCallback((a: Agent) => {
    setSelected(a);
    setFlyTarget({ lat: a.lat, lng: a.lng, zoom: 12 });
  }, []);

  function toggleLocation() {
    // Already located? Click clears it and flies back to the default overview.
    if (userLocation) {
      setUserLocation(null);
      setFlyTarget({
        lat: DEFAULT_VIEW.center[0],
        lng: DEFAULT_VIEW.center[1],
        zoom: DEFAULT_VIEW.zoom,
      });
      return;
    }
    if (!navigator.geolocation) {
      alert("Geolocation isn't available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setFlyTarget({ ...loc, zoom: 9 });
        setLocating(false);
      },
      () => {
        alert("Couldn't get your location. Check browser permissions.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
    );
  }

  return (
    <div className={`app${darkMode ? " dark" : ""}`}>
      <header className="header">
        <h1>
          <span className="logo-dot" /> #teamgogo map
        </h1>
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
          aria-label="Filter by country"
        >
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <button
          className={`icon-btn${userLocation ? " active" : ""}`}
          onClick={toggleLocation}
          disabled={locating}
          title={userLocation ? "Clear location" : "Find agents near me"}
          aria-label={userLocation ? "Clear location" : "Find agents near me"}
        >
          {locating ? "…" : "📍"}
        </button>

        <button
          className={`icon-btn${showDensity ? " active" : ""}`}
          onClick={() => setShowDensity((v) => !v)}
          title="Toggle coverage density"
          aria-label="Toggle coverage density"
        >
          ◉
        </button>

        <button
          className="icon-btn"
          onClick={() => setDarkMode((v) => !v)}
          title="Toggle dark mode"
          aria-label="Toggle dark mode"
        >
          {darkMode ? "☀" : "☾"}
        </button>

        <div className="toggle">
          <button className={view === "map" ? "active" : ""} onClick={() => setView("map")}>
            Map
          </button>
          <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
            List
          </button>
        </div>
      </header>

      <div className="body">
        {loading ? (
          view === "map" ? <MapSkeleton /> : <ListSkeleton />
        ) : view === "map" ? (
          <MapView
            agents={filtered}
            selected={selected}
            flyTarget={flyTarget}
            onSelect={pickAgent}
            maxBounds={maxBounds}
            initialView={DEFAULT_VIEW}
            showDensity={showDensity}
            userLocation={userLocation}
            darkMode={darkMode}
          />
        ) : (
          <ListView
            agents={filtered}
            onSelect={pickAgent}
            userLocation={userLocation}
            query={query}
          />
        )}
        {selected && (
          <SidePanel
            agent={selected}
            onClose={() => setSelected(null)}
            userLocation={userLocation}
          />
        )}
      </div>
    </div>
  );
}
