import { useEffect, useRef, useState } from "react";
import type { Agent } from "../types";
import { matchesQuery } from "../utils/search";

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  agents: Agent[];
  onPick: (a: Agent) => void;
};

export function SearchBar({ query, onQueryChange, agents, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const q = query.trim().toLowerCase();
  const suggestions: Agent[] = q
    ? agents.filter((a) => matchesQuery(a, q)).slice(0, 8)
    : [];

  function pick(a: Agent) {
    onPick(a);
    setOpen(false);
  }

  return (
    <div className="search-wrap" ref={wrapRef}>
      <input
        className="search"
        placeholder="Search name, city, state, zip…"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(suggestions[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && suggestions.length > 0 && (
        <ul className="suggestions">
          {suggestions.map((a, i) => (
            <li
              key={a.id}
              className={i === highlight ? "active" : ""}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // avoid blur before click
                pick(a);
              }}
            >
              <span className="sug-name">{a.name}</span>
              <span className="sug-loc">
                {[a.city, a.state, a.country].filter(Boolean).join(", ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
