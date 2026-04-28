#!/usr/bin/env python3
"""
v2 geocoder: Nominatim (OpenStreetMap) primary, zippopotam.us fallback.

Sends FULL address string ("City, State Zip, Country") for max accuracy.
Falls back to zip-only via zippopotam.us if Nominatim fails.

Rate-limited to 1 req/sec per Nominatim's usage policy. ~30 min for 1675 rows.
Caches by full address, so re-runs are fast.
"""
import csv, json, os, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "agents-source.csv")
OUT = os.path.join(ROOT, "public", "agents.json")
CACHE = os.path.join(ROOT, "scripts", ".geocache_v2.json")

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

def geocode(city: str, state: str, zip_code: str, country: str):
    if not country:
        country = "US"
    query = build_query(city, state, zip_code, country)
    if not query:
        return None
    if query in cache:
        return cache[query]
    # Primary: full-address Nominatim
    result = nominatim(query)
    time.sleep(1.05)  # Nominatim usage policy: 1 req/sec
    if result is None:
        # Try less-specific Nominatim query (drop zip)
        less = build_query(city, state, "", country)
        if less and less != query:
            result = nominatim(less)
            time.sleep(1.05)
    if result is None:
        # Fallback: zippopotam by zip alone
        result = zippopotam(country, zip_code)
    cache[query] = result
    return result

# Parse CSV
with open(SRC, newline="", encoding="utf-8") as f:
    rows = list(csv.reader(f))
header_idx = next(i for i, r in enumerate(rows) if r and r[0] == "Agent ID")
header = [h.replace("\n", " ").strip() for h in rows[header_idx]]
data_rows = rows[header_idx + 1:]

def col(row, name, default=""):
    try:
        idx = header.index(name)
        return (row[idx] if idx < len(row) else default).strip()
    except ValueError:
        return default

agents = []
total = len(data_rows)
geocoded = 0
skipped = 0
src_count = {"nominatim": 0, "zippopotam": 0}

start = time.time()
for i, row in enumerate(data_rows):
    if not row or not col(row, "Agent Name"):
        continue
    country = col(row, "Agent Country") or "US"
    city = col(row, "Agent City")
    state = col(row, "Agent State")
    zip_code = col(row, "Agent Postal (zip) Code")
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
with open(OUT, "w") as f:
    json.dump(agents, f, separators=(",", ":"))

print(f"\nDONE. {len(agents)} agents written to {OUT}")
print(f"  Skipped: {skipped}")
print(f"  Sources: {src_count}")
print(f"  Total time: {int(time.time() - start)}s")
