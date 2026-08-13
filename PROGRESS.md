# Progress File — #teamgogo map

_Last updated: 2026-08-13. Kept current with every commit; auto-mirrored to Drive._

> **Team mirror (Google Drive):** This file is auto-copied to Google Drive as **"Progress File - #teamgogo map.md"** in the folder `1Ohu5GNOY6TndHHg0LOauF5JVEcrkKMkV` ("Progress Files For All AI Projects"). Any commit that includes a change to this file re-uploads it.

---

## What This Is

A public web-based directory of every #teamgogo eXp Realty agent. Visitors can browse ~1,290 agents across ~5 countries, find the nearest agent to their location, share direct links to an agent's profile, and contact them.

**Live at:**
- Primary: **https://map.teamgogo.team/**
- Vercel fallback: https://teamgogo-map.vercel.app/
- GitHub Pages backup: https://sammie-07.github.io/teamgogo-map/

**Repo:** https://github.com/Sammie-07/teamgogo-map

---

## Tech Stack

| Layer | Tool | Role |
|-------|------|------|
| Framework | Vite + React 18 + TypeScript | Build system + UI |
| Map library | Leaflet + react-leaflet | Map rendering, pins, controls |
| Tile provider | CartoDB Voyager (light) / DarkMatter (dark) | Free, clean, no Mapbox dependency |
| Hosting | Vercel (Hobby / free tier) | Primary hosting on custom domain |
| Backup hosting | GitHub Pages | Same code deploys to `sammie-07.github.io/teamgogo-map/` |
| Analytics | Vercel Analytics | Visitor + page-view tracking (2500 events/mo free) |
| Data source | Google Sheet (Gogo's eXp agent export) | Refreshed hourly |
| Geocoding | zippopotam.us (US zips) + Nominatim/OpenStreetMap (fallback) | Free, zip-accurate |
| Refresh pipeline | GitHub Actions (`refresh-data.yml`) | Hourly cron + manual trigger |

---

## Data Pipeline

```
Google Sheet (Gogo's team edits here)
  → GitHub Action runs every hour at :23 past
  → Downloads sheet as CSV
  → Geocodes any new zip codes (zippopotam.us first, then Nominatim)
  → Runs safeguards (row-count drop check, cross-run coord drift, country-bounding-box validation)
  → Commits updated `public/agents.json` if anything changed
  → Vercel auto-deploys the new commit
  → Map updates for visitors within ~2 minutes total
```

**Manual refresh** (skip the wait for the next :23):
1. Go to https://github.com/Sammie-07/teamgogo-map/actions
2. Click "Refresh agent data from sheet" in the left sidebar
3. Click "Run workflow" → green "Run workflow" button
4. ~90 seconds later the map is updated

---

## Features Currently Built

### Map view
- All agents rendered as red circle markers on Leaflet map
- CartoDB tiles wrap horizontally (tiles always fill the viewport, no blue empty strips)
- minZoom = 3 (can't zoom out past the world), maxZoom = 18
- maxBounds constrained to 3° around the outermost agents (can't pan far into empty ocean)
- Opening shot fits the **lower-48 US** — the densest agent region — regardless of viewport size
- Density overlay (◉ button) shows translucent circles per state sized by agent count

### Search & filtering
- Search bar with autocomplete dropdown (top 8 matches)
- Token-based matching: `"Kaitlyn Posey"` matches `"Kaitlyn N Posey"` (handles middle initials, suffixes)
- Full state names work: `"texas"` finds all TX agents
- Full country names work: `"united states"` finds all US agents
- Search NEVER hides pins — the map always shows all agents so visitors can see the nearest available options
- Country dropdown flies the map to that country but leaves all pins visible

### Agent interactions
- Click pin → side panel slides in with contact info (email, phone) gated behind "Show contact" click (privacy)
- Click autocomplete suggestion → map flies to that agent, side panel opens
- Selected pin gets a pulsing red ring animation
- Multi-location agents (2 rows in the sheet for primary + secondary location) show as 2 pins; picking one fits map bounds to both

### Header & discovery
- Hero stats line: **"1,292 agents · 5 countries · 46 US states · 749 cities"** in brand red
- Pin-drop pulse animation on first load (~700ms) — dots pop into view drawing attention to scale
- Agent name labels fade in at high zoom (~zoom 11+) with an anti-overlap algorithm (labels never cover each other)

### Personalization
- **Find me** 📍 button — geolocation permission → drops a pulsing blue dot at your location, sorts list view by distance from you
- **Dark mode** ☾ toggle — remembers preference in localStorage, respects OS `prefers-color-scheme`
- **Shareable agent URLs** — `?agent=<rowKey>` deep-links directly to a specific agent's location (works for both locations of multi-location agents)

### List view
- Toggle between Map / List in header
- Cards with agent name, city, state, distance (when Find Me is on)
- `content-visibility` CSS = smooth scrolling even with 1,292 cards
- Empty state and loading skeletons

### Icon button tooltips
- Custom CSS tooltips on hover for 📍 ◉ ☾ buttons (native browser `title` is too slow / ugly)

---

## Safeguards Built Into the Pipeline

Every hourly refresh runs these before writing new data:

1. **Row-count drop check** — if the sheet suddenly has ≥100 fewer named rows than the previous run, abort. Prevents accidental mass deletion.
2. **Cross-run coord drift** — if any agent's lat/lng moves more than 100 km between runs without their address changing, log a warning (potential geocoder regression).
3. **Country-bounding-box validation** — if a US agent's coordinates land outside the US bounding box, log a warning (geocoder error).

4. **Per-step timeouts** — the whole refresh job is capped at 10 min; sheet download at 2 min (with 2 retries); geocode step at 6 min. Transient runner/API hangs fail fast (was ~15 min before 2026-08-06).

Failed refreshes email the repo owner and don't overwrite the good data.

---

## Recent Fixes / Conventions to Remember

- **Parallel zip-code prefetch** (2026-08-13): the geocoder now fires up to 20 concurrent zippopotam.us requests before the sequential main loop. Cold-cache runs on ~400 new US agents dropped from ~6 min to well under 2 min. Fixed the hourly-refresh failures that started when the sheet grew from 1,300 → 1,700 rows.
- **Refresh timeouts tuned**: 15 min job cap / 9 min geocode step / 2 min sheet download (with 2 retries). Was 10/6/2 before the sheet growth.
- **Sheet column renames** are tolerated: the geocoder accepts both `"Agent Postal Code"` (current) and the old `"Agent Postal (zip) Code"`. If any team member renames columns further, add the new name to `scripts/geocode_v2.py`.
- **Polish/non-ASCII characters** in city or agent names that arrive as `��` are already corrupted at the **source sheet level** (not our code). Fix at the sheet.
- **When two different agents both have empty Agent IDs at the same location**, the dedupe key falls back to using the agent's name — so no one gets silently dropped.
- **US zips always resolve via zippopotam.us**, never Nominatim. Nominatim mis-handles duplicate-named cities (e.g. "Shelby Twp, MI" used to land in Oceana County instead of Macomb County).
- **Non-numeric Agent IDs** (e.g. someone typed `"Cosponsor"` in the ID column) are ignored for peer-matching. Real eXp Agent IDs are always numeric — anything else is data error.
- **Do not use `git amend`** on shared branches. Always create new commits.

---

## Open Items / What's Not Built Yet

**Suggested next (in priority order):**
1. **Agent photos + short bios** — needs data collection (e.g. Google Form sent to all agents). Would be the single biggest visual upgrade.
2. **Password protection** — Basic Auth via Vercel middleware. Scoped but not yet built. Would restrict the site to team + partners only.
3. **True blur-based heatmap** for the density view (currently just circles).
4. **PWA install** (works offline, add-to-home-screen).
5. **Open Graph card image** — when someone shares an agent URL on iMessage/WhatsApp/Twitter, show a preview with the agent's name + location.

**Known data-cleanup tasks** the team should handle in the sheet:
- 6 agents currently have literal text `"Cosponsor"` in their Agent ID column (Galina Iancu, Ana Bialek, Meagan Clark, Liz Brown, Nikki Wolfe, Lauren Blizzard). Should be replaced with their real numeric agent IDs.

---

## Quick-Reference Links

- **Live map**: https://map.teamgogo.team/
- **GitHub repo**: https://github.com/Sammie-07/teamgogo-map
- **Manual refresh**: https://github.com/Sammie-07/teamgogo-map/actions/workflows/refresh-data.yml
- **Source sheet**: https://docs.google.com/spreadsheets/d/1AuNeVPAhWvdFvHiSIIz1UW6sgTMYSmIy05wTo42uVdY/edit
- **Vercel dashboard**: https://vercel.com/sammie-07s-projects/teamgogo-map
- **Vercel Analytics**: Vercel dashboard → teamgogo-map → Analytics tab
- **Drive team folder**: https://drive.google.com/drive/folders/1Ohu5GNOY6TndHHg0LOauF5JVEcrkKMkV

---

## How This File Stays in Sync

**Automatic** — a git `post-commit` hook copies this file to the Google Drive for Desktop synced folder (path in local `git config progress.syncDir`). Drive for Desktop then uploads it to the "Progress Files For All AI Projects" folder as **"Progress File - #teamgogo map.md"**.

**When Claude commits from /tmp** — the hook may not be installed on that ephemeral clone; Claude also does an explicit `cp` to the sync path after every push, matching this same behavior.

**Manual re-wire (after a fresh clone):**
```
git config progress.syncDir "/Users/mac/Library/CloudStorage/GoogleDrive-tech@gogosrealestate.com/My Drive/Progress Files For All AI Projects"
cat > .git/hooks/post-commit <<'SH'
#!/bin/sh
dest="$(git config --get progress.syncDir)"
[ -z "$dest" ] && exit 0
[ -d "$dest" ] || exit 0
root="$(git rev-parse --show-toplevel)"
src="$root/PROGRESS.md"
[ -f "$src" ] || exit 0
cp "$src" "$dest/Progress File - #teamgogo map.md" 2>/dev/null || true
exit 0
SH
chmod +x .git/hooks/post-commit
```
