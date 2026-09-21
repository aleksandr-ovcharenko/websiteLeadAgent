# ADR: Generation Intelligence Foundation

**Status:** accepted  
**Date:** 2026-09-10

## Context

WLA is moving from a deterministic template-based generator to an evidence-driven platform. Multiple generation approaches are candidates: Blueprint, Stitch, Claude Code, Codex, Devin, and continued WLA template evolution. Before selecting or building any of these, the platform needs a common substrate that every approach can share.

The existing `RedesignRun` model already captured crawl JSON, content JSON, screenshots and Lighthouse reports for a single redesign path. Phase A artifacts for MAPID were useful but stored ad-hoc under `data/experiments/mapid/` without a consistent manifest, no cross-variant source guarantees, and no reusable QA or comparison layer.

## Decision

Introduce a filesystem-first **Generation Intelligence Foundation** with the following core concepts:

1. **SourceSnapshot** — an immutable, hashed set of source artifacts (crawl, source documents, content graph, screenshots). Every variant in an experiment must reference the same `SourceSnapshot`.
2. **GenerationRun** — a provider-neutral record of one generation attempt, with stages, costs, artifacts, errors and skill provenance. This is the conceptual successor to `RedesignRun`.
3. **Experiment** and **ExperimentVariant** — a collection of variants that share a `SourceSnapshot` and are evaluated together.
4. **ArtifactManifest** — every artifact is referenced by `type`, `path`, `sha256`, `createdAt`, `provider` and `metadata`. Large blobs remain on disk; manifests live alongside them.
5. **Evaluation** — automated and human scores per dimension, with explicit `NOT_MEASURED` for missing data.
6. **Provider and skill provenance** — every stage records which provider/skill produced it, without hard-coding Gemini, Firecrawl, Impeccable or any other vendor.

## Consequences

### Positive
- Future V2, Blueprint, Stitch and agent variants can be compared on the same source data.
- Reproducibility and traceability improve: a `GenerationRun` identifies source snapshot, git commit, provider, version and artifacts.
- QA becomes reusable: screenshot, Lighthouse, navigation, integrity, visual QA and evaluation modules are provider-neutral.
- Cost and duration are first-class, preventing hidden manual work or unmeasured provider spend.

### Negative / Trade-off
- The model is filesystem-first. Database persistence (Prisma) is intentionally deferred until the schema has been exercised by more experiments.
- Stage granularity adds some bookkeeping overhead, but it is required for fair comparison and debugging.
- `NOT_MEASURED` values can make reports look sparse, but this is preferable to inventing scores.

## Alternatives considered

1. **Extend `RedesignRun` directly in Prisma.** Rejected for now because the required fields are still stabilizing; filesystem iteration is faster. The existing `RedesignRun` table remains and `GenerationRun` can reference it later.
2. **Build one giant generic framework.** Rejected. The foundation is minimal and only adds modules that have concrete uses (MAPID re-registration).
3. **Pick Blueprint/Stitch/Agent first and instrument it.** Rejected. The goal is to compare architectures, not to assume a winner.

## Related files

- `packages/redesign-engine/experiments/` — foundation modules
- `packages/redesign-engine/experiments/REPORT.md` — full engineering report
- `data/experiments/mapid/REPORT-V2.md` — MAPID validation report
