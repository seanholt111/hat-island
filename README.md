# Hat Island Explorer

Phone-friendly **3D orbit** viewer of Hat Island (Gedney Island) in Possession Sound, Washington — built from **real elevation** and **Esri World Imagery**.

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
