#!/usr/bin/env python3
"""
Hair Salon Tip Calculator — Data Builder
========================================
Run this once (and once a year to refresh).

What it does:
  1. Downloads ~28K US cities from simplemaps (free, public)
  2. Downloads median household income for all ~3,100 US counties
     from the Census Bureau ACS 5-year estimates (public domain)
  3. Outputs two lean JSON files:
       cities.json   — city autocomplete + county FIPS lookup
       counties.json — county FIPS → median household income

Requirements:
  pip install requests pandas

Usage:
  python3 build_data.py

Output files go in the same directory. Copy them next to your HTML file.
"""

import io, json, zipfile, requests, pandas as pd, sys, os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ── 1. CITIES (simplemaps free tier) ─────────────────────────────────────────
CITIES_URL = (
    "https://simplemaps.com/static/data/us-cities/1.79/basic/"
    "simplemaps_uscities_basicv1.79.zip"
)

def fetch_cities():
    print("Downloading cities data from simplemaps...")
    r = requests.get(CITIES_URL, timeout=60)
    r.raise_for_status()
    z = zipfile.ZipFile(io.BytesIO(r.content))
    csv_name = [n for n in z.namelist() if n.endswith('.csv')][0]
    df = pd.read_csv(z.open(csv_name), dtype=str)

    # Columns we need: city, state_id, county_fips, county_name, population
    keep = ['city', 'state_id', 'state_name', 'county_fips', 'county_name', 'population']
    df = df[keep].copy()

    # Drop non-US territories we can't get income data for
    exclude_states = {'PR','GU','VI','AS','MP'}
    df = df[~df['state_id'].isin(exclude_states)]

    # Clean county_fips — zero-pad to 5 digits
    df['county_fips'] = df['county_fips'].str.strip().str.zfill(5)

    # Sort by population descending so big cities appear first in autocomplete
    df['population'] = pd.to_numeric(df['population'], errors='coerce').fillna(0)
    df = df.sort_values('population', ascending=False)

    # Build output list — lean, only what the calculator needs
    cities = []
    for _, row in df.iterrows():
        cities.append({
            "c": row['city'],
            "s": row['state_id'],
            "f": row['county_fips'],   # FIPS for county income lookup
        })

    print(f"  ✓ {len(cities):,} cities processed")
    return cities


# ── 2. COUNTY INCOME (Census ACS 5-year, table S1901) ────────────────────────
# Variable S1901_C01_012E = Median household income (estimate)
CENSUS_URL = (
    "https://api.census.gov/data/2022/acs/acs5/subject"
    "?get=NAME,S1901_C01_012E&for=county:*&in=state:*"
    "&key={api_key}"   # key optional for small requests; remove if hitting limits
)
# No API key version (works for most requests, rate limited):
CENSUS_URL_NOKEY = (
    "https://api.census.gov/data/2022/acs/acs5/subject"
    "?get=NAME,S1901_C01_012E&for=county:*&in=state:*"
)

def fetch_counties():
    print("Downloading county income data from Census ACS...")
    r = requests.get(CENSUS_URL_NOKEY, timeout=120)
    r.raise_for_status()
    data = r.json()

    headers = data[0]   # ['NAME', 'S1901_C01_012E', 'state', 'county']
    rows = data[1:]

    name_idx  = headers.index('NAME')
    inc_idx   = headers.index('S1901_C01_012E')
    state_idx = headers.index('state')
    cnty_idx  = headers.index('county')

    counties = {}
    skipped = 0
    for row in rows:
        fips = row[state_idx].zfill(2) + row[cnty_idx].zfill(3)
        income_raw = row[inc_idx]
        # Census returns -666666666 for missing/suppressed data
        try:
            income = int(income_raw)
            if income < 0:
                skipped += 1
                continue
        except (ValueError, TypeError):
            skipped += 1
            continue
        counties[fips] = income

    print(f"  ✓ {len(counties):,} counties with income data ({skipped} skipped/suppressed)")
    return counties


# ── 3. WRITE OUTPUT ───────────────────────────────────────────────────────────
def build():
    try:
        cities = fetch_cities()
    except Exception as e:
        print(f"\n❌ Cities fetch failed: {e}")
        print("   Check your internet connection and try again.")
        sys.exit(1)

    try:
        counties = fetch_counties()
    except Exception as e:
        print(f"\n❌ County income fetch failed: {e}")
        print("   Census API may be temporarily unavailable. Try again in a few minutes.")
        sys.exit(1)

    # Validate cross-reference
    matched = sum(1 for c in cities if c['f'] in counties)
    print(f"\n  Cross-reference: {matched:,} of {len(cities):,} cities matched to county income data")

    # Write cities.json — minified
    cities_path = os.path.join(OUT_DIR, 'cities.json')
    with open(cities_path, 'w', encoding='utf-8') as f:
        json.dump(cities, f, separators=(',', ':'), ensure_ascii=False)
    size_kb = os.path.getsize(cities_path) / 1024
    print(f"\n  ✓ cities.json written ({size_kb:.0f} KB) → {cities_path}")

    # Write counties.json — minified
    counties_path = os.path.join(OUT_DIR, 'counties.json')
    with open(counties_path, 'w', encoding='utf-8') as f:
        json.dump(counties, f, separators=(',', ':'))
    size_kb = os.path.getsize(counties_path) / 1024
    print(f"  ✓ counties.json written ({size_kb:.0f} KB) → {counties_path}")

    print("\n✅ Done! Copy cities.json and counties.json next to your HTML file.")
    print("   Run this script again each year to refresh the data.")


if __name__ == '__main__':
    build()
