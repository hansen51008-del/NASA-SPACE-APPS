# BARA · Indonesia Hotspot Observatory

A React + TypeScript hackathon MVP for exploring MODIS and VIIRS hotspot observations across Indonesia. All observations are clearly labeled synthetic demo data. No live NASA connection, API key, or backend is required.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the URL printed by Vite (normally http://127.0.0.1:5173). In Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm.ps1`.

```sh
npm run build
npm test
npm run preview
```

## Open on your phone

Connect the phone and laptop to the same Wi-Fi (or connect the laptop to the phone's hotspot), then run:

```sh
npm run dev:lan
```

Open the **Network** address printed by Vite, using the Wi-Fi IPv4 address and port **5174**. Find that address with `ipconfig` on Windows; do not use `localhost` on the phone. Keep the laptop and terminal running. If Windows asks, allow Node.js on the private network. If the phone cannot connect, check the firewall and whether the Wi-Fi isolates devices. The IP may change when switching networks. The LAN script follows [Vite's host option](https://vite.dev/config/server-options#server-host); the regular development command remains local to the laptop.

## Included

- Clickable, keyboard-accessible published boundaries for all 38 provinces; pan, zoom, reset, selected province highlighting, hotspot markers, and province activity shading.
- Six deterministic demo years (2020–2025), Jan–Dec selection, monthly replay with play/pause, speed controls, and full-year reset.
- MODIS, VIIRS, and harmonized observation layers; confidence and display controls.
- Source counts, harmonized counts, confidence, regions with observations, and maximum occupancy of a 0.05° grid cell.
- Monthly trends, prior-year monthly average, six-year activity calendar, explicit anomaly thresholds, full-year comparison, and calculated briefs.
- CSV export of the selected region/year/month/layer/confidence subset, including demo flags and harmonized source membership.
- Responsive UI and in-app data/methodology documentation.

## What the numbers mean

A hotspot is an observation, **not a fire incident**. Burned area is not inferred. Demo counts, brightness, seasonal patterns, and anomalies are invented and must not be represented as NASA measurements.

Harmonization sorts detections by UTC timestamp and greedily pairs the nearest available opposite-sensor observation within **1 km and 60 minutes**, in the same province. Matching is one-to-one; same-sensor detections remain distinct. The first observation anchors location and timestamp, including its month/year. Each result retains source IDs and the maximum member confidence class. Brightness remains sensor-specific and is not averaged. Filtering to high confidence occurs before matching.

This is an overlap-reduction prototype, not a validated consistent historical fire product. It does not correct differences in spatial resolution, overpass frequency, cloud cover, or sensor sensitivity. Those require scientific calibration and validation before real-data interpretation. The dense-cell metric is fixed-grid occupancy, not an incident cluster, burned area, or equal-area density.

Anomaly threshold: selected-period count > mean + 2 population standard deviations. Baselines use all available **earlier** years for the same region, sensor layer, confidence filter, and calendar period, requiring at least three years. Annual and monthly anomalies are separate. Missing real-data coverage must be distinguished from observed zero activity before a real provider is enabled; the demo has full coverage.

The yearly charts, comparison, and brief always use the full selected year. The map, headline metrics, region counts, and CSV use the selected month or full-year period. The region panel shows both sensors' source counts for context even when one sensor layer is selected.

Overlapping map symbols are consolidated within 0.04° display cells using an actual member's coordinates. This display optimization never changes analytical counts. Symbol color uses the highest confidence class in the display cell.

The 3D view renders actual elevation terrain with MapLibre GL JS, using [Mapterhorn terrain tiles](https://mapterhorn.com/data-access/) in 512-pixel Terrarium WebP format (global tiles through zoom 12). Elevation colours and directional hillshading reveal mountains, calderas, valleys, and drainage ridges. Satellite is the default surface, with clearer vegetation and rock detail, near-natural brightness and modest saturation. Shaded relief is an optional green-to-stone elevation palette with soft shadow-only shading and no white summit highlight. Satellite uses Esri World Imagery for the regional overview (source capped at zoom 8) and the EOxCloudless 2024 Sentinel-2 annual mosaic for close terrain. Between map zooms 8 and 10, the detail layer fades smoothly over the overview; both use a single global camera-zoom blend, never per-tile blending. A consistent imagery pyramid avoids the strongly different acquisitions found at adjacent detail levels in the previous basemap (notably Semeru). Multidirectional DEM hillshading uses a broad northwest key (295 and 335 degrees) and a weaker northeast fill (35 degrees), all fixed geographically, for smoother warm highlights and cool valley gradients. A 30-degree light altitude keeps flat surfaces neutral. Its strength does not depend on camera bearing, tilt, or distance. The mosaic reduces clouds; residual clouds and geographic mosaic seams may still exist. Satellite tiles are requested while that surface is selected. The detail mosaic is fixed to 2024; overview imagery dates vary. Neither is matched to the selected activity year; this is not a live feed or an erosion simulation. Satellite colour adjustments remain constant across zoom and camera orientation. Hillshade is anchored to the map with restrained warm highlights; province tint is fixed across zoom levels and terrain fog is pushed to the horizon to avoid a camera-proximity brightening effect. If imagery fails, the surface control offers a shaded-relief fallback. The default Bromo–Semeru camera provides a close view; Rinjani and Papua presets and the Indonesia overview change only the camera, not activity filters. Selecting a province fits its geographic extent. Inspect hotspot cycles through the displayed demo observations at a close camera angle, without changing data filters. Use Pan for navigation or Orbit 360 for one-finger/left-button orbit: horizontal drag rotates continuously through north, vertical drag adjusts tilt within 0 to 75 degrees. Face north restores bearing without resetting zoom or tilt. Close the Map settings panel with the close button and reopen it from Map settings; surface, relief, orbit mode and tilt are preserved. On phones both panels start collapsed and opening one closes the other to keep the map clear. Pan mode retains native right-drag and two-finger gestures. Fullscreen expands either 2D or 3D, preserving map controls; an Escape-enabled viewport fallback is used when native fullscreen is unavailable. Administrative lines show shared province edges once. Selection highlights those same shared edges, identified by both adjoining provinces; neither line layer draws simplified coastlines or detached-island outlines. Selected edges fade at close zoom. This styling does not increase boundary accuracy. Relief defaults to an explicitly labelled 1.5× vertical exaggeration, with 1× and 2.5× options. Zoom in to see local terrain detail; mountains are naturally small at national scale. Tiles are requested for the visible camera area, including the distant horizon, with a bounded tile cache. HD rendering supersamples standard screens at 1.5x, supports up to 2x on high-DPI screens, and targets at most six million render pixels while never going below 1x. Fullscreen resizing recalculates this budget. Linear texture filtering smooths terrain and imagery interpolation. Avoid clipping imagery or elevation to Indonesia's bounding box: at oblique angles it leaves a rectangular gap in the sea. GeoJSON updates are separated from appearance changes. Cached tilt/orbit changes retain the ready state, and a loaded lower-resolution terrain tile can provide the initial preview while detail arrives. First-load speed still depends on the external tile services and connection.

The Province colours toggle changes the thematic province tint in 3D and the province palette in 2D. The 3D tint stays constant across zoom levels to keep surface brightness consistent. Choosing province colours while activity intensity is enabled disables intensity. These display changes never change analytical counts. The 2D button opens the locally bundled SVG geography, including keyboard-accessible provinces; the province search and area selector also provide keyboard selection for 3D. Rendering lives in `src/components/TerrainMap.tsx`, with a lazy-loaded engine and a separately bundled MapLibre worker for development and production. Terrain needs an internet connection and WebGL2; failed tile loading or unsupported graphics shows a message with a 2D fallback.

In 2D, hotspot symbols have ember cores and soft glow; up to 100 spatially spaced high-confidence symbols also receive decorative flame and spark animation. In 3D, glowing points follow the terrain at the demo observation coordinates. A selected province additionally shows up to 24 spatially spaced decorative fire effects, prioritizing high-confidence observations and using actual member coordinates. A shared WebGL atlas renders four variations of gently moving flame edges, restrained smoke, subtle contact glow, and sparse rising embers. The 256 x 384 sprites foreshorten continuously with camera pitch, reveal an ember bed from above, and adjust the ground glow to the viewing angle. These are procedural camera-aware sprites, not a physical fire simulation. Canvas markers share one renderer capped at 24 frames per second; offscreen and terrain-occluded markers are skipped; animation pauses when the map is offscreen or the page is hidden. Devices unable to allocate the extra WebGL context retain simple ember symbols. Terrain-aware markers follow camera changes and disappear behind ridges. The selected province also receives fuller flames in 2D. The 3D effect is isolated in src/components/SelectedFireEffects.tsx, src/components/fireRenderer.ts, and src/selected-fire.css. Symbols follow filters/replay and disappear when detections are hidden. Symbol shape is not a measurement of severity, flame height, incident extent, or burned area. Reduced-motion preferences disable flame animation and camera flights. The SVG symbols are isolated in `src/components/HotspotSymbols.tsx`.

For the browser smoke test, start the development server on port 5173, then run `node tests/browser.mjs`. This uses an installed Microsoft Edge browser in headless mode and writes screenshots to `test-results/`.

Run `node tests/camera-browser.mjs` for fullscreen, continuous orbit, drag tilt, north reset, mobile fallback, and Escape checks.

Run `node tests/terrain-browser.mjs` for the network-dependent 3D integration check (satellite texture loading, surface switching, terrain loading, camera presets, relief control, province selection, fire projection at 0/30/60/75 degrees, mobile layout, and imagery/DEM network fallbacks). Screenshots are saved to `test-results/terrain-*.png`. Set `APP_URL` to test a production preview instead of the development server.

Run `node tests/terrain-lighting-browser.mjs` to check constant surface brightness during small camera moves with deterministic tile fixtures. Add `--live` to compare the same Semeru geographic patch across actual satellite detail levels and capture real-terrain camera movements in `test-results/lighting/`. Live checks require both imagery and elevation services.

## Architecture

`src/components/`: `IndonesiaMap`, `LayerSelector`, `RegionPanel`, `YearSelector`, `FireReplay`, `ActivityCalendar`, `HotspotTrend`, `YearComparison`, `FireBrief`.

`src/services/`: `nasaDataService` (provider interface, demo generator, FIRMS row normalization), `harmonizationService` (matching, layer filtering, grid occupancy), `anomalyService` (monthly counts, baselines, peaks, rankings).

`src/types.ts`: common normalized observation schema. `src/styles.css`: dashboard styling, map colors, typography, and responsive rules. Map projection, geographic rendering, and display controls are isolated in `IndonesiaMap` so a later design reference can be applied without changing analysis services.

## Connecting real FIRMS observations

1. Build a server-side ingestion adapter with NASA FIRMS credentials stored only on the server. Historical years need archived observations; do not substitute recent NRT coverage for historical archives.
2. Parse rows with `normalizeFirmsRow`; this preserves native MODIS confidence and VIIRS categories and validates dates and coordinates. Assign province using point-in-polygon against the boundary file. Preserve satellite/product provenance and stable record IDs in a production extension.
3. Implement `NasaDataService.loadRecords` and replace the exported demo provider. Return normalized records with `isDemo: false`.
4. Add coverage metadata and data-mode UI so missing time windows cannot be treated as zero. Update the visible demo badges and documentation only when the real provider is operational.
5. Validate the matching thresholds against independent reference data; account for sensor and acquisition changes before interpreting trends as comparable historical activity.

References: [NASA FIRMS MODIS attributes](https://firms.modaps.eosdis.nasa.gov/descriptions/FIRMS_MODIS_Firehotspots.html), [NASA FIRMS API tutorial](https://firms.modaps.eosdis.nasa.gov/content/academy/data_api/firms_api_use.html), [NASA confidence guidance](https://forum.earthdata.nasa.gov/viewtopic.php?t=5182).

## Geography attribution

The unmodified `public/data/indonesia-provinces.geojson` is from [Deny Herianto, Indonesia GeoJSON & TopoJSON Maps (38 Provinces)](https://github.com/denyherianto/indonesia-geojson-topojson-maps-with-38-provinces), downloaded September 19, 2026, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The upstream license is included at `public/data/DATA_LICENSE.md`. Ring winding is normalized only in memory for D3 rendering. These community-published boundaries are suitable for the prototype and are not asserted to be authoritative cadastral boundaries. The same geography is used for all demo years; historical province changes are not reconstructed.

Province boundaries and the 2D map are bundled locally and require no tile service or API key. The 3D elevation tiles are fetched from `https://tiles.mapterhorn.com/{z}/{x}/{y}.webp`, without credentials. Terrain attribution: the contributing elevation sources listed in the [Mapterhorn attribution](https://mapterhorn.com/attribution/). Terrain resolution varies by location and zoom; the Shaded relief palette is derived from height, while Satellite uses the imagery basemap. Real elevation does not make the hotspot dataset real: observations remain synthetic demo data. Optional Google Fonts fall back to local sans-serif fonts when unavailable. NASA Space Apps naming describes the intended event; this prototype is not an official NASA product.

Satellite imagery is requested from the public [EOX WMTS](https://maps.eox.at/) service: `s2cloudless-2024_3857`, 256-pixel tiles through zoom 14 (higher zooms reuse that resolution). Attribution: [EOxCloudless](https://cloudless.eox.at) by [EOX IT Services GmbH](https://eox.at) (Contains modified Copernicus Sentinel data 2024). This layer is [CC BY-NC-SA 4.0, for non-commercial use](https://cloudless.eox.at/license-non-commercial); provider credits and the license are linked in the map attribution control. The prototype uses it as a visual basemap, not as fire evidence.

Regional satellite overview: [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9), credited to Esri, Maxar, Earthstar Geographics, and the GIS User Community. This source is capped at zoom 8 and remains underneath the detail layer as a cached fallback. Missing or delayed detail tiles reveal that overview instead of the blue background; its mismatched high-resolution acquisitions are never requested.

Run `node tests/terrain-loading-browser.mjs` to hold back detail imagery while zooming from level 7 through 12.3. The test checks that loaded land never becomes a blue background; screenshots are written to `test-results/loading/`.
