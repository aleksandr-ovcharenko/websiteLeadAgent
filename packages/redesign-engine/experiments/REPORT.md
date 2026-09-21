# Generation Intelligence Foundation — Engineering Report

**Date:** 2026-09-10  
**Scope:** reusable foundation for all future WLA generation experiments (V2, Blueprint, Stitch, agent)  
**Validation experiment:** MAPID Phase A / B1 re-registered under the new model  
**Main validation artifact:** `data/experiments/mapid/REPORT-V2.md`

---

## 1. Summary

This work introduces a common Generation Intelligence Foundation so every future WLA website generation is:

- **reproducible** — a stable `SourceSnapshot` and `GenerationRun` identity;
- **inspectable** — stage-level status, duration, costs and artifacts;
- **evidence-backed** — every artifact carries SHA-256 and provenance;
- **comparable** — `Experiment` with multiple `Variant`s sharing the same source;
- **measurable** — Lighthouse, navigation, integrity, visual QA and evaluation metrics;
- **skill-aware** — skill registry and per-stage skill usage;
- **provider-aware** — provider-neutral enums for source, intelligence, design and generation;
- **cost-aware** — cost records support unknown values and provider-specific units;
- **QA-aware** — deterministic generated-site integrity checks and a structured VisualQA interface.

No production generation path was replaced. `construction-modern-v1`, `generateSite`, Site/CMS contracts, Showcase rendering, Radar and RBAC remain untouched.

---

## 2. Architecture before

```
Radar → Lead → crawl/audit → SourceDocuments → SourceContentGraph → SiteContentPlanV2 → content → CMS → template → SiteBuild → Showcase
```

State was split across:

- `prisma/schema.prisma` (`Lead`, `Site`, `SiteBuild`, `RedesignRun`, `LighthouseReport`, `VisualAnalysis`, `OperationRun`, `ActivityEvent`).
- `packages/redesign-engine/src/` for crawl, extraction, semantic graph, planning and generation.
- `data/experiments/mapid/` for Phase A artifacts, but without a unifying experiment model.
- `apps/auditor/src/lighthouse/` and `scripts/mapid-screenshots.mjs` for one-off QA.

`RedesignRun` already stored `crawlJsonPath`, `contentJsonPath`, `lighthouseReport`, `redesignScreenshots`, etc. The foundation reuses that concept and names it `GenerationRun`.

---

## 3. Architecture after

```
                                  ┌──────────────┐
                                  │ SourceSnapshot│
                                  └───────┬──────┘
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            │                             │                             │
            ▼                             ▼                             ▼
   ┌─────────────────┐        ┌──────────────────┐          ┌───────────────┐
   │ Intelligence Run │        │ Generation Run  │          │  Experiment   │
   │  (B1, future)   │        │  (V1, V2, ...)  │          │ (compares     │
   └────────┬─────────┘        └────────┬─────────┘          │  variants)   │
            │                           │                    └───────┬──────┘
            │                           ▼                            │
            │                  ┌─────────────────┐                   │
            │                  │   SiteBuild     │                   │
            │                  │  (existing)     │                   │
            │                  └─────────────────┘                   │
            │                                                        │
            └────────────────────┬───────────────────────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │  QA / Evaluation Layer   │
                    │  (screenshot, lighthouse,│
                    │   navigation, integrity, │
                    │   visual QA, comparison) │
                    └──────────────────────────┘
```

The new foundation lives in `packages/redesign-engine/experiments/` and is exposed through `packages/redesign-engine/experiments/index.mjs`.

---

## 4. Data model

### 4.1 SourceSnapshot

```ts
{
  id: string;
  sourceUrl: string;
  crawler: 'WLA' | 'FIRECRAWL' | ...;
  crawlRunId?: string;
  crawledAt: string;
  artifacts: ArtifactRef[];
  contentHash: string; // hash of artifact metadata
  metadata?: Record<string, unknown>;
}
```

`SourceSnapshot` is immutable. Every variant in an experiment references the same `sourceSnapshotId`.

### 4.2 ArtifactRef

```ts
{
  type: ArtifactType; // SOURCE_CRAWL, LIGHTHOUSE, etc.
  path: string;
  sha256: string;
  createdAt: string;
  provider?: string;
  metadata?: Record<string, unknown>;
}
```

Large blobs stay on the filesystem. The manifest carries SHA-256 and metadata.

### 4.3 GenerationRun

```ts
{
  id: string;
  leadId?: string;
  siteId?: string;
  demoVariantId?: string;
  mode: 'SAFE' | 'CREATIVE' | 'BESPOKE';
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'SKIPPED';
  sourceSnapshotId: string;
  intelligenceRunId?: string;
  generationProvider: string;
  generationVersion: string;
  designRecipeId?: string;
  siteBuildId?: string;
  startedAt: string;
  completedAt?: string;
  gitCommit?: string;
  stages: Stage[];
  costs: CostRecord[];
  provenance: SkillUsage[];
  artifacts: ArtifactRef[];
  errors: RunError[];
}
```

`GenerationRun` is the conceptual successor to `RedesignRun`. It does **not** replace the `RedesignRun` table; it is a filesystem-first representation that `RedesignRun` can reference.

### 4.4 Stage

```ts
{
  name: string;
  status: StageStatus;
  provider?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  artifacts: ArtifactRef[];
  costs: CostRecord[];
  errors: RunError[];
}
```

Supported stages: `SOURCE`, `INTELLIGENCE`, `GENERATION`, `BUILD`, `SCREENSHOT`, `LIGHTHOUSE`, `NAVIGATION`, `INTEGRITY`, `VISUAL_QA`, `QA`, `SECURITY`, `REPORT`.

### 4.5 CostRecord

```ts
{
  provider: string;
  operation: string;
  requests?: number;
  inputTokens?: number;
  outputTokens?: number;
  credits?: number;
  reportedCost?: number;
  estimatedCost?: number;
  currency?: string;
}
```

Unknown/unmeasured fields remain `undefined`, never zero.

### 4.6 SkillUsage

```ts
{
  skill: string;
  source: string;
  version?: string;
  stage: string;
  reason?: string;
}
```

### 4.7 Experiment / Variant

```ts
Experiment {
  id: string;
  name: string;
  sourceSnapshotId: string;
  sourceUrl: string;
  createdAt: string;
  variants: ExperimentVariant[];
  artifacts: ArtifactRef[];
  skillUsage: SkillUsage[];
  qaFindings: Finding[];
  humanEvaluations: Evaluation[];
  comparisonMatrix: ComparisonMatrix;
  automatedEvaluation: Evaluation;
}
```

`ExperimentVariant` links a `GenerationRun`, `siteId`, `demoVariantId` and provider.

### 4.8 Evaluation

```ts
Evaluation {
  source: 'AUTOMATED' | 'HUMAN';
  evaluator?: string;
  scores: Record<EvaluationMetric, number | 'NOT_MEASURED'>;
  notes?: string;
}
```

Dimensions: business, content, UX, design, engineering, economics. Missing dimensions are explicitly `NOT_MEASURED`.

---

## 5. Ownership boundaries

| Concept | Owner | Persistence | Notes |
|---|---|---|---|
| SourceSnapshot | foundation | `data/experiments/{id}/source-snapshot.json` | Immutable, referenced by runs |
| GenerationRun | foundation | `data/experiments/{id}/variants/{variant}/generation-run-*.json` | Stage/cost/provenance |
| SiteBuild | existing `SiteBuild` model | PostgreSQL | `GenerationRun.siteBuildId` references it |
| Experiment | foundation | `data/experiments/{id}/experiment.json` | Groups variants and evaluation |
| LighthouseReport | existing `LighthouseReport` model | PostgreSQL | `GenerationRun` artifacts duplicate for experiments |
| Security audit | existing `SecurityAudit` / `SecurityFinding` | PostgreSQL | Foundation only adds provenance links |

The foundation does **not** duplicate `SiteBuild` fields (`dependencySnapshotId`, `templateId`, `outputPath`). It references them.

---

## 6. Artifact system

- `hashFile(path)` computes SHA-256.
- `createArtifactRef(type, path, metadata)` builds an `ArtifactRef`.
- `verifyManifest(manifest)` checks that every artifact exists and matches its hash.
- `buildDirectoryManifest(root, artifacts)` writes `artifact-manifest.json`.
- Experiment manifests (`experiment.json`) embed artifact references.
- Filesystem layout:

```
data/experiments/{experiment}/
  source-snapshot.json
  experiment.json
  REPORT-V2.md
  variants/
    {variant}/
      generation-run-{uuid}.json
      screenshots/
      lighthouse/
      qa/
        integrity-{uuid}.json
        navigation-{uuid}.json
        visual-qa-{uuid}.json
```

---

## 7. Provider system

Provider enums are intentionally vendor-neutral:

- `SourceProvider`: `WLA`, `FIRECRAWL`
- `IntelligenceProvider`: `RULE_BASED`, `GEMINI`, `OPENAI`
- `ResearchProvider`: `WEB_SEARCH`, `PERPLEXITY`
- `VisualQAProvider`: `IMPECCABLE_GUIDED_AGENT`, `AI`, `HUMAN`
- `GenerationProvider`: `TEMPLATE`, `BLUEPRINT`, `AGENT`, `DEVIN`, `CLAUDE_CODE`, `CODEX`, `STITCH`, `DESIGN_TO_CODE`
- `GenerationMode`: `SAFE`, `CREATIVE`, `BESPOKE`

`GenerationMode` is separate from `GenerationProvider`.

---

## 8. Skill provenance

`packages/redesign-engine/experiments/skills.mjs` discovers `.agents/skills/` and produces a registry. For each installed skill it records:

- `id`, `name`, `source`, `version`, `license`, `stages`, `path`.

Usage is recorded per stage in `GenerationRun.provenance`:

```json
{
  "skill": "internal/strategy/site-analysis",
  "source": "WLA",
  "stage": "INTELLIGENCE"
}
```

Discovered skills for MAPID: `impeccable`, `taste-skill`, `emilkowalski/skills`.

---

## 9. QA modules

### 9.1 Screenshot runner (`screenshots.mjs`)

- Uses `launchSandboxedBrowser` from `@minsk/security`.
- Supports desktop/mobile viewports.
- Records `url`, `viewport`, `timestamp`, `httpStatus`, `consoleErrors`.
- Exposes `captureScreenshots({ targets, outDir, viewports })` and `ingestScreenshot(filePath, type, metadata)`.

### 9.2 Lighthouse runner (`lighthouse.mjs`)

- Runs Lighthouse via `lighthouse` + `chrome-launcher`.
- Ingests existing Lighthouse JSON into a common `LighthouseResult`.
- Records `performance`, `accessibility`, `bestPractices`, `seo`, `lcp`, `cls`, `inp`, `fcp`, `tbt`, `durationMs`, `version`.

### 9.3 Navigation validator (`navigation.mjs`)

- Extracts header/footer/body links with Playwright.
- Classifies each link as `VALID`, `BROKEN`, `EXTERNAL`, `ANCHOR`, `UNTESTED`.
- Respects `maxLinks` to avoid destructive crawling.
- Reports `validPercent` and per-link status.

### 9.4 Content integrity (`integrity.mjs`)

Deterministic checks for:

- empty hero headline / missing CTA;
- truncated strings;
- placeholder or incorrect content (`Internet provider`);
- mixed UI language;
- missing primary navigation / contact path;
- duplicate section headings;
- duplicate media overuse.

### 9.5 Visual QA (`visualQA.mjs`)

- Provider-neutral `VisualQAReport` with `findings[]`.
- `IMPECCABLE_GUIDED_AGENT` placeholder: when the Impeccable engine binary is not executed, the report clearly notes findings were derived from deterministic checks.

### 9.6 Evaluation (`evaluation.mjs`)

- `createEmptyEvaluation()` initializes all metrics to `NOT_MEASURED`.
- `buildAutomatedEvaluation()` fills scores from available QA measurements.
- `buildComparisonMatrix()` produces a variant × metric matrix.
- `writeEvaluation()` persists evaluation artifacts.

---

## 10. MAPID re-registration

The MAPID Phase A experiment was re-registered with the new model:

```bash
node scripts/mapid-experiment-foundation.mjs
```

Output:

- `data/experiments/mapid/source-snapshot.json`
- `data/experiments/mapid/experiment.json`
- `data/experiments/mapid/REPORT-V2.md`
- `data/experiments/mapid/variants/{v1,v2_alpha,b1-intelligence}/`

Variants:

| Variant | Provider | Status | Integrity findings |
|---|---|---|---|
| V1 | TEMPLATE | SUCCESS | 2 ("Internet provider" misclassification) |
| V2_ALPHA | TEMPLATE | SUCCESS | 2 (catalog CTA, English nav on Russian site) |

Both variants shared the same `SourceSnapshot` and were compared with Lighthouse and integrity scores.

---

## 11. Security

- No new dependencies were added.
- `npm run security:audit` completed with the **same pre-existing** `HIGH_RISK` status (15 production-reachable HIGH findings, 1 build CRITICAL). New code did not introduce new findings.
- `packages/redesign-engine/experiments/screenshots.mjs` and `navigation.mjs` use `launchSandboxedBrowser` and `assertAllowedUrl` from `@minsk/security`.
- No `--no-sandbox` default; `PLAYWRIGHT_CHROMIUM_NO_SANDBOX=true` only allowed in dev/test.
- No secrets are logged or stored in experiment manifests.

---

## 12. Tests

| Command | Result |
|---|---|
| `npm run test:node` (packages/redesign-engine) | **PASS** — 151 passed, 0 failed, 1 skipped |
| `npm run test:unit` | **PASS** — 28 files, 157 tests passed |
| `npm run test:auth` | **PASS** — 7 tests passed |
| `npm run test:security` | **PASS** — 24 tests passed |
| `npm run security:audit` | Completed; pre-existing HIGH_RISK, no new issues |

New tests: `packages/redesign-engine/test/experiments.test.mjs`

---

## 13. Performance

The MAPID re-registration script completed in ~10s. Navigation validation dominated duration (~10s per variant with `maxLinks=10`). Lighthouse was ingested from existing reports; running Lighthouse would add ~10–20s per variant.

---

## 14. Files changed

New foundation modules:

- `packages/redesign-engine/experiments/types.mjs`
- `packages/redesign-engine/experiments/manifest.mjs`
- `packages/redesign-engine/experiments/sourceSnapshot.mjs`
- `packages/redesign-engine/experiments/generationRun.mjs`
- `packages/redesign-engine/experiments/cost.mjs`
- `packages/redesign-engine/experiments/screenshots.mjs`
- `packages/redesign-engine/experiments/lighthouse.mjs`
- `packages/redesign-engine/experiments/navigation.mjs`
- `packages/redesign-engine/experiments/integrity.mjs`
- `packages/redesign-engine/experiments/visualQA.mjs`
- `packages/redesign-engine/experiments/evaluation.mjs`
- `packages/redesign-engine/experiments/skills.mjs`
- `packages/redesign-engine/experiments/report.mjs`
- `packages/redesign-engine/experiments/experiment.mjs`
- `packages/redesign-engine/experiments/index.mjs`
- `packages/redesign-engine/test/experiments.test.mjs`
- `scripts/mapid-experiment-foundation.mjs`

Generated artifacts (not committed):

- `data/experiments/mapid/source-snapshot.json`
- `data/experiments/mapid/experiment.json`
- `data/experiments/mapid/REPORT-V2.md`
- `data/experiments/mapid/variants/{v1,v2_alpha,b1-intelligence}/`

No production code in `packages/` or `apps/` was changed except the additive foundation modules.

---

## 15. Remaining gaps

### BLOCKER
- None. The foundation is usable and tests pass.

### IMPORTANT
1. **DB persistence:** `SourceSnapshot`, `GenerationRun` and `Experiment` are filesystem-first. Once the schema stabilizes, add Prisma models and migration.
2. **Impeccable integration:** `visualQA.mjs` currently records `IMPECCABLE_GUIDED_AGENT` as a manual/agent-assisted placeholder. The Impeccable engine binary can be wired later.
3. **Lighthouse live execution:** `lighthouse.mjs` can run live, but the MAPID script ingested existing reports for speed.
4. **Navigation validator accuracy:** currently uses Playwright `goto` with `domcontentloaded`; JS-rendered routes may need `networkidle`.
5. **Human evaluation UI:** only a JSON/Markdown placeholder exists.

### OPTIONAL
1. `GET /api/experiments` read-only API.
2. Per-provider cost configuration file.
3. Visual diff between variants.
4. Automated media relevance AI pass.

---

## 16. Recommendation

**WLA is ready to start B1 Website Intelligence proper.**

The foundation provides:

- a stable `SourceSnapshot` that B1 already feeds into;
- an `Experiment` format that can hold B1 intelligence runs and future B2 design variants;
- QA and evaluation machinery to compare V1, V2 and any future Blueprint/Stitch/agent variant fairly;
- skill and provider provenance so architecture decisions can be evidence-based.

Before B2, the most important follow-ups are:

1. Persist `SourceSnapshot` / `GenerationRun` / `Experiment` in PostgreSQL once the schema is exercised by a few more experiments.
2. Wire Impeccable or another VisualQA provider into the `VISUAL_QA` stage.
3. Run the MAPID experiment with live Lighthouse and full navigation once the previews are stable.
