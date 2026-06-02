import { useCallback, useEffect, useMemo, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { MapView, type FlyTarget } from "./components/MapView";
import { ListView } from "./components/ListView";
import { SidePanel } from "./components/SidePanel";
import { SearchBar } from "./components/SearchBar";
import { MapSkeleton, ListSkeleton } from "./components/LoadingSkeleton";
import { fanOutOverlaps } from "./utils/positions";
import { matchesQuery } from "./utils/search";
import { agentsBounds, boundsOfAgents } from "./utils/bounds";
import { readUrlState, useSyncUrl } from "./utils/url";
import { agentRowKey } from "./utils/identity";
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
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);
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

  // Dedupe + spread overlapping pins.
  // KEY: agent ID + location. Same ID + same location = real duplicate
  // (drop one). Same ID + different location = primary/secondary location
  // (keep both — agent gets two pins on the map).
  const agents = useMemo(() => {
    const seen = new Set<string>();
    const unique = agentsRaw.filter((a) => {
      const k = agentRowKey(a);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return fanOutOverlaps(unique);
  }, [agentsRaw]);

  // After data loads, if URL had ?agent=, open that agent.
  // Tries exact rowKey match first; falls back to matching just the id
  // (for older share URLs that only encoded the id).
  useEffect(() => {
    if (initialUrl.agentId && agents.length > 0 && !selected) {
      const found =
        agents.find((a) => agentRowKey(a) === initialUrl.agentId) ??
        agents.find((a) => a.id === initialUrl.agentId);
      if (found) {
        setSelected(found);
        setFlyTarget({ kind: "point", lat: found.lat, lng: found.lng, zoom: 12 });
      }
    }
  }, [agents, initialUrl.agentId, selected]);

  // Sync state → URL (use rowKey so each location is shareable)
  useSyncUrl({
    agentId: selected ? agentRowKey(selected) : null,
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
    // Search is GLOBAL — when the user is searching, ignore the country
    // filter so they can find agents in any country. When not searching,
    // the country filter applies as a "browse this country" mode.
    const applyCountryFilter = q === "";
    return agents.filter((a) => {
      if (applyCountryFilter && country && a.country !== country) return false;
      return matchesQuery(a, q);
    });
  }, [agents, query, country]);

  const maxBounds = useMemo<LatLngBoundsExpression | null>(() => {
    return agentsBounds(agents);
  }, [agents]);

  // Flies the map to the agent. Used by search/list where the user is
  // navigating to a new agent. If the picked agent has multiple location
  // rows (primary + secondary), fits bounds to ALL their pins so the user
  // sees every location at once instead of just one.
  const pickAgent = useCallback(
    (a: Agent) => {
      setSelected(a);
      if (country && a.country !== country) {
        setCountry("");
      }
      // Find peer rows for this agent — multi-location case.
      // Same agent if: identical non-empty id, OR one name's word-set is a
      // subset/superset of the other's (handles "Kaitlyn Posey" + "Kaitlyn N
      // Posey", "John Smith Jr." + "John Smith", etc.)
      const aWords = a.name
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 2);
      const aSet = new Set(aWords);
      const peers = agents.filter((x) => {
        if (x === a) return true;
        // Both have non-empty ids → must match exactly (avoid merging
        // two unrelated "John Smith"s who both happen to be teamgogo agents)
        if (a.id && x.id) return a.id === x.id;
        // Otherwise fall back to name word-set subset/superset
        const xWords = x.name
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length >= 2);
        if (xWords.length === 0 || aWords.length === 0) return false;
        const xSet = new Set(xWords);
        const aSubsetOfX = aWords.every((w) => xSet.has(w));
        const xSubsetOfA = xWords.every((w) => aSet.has(w));
        return aSubsetOfX || xSubsetOfA;
      });
      if (peers.length > 1) {
        const b = boundsOfAgents(peers, 0.3);
        if (b) {
          setFlyTarget({ kind: "bounds", bounds: b });
          return;
        }
      }
      setFlyTarget({ kind: "point", lat: a.lat, lng: a.lng, zoom: 12 });
    },
    [agents, country]
  );

  // Selects an agent without changing the map view. Used by direct pin/label
  // clicks — the user is already looking at the pin, don't yank them
  // somewhere else.
  const selectOnMap = useCallback((a: Agent) => {
    setSelected(a);
  }, []);

  // Enter on the search box: fit the map to ALL results without selecting
  // anyone. Lets the user see everything matching their query at once.
  const submitSearch = useCallback(() => {
    if (filtered.length === 0) return;
    if (filtered.length === 1) {
      setFlyTarget({
        kind: "point",
        lat: filtered[0].lat,
        lng: filtered[0].lng,
        zoom: 12,
      });
      return;
    }
    const b = boundsOfAgents(filtered, 0.3);
    if (b) setFlyTarget({ kind: "bounds", bounds: b });
  }, [filtered]);

  // Auto-fit the map when the country filter changes — so picking a country
  // with one agent zooms straight to that pin, and picking a country with
  // many fits all of them in view.
  useEffect(() => {
    if (loading || agents.length === 0) return;
    if (country) {
      const inCountry = agents.filter((a) => a.country === country);
      if (inCountry.length === 0) return;
      if (inCountry.length === 1) {
        setFlyTarget({
          kind: "point",
          lat: inCountry[0].lat,
          lng: inCountry[0].lng,
          zoom: 11,
        });
      } else {
        const b = boundsOfAgents(inCountry, 0.5);
        if (b) setFlyTarget({ kind: "bounds", bounds: b });
      }
    } else {
      setFlyTarget({
        kind: "point",
        lat: DEFAULT_VIEW.center[0],
        lng: DEFAULT_VIEW.center[1],
        zoom: DEFAULT_VIEW.zoom,
      });
    }
    // We only react to the country filter — not to agents/loading after
    // initial mount — so this fires when the user changes the dropdown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  function toggleLocation() {
    // Already located? Click clears it and flies back to the default overview.
    if (userLocation) {
      setUserLocation(null);
      setFlyTarget({
        kind: "point",
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
        setFlyTarget({ kind: "point", ...loc, zoom: 9 });
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
          onSubmit={submitSearch}
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
          data-tooltip={
            locating
              ? "Locating…"
              : userLocation
              ? "Clear my location"
              : "Find agents near me"
          }
          aria-label={userLocation ? "Clear location" : "Find agents near me"}
        >
          {locating ? "…" : "📍"}
        </button>

        <button
          className={`icon-btn${showDensity ? " active" : ""}`}
          onClick={() => setShowDensity((v) => !v)}
          data-tooltip={showDensity ? "Hide coverage density" : "Show coverage density"}
          aria-label="Toggle coverage density"
        >
          ◉
        </button>

        <button
          className="icon-btn"
          onClick={() => setDarkMode((v) => !v)}
          data-tooltip={darkMode ? "Switch to light mode" : "Switch to dark mode"}
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
            onSelect={selectOnMap}
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
      <Analytics />
    </div>
  );
}
