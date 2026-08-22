# Hat Island Explorer

Phone-friendly **3D orbit** viewer of Hat Island (Gedney Island) in Possession Sound, Washington — built from **real elevation** and **Esri World Imagery**.

Whimsical PNW scenery: instanced evergreens on the DEM plus cottages at OpenStreetMap building footprints, with a featured **B25** compound (brother-in-law lot). **B25 pin** is Sean’s Google Maps share (`lots.json`: 48.0125031, −122.3257859).

**Foundation:** one island-wide DEM mesh from `elevation.json` draped with `terrain-sat-hi.jpg` (fallback `terrain-sat.jpg`). No local heightfield overlay — the old `b25-elevation.json` dual-mesh / polygonOffset patch was removed because it warped ground near B25.

**B25 scenery** is hand-placed from satellite reference (`b25-sat-hi.jpg`): dark **forest-green** gabled main house (E–W), **terracotta** guest/outbuilding immediately east, gravel driveway north to Whidbey Island Drive, white trailer + shed in the north clearing, and a hand-placed evergreen ring with yard clearance. Island-wide auto trees/houses are suppressed within ~90 m of the pin.

Open the GitHub Pages URL on iPhone Safari/Chrome. Drag with one finger to orbit, pinch to zoom, two-finger drag to pan. Use **+ / − / B25 / ⌂** for zoom, focus, and reset.

## Local

Serve the folder over HTTPS or `http://localhost` (module imports + fetch need a real origin — Files Preview will not work):

```bash
npx serve /workspace/hat-island
```

## Data sources

| Asset | Source |
|-------|--------|
| `elevation.json` | [OpenTopoData](https://www.opentopodata.org/) `ned10m` (USGS NED 10 m), bbox-sampled grid |
| `terrain-sat.jpg` | [Esri World Imagery](https://www.esri.com/) MapServer export (same bbox) |
| `terrain-sat-hi.jpg` | Higher-res Esri World Imagery drape (island-wide) |
| `buildings.json` | OpenStreetMap building centers (Overpass) |
| `lots.json` | Featured lot pins — **B25** from Sean’s Google Maps pin |
| `b25-local.json` | Compact roads/buildings extract for Whidbey Island Drive near B25 |
| `b25-sat-hi.jpg` / `b25-sat-mid.jpg` | Close-up Esri crops used as **placement reference** (not second DEM meshes) |
| `b25-osm.json` / `b25-elevation.json` | Research extracts retained on disk; **not** loaded for a second heightfield |
| `hat-island.png` | Optional cinematic still (not required by the 3D viewer) |

Bbox ≈ 48.00465–48.02167 N, 122.33509–122.30296 W. Elevations are meters; the mesh uses vertical exaggeration (~3×) so hills read clearly on a phone. Null / ≤0 m samples sit at the water plane (deep PNW blue).

## Controls

- **One finger** — orbit
- **Pinch** — zoom
- **Two fingers** — pan
- **B25** — focus brother-in-law lot
- **⌂** — reset camera
- **+ / −** — step zoom

Attribution appears in the footer (OpenTopoData dataset + Esri imagery credit).

## Files

Static only (`index.html` + `app.js` + data) — no build step. Works on GitHub Pages HTTPS.

## B25 hand placement

Most important viewing area: brother-in-law lot **B25**. Coordinates come from Sean’s Google Maps pin (`https://maps.app.goo.gl/6rWk1yFwMGBBsvcSA` → 48.0125031, −122.3257859).

Sat match: green main roof + red-brown outbuilding to the east, driveway from the E–W gravel road on the north, trailer in the north yard clearing, dense evergreens in a ring with open yard (~12–20 m) and driveway corridor. Camera starts on a closer pleasant orbit of the compound.
