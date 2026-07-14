# NWS Dashboard Webmap

A browser-based National Weather Service dashboard for viewing live U.S. weather alerts on a Leaflet map. The app colorizes counties by alert priority, shows alert details, records local history snapshots, and provides playback, alert-count mapping, event plotting, radar, precipitation, lightning, and cloud overlays.

## Quick Start

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal. By default the dev server binds to `127.0.0.1`.

Useful commands:

```bash
npm run build              # Build the app into dist/
npm run preview            # Preview the production build
npm test                   # Run pure helper tests
npm run test:smoke         # Run browser smoke tests against the source app
npm run test:smoke:dist    # Run browser smoke tests against dist/
npm run check              # Syntax check, tests, build, and dist smoke test
```

## How The Application Works

The entry page is `webmap.html`. It loads `styles.css`, Leaflet from a CDN, and `src/main.js`. The main script keeps the classic browser-script execution model by loading each file in `src/sections/` in a fixed order.

At startup the app:

1. Creates a Leaflet map centered on the continental United States.
2. Loads U.S. county GeoJSON and state GeoJSON.
3. Fetches active alerts from `https://api.weather.gov/alerts/active`.
4. Converts NWS SAME codes into county FIPS keys.
5. Colors counties by the highest-priority active alert.
6. Starts refresh timers for weather alerts and radar.
7. Opens local IndexedDB caches for history, radar tiles, and alert hash lookups.

The global runtime namespace is `window.Webmap`:

- `Webmap.config` exposes constants such as API URLs, default colors, history limits, and storage keys.
- `Webmap.state` exposes live runtime state through getters and setters.
- `Webmap.services` contains reusable API, DOM, map, panel, and pure helper services.
- `Webmap.actions` stores delegated UI action handlers.
- `Webmap.registerAction(name, handler)` registers handlers used by `data-click`, `data-change`, and `data-input` attributes.

## Main Features

### Live Alert Map

Counties are colored by priority category:

- Tornado Warning
- Warning
- Statement
- Watch
- Advisory
- Other

Clicking a county opens the details sidebar with active alerts, event names, severity, issued and expiration times, descriptions, alert hashes, and reference links. A tornado warning banner appears when any active county alert is categorized as a tornado warning.

### Filtering And Search

The Setup panel includes alert filters:

- Severity filter: all, Extreme, Severe, Moderate, Minor, Unknown
- Expired-only mode
- Search fields: event, headline, description, area, alert ID
- Boolean search syntax: `&`, `|`, `!`, and parentheses
- Event title filtering through the Event Titles panel

Example searches:

```text
tornado & warning
(flood | flash) & !advisory
observed & rotation
```

### Weather Priority Panel

The Weather Priority panel lets you reorder priority categories and change their map colors. Settings are saved in `localStorage` under `nwsDashboardPrioritySettings`.

Defaults are defined in `src/sections/000-config.js`.

### History Recording And Playback

The app stores alert snapshots in IndexedDB when history recording is enabled. The Setup panel controls:

- Weather update interval
- Radar update interval
- Whether history recording is enabled
- Weather updates per history frame
- History retention days
- Optional label/crosshair location

The History Playback panel can:

- Load local history frames
- Restrict playback by start and stop time
- Step forward or backward by one frame or multiple frames
- Play forward or reverse
- Jump to the first or last frame
- Search for the next tornado warning frame
- Clear all saved history

History state is stored in IndexedDB using:

- `nwsDashboardHistory`
- `snapshots`
- `radarTiles`
- `alertHashIndex`

### History Alert Map

The History Alert Map panel colorizes counties by alert counts over a selected time range. Quick ranges include 1, 2, 6, 12, 24, 48, and 96 hours. You can filter by event title and then apply the count map.

### Event Plot

The Event Plot panel draws a time-series chart from local history. It can count either:

- Active alerts
- Impacted counties

You can choose start and stop times, select event titles, update the history cache, plot the result, drag the plot cursor, and jump the map to the selected historical frame.

### Map Overlays

The app supports several overlays:

- Live radar from Iowa State Mesonet NEXRAD tiles
- Historical radar through IEM WMS-T
- NOAA/NWS MRMS precipitation WMS
- NOAA nowCOAST lightning density WMS
- NOAA nowCOAST visible satellite cloud WMS
- NWS alert polygons from active alert geometry
- State labels and an optional location crosshair

Precipitation supports 1h, 3h, 6h, 12h, 24h, 48h, and 72h ranges. When the precipitation layer is active, pressing Space over a county samples estimated precipitation at the cursor. Space can also sample point elevation.

### Saved Map Views

Map views are saved in `localStorage` under `nwsDashboardStoredMapViews`.

- `Shift + 1` through `Shift + 9`: save the current map center and zoom.
- `1` through `9`: restore a saved view.

## Keyboard Shortcuts

Panels:

- `?`: keyboard shortcuts
- `S`: setup
- `U`: weather priority/colors
- `H`: history playback
- `A`: history alert-count map
- `G`: event plot
- `T`: event title filter
- `Q`: precipitation controls
- `Y`: lightning controls
- `K`: cloud layer on/off
- `W`: show or hide popup windows
- `Esc`: close the active floating panel

Map:

- `I`: zoom in while held
- `O`: zoom out while held
- `R`: radar on/off
- `V`: NWS alert polygons on/off
- `M`: switch between Street and Topological maps
- `C`: cycle county colorization mode
- `Space`: sample precipitation or elevation at the cursor
- `L`: state labels and location marker on/off
- Right click: pan map to the clicked point

History:

- `N`: next single frame
- `n`: next configured frame step
- `P`: previous single frame
- `p`: previous configured frame step

## Source Layout

```text
webmap.html                 Main HTML and UI panels
styles.css                  Application styles
src/main.js                 Ordered loader for classic browser scripts
src/lib/pure.js             Shared pure helpers with Node/browser exports
src/sections/000-config.js  Constants, URLs, defaults, storage keys
src/sections/001-006*.js    Core services, runtime state, Webmap namespace
src/sections/010-050*.js    Draggable and floating panel behavior
src/sections/060-090*.js    Setup, priority, shortcut, and timer panels
src/sections/100-120*.js    Utilities, startup status, history store, data loading
src/sections/130-160*.js    Map rendering, sidebar, filters
src/sections/170-200*.js    Radar, precipitation, lightning, cloud overlays
src/sections/210-250*.js    Startup, timers, pan/zoom shortcuts, DOM bindings
tests/pure.test.js          Unit tests for pure helpers
tests/smoke.test.js         Playwright browser smoke tests
vite.config.js              Vite build config and dist runtime copy plugin
```

## Important Functions And Modules

- `processAlerts(data)`: converts NWS alert features into a FIPS-keyed alert map.
- `refresh()`: fetches live alerts, updates map state, and saves history snapshots when enabled.
- `redrawMap()`: reapplies county coloring, labels, blinking, and filtered alert state.
- `applyFilters()`: reads filter controls and refreshes visible alert data.
- `toggleRadar()`, `reloadRadar()`, `updateRadarOpacity()`: manage radar tiles.
- `togglePrecipLayer()`, `changePrecipRange()`, `fetchPrecipSample()`: manage precipitation overlay and sampling.
- `toggleLightningLayer()` and `toggleCloudLayer()`: manage nowCOAST overlays.
- `saveHistorySnapshot()`, `loadHistorySnapshots()`, `loadHistoryFrame()`: manage IndexedDB history.
- `showHistoryFrame(index)`: switches the map into historical alert state.
- `toggleHistoryMapMode()`: applies historical county alert-count coloring.
- `refreshEventPlot()`: renders the event count chart.
- `evaluateSearch(query, text)`: implements boolean search syntax.
- `getPriorityCategory(event)`: maps NWS event names to priority categories.
- `bindDelegatedDomHandlers()`: wires UI controls through `data-click`, `data-change`, and `data-input`.

## Data Sources

- NWS active alerts: `api.weather.gov`
- County GeoJSON: Plotly datasets GitHub repository
- State GeoJSON: PublicaMundi MappingAPI GitHub repository
- Live radar and historical radar: Iowa State Mesonet
- Precipitation: NOAA/NWS MRMS QPE WMS and REST image service
- Lightning and cloud layers: NOAA nowCOAST
- Elevation sampling: USGS National Map EPQS
- Base maps: OpenStreetMap and OpenTopoMap

## Persistence

Browser storage is local to the user and browser profile.

- `localStorage`: setup settings, priority settings, saved map views
- `IndexedDB`: history snapshots, cached radar tiles, alert hash index

Use the History Playback panel's Clear History button to remove saved history data.

## Build Notes

The Vite config uses `webmap.html` as the multi-page app entry. A custom `copy-classic-runtime` plugin copies `src/` and `styles.css` into `dist/` after build so the classic script loader continues to work in production output.

The smoke test starts a local static server, opens `webmap.html` with Playwright Chromium, checks that `window.Webmap` is initialized, opens major panels, and verifies event-title alert counts only include displayable counties.
