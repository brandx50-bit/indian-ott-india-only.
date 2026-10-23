# Source audit and support status

Audit date: 24 October 2026, Asia/Colombo. Network probe timestamps are UTC. Source access and verified Indian catalog output are different facts.

## Community repository

Inspected [pratiks360/Indian-stremio-catalogs](https://github.com/pratiks360/Indian-stremio-catalogs) at commit `d56799e117e68a3fcefb972e74b38554bba3fcd3` (last commit 4 September 2026). Reviewed README, package and lock files, `.env.example`, `config.js`, `addon.js`, `catalog.js`, TMDB integration, both source modules, HTTP helpers and the deployment service file. The upstream checkout was left unchanged.

Findings:

- Actual registry: Netflix, Prime Video, ZEE5, JioHotstar and SonyLIV. No Sun NXT, Hoichoi, Eros Now, Airtel Xstream or Lionsgate Play adapters.
- Netflix uses the public Tudum TSV. ZEE5 parses Next.js rails tagged `top10`. Prime, SonyLIV and JioHotstar opt into TMDB Discover; they have no direct ranking scraper in the registry.
- Language filtering is hardcoded to English, Hindi and Marathi, excluding other requested Indian language coverage implicitly.
- Movie/series catalogs and a custom mixed trending type share source datasets. This does not implement six independent selection methods per provider.
- The application includes AI search, torrent/debrid/local-seed modules, administrative routes and streaming dependencies beyond this task.
- `package.json` is version 0.2.1 while the lock root is 0.1.4. A real `npm ci --dry-run --ignore-scripts --no-audit --no-fund` failed with EUSAGE because WebTorrent and many dependencies are absent from the lockfile. Clean deployment was therefore not reproducible as checked out; the full application was not started.
- Dependencies include Express 4.22.2, Playwright/Playwright Core 1.62.1, Stremio SDK 1.6.10, Undici 8.10.0 and WebTorrent 1.9.7 (manifest declarations, not proof of successful installation). The runtime claims Node >=18; compatibility of each declared dependency needs separate verification.
- `.env.example` includes a TMDB key plus optional OpenRouter, Prowlarr, Real-Debrid, local-drive, Cloudflare and proxy settings. Its deployment example is a VPS systemd service, not a Render Blueprint.
- README claims MIT and links `LICENSE`; the tracked checkout has no LICENSE file, and the raw GitHub LICENSE URL returned 404. Reuse permission is not resolved by the README alone.
- ZEE5's parser warns but does not reject a non-IN country when rails exist. Our plain public GET received `country=LK` with rails, demonstrating why access to the page alone cannot establish India-specific rankings. No geo headers, proxy or challenge bypass was used.

Decision: implement a minimal catalog-only application with the official SDK. No upstream code or assets are copied. Its organizational ideas are useful reference material; its current deployability, direct chart accuracy and license are not assumed.

## Public platform-source investigation

The saved [probe evidence](source-probes.json) records ordinary public GETs with an identifying research User-Agent and a 20-second timeout, without credentials or location overrides. HTML reachability is not evidence of a supported catalog API. No authenticated or undocumented OTT platform API was probed, and no repeated challenge or geographic restriction was bypassed.

| Platform | Direct-source evidence | Chosen route and direct-source status |
|---|---|---|
| JioHotstar | Homepage returned 200 and redirected to Hotstar; no verified public chart parser. Upstream has no ranking source. | TMDB India availability candidate; official ranking unverified. |
| SonyLIV | Homepage returned 200. [Terms 5.5.5](https://www.sonyliv.com/terms-of-use) prohibit extracting material for third-party applications. | No scraper; TMDB India availability candidate. |
| ZEE5 | Movies returned 200, redirected to premium/movies, with Next.js rails but `country=LK`. [Terms](https://www.zee5.com/termsofuse) restrict unauthorized indexing and automated extraction. | Upstream chart source is not verified for India here. Use TMDB availability candidate only. |
| Prime Video India | Homepage returned 200 but redirected to `/region/eu/`; upstream has no direct chart adapter. | TMDB exact direct-provider candidate; do not equate Amazon rental or channel catalogs with the subscription. |
| Sun NXT | Homepage returned 200 with Next.js data; no stable permitted catalog/ranking API was verified. | TMDB direct-provider candidate; no production scraper. |
| Hoichoi | Plain request returned 403 with an access challenge. [Official PartnerAPI docs](https://github.com/hoichoitech/PartnerAPI) describe subscription onboarding/entitlements, require partner keys/IP approval, and do not establish a public catalog endpoint. [Terms](https://www.hoichoi.tv/tos) restrict unauthorized indexing. | No challenge bypass or partner API integration; TMDB direct-provider candidate. |
| Eros Now | Homepage returned 200; no stable public chart/API verified. [Terms](https://erosnow.com/termsofuse) restrict republishing/compilations of service content. | TMDB exact-provider candidate. Service homepage reachability alone does not verify current offer coverage. |
| Airtel Xstream | Homepage returned 200 and describes aggregating multiple partners. [Airtel API marketplace](https://developers.airtel.in/) is not evidence of an OTT catalog API. | Only an exact direct-provider India mapping can qualify. Partner-provider catalogs are never automatically unioned. |
| Lionsgate Play | Homepage returned 200 but was a small app shell (~5.7 KB); no public catalog feed verified. [Service policies](https://lionsgateplay.com/privacypolicy) link its own terms. | Exact direct-provider TMDB candidate; reseller channels are separate. |
| Netflix (optional) | Tudum TSV request timed out after 20 seconds from this environment. The original module's full multi-retry pipeline was not run. | Official chart is not claimed working. Optional TMDB-only candidate can be enabled and verified like the others. |

No reliable, maintained replacement community source covering all nine providers was established during this audit. This does not assert that no such source can exist. No direct scraper is shipped. Publicly observable HTML does not grant reuse rights.

## TMDB / JustWatch route

Official references reviewed:

- [India-filterable movie provider registry](https://developer.themoviedb.org/reference/watch-providers-movie-list) and corresponding TV list.
- [Movie Discover](https://developer.themoviedb.org/reference/discover-movie) and [TV Discover](https://developer.themoviedb.org/reference/discover-tv), using `watch_region=IN`, the resolved provider ID, and `flatrate|free|ads`.
- [Movie availability](https://developer.themoviedb.org/reference/movie-watch-providers) and [TV availability](https://developer.themoviedb.org/reference/tv-series-watch-providers), used per title to validate the India offer, via appended detail responses.
- [Details/append support](https://developer.themoviedb.org/reference/movie-details) for metadata, external IDs and watch-provider information.
- [Rate limits](https://developer.themoviedb.org/docs/rate-limiting): limits may change; the client spaces starts, caches requests, handles 429/Retry-After and bounds retries.

Unauthenticated access to the India provider registry returned 401, as expected. Authenticated results are reported separately in [TEST-REPORT.md](TEST-REPORT.md); no provider ID is accepted from the upstream repository or an assumed internet list.

Authenticated investigation also found that Discover can select a title where the chosen provider only offers rent/buy while a different provider has subscription availability. For example, the Zee5-filtered movie query returned Trolls World Tour, Oppenheimer and Spider-Man: No Way Home, but their India detail offers placed Zee5 under rent. The application rejects these and scans further within an explicit candidate budget; this can leave sparse rows.

The live India registry contained an Eros Now Select Apple TV channel, not a direct Eros Now entry, and no exact Airtel Xstream entry. These are not silently substituted.

A registry match alone is insufficient: each title must have a matching provider ID in its India offers. Runtime statuses distinguish a missing mapping, ambiguous mapping, source error, empty row, partial provider coverage and verified rows. The test report and `/status.json` list the rows actually available. First-release dates never represent newly-added-to-service dates.
