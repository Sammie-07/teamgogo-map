#!/usr/bin/env python3
"""
v2 geocoder: Nominatim (OpenStreetMap) primary, zippopotam.us fallback.

Sends FULL address string ("City, State Zip, Country") for max accuracy.
Falls back to zip-only via zippopotam.us if Nominatim fails.

Rate-limited to 1 req/sec per Nominatim's usage policy. ~30 min for 1675 rows.
Caches by full address, so re-runs are fast.
"""
import csv, json, os, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "agents-source.csv")
OUT = os.path.join(ROOT, "public", "agents.json")
CACHE = os.path.join(ROOT, "scripts", ".geocache_v3.json")

UA = "teamgogo-map/1.0 (https://github.com/Sammie-07/teamgogo-map)"

cache = {}
if os.path.exists(CACHE):
    with open(CACHE) as f:
        cache = json.load(f)

def http_get_json(url: str, timeout: int = 15):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())

def nominatim(query: str):
    """Free-form structured query against Nominatim. Returns (lat,lng,display) or None."""
    url = (
        "https://nominatim.openstreetmap.org/search?"
        + urllib.parse.urlencode({
            "q": query,
            "format": "jsonv2",
            "limit": 1,
            "addressdetails": 0,
        })
    )
    try:
        data = http_get_json(url)
        if not data:
            return None
        return {
            "lat": float(data[0]["lat"]),
            "lng": float(data[0]["lon"]),
            "src": "nominatim",
            "q": query,
        }
    except Exception:
        return None

def zippopotam(country: str, zip_code: str):
    """Last-resort fallback when Nominatim fails."""
    z = (zip_code or "").strip().upper()
    if country == "CA":
        z = z.replace(" ", "")[:3]
    if not z or not country:
        return None
    url = f"https://api.zippopotam.us/{country.lower()}/{urllib.parse.quote(z)}"
    try:
        data = http_get_json(url, timeout=10)
        place = data["places"][0]
        return {
            "lat": float(place["latitude"]),
            "lng": float(place["longitude"]),
            "src": "zippopotam",
            "q": f"{country}/{z}",
        }
    except Exception:
        return None

def build_query(city: str, state: str, zip_code: str, country: str) -> str:
    parts = [p for p in [city, state, zip_code, country] if p]
    return ", ".join(parts)

# Rough country bounding boxes (min_lat, max_lat, min_lng, max_lng). Used as a
# sanity check — if a geocoder returns coords outside the expected country box,
# we reject the result. US includes Alaska/Hawaii/PR/territories.
COUNTRY_BOX = {
    "US": (17.5, 71.5, -179.2, -65.5),
    "CA": (41.0, 83.5, -141.5, -52.0),
    "AU": (-44.0, -10.0, 112.5, 154.0),
    "PR": (17.8, 18.6, -67.5, -65.5),
    "ES": (27.5, 44.0, -19.0, 4.5),    # incl. Canary Islands
    "PL": (49.0, 55.0, 14.0, 24.5),
    "PE": (-18.5, 0.5, -82.0, -68.5),
    "GB": (49.5, 61.0, -8.7, 2.0),
    "MX": (14.0, 33.0, -118.5, -86.5),
    "DE": (47.0, 55.5, 5.8, 15.1),
    "FR": (41.0, 51.5, -5.5, 9.8),
    "IT": (35.0, 47.5, 6.5, 19.0),
    "NL": (50.5, 53.8, 3.0, 7.5),
    "BE": (49.4, 51.6, 2.5, 6.5),
    "PT": (32.0, 42.5, -32.0, -6.0),    # incl. Azores/Madeira
    "BR": (-34.0, 5.5, -74.0, -34.0),
    "AR": (-56.0, -21.5, -74.0, -53.5),
    "CL": (-56.5, -17.5, -76.0, -66.0),
    "CO": (-4.5, 13.5, -82.0, -66.5),
    "VE": (0.5, 12.5, -73.5, -59.5),
    "EC": (-5.0, 1.5, -81.0, -75.0),
    "DO": (17.5, 20.0, -72.0, -68.0),
    "IN": (6.5, 36.0, 68.0, 97.5),
    "ZA": (-35.0, -22.0, 16.5, 33.0),
}

def in_country_box(country: str, lat: float, lng: float) -> bool:
    """True if (lat,lng) falls within the known box for this country, or
    True if we don't have a box for this country (be permissive)."""
    box = COUNTRY_BOX.get((country or "").upper())
    if not box:
        return True  # unknown country, can't validate
    min_lat, max_lat, min_lng, max_lng = box
    return min_lat <= lat <= max_lat and min_lng <= lng <= max_lng

def geocode(city: str, state: str, zip_code: str, country: str):
    if not country:
        country = "US"
    query = build_query(city, state, zip_code, country)
    if not query:
        return None
    if query in cache:
        return cache[query]

    result = None

    # For US zips, zippopotam.us is more reliable than Nominatim. Nominatim
    # can return the wrong "Shelby" (or any duplicate-named city) even with
    # the zip in the query; zippopotam.us is indexed by zip directly so
    # there's no ambiguity. We use it as the primary source for US zips.
    if country.upper() == "US" and zip_code:
        result = zippopotam(country, zip_code)

    # Fall back to Nominatim with the full address (good for non-US and
    # for zips zippopotam.us doesn't know about).
    if result is None:
        result = nominatim(query)
        time.sleep(1.05)  # Nominatim usage policy: 1 req/sec

    # Less-specific Nominatim retry (drop zip)
    if result is None:
        less = build_query(city, state, "", country)
        if less and less != query:
            result = nominatim(less)
            time.sleep(1.05)

    # Last resort: zippopotam for non-US zips
    if result is None and country.upper() != "US":
        result = zippopotam(country, zip_code)

    # Sanity check: reject results that fall outside the country's bounding
    # box. Catches geocoder confusing the agent's country with another
    # (e.g. an "Australia, MO" being matched to literal Australia).
    if result is not None and not in_country_box(country, result["lat"], result["lng"]):
        print(f"  WARN: rejected out-of-country result for {query!r} → "
              f"({result['lat']:.3f}, {result['lng']:.3f}) from {result.get('src')}", flush=True)
        result = None

    cache[query] = result
    return result

# Parse CSV
with open(SRC, newline="", encoding="utf-8") as f:
    rows = list(csv.reader(f))
header_idx = next(i for i, r in enumerate(rows) if r and r[0].strip() == "Agent ID")
header = [h.replace("\n", " ").strip() for h in rows[header_idx]]
data_rows = rows[header_idx + 1:]

def col(row, *names, default=""):
    """First non-empty value across the given column names. Tolerant of
    column renames in the source sheet — pass old + new names and we'll
    take whichever exists."""
    for name in names:
        try:
            idx = header.index(name)
            v = (row[idx] if idx < len(row) else "").strip()
            if v:
                return v
        except ValueError:
            continue
    return default

agents = []
total = len(data_rows)
geocoded = 0
skipped = 0
src_count = {"nominatim": 0, "zippopotam": 0}

# ---- Phase 1: parallel pre-fetch of zippopotam for uncached US zips ----
# Zippopotam has no rate limit, so hitting it with 20 concurrent workers is
# safe and drops the cold-cache runtime for ~400 new US zips from ~80s
# sequential to ~5-8s. Warms `cache` before the main loop runs.
prefetch_start = time.time()
prefetch_queries: list[tuple[str, str, str, str]] = []
seen_queries: set[str] = set()
for row in data_rows:
    if not row or not col(row, "Agent Name"):
        continue
    country = col(row, "Agent Country") or "US"
    if country.upper() != "US":
        continue
    zip_code = col(row, "Agent Postal Code", "Agent Postal (zip) Code")
    # Normalise US zips: Google Sheets treats them as numbers and strips leading
    # zeros from northeast US zips (MA/NJ/CT/ME/RI/NH/VT all start with "0").
    # Also strip ZIP+4 suffixes (e.g. "80528-4412") — zippopotam.us only knows
    # the base 5-digit code.
    _c = (country or "US").upper()
    if _c == "US" and zip_code:
        if "-" in zip_code:
            zip_code = zip_code.split("-")[0].strip()
        if zip_code.isdigit() and len(zip_code) < 5:
            zip_code = zip_code.zfill(5)
    if not zip_code:
        continue
    city = col(row, "Agent City")
    state = col(row, "Agent State")
    query = build_query(city, state, zip_code, country)
    if query in cache or query in seen_queries:
        continue
    seen_queries.add(query)
    prefetch_queries.append((query, country, zip_code, city + "|" + state))

if prefetch_queries:
    print(f"Prefetching zippopotam.us for {len(prefetch_queries)} uncached US queries "
          f"(20 workers)…", flush=True)
    def _fetch_one(item):
        query, country, zip_code, _ctx = item
        return query, zippopotam(country, zip_code)
    with ThreadPoolExecutor(max_workers=20) as ex:
        for i, (q, res) in enumerate(ex.map(_fetch_one, prefetch_queries)):
            cache[q] = res  # may be None if zip unknown → main loop will fall back
    with open(CACHE, "w") as f:
        json.dump(cache, f)
    print(f"  prefetch done in {int(time.time() - prefetch_start)}s "
          f"({sum(1 for q in seen_queries if cache.get(q)) } of {len(prefetch_queries)} resolved)",
          flush=True)

# ---- Phase 2: main loop (now mostly cache hits + Nominatim for non-US) ----
start = time.time()
for i, row in enumerate(data_rows):
    if not row or not col(row, "Agent Name"):
        continue
    country = col(row, "Agent Country") or "US"
    city = col(row, "Agent City")
    state = col(row, "Agent State")
    zip_code = col(row, "Agent Postal Code", "Agent Postal (zip) Code")
    # Normalise US zips: Google Sheets treats them as numbers and strips leading
    # zeros from northeast US zips (MA/NJ/CT/ME/RI/NH/VT all start with "0").
    # Also strip ZIP+4 suffixes (e.g. "80528-4412") — zippopotam.us only knows
    # the base 5-digit code.
    _c = (country or "US").upper()
    if _c == "US" and zip_code:
        if "-" in zip_code:
            zip_code = zip_code.split("-")[0].strip()
        if zip_code.isdigit() and len(zip_code) < 5:
            zip_code = zip_code.zfill(5)
    coords = geocode(city, state, zip_code, country)
    if coords is None:
        skipped += 1
    else:
        geocoded += 1
        src_count[coords.get("src", "nominatim")] = src_count.get(coords.get("src", "nominatim"), 0) + 1
        agents.append({
            "id": col(row, "Agent ID"),
            "name": col(row, "Agent Name"),
            "email": col(row, "Agent Primary Email"),
            "email2": col(row, "Agent Secondary Email"),
            "phone": col(row, "Agent Phone Number"),
            "city": city,
            "state": state,
            "zip": zip_code,
            "country": country,
            "status": col(row, "Status"),
            "level": col(row, "Level"),
            "years": col(row, "Years with eXp"),
            "influencer": col(row, "Influencer Status"),
            "lat": coords["lat"],
            "lng": coords["lng"],
        })
    if i % 25 == 0:
        elapsed = int(time.time() - start)
        eta = int(elapsed * (total - i - 1) / max(i + 1, 1))
        print(f"[{i+1}/{total}] geocoded={geocoded} skipped={skipped} src={src_count} elapsed={elapsed}s eta={eta}s", flush=True)
        with open(CACHE, "w") as f:
            json.dump(cache, f)

with open(CACHE, "w") as f:
    json.dump(cache, f)

# Safety check #1: row-count regression.
# If the new dataset is dramatically smaller than the previous one, refuse
# to overwrite. Probably means the sheet or geocoder broke and would
# silently delete agents from the live map otherwise.
prev_agents = []
if os.path.exists(OUT):
    try:
        with open(OUT) as f:
            prev_agents = json.load(f)
    except Exception:
        prev_agents = []

if prev_agents and len(agents) < 0.8 * len(prev_agents):
    print(f"\n!!! ABORTING: new dataset has {len(agents)} rows but previous had "
          f"{len(prev_agents)}. That's a {(1 - len(agents)/len(prev_agents))*100:.0f}% "
          f"drop — refusing to overwrite. Investigate sheet/geocoder before retrying.",
          flush=True)
    sys.exit(2)

# Safety check #2: coord-drift summary.
# Compare each agent (by id) against their previous coordinates. Flags any
# agent that moved >100 km between runs (suggests geocoder regression).
def haversine_km(lat1, lng1, lat2, lng2):
    import math
    R = 6371
    rl1, rl2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lat2 - lat1)
    dg = math.radians(lng2 - lng1)
    h = math.sin(dl/2)**2 + math.cos(rl1) * math.cos(rl2) * math.sin(dg/2)**2
    return 2 * R * math.asin(math.sqrt(h))

drift_threshold_km = 100
prev_by_key = {f"{a.get('id','')}|{a.get('zip','')}|{a.get('city','')}": a for a in prev_agents}
drifted = []
for a in agents:
    key = f"{a['id']}|{a['zip']}|{a['city']}"
    prev = prev_by_key.get(key)
    if prev and "lat" in prev and "lng" in prev:
        d = haversine_km(prev["lat"], prev["lng"], a["lat"], a["lng"])
        if d > drift_threshold_km:
            drifted.append((a["name"], a["city"], a["state"], d))

with open(OUT, "w") as f:
    json.dump(agents, f, separators=(",", ":"))

print(f"\nDONE. {len(agents)} agents written to {OUT}")
print(f"  Skipped: {skipped}")
print(f"  Sources: {src_count}")
print(f"  Total time: {int(time.time() - start)}s")
if prev_agents:
    print(f"  Row count: {len(prev_agents)} → {len(agents)} (delta {len(agents)-len(prev_agents):+d})")
if drifted:
    print(f"\n  ! {len(drifted)} agent(s) moved >{drift_threshold_km}km from previous run:")
    for name, city, state, d in drifted[:25]:
        print(f"    {name} ({city}, {state}): {d:.0f}km")
    if len(drifted) > 25:
        print(f"    ...and {len(drifted)-25} more")
