# 2GIS Discovery Regression Report

## 1. Reproduction from the Radar UI (before the fix)

Parameters used in the web UI (`http://localhost:3000/radar`):

- Provider: 2GIS (`dgis`)
- Location: `Минск`
- Query: `строительство домов`
- Limit: 50
- Max pages: 5

**Outcome:** `0 results`.

Example `OperationConsole` output before the fix:

```
Searching dgis for "строительство домов"
Found 0 results (0 new, 0 duplicates)
2GIS returned no results for this query/location
Enrichment started in background
```

The operation technically executed but produced no usable leads.

---

## 2. Old working CLI path (same parameters)

Command run:

```bash
npx tsx apps/collector/src/cli/leads.ts --city='Минск' --query='строительство домов' --limit=50
```

Result:

```
query: "строительство домов"
collected: 50
new: 50
duplicates: 0
durationMs: 141420
```

The old path returned 50 real businesses immediately, proving that 2GIS, the API key, the query and `Минск` all work correctly.

---

## 3. Comparison: old path works, new UI path returned 0

| Path | Query | Location | Limit | Result count | Outcome |
|---|---|---|---|---|---|
| `apps/collector/src/cli/leads.ts` (old) | `строительство домов` | `Минск` | 50 | 50 | Working |
| Radar `DISCOVER_BUSINESSES` operation (new) | `строительство домов` | `Минск` | 50 | 0 | Broken |

Both paths use the same `DGIS_API_KEY` from `.env` and the same `fetch2gisItems` service.

---

## 4. Root cause

The 2GIS `catalog.api.2gis.com/3.0/items` endpoint returns **zero results for `page_size` values greater than 10**. The old collector used `pageSize = Math.min(10, limit)`. The new `apps/dashboard/src/discovery/providers/twogis.ts` (introduced with the provider abstraction in `67db921`) used `pageSize = Math.min(32, limit)`.

When the UI asked for 50 results, `twogis.ts` requested `page_size=32` on the first page, the API returned an empty `items` array, and the search broke at the first page.

Diagnostic evidence (`scripts/debug2gis.ts`):

```
pageSize=1  -> 1 items
pageSize=5  -> 5 items
pageSize=10 -> 10 items
pageSize=15 -> 0 items
pageSize=32 -> 0 items
```

The regression is **not** in the API key, query, city, locale, headers or response parsing. It is purely in the `page_size` parameter.

---

## 5. Git history of the regression

`apps/dashboard/src/discovery/providers/twogis.ts` was created in:

```
67db921 feat(radar): add Discovery Providers, presets and history UI with Playwright QA
```

It introduced a new `BusinessDiscoveryProvider` abstraction and set `pageSize = Math.min(32, limit)`.

The old, still-working implementation is in `apps/collector/src/collector/collect2gisLeads.ts`, which uses `pageSize = Math.min(10, limit)`.

`git log -- apps/dashboard/src/discovery/providers/twogis.ts` shows that the file was not changed after `67db921`, so the incorrect page size was never revisited.

---

## 6. Files changed to fix the regression and improve diagnostics

1. `apps/dashboard/src/discovery/providers/twogis.ts`
   - `pageSize = Math.min(10, limit)` (was `32`).
   - Added `context.onProgress` calls that report the effective 2GIS request, each page's HTTP status, raw and normalized result counts.

2. `apps/dashboard/src/discovery/types.ts`
   - Added optional `onProgress` callback to `DiscoveryContext` so providers can stream diagnostics to the `OperationConsole`.

3. `apps/dashboard/src/discovery/service.ts`
   - `start()` now accepts an `onProgress` callback and passes it to the provider.
   - `testProvider()` now uses a realistic query (`строительные компании`) and a meaningful limit.

4. `apps/dashboard/src/operations/registry.ts`
   - `DISCOVER_BUSINESSES` handler now:
     - shows the effective location in the `search` stage message;
     - passes `onProgress` into `DiscoveryService.start()`;
     - only logs "Enrichment started" when `collected > 0`.

5. `apps/platform/src/radar/OperationConsole.tsx`
   - Added `data-testid="operation-console"` for Playwright QA.

6. `scripts/test-discovery-2gis.ts` (new)
   - Real 2GIS smoke test.

7. `package.json`
   - New script: `npm run test:discovery:2gis`.

8. `scripts/2gis-regression-qa.ts` (new)
   - Playwright regression test for three queries.

---

## 7. Old vs. new vs. corrected request behaviour

### Old working collector request

- `pageSize = Math.min(10, limit)`
- `maxPages = 5`
- Effective `q = "строительство домов Минск"`
- Result: 50 real businesses

### New broken `twogis.ts` request (before fix)

- `pageSize = Math.min(32, limit)`
- `maxPages = 5` (default)
- Effective `q = "строительство домов Минск"`
- With `limit=50`, first request used `page_size=32`
- Result: `0` items from 2GIS

### Corrected `twogis.ts` request (after fix)

- `pageSize = Math.min(10, limit)`
- `maxPages = 5`
- Effective `q = "строительство домов Минск"`
- Result: 50 real businesses across 5 pages

---

## 8. Effective provider request logging in OperationConsole

The `OperationConsole` now shows safe, non-secret diagnostic values for every 2GIS discovery run:

```
Effective 2GIS request: query="строительство домов", location="Минск", limit=50, maxPages=5, pageSize=10
2GIS page 1 (pageSize=10): HTTP 200, raw=10, normalized=10
2GIS page 2 (pageSize=10): HTTP 200, raw=10, normalized=10
...
2GIS finished: 50 candidate(s), warning=none
```

The API key and any authorization headers are not logged. The `OperationService` also redacts values for keys like `apiKey`, `token`, `secret`, `password`.

---

## 9. Location and query handling

The new path does not drop or alter `location`.

- UI sends `location: "Минск"`, `query: "строительство домов"`.
- `DiscoveryService.resolveRequest` preserves these values.
- `twogis.ts` builds `fetch2gisItems({ city: "Минск", query: "строительство домов" })`.
- `fetch2gisItems` sets the 2GIS `q` param to `${query} ${city}` = `"строительство домов Минск"`.

This is the same query construction used by the old `collect2gisLeads.ts`.

---

## 10. Credentials/config source

Both the old CLI and the new Radar path use the same environment variable:

- `DGIS_API_KEY` from `.env`
- `DiscoveryProviderConfig` only stores `enabled`/`defaults`; the secret is never persisted to the database.
- `twogis.ts` resolves the key from `context.env.DGIS_API_KEY`.

---

## 11. Provider status and Test action

The Providers page still shows 2GIS as `Ready` when `DGIS_API_KEY` is present, but the test now proves more:

- `testProvider()` uses a realistic query (`строительные компании`) in `Минск` with `limit=5`.
- A successful test now returns the actual candidate count, not just a connectivity ping.

---

## 12. No more silent zero-result `SUCCESS`

- `OperationConsole` now explicitly shows the `0` result count and any provider warning.
- When a discovery returns `0` candidates, the handler now logs `Skipping enrichment: no candidates found` instead of starting an empty enrichment workflow.
- When a discovery returns `>0` candidates, it logs `Enrichment started in background for N candidate(s)`.

---

## 13. Pagination

- `pageSize = 10` (2GIS API limit)
- `maxPages = 5` (configurable in the UI, default 5)
- Pages are requested sequentially starting from `page=1`.
- The loop stops when `candidates.length >= limit` or `page > maxPages`.

---

## 14. One shared 2GIS implementation

- `apps/collector/src/providers/2gis/fetch2gisItems.ts` is the single HTTP client.
- `apps/collector/src/providers/2gis/map2gisItemToLeadUpsert.ts` is the single normalizer.
- `apps/dashboard/src/discovery/providers/twogis.ts` (Radar) and `apps/collector/src/collector/collect2gisLeads.ts` (CLI) both use the same two files.
- There is no duplicated 2GIS request-building logic.

---

## 15. Integration / smoke test

New command:

```bash
npm run test:discovery:2gis
```

Result:

```
PASS: 2GIS smoke test returned 10 raw item(s)
First: Зеленая гавань, офис продаж (бульвар Зелёной Гавани, 5)
```

The test calls the real 2GIS API with `q="строительные компании Минск"` and `page_size=10`. It fails if the response contains 0 items.

---

## 16. Browser QA after the fix

Script run: `npx tsx scripts/2gis-regression-qa.ts`

Location: `Минск`, limit: `50`, max pages: `5`, provider: `2GIS`.

| Query | UI result | Created | Duplicates | OperationRun ID | DiscoveryRun ID |
|---|---|---|---|---|---|
| `строительство домов` | 50 | 0 | 50 | `cmtg7gf6g004yxe7tonz80ch3` | `cmtg7gf6y0055xe7th7hc5q96` |
| `строительные компании` | 50 | 30 | 20 | `cmtg7gibt009wxe7t6fmkxx8c` | `cmtg7gic800a3xe7t0vj8nm7l` |
| `ремонт квартир` | 50 | 45 | 5 | `cmtg7glk300euxe7t8hxcqbgb` | `cmtg7glkm00f1xe7tzq0qux6t` |

Screenshots: `docs/screenshots/2gis-regression/`

The first query returned 0 new because the old CLI had already inserted the same 50 leads. The next two queries proved real creation of new leads.

---

## 17. CLI and UI comparison after the fix

For the same `строительство домов` / `Минск` / `50` parameters:

| Metric | CLI (`apps/collector/src/cli/leads.ts`) | Radar UI (`DISCOVER_BUSINESSES` operation) |
|---|---|---|
| Query | `строительство домов` | `строительство домов` |
| Location | `Минск` | `Минск` |
| Limit | 50 | 50 |
| Provider | 2GIS | 2GIS |
| Collected | 50 | 50 |
| Created | 50 (first run) | 0 (CLI already created them) |
| Duplicates | 0 | 50 |

Both paths return the same number of candidates. The created/duplicate split differs only because the CLI was run first and the UI re-discovered the same leads.

---

## 18. DiscoveryRun persistence

After the UI run for `строительные компании`:

- `discoveryRunId`: `cmtg7gic800a3xe7t0vj8nm7l`
- Persisted fields:
  - `provider`: `dgis`
  - `requestedProvider`: `dgis`
  - `query`: `строительные компании`
  - `location`: `Минск`
  - `limit`: 50
  - `maxPages`: 5
  - `collected`: 50
  - `createdCount`: 30
  - `duplicateCount`: 20
  - `status`: `COMPLETED`

Discovery History and `/radar/discoveries` now show the correct effective parameters and counts.

---

## Conclusion

The 2GIS regression was caused by an invalid `page_size` value (32) in the new provider abstraction. Restoring the 2GIS-supported page size of 10 makes the Radar web UI return real results again. Diagnostics, shared code reuse and an automated smoke test have been added to prevent similar regressions.
