# Adding and repairing catalogs

## Diagnose first

1. Inspect `/status.json`: identify the provider, content type, affected ranking, last verification and whether a cached row is being served.
2. Inspect safe server logs for TMDB status/path. Never print environment values, Authorization headers, full credential-bearing URLs or raw upstream errors.
3. Check current `/watch/providers/movie` and `/watch/providers/tv` data with `watch_region=IN` using your existing credential privately. A movie mapping need not imply a TV mapping.
4. Inspect a known title's country offers. A title appearing in Discover does not qualify without a matching `IN` subscription/free/ad-supported provider ID.

## Provider name changes

The only provider registry is `src/providers.js`. Add an exact provider name alias only after inspecting a real India registry response. Matching is case/punctuation normalized, not fuzzy. Do not map `Hotstar`, `JioCinema`, Amazon/Apple channels, or rental services to a merged/direct provider just because their names seem related. Multiple candidate IDs are treated as ambiguous.

Stable catalog IDs use a documented internal code in `src/engine.js`, not a hardcoded source-provider ID. Codes: `jh` JioHotstar, `sl` SonyLIV, `z5` ZEE5, `pv` Prime Video, `sn` Sun NXT, `hc` Hoichoi, `en` Eros Now, `ax` Airtel Xstream, `lp` Lionsgate Play, `nf` Netflix. Suffixes are `trend`, `pop` and `new`. Movie and series requests are distinguished by their endpoint type. Never change existing IDs to repair a source.

Add a new provider entry, a new unused internal code and a fixture for exact matching/ambiguity, then enable its slug via `PROVIDERS`. Optional Netflix works this way already. Run fixture tests plus an authenticated live check before claiming support. The SDK has an 8 KB manifest limit; the test includes all 60 current possible rows. Recheck this limit before adding more providers or collections.

## New selection sources or collections

First establish permission and a stable source/API. Document the exact selection rule, geographic scope, update frequency, authentication, attribution and failure behavior. Require exact title identifiers or verified matching, not unconstrained title-name search. Originals are not inferred from availability: a provider can license content it did not produce. A collection requires verified membership and its own stable catalog definition. Do not reuse a popularity row under a different label.

Keep source adapters server-side, behind the same cache/rate-limit controls, and preserve successful old rows on transient errors. Successful empty membership must remove a row; do not retain stale availability forever. Add tests for source errors, malformed/missing fields, pagination, duplicate membership, title type and India scope.

## Refresh and release

- `npm run refresh` performs a one-off authenticated refresh into the selected cache directory. Run it with the server stopped locally to avoid two writers; a running server does not watch/reload another process's snapshot.
- `npm test` exercises fixtures without keys. `npm run check` validates JavaScript syntax. `npm audit --omit=dev` checks current dependencies.
- `npm run verify:live` does a new authenticated source refresh and HTTP/title checks. For a hosted instance, add `-- --url https://ACTUAL-ORIGIN` and optionally `--all-posters`.
- Review generated reports and update the support table. Do not copy fixture names, provider numbers or sample output into a live support claim.
- Push to GitHub only after verifying `.env` and `.cache` are ignored. GitHub Actions and the Render build both test changes. Deploy to the existing service and verify the same manifest URL afterwards.

The refresh scheduler is a process timer and does not run while a free instance sleeps. A paid always-on service with persistent storage provides stronger refresh continuity. Scaling past one instance requires shared storage and refresh coordination, which this initial version does not provide.
