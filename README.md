# Indian OTT Discovery for Stremio

A personal, catalog-only Node.js add-on. It defines separate movie and series rows for TMDB weekly trends, TMDB popularity, and recent releases on Indian OTT services. It never extracts or serves video streams.

**Delivery status:** authenticated local checks passed for 27 rows and 669 entries across seven providers; all 27 fixture tests passed. Deployment and actual Stremio-client acceptance are pending. Full evidence and all nine support statuses are in [the acceptance report](docs/TEST-REPORT.md).

## Start locally

Use Node.js 24 (tested on 24.19.0).

```powershell
npm ci --ignore-scripts
Copy-Item .env.example .env # ONLY if you do not already have .env
# Edit .env privately. Set TMDB_API_KEY OR TMDB_READ_ACCESS_TOKEN.
npm test
npm start
```

Visit `http://127.0.0.1:7000/`. On a fresh cache the first refresh runs in the background and can take several minutes. `/health` confirms the process is running; `/ready` remains 503 until at least one nonempty catalog is verified. The manifest advertises no unverified or empty rows. Install only after rows are ready.

## Live acceptance checks

```powershell
npm run verify:live
npm run verify:live -- --url https://YOUR-ACTUAL-SERVICE.onrender.com
# Optional: test every returned poster rather than one per row.
npm run verify:live -- --url https://YOUR-ACTUAL-SERVICE.onrender.com --all-posters
```

The script needs your credential in the local environment even when testing a hosted service. It resolves current provider IDs from India-specific registries and independently checks every returned title's India availability. It writes a credential-free `reports/live-verification.json`. A missing credential exits 2; a failed assertion/source request exits 1. Fixture tests never substitute for this check. Actual Stremio installation, device rendering and URL continuity across redeployment must be checked separately.

## Catalogs and accuracy

All nine requested platforms are candidates: JioHotstar, SonyLIV, ZEE5, Prime Video India, Sun NXT, Hoichoi, Eros Now, Airtel Xstream and Lionsgate Play. Netflix is optional. Each candidate is matched by exact normalized name to TMDB's movie and TV provider lists for `watch_region=IN`; no provider numbers are assumed.

Where nonempty, the following rows are emitted for each platform:

| Row suffix | Selection method |
|---|---|
| Trending Movies / Series (TMDB) | Global TMDB weekly trend candidates intersected with the provider's verified India availability |
| Popular Movies / Series (TMDB) | Provider-filtered TMDB Discover results, sorted by TMDB popularity |
| New Movies / Series | Recent first movie release or series premiere, sorted by date, and currently available on the provider |

Discover scans a bounded pool (up to 160 candidates per row by default) to refill rows after availability checks. The default trend candidate pool is 60 titles per content type. Small providers may have no matches. New releases means first release/premiere in the preceding 90 days, not platform addition dates or new series seasons. Platform originals/collections and official provider charts remain unsupported until a separate verified source exists.

Availability accepts `flatrate`, `free`, or `ads` in the title's `IN` offers. It excludes rent/buy and differently named Amazon/Apple/reseller channels. No union of Airtel's partner catalogs is inferred to be an Airtel subscription. No language restriction is applied; Tamil, Telugu, Bengali, Malayalam, Kannada and other languages can qualify. This is discovery on Indian services, not a restriction to Indian productions.

Every title requires an exact TMDB detail lookup and a valid IMDb external ID. Items without IMDb IDs are omitted so Cinemeta can resolve title/episode details without adding a meta resource. Missing posters are allowed; malformed poster paths are omitted. No TMDB vote is presented as an IMDb rating. Entries are deduplicated within rows; identical ordered rows on the same provider/type are suppressed. Different rankings may legitimately overlap.

## Configuration

All values are server-side. Never put a key in an installation URL, manifest, Git repository, screenshot or chat.

| Variable | Default / purpose |
|---|---|
| `TMDB_API_KEY` | Blank; TMDB v3 key, sent to TMDB only |
| `TMDB_READ_ACCESS_TOKEN` | Blank; API Read Access Token, sent as Bearer auth; takes precedence over a key |
| `HOST` | `0.0.0.0`; bind address |
| `PORT` | `7000`; Render supplies this automatically |
| `PUBLIC_BASE_URL` | Blank; actual HTTPS origin used for the install link, e.g. `https://your-service.onrender.com` |
| `PROVIDERS` | All nine requested candidates; comma-separated stable slugs from `.env.example`; optional `netflix` |
| `ROW_LIMIT` | `40`; retained items per row, 20–200; 100 items per page |
| `TRENDING_PAGES` | `3`; global weekly trend pages per type, 1–10 |
| `DISCOVER_SCAN_PAGES` | `8`; maximum Discover pages scanned per row to refill verified titles after exclusions, 1–20 |
| `NEW_RELEASE_DAYS` | `90`; first-release/premiere window, 1–365 |
| `REFRESH_HOURS` | `12`; refresh interval while the process is running, 1–168 |
| `STALE_HOURS` | `48`; maximum snapshot age, must be at least the refresh interval |
| `TMDB_CACHE_HOURS` | `6`; successful upstream response cache, 1–24 |
| `REQUEST_INTERVAL_MS` | `250`; minimum interval between TMDB request starts, 100–10000 |
| `REQUEST_TIMEOUT_MS` | `10000`; per-request timeout, 1000–30000 |
| `CACHE_DIR` | `.cache`; local snapshot directory; mount a persistent disk here for durable snapshots |

Configuration changes that affect selection invalidate old snapshots. The snapshot contains metadata and source evidence, not credentials. Treat `.env` and hosting secret settings as private. A configured endpoint is publicly readable; ownership of the TMDB credential stays with the service owner. Stremio requests read bounded snapshots and cannot trigger arbitrary upstream searches or refreshes.

## Endpoints

- `/manifest.json`: SDK-validated manifest with separate typed catalogs.
- `/catalog/movie/in.sl.pop.json`: example SonyLIV popularity movie row, if verified.
- `/catalog/movie/in.sl.pop/skip=100.json`: next 100 items; arbitrary nonnegative offsets supported.
- `/status.json`: per-provider, per-type source status, row methods, verification times and samples.
- `/health`: process liveness.
- `/ready`: nonempty catalog readiness.
- `/install.json`: configured HTTPS manifest/install URLs; contains no credential.

Stremio uses 100-item pages; a shorter response is the end of the catalog. The default 40-item row is therefore returned in full on the first request. Set ROW_LIMIT above 100 (with a matching DISCOVER_SCAN_PAGES budget) for multiple Stremio pages. Pagination operates over the current finite snapshot (40 items per row by default), not the entire provider library. Refreshing a snapshot can change its order. Unknown, expired, unavailable or invalid-offset requests return an empty metadata list. Requests do not contact TMDB. Responses cache for up to five minutes, capped by remaining snapshot lifetime.

## Architecture and maintenance

`src/providers.js` holds exact provider-name aliases; `src/tmdb.js` handles authenticated API requests and response caching; `src/engine.js` verifies and materializes rows; `src/addon.js` uses the official Stremio SDK; `src/server.js` serves the add-on, status and credits.

A bounded memory cache coalesces identical requests. Restarting with a current successful snapshot defers the next refresh until it is due. Refresh jobs cannot overlap inside one process. Failed refreshes retain successful rows up to the maximum age; successful empty results or missing provider mappings remove the affected row. One provider/type failure does not discard other catalogs. Snapshots are written using a temporary file and atomic rename. There is no public refresh/admin endpoint.

See [deployment](docs/DEPLOYMENT.md), [source audit](docs/SOURCES.md), [acceptance results](docs/TEST-REPORT.md), [repair workflow](docs/MAINTENANCE.md), and [licensing](docs/LICENSING.md).

## Credits

[TMDB](https://www.themoviedb.org/) supplies metadata and images. This product uses the TMDB API but is not endorsed or certified by TMDB. India streaming availability is supplied by [JustWatch](https://www.justwatch.com/) through TMDB. These credits and an approved TMDB logo are shown on the service's About section.

Original implementation under MIT; no code was copied from the reviewed community repository. Third-party dependencies retain their own licenses.
