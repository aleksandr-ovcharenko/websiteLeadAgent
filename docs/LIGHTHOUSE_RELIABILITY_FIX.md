# Lighthouse Reliability Fix

## 1. Observed Failure

A real qualification caused the WebsiteLeadAgent **CORE** process to exit with:

```
LighthouseError: PROTOCOL_TIMEOUT
protocolMethod: Target.getTargetInfo
Waiting for DevTools protocol response has exceeded the allotted time.
Stack: node_modules/lighthouse/core/gather/session.js
[CORE] exited with code 1
```

## 2. Root Cause

- **Lighthouse ran in the main CORE Node process.** It used `chrome-launcher` directly inside `apps/auditor/src/lighthouse/runLighthouse.ts` and was awaited by `apps/dashboard/src/operations/OperationService`.
- **No process isolation.** A `PROTOCOL_TIMEOUT` / `unhandledRejection` from `lighthouse` could propagate and terminate the entire server.
- **No bounded concurrency.** Many `RUN_LIGHTHOUSE` operations could start simultaneously; before the fix there were **32 stale Chrome/Chromium processes** left from previous qualification runs.
- **No outer watchdog.** There was nothing to kill a hung Lighthouse/Chrome if Lighthouse's own protocol timeout did not trigger or was ignored.
- **Retry used the same broken Chrome.** The original `try/finally` killed Chrome, but only after the error had already surfaced in the main process.
- **Leads with a failed Lighthouse stayed PENDING forever.** There was no `status` or `error` on `LighthouseReport`, so the UI could not show `FAILED`.

## 3. Current Lighthouse Execution Model

```
CORE / OperationService
  └─ category concurrency semaphore (HEAVY=1)
      └─ RUN_LIGHTHOUSE handler in registry.ts
          └─ fork worker process
              └─ chrome-launcher (fresh Chrome)
                  └─ lighthouse(...)
          └─ parent watchdog (120 s default, configurable)
          └─ retry up to 3 attempts with fresh Chrome/worker
          └─ on failure: create LighthouseReport(status=FAILED, error, attempts, durationMs)
          └─ on success: create LighthouseReport(status=SUCCESS, ...scores)
```

Lighthouse now runs in an isolated worker child. If the worker exits, crashes, or hangs, **only the operation fails** — CORE continues.

## 4. Files Changed

- `apps/auditor/src/lighthouse/runLighthouse.ts` — full rewrite with `LighthouseError`, worker spawning, watchdog, retry, cleanup.
- `apps/auditor/src/lighthouse/lighthouse.worker.ts` — new child-process worker that runs `runLighthouseOnce`.
- `apps/dashboard/src/operations/registry.ts` — `RUN_LIGHTHOUSE` now persists a `FAILED` `LighthouseReport` with structured diagnostics.
- `apps/dashboard/src/operations/OperationService.ts` — added `AsyncSemaphore` and per-category concurrency (HEAVY/AI/SCORING/...).
- `apps/platform/src/radar/qualification.ts` — derive Lighthouse stage from `lighthouseReport.status` and surface `error.message`.
- `apps/dashboard/src/server.ts` — require `lighthouseReport.status === 'SUCCESS'` for ready-for-review counts.
- `prisma/schema.prisma` — added `status`, `error`, `attempts`, `durationMs` to `LighthouseReport`.
- New test scripts:
  - `scripts/lh-timeout-test.mjs`
  - `scripts/lh-operation-regression.mjs`

## 5. Timeout and Retry Configuration

Defaults (overridable through `CONCURRENCY_*` env or operation `input`):

- `maxTimeMs` (total worker watch dog): `120000` ms
- `maxWaitForLoad`: `60000` ms
- `maxWaitForFcp`: `30000` ms
- `retries`: `2` (so 3 attempts total)
- Concurrency for browser-heavy work (`audit` + `lighthouse`): `1`
- AI concurrency: `1`
- Scoring concurrency: `2`

## 6. Concurrency Configuration

```ts
// OperationService maps categories to a shared HEAVY semaphore for audit + lighthouse
private getSemaphore(def: OperationDefinition) {
  const key = def.category === 'lighthouse' || def.category === 'audit' ? 'HEAVY' : def.category.toUpperCase();
  // limit is parsed from CONCURRENCY_HEAVY, CONCURRENCY_AI, etc.
}
```

## 7. Chrome Cleanup

- Worker `finally` calls `chrome.kill()`.
- Worker also sends `SIGTERM` to the Chrome PID as a fallback.
- Parent kills the entire worker process group (`kill(-pid, SIGTERM)` then `SIGKILL`) on watchdog timeout or worker error.
- After all tests, `ps aux` showed **0** Chrome processes.

## 8. Node / Lighthouse / Puppeteer / Chrome Versions

- Node: `v22.23.2`
- Lighthouse: from installed `node_modules/lighthouse`
- `chrome-launcher`: from installed `node_modules/chrome-launcher`
- Chrome/Chromium: Playwright-installed Chromium (`~/.cache/ms-playwright/chromium-1228`)
- `puppeteer-core` / Playwright are used elsewhere; Lighthouse uses `chrome-launcher`.

## 9. Test Results

### 9.1 Worker timeout containment (`scripts/lh-timeout-test.mjs`)

```bash
npx tsx scripts/lh-timeout-test.mjs
```

Result:

```
Chrome before timeout test: 0
Expected failure captured: LighthouseError WATCHDOG_TIMEOUT attempt 3 retryable true
LighthouseError.toJSON: { name, message, code: "WATCHDOG_TIMEOUT", attempt: 3, url, ... }
Chrome after failure: 0
Now running a normal successful run...
Success: { performance: 15, accessibility: 67, ... }
Chrome after success: 0
```

- Process survived the failure.
- Error was structured with `code`, `attempt`, `retryable`.
- No Chrome leak.
- A subsequent normal run succeeded.

### 9.2 OperationService regression (`scripts/lh-operation-regression.mjs`)

```bash
npx tsx scripts/lh-operation-regression.mjs
```

Result:

```
Chrome before: 0
FAILURE TEST OK: FAILED WATCHDOG_TIMEOUT
SUCCESS TEST OK: SUCCESS performance 43
Chrome after: 0
Chrome count acceptable
REGRESSION PASSED
```

- `OperationService` `RUN_LIGHTHOUSE` on `http://localhost:1` with `maxTimeMs: 10` → `FAILED` `OperationRun` and `FAILED` `LighthouseReport` with `WATCHDOG_TIMEOUT`.
- `RUN_LIGHTHOUSE` on `mrs.by` (certificate site) → `SUCCESS` with valid scores.
- CORE process survived both outcomes.
- Concurrency semaphore serialised them because both use the `HEAVY` slot.

### 9.3 Real problematic site (`saga.by`)

```bash
npx tsx scripts/lighthouse-now.ts cmtlwims40010mz6a5y30n7px
```

Result:

```
Running Lighthouse for cmtlwims40010mz6a5y30n7px https://saga.by/
{
  "performance": 35,
  "accessibility": 80,
  "seo": 93,
  "bestPractices": 74,
  "lcp": 8063.75,
  "fcp": 2447.85,
  "tbt": 1997.01
}
```

### 9.4 Certificate site (`mrs.by`)

```bash
npx tsx apps/dashboard/test-mrs-lighthouse.mjs
```

Result:

```
Lighthouse OK {
  performance: 42, accessibility: 81, seo: 88, bestPractices: 74,
  lcp: 5767.5, cls: 0.087, fcp: 4370.9, tbt: 834
}
```

## 10. Remaining / Recommended Verification

- Run the full Radar UI qualification flow for `saga.by` and capture the requested screenshots.
- Run a larger batch (5–10 leads) through `OperationService` to record peak Chrome count under `HEAVY=1` concurrency.
- Add the screenshot capture step to `apps/dashboard/capture-radar.mjs` or a new `capture-lighthouse.mjs`.

## 11. Checklist

- [x] `PROTOCOL_TIMEOUT` does not terminate CORE — isolated worker + watchdog
- [x] Lighthouse errors are caught and persisted with `code`, `protocolMethod`, `attempt`, `retryable`
- [x] Chrome is cleaned on every outcome (worker `finally` + parent process-group kill)
- [x] Retries use a fresh worker and fresh Chrome
- [x] Retries are bounded (max 3 attempts by default)
- [x] Concurrency is bounded (`HEAVY=1`, `AI=1`, `SCORING=2`)
- [x] Failed Lighthouse becomes explicit `FAILED`, not `Pending`
- [x] Radar qualification can show `FAILED` with a reason
- [x] Qualification can resume from Lighthouse after a failure (re-run `RUN_LIGHTHOUSE`)
- [x] CORE remains usable after the failure
- [x] Exact problematic site `saga.by` tested
- [x] Certificate site `mrs.by` tested
- [x] Regression test proves process survives
