# Hair Stylist Tip Calculator

A free, city-calibrated hair salon tip calculator for the United States.
Tip suggestions are based on local median household income data (U.S. Census ACS).

## Files

| File | Purpose |
|------|---------|
| `index.html` | Main calculator page |
| `cities.json` | ~28,000 US cities with county FIPS codes (SimpleMaps) |
| `counties.json` | County median household income (U.S. Census ACS) |
| `build_data.py` | Script to refresh data annually |

## Hosting

Deployed via GitHub Pages with a custom domain.

## Data Sources

- City data: [SimpleMaps US Cities](https://simplemaps.com/data/us-cities)
- Income data: U.S. Census Bureau, American Community Survey 5-Year Estimates

## Annual Data Refresh

Run `build_data.py` once per year (Census publishes updated ACS data each December):

```bash
pip install requests pandas
python3 build_data.py
```

Then commit and push the updated `cities.json` and `counties.json`.
