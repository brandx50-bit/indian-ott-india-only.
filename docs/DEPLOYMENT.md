# Deployment and Stremio installation

Prepared on 24 October 2026 (Asia/Colombo). No public deployment is claimed until the acceptance report records an actual reachable HTTPS URL.

## Render + GitHub

Render is the initial target because its Node web service provides a stable service hostname, managed HTTPS, secret environment settings and GitHub deployment. The included `render.yaml` declares a **free** service in Singapore with Node 24, fixture checks during the build, and deployment after GitHub checks pass.

1. Publish this source directory as a GitHub repository (private is appropriate for a personal instance). Keep the repository root at this folder so `render.yaml`, `package.json` and `.github/workflows/ci.yml` are at the root. `.env`, `.cache`, `reports`, and `node_modules` must remain ignored. The packaged source archive excludes them too.
2. Connect GitHub to Render and create a Blueprint from the repository. Review the free plan and region before applying it. The GitHub and Render integrations can do the publication/deployment once connected to the user's accounts.
3. Enter `TMDB_READ_ACCESS_TOKEN` in Render's **secret environment** field. If you have only a v3 key, leave that token blank, add `TMDB_API_KEY` as a secret environment variable, and use that instead. No additional OTT credentials are required.
4. Create the service. Render assigns its actual `https://...onrender.com` origin. Set `PUBLIC_BASE_URL` to that origin (HTTPS, no additional path or query) in Environment settings and redeploy. The initial blank value only disables the install link; it does not change the manifest route.
5. Wait for `/ready` to return 200 and inspect `/status.json` for verified/nonempty rows. The first refresh may need minutes; `/health` only checks the process. Render's edge can terminate HTTPS while the Node process uses its supplied `PORT` internally.
6. Run `npm run verify:live -- --url https://ACTUAL-ORIGIN` from the local source with your locally configured credential. The validator checks all advertised endpoints, all returned title availability and sample poster URLs. Use `--all-posters` for complete poster checks.
7. Record the actual manifest URL, service ID, repository URL, deployed commit and test report. Trigger a second deployment and recheck the same manifest URL. Keep the same Render service; deleting and recreating it is not URL continuity.

GitHub Actions runs syntax checks, fixture tests and dependency audit on pushes and pull requests. `autoDeployTrigger: checksPass` asks Render to wait for provider checks; verify the repository integration and checks in the actual Render dashboard. Do not publish this add-on to a public add-on directory automatically.

## Free service limits

[Render's current documentation](https://render.com/docs/free) says free web services sleep after 15 minutes without inbound traffic and may take about a minute to wake. The local filesystem is ephemeral, including on spin-down, so cached snapshots can be lost. A workspace receives 750 free instance hours per calendar month, shared across free services, with separate bandwidth/build limits. Free services cannot attach persistent disks.

The app's in-process refresh timer stops while the service sleeps; it is not a guaranteed wall-clock scheduler. On waking, rows rebuild and can take additional time. This makes free hosting suitable for initial evaluation, with slower first opens. It does not depend on your PC being on.

For reliable everyday browsing, move the same service to a paid always-on instance, attach a persistent disk and set `CACHE_DIR` to its mount path. Review the actual price first; no paid resource has been authorized or provisioned in this delivery. A separate scheduled refresh job needs shared durable storage to benefit a different web process; a cron job with its own ephemeral filesystem is not a persistent cache solution. Run a single web instance with the current file-based snapshot design.

## Alternatives

- [Railway plans](https://docs.railway.com/reference/pricing/plans): usage/trial allowances and plan minimums should be reviewed before migration. It can host a Node service with HTTPS and environment variables, but is not assumed to be permanently free.
- [Fly.io pricing](https://fly.io/docs/about/pricing/): usage-based Machines and optional volumes require billing review. Suitable if instance placement and durable volumes become important; no free always-on entitlement is assumed.

Render's documented sleep and storage limitations are the main tradeoff for this initial free deployment. Paid hosting and shared durable storage are a later choice, not included silently.

## Install in Stremio

After HTTPS acceptance checks pass:

1. Open the public service homepage and choose **Install in Stremio**, or copy `https://ACTUAL-ORIGIN/manifest.json`.
2. In Stremio's add-ons interface, use its add-on URL field and install the manifest. Exact labels vary by app/version. Keep Cinemeta enabled for title and series episode metadata.
3. Inspect both Board/Home and Discover. Rows have separate movie/series types and no required search filters. Existing installed playback add-ons remain separate.
4. Record the Stremio client/version, device, number/names of rows shown and whether posters/title details load. Installation and rendering have not passed merely because the SDK linter passed.
5. If new rows appear after a provider repair, clients may cache the old manifest. Refresh add-ons or remove/reinstall the same manifest URL if necessary. No universal home-row reordering feature is assumed.

The current [official SDK documentation](https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/advanced.md) describes catalogs on Board and Discover. The audited [Stremio Web Board source](https://github.com/Stremio/stremio-web/blob/9f991f0e5de35babe83e7d632d2521e8a22855cb/src/routes/Board/Board.js) maps nonempty ready catalogs to individual `MetaRow` components and omits `EmptyContent`. This is source inspection, not a claim that every current client/version was tested.

## Troubleshooting

| Symptom | Action |
|---|---|
| `/health` works but `/ready` is 503 | Inspect `/status.json`, TMDB credential settings, refresh logs and API reachability. No verified row is ready yet. |
| Provider is `not-listed` | Its direct provider name was absent from that content-type's India registry. Check current registry data before editing aliases; never substitute a channel ID silently. |
| Provider `ambiguous` | Review duplicate exact names/IDs manually; the service refuses to guess. |
| Empty trending row | The bounded global weekly trend pool may contain no available titles for that provider. Popular/new can still work. |
| `401`/`403` from TMDB | Check the credential kind/activation and server network. Do not log or paste the key. There is no geo-proxy fallback. |
| `429` | Keep cached rows, increase request spacing or reduce row/trend limits. Retry-After is honored; long cooldowns abort work rather than busy-waiting. |
| Cached row is marked stale | Refresh failed or is overdue; it is retained only up to `STALE_HOURS`. Fix the source instead of extending the bound indefinitely. |
| Cold starts are slow | Expected on Render free. Upgrade the same service for always-on operation if desired. |
| Snapshot write fails | Check `CACHE_DIR` ownership/space and mount permissions. Existing in-memory rows remain usable. |
| A title is missing | It may lack India availability, IMDb ID, valid release date, or be outside the bounded candidate pool. Inspect TMDB source evidence before changing filters. |
| No video streams from this add-on | Expected: it advertises only the catalog resource. |

The supplied Dockerfile is an alternative packaging option. The Node app is tested directly; Docker builds and deployments require their own checks.
