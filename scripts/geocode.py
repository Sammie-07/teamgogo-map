#!/usr/bin/env python3
"""
One-shot geocoder: reads agents-source.csv, geocodes each zip via
zippopotam.us, writes public/agents.json with lat/lng baked in.

Re-run anytime to refresh. Caches results in scripts/.geocache.json so
re-runs are fast and stay polite to the free API.
"""
import csv, json, os, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "agents-source.csv")
OUT = os.path.join(ROOT, "public", "agents.json")
CACHE = os.path.join(ROOT, "scripts", ".geocache.json")

os.makedirs(os.path.dirname(OUT), exist_ok=True)

cache = {}
if os.path.exists(CACHE):
    with open(CACHE) as f:
        cache = json.load(f)

def normalize_zip(zip_code: str, country: str) -> str:
    z = (zip_code or "").strip().upper()
    if country == "CA":
        # zippopotam.us takes the 3-char FSA only
        z = z.replace(" ", "")[:3]
    elif country == "GB":
        # outward code only
        z = z.split()[0] if " " in z else z[:4]
    return z

def geocode(country: str, zip_code: str):
    z = normalize_zip(zip_code, country)
    if not z or not country:
        return None
    key = f"{country}/{z}"
    if key in cache:
        return cache[key]
    url = f"https://api.zippopotam.us/{country.lower()}/{urllib.parse.quote(z)}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "teamgogo-map-geocoder/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
        place = data["places"][0]
        result = {
            "lat": float(place["latitude"]),
            "lng": float(place["longitude"]),
            "place": place.get("place name", ""),
        }
        cache[key] = result
        return result
    except Exception as e:
        cache[key] = None  # negative cache so we don't retry forever
        return None

# Parse CSV — first row is blank, second row is header
with open(SRC, newline="", encoding="utf-8") as f:
    reader = csv.reader(f)
    rows = list(reader)

# Find header row (first row with "Agent ID")
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

for i, row in enumerate(data_rows):
    if not row or not col(row, "Agent Name"):
        continue
    country = col(row, "Agent Country") or "US"
    zip_code = col(row, "Agent Postal (zip) Code")
    coords = geocode(country, zip_code)
    if coords is None:
        skipped += 1
        if i % 50 == 0:
            print(f"[{i+1}/{total}] geocoded={geocoded} skipped={skipped}", flush=True)
        continue
    geocoded += 1
    agents.append({
        "id": col(row, "Agent ID"),
        "name": col(row, "Agent Name"),
        "email": col(row, "Agent Primary Email"),
        "email2": col(row, "Agent Secondary Email"),
        "phone": col(row, "Agent Phone Number"),
        "city": col(row, "Agent City"),
        "state": col(row, "Agent State"),
        "zip": col(row, "Agent Postal (zip) Code"),
        "country": country,
        "status": col(row, "Status"),
        "level": col(row, "Level"),
        "years": col(row, "Years with eXp"),
        "influencer": col(row, "Influencer Status"),
        "lat": coords["lat"],
        "lng": coords["lng"],
    })
    if i % 50 == 0:
        print(f"[{i+1}/{total}] geocoded={geocoded} skipped={skipped}", flush=True)
        # Persist cache periodically
        with open(CACHE, "w") as f:
            json.dump(cache, f)
    # Be polite — only sleep if we made a real request (not a cache hit)
    if f"{country}/{normalize_zip(zip_code, country)}" not in cache or len(cache) <= geocoded:
        pass

# Final cache save
with open(CACHE, "w") as f:
    json.dump(cache, f)

with open(OUT, "w") as f:
    json.dump(agents, f, separators=(",", ":"))

print(f"\nDONE. {len(agents)} agents written to {OUT}")
print(f"Skipped (no/invalid zip): {skipped}")
print(f"Cache size: {len(cache)} entries")
