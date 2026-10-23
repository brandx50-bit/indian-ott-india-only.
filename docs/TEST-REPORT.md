# Acceptance and support report

Tested 24 October 2026, Asia/Colombo. Authenticated refresh started 24/10/2026, 01:48:10 and finished 24/10/2026, 01:52:17. Machine-readable timestamps are UTC.

**Local live result: PASS — 27 nonempty rows, 669 catalog entries across seven providers.** Entries can overlap across rankings/providers; this is not a unique-title total. All 589 distinct returned poster URLs passed HTTP HEAD checks. Full remote hosting and actual Stremio installation remain pending.

Evidence: [authenticated title/catalog checks](live-verification.json), [current HTTP/restart checks](http-verification.json), [all-poster checks](poster-verification.json), [fixture test output](unit-tests.tap), [clean dependency install](clean-install.txt), and [dependency audit](dependency-audit.json).

## Per-platform results

Counts below are **Movies / Series**, per row category. Zero means no qualifying result in this version's bounded candidate pool; no empty catalog is advertised. Verified availability means matching TMDB/JustWatch India offer data, not an independent audit of the platform's entire library.

| Platform | Trending (TMDB) M/S | Popular (TMDB) M/S | New M/S | Current status |
|---|---:|---:|---:|---|
| JioHotstar | 3 / 18 | 40 / 40 | 22 / 40 | All six discovery rows verified; no originals/official charts |
| SonyLIV | 1 / 6 | 40 / 40 | 0 / 1 | Partially supported; only nonempty rows advertised |
| ZEE5 | 0 / 0 | 1 / 40 | 0 / 0 | Partially supported; only nonempty rows advertised |
| Prime Video India | 3 / 8 | 40 / 40 | 30 / 25 | All six discovery rows verified; no originals/official charts |
| Sun NXT | 0 / 0 | 40 / 28 | 2 / 0 | Partially supported; only nonempty rows advertised |
| Hoichoi | 0 / 0 | 40 / 40 | 0 / 1 | Partially supported; only nonempty rows advertised |
| Eros Now | 0 / 0 | 0 / 0 | 0 / 0 | Unsupported: direct provider not listed in either India registry |
| Airtel Xstream | 0 / 0 | 0 / 0 | 0 / 0 | Unsupported: direct provider not listed in either India registry |
| Lionsgate Play | 0 / 0 | 40 / 40 | 0 / 0 | Partially supported; only nonempty rows advertised |

Netflix is optional and disabled. The Tudum feed timed out during investigation; no Netflix row has been tested or advertised.

Provider IDs were resolved live: JioHotstar 2336, Sony Liv 237, Zee5 232, Amazon Prime Video 119, Sun Nxt 309, Hoichoi 315, Lionsgate Play 561. These are observations in this report, not constants used in the application. The Eros Now Select Apple TV reseller channel was not substituted for Eros Now; Airtel partner catalogs were not unioned.

ZEE5 movie coverage is sparse (one qualifying title in the configured scan). The Discover candidate list was dominated by movies with Zee5 rental offers and subscriptions elsewhere. Title-level verification excluded those offers rather than publishing a misleading full row. Increase the bounded scan only after assessing request volume; it does not prove full-library coverage.

## Actual advertised rows

| Catalog name | Content type | Stable catalog ID | Entries |
|---|---|---|---:|
| JioHotstar Popular Movies (TMDB) | movie | in.jh.pop | 40 |
| JioHotstar New Movies | movie | in.jh.new | 22 |
| JioHotstar Trending Movies (TMDB) | movie | in.jh.trend | 3 |
| SonyLIV Popular Movies (TMDB) | movie | in.sl.pop | 40 |
| SonyLIV Trending Movies (TMDB) | movie | in.sl.trend | 1 |
| ZEE5 Popular Movies (TMDB) | movie | in.z5.pop | 1 |
| Prime Video India Popular Movies (TMDB) | movie | in.pv.pop | 40 |
| Prime Video India New Movies | movie | in.pv.new | 30 |
| Prime Video India Trending Movies (TMDB) | movie | in.pv.trend | 3 |
| Sun NXT Popular Movies (TMDB) | movie | in.sn.pop | 40 |
| Sun NXT New Movies | movie | in.sn.new | 2 |
| Hoichoi Popular Movies (TMDB) | movie | in.hc.pop | 40 |
| Lionsgate Play Popular Movies (TMDB) | movie | in.lp.pop | 40 |
| JioHotstar Popular Series (TMDB) | series | in.jh.pop | 40 |
| JioHotstar New Series | series | in.jh.new | 40 |
| JioHotstar Trending Series (TMDB) | series | in.jh.trend | 18 |
| SonyLIV Popular Series (TMDB) | series | in.sl.pop | 40 |
| SonyLIV New Series | series | in.sl.new | 1 |
| SonyLIV Trending Series (TMDB) | series | in.sl.trend | 6 |
| ZEE5 Popular Series (TMDB) | series | in.z5.pop | 40 |
| Prime Video India Popular Series (TMDB) | series | in.pv.pop | 40 |
| Prime Video India New Series | series | in.pv.new | 25 |
| Prime Video India Trending Series (TMDB) | series | in.pv.trend | 8 |
| Sun NXT Popular Series (TMDB) | series | in.sn.pop | 28 |
| Hoichoi Popular Series (TMDB) | series | in.hc.pop | 40 |
| Hoichoi New Series | series | in.hc.new | 1 |
| Lionsgate Play Popular Series (TMDB) | series | in.lp.pop | 40 |

## User acceptance criteria

| # | Criterion | Result and evidence |
|---:|---|---|
| 1 | Successful hosted deployment | Pending: no public service or remote repository created yet. |
| 2 | HTTPS manifest reachable | Pending: no hosted URL assigned or claimed. |
| 3 | Accepted by Stremio | SDK schema/router passed; actual installation/client acceptance still pending. |
| 4 | Every advertised endpoint valid | PASS locally for all 27 advertised movie/series endpoints. |
| 5 | Actual relevant titles | PASS against authenticated TMDB title metadata and provider India offers. Sample titles/IDs appear in the JSON report. |
| 6 | Posters and identifiers | All 589 distinct posters returned image HTTP 200. IMDb external IDs checked against exact TMDB records. Cinemeta UI resolution is not yet tested. |
| 7 | No unrelated provider entries | PASS against the selected provider ID in each returned title's IN subscription/free/ads offers. Rent/buy-only offers and reseller channels excluded. |
| 8 | Indian availability | PASS for matching IN offers supplied by TMDB/JustWatch; no guarantee of source completeness or real-time OTT ground truth. |
| 9 | Correct content types | PASS for separate movie and series catalog endpoints. |
| 10 | Pagination/cache | PASS: 100-item fixture pages, arbitrary offset handling, finite live snapshots, no upstream calls for HTTP browsing, persisted snapshot restored on restart. |
| 11 | Empty/unavailable rows | PASS: omitted and reported honestly; source failures retain bounded old rows, then expire. |
| 12 | Stable URL after redeploy | Pending real deployment and a subsequent redeploy of the same service. |
| 13 | All nine statuses | PASS: table above and per-type statuses in JSON. |

## Automated verification

- 27 fixture/integration tests passed on Node 24.19.0, including India offer filtering, foreign-country/rental-only rejection, candidate refill, stable IDs, type correctness, duplicate suppression, 100-item pagination, source isolation, cache coalescing/expiry, stale retention/removal, disk restart, credential redaction, retries/Retry-After, CORS and rejection of stream/file endpoints. These use synthetic fixtures, not proof of live provider support.
- A clean `npm ci --ignore-scripts` succeeded with the delivered lockfile. JavaScript syntax checks passed. `npm audit --omit=dev` reported zero vulnerabilities at the time of testing.
- Authenticated source checks verified 669 emitted entries across 27 nonempty rows. Title checks used the source response data cached during the same refresh; they do not constitute a second independent data-provider audit.
- Current HTTP code served the full retained live rows (up to the 100-item Stremio page size), returned correct next-page results, and `/ready` returned 200 after reloading the saved snapshot.
- Restarted production entry point with the saved snapshot: 27 rows immediately available, `refreshing=false`, zero upstream requests at initial inspection. Scheduling resumes when the next refresh is due.
- Every unique poster URL in the final snapshot was tested with HTTP HEAD without downloading images.

## Remaining steps and limits

1. Publish the private GitHub repository and create the free Render web service in the intended workspace. Both plugins were installed during the session, but their GitHub/Render account-operation tools were not exposed to this running turn; no account mutation is falsely claimed.
2. Set the existing TMDB credential privately in Render, set the assigned HTTPS origin, deploy, and run the hosted validator. Keep the credential out of source and the public manifest.
3. Install the hosted manifest in the actual Stremio client, record app/device versions and row display, then redeploy the same service and verify URL continuity.
4. Render free sleep/ephemeral storage can cause long cold starts and pause refresh timers. No paid resources have been provisioned.
5. Official OTT charts, platform-added dates and originals/collections have no verified source and are not advertised. Full-library coverage, language-specific rows, multi-instance coordination and persistent free-host storage are not implemented.

The public-client source audit confirms individual catalog rows in Stremio Web's Board and catalog selection in Discover. This is not an actual device rendering test. See [deployment instructions](DEPLOYMENT.md) and [source investigation](SOURCES.md).
