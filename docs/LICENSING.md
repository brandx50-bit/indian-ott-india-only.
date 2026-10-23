# Licensing, attribution and use boundaries

This is a technical source/terms review, recorded 24 October 2026, rather than a blanket permission grant for third-party data.

## Application and dependencies

The newly written implementation is MIT licensed; see `LICENSE`. No source or artwork from the reviewed Indian-stremio-catalogs repository was reused. Its README claims MIT, but a LICENSE file was missing at the audited commit and its linked raw file returned 404. Obtain an actual permission/license before copying that project's code in future.

The official [Stremio SDK](https://github.com/Stremio/stremio-addon-sdk/blob/master/LICENSE.md) and Express are MIT licensed. Preserve dependency license notices when redistributing a packaged dependency tree. The delivered source uses npm's lockfile; dependencies retain their own licenses, as enumerated in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). The application uses the SDK protocol builder/router, not Stremio Web source; inspection of the latter does not incorporate its GPL code into this application.

Pinned overrides update the SDK's transitive `router` dependency to `path-to-regexp` 0.1.13, and `tmp` to 0.2.7. These address the initial dependency audit findings; SDK HTTP routing is covered by tests after the overrides. Security audit results reflect the date of testing and should be rerun on updates.

## TMDB and JustWatch

[TMDB's API FAQ](https://developer.themoviedb.org/docs/faq) permits noncommercial API use subject to attribution and describes commercial licensing separately. A future revenue-producing deployment needs the appropriate TMDB agreement. Access to the API and metadata/image use remain subject to the owner's account/API terms; an application's source license does not license third-party images.

The service homepage About section contains the TMDB logo, links to TMDB, and this required notice:

> This product uses the TMDB API but is not endorsed or certified by TMDB.

The logo is loaded unchanged from TMDB's official asset URL, whose HTTP 200/image response was checked. Brand guidelines and logo approval remain governed by [TMDB attribution guidance](https://www.themoviedb.org/about/logos-attribution).

Availability data is attributed prominently to **JustWatch**, obtained only through TMDB's documented endpoints. [TMDB's watch-provider documentation](https://developer.themoviedb.org/reference/movie-watch-providers) expressly requires JustWatch attribution. No direct JustWatch scraper/API or independently licensed JustWatch feed is used. This documentation is not a license for bulk redistribution of a standalone JustWatch dataset. Commercial distribution or substantially different use needs review of the current source agreements.

## Platform boundaries

No direct provider scraper is included. SonyLIV's third-party scraping prohibition, ZEE5's automated extraction/indexing restrictions, and Hoichoi's unauthorized indexing restrictions informed this decision; source links are in [SOURCES.md](SOURCES.md). Other platforms' public pages were checked for evidence, not treated as blanket reuse authorization. No OTT login, browser impersonation, private partner API key, proxy, DRM circumvention or geographic override is implemented.

Platform/provider names identify catalog availability and do not imply endorsement. This service does not fetch, download, redistribute or serve video files. It advertises only `catalog` and leaves title/episode details to Cinemeta. Any separate installed playback add-ons are outside this project.
