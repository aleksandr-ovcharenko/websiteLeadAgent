# Discovery Provider Capability Audit

## Goal
Inspect existing discovery and enrichment sources before implementing the provider abstraction for Radar.

## Existing Sources

| Provider / Source | Existing implementation | Current purpose | Requires credentials | Can currently discover businesses | Reusable for Radar? | Missing work |
|---|---|---|---|---|---|---|
| **2GIS** | `apps/collector/src/providers/2gis/fetch2gisItems.ts` + `map2gisItemToLeadUpsert.ts`, `apps/collector/src/collector/collect2gisLeads.ts` | Fetch business listings for a city/query and create/update `Lead` records. | `DGIS_API_KEY` | Yes — full search is implemented. | Yes. Move/wrap into `BusinessDiscoveryProvider` and add `DiscoveryRun` persistence. | Add `limit`/`maxPages` controls and provider registry. |
| **OSM / Overpass** | `apps/collector/src/enrichment/providers/osm/osmEnrichmentProvider.ts` | Enrich an existing `Lead` with website/phone using Nominatim geocoding and Overpass tags. | No | Indirectly — can be adapted to search POIs by name/location. | Yes, with new discovery path. | Build a search mode that returns a list of candidates from Overpass instead of enriching one lead. |
| **DuckDuckGo HTML** | `apps/collector/src/enrichment/providers/ddg/ddgEnrichmentProvider.ts` | Search `companyName city официальный сайт` and extract the first result URL. | No | Indirectly — single-result today. | Yes, but limited. | Build a multi-result discovery path or use it only to enrich candidates found elsewhere. |
| **SerpAPI** | `apps/collector/src/enrichment/providers/serpapi/serpApiEnrichmentProvider.ts` | Search Google via SerpAPI and extract the first organic link for an existing lead. | `SERPAPI_API_KEY` | Indirectly — single-result. | Optional. Better as enrichment. | Needs a search-specific API call and multi-result parsing. |
| **Manual Import** | Not yet implemented. | — | No | N/A | Yes. | Create a provider that accepts pasted domains/websites/company data and turns them into `Lead` candidates. |
| **Yandex** | Not implemented. | — | Yes (needs a Yandex Search API key or suitable web interface, which is out of scope now). | No | Extension point only. | Add `BusinessDiscoveryProvider` slot and configuration model; do not fake results. |
| **Domain normalization** | `apps/collector/src/utils/normalizeWebsiteDomain.ts` | Strip `www`, lower-case host, validate URL. | No | N/A | Yes. | Already used in providers. |
| **Deduplication** | `prisma/schema.prisma` `Lead.@@unique([source, sourceId])` + `websiteDomain` index | Avoid duplicates by source/sourceId; domain is also indexed. | No | N/A | Yes. | May need cross-provider domain deduplication beyond `sourceId`. |

## Conclusion
- The **2GIS** adapter is the only complete discovery source today and becomes the first real `BusinessDiscoveryProvider`.
- **Manual Import** can be implemented immediately without any credentials and will prove provider switching.
- **OSM / Overpass** and **DuckDuckGo** are present as enrichment but can be given a discovery mode.
- **SerpAPI** and **Yandex** are credential-locked; Yandex will remain a not-configured extension point.
