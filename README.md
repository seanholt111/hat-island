# Hat Island Explorer

Phone-friendly **3D orbit** viewer of Hat Island (Gedney Island) in Possession Sound, Washington — built from **real elevation** and **Esri World Imagery**.

Whimsical PNW scenery: instanced evergreens on the DEM plus cottages at OpenStreetMap building footprints, with a featured **B25** craftsman cabin (brother-in-law lot). **B25 pin** is Sean’s Google Maps share (`lots.json`: 48.0125031, −122.3257859). Around B25 a **local high-res DEM/sat patch** (`b25-elevation.json` + `b25-sat-hi.jpg` / `b25-sat-mid.jpg`) overlays the island mesh, with denser evergreens, Whidbey Island Drive ribbons, and a driveway stub. Island-wide drape still uses `terrain-sat-hi.jpg`.

Open the GitHub Pages URL on iPhone Safari/Chrome. Drag with one finger to orbit, pinch to zoom, two-finger drag to pan. Use **+ / − / ⌂** for zoom and reset.

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
| `buildings.json` | OpenStreetMap building centers (Overpass) |
| `lots.json` | Featured lot pins — **B25** from Sean’s Google Maps pin |
| `terrain-sat-hi.jpg` | Higher-res Esri World Imagery drape (island-wide) |
| `b25-elevation.json` | Dense OpenTopoData `ned10m` 80×80 grid ≈±0.0018° around B25 |
| `b25-sat-hi.jpg` | Esri World Imagery crop ≈±0.0008° @ 2048² (hero yard) |
| `b25-sat-mid.jpg` | Esri World Imagery crop ≈±0.0025° @ 1536² (neighborhood) |
| `b25-osm.json` | Overpass extract (buildings, highways, woods, golf) near B25 |
| `b25-local.json` | Compact roads/buildings extract for the local patch |
| `hat-island.png` | Optional cinematic still (not required by the 3D viewer) |

Bbox ≈ 48.00465–48.02167 N, 122.33509–122.30296 W. Elevations are meters; the mesh uses vertical exaggeration (~3×) so hills read clearly on a phone. Null / ≤0 m samples sit at the water plane (deep PNW blue).

## Controls

- **One finger** — orbit
- **Pinch** — zoom
- **Two fingers** — pan
- **⌂** — reset camera
- **+ / −** — step zoom

Attribution appears in the footer (OpenTopoData dataset + Esri imagery credit).

## Files

Static only (`index.html` + `app.js` + data) — no build step. Works on GitHub Pages HTTPS.


## B25 detail patch

Most important viewing area: brother-in-law lot **B25**. Coordinates come from Sean’s Google Maps pin (`https://maps.app.goo.gl/6rWk1yFwMGBBsvcSA` → 48.0125031, −122.3257859), not a guessed street address.

When the camera is near B25 the viewer loads a second, denser terrain mesh (NED 10 m resampled to ~80×80 / 96×96) draped with close-up Esri imagery so the house yard is not a blurry island-wide texel. A larger PNW craftsman hero house (terracotta gable, green wing, porch, chimney, warm windows), local evergreens with yard/driveway clearances, and gravel **Whidbey Island Drive** ribbons from OSM sit on that patch. Island-wide mesh stays lighter for iPhone performance.
