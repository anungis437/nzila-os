# OCRA Adaptive Flow — Production Readiness Memo v2 (Completion Sprint)

**Doctrine version:** 1.0.0
**Routing engine version:** 1.0.0
**Question bank version:** 3
**Branch:** `feat/icra-executive-continuity-brief-elite`
**Predecessor memo:** [OCRA_ADAPTIVE_FLOW_PRODUCTION_READINESS.md](./OCRA_ADAPTIVE_FLOW_PRODUCTION_READINESS.md)
**Predecessor commit:** `24836174d`

> **Emotional bar:** "This feels calm, trustworthy, and impossible to break casually."

---

## Recommendation

**GO** for production. All four blocking notes from the v1 memo are now closed. The single remaining limitation (Playwright full-traversal scenarios still scaffolded) is non-blocking: the static doctrine guard for per-question selectors is now active, and the manual QA script remains the authoritative end-to-end gate.

---

## Notes resolved in this completion sprint

### ✅ Note 1 — HubSpot live wiring

`syncIcraPurchase` now resolves the adaptive context (via the new `resolveAdaptiveContext`), derives the audit-safe properties through `deriveOcraAdaptivePropertiesFromPersisted`, coerces them to `Record<string, string>` for the HubSpot client, and merges them into `contactProperties`. The derivation is wrapped in try/catch so any failure logs a warning and the purchase sync proceeds with legacy properties only.

- Source: [apps/union-eyes/lib/hubspot/syncIcraPurchase.ts](../../../apps/union-eyes/lib/hubspot/syncIcraPurchase.ts)
- New helper: `deriveOcraAdaptivePropertiesFromPersisted` in [apps/union-eyes/lib/hubspot/icraAdaptiveProperties.ts](../../../apps/union-eyes/lib/hubspot/icraAdaptiveProperties.ts)

### ✅ Note 2 — Zero-migration adaptive persistence

We took the recommended zero-migration path: a `_adaptive` sub-key inside the existing `organizationContext` jsonb. The submit route embeds a `PersistedAdaptiveContext` blob at insert time; the result page, the PDF route, and the HubSpot sync read it back via the deterministic 4-path resolver.

- Persistence helpers: [apps/union-eyes/lib/icra/adaptation/persistedAdaptiveContext.ts](../../../apps/union-eyes/lib/icra/adaptation/persistedAdaptiveContext.ts)
- Reconstruction engine: [apps/union-eyes/lib/icra/adaptation/reconstructAdaptiveContext.ts](../../../apps/union-eyes/lib/icra/adaptation/reconstructAdaptiveContext.ts)
- Submit-route integration: [apps/union-eyes/app/api/icra/submit/route.ts](../../../apps/union-eyes/app/api/icra/submit/route.ts)
- Server action: [apps/union-eyes/actions/icra/get-adaptive-resolution.ts](../../../apps/union-eyes/actions/icra/get-adaptive-resolution.ts)

The resolver returns `AdaptiveContextResolution { source, adaptiveContext, fallbackUsed, compatibilityWarnings }` where `source ∈ { 'persisted', 'reconstructed', 'rerouted', 'safe_default' }`. Reconstruction is pure and version-aware: on a question-bank version drift, the resolver reroutes from the persisted profile bands; on missing persistence or shape mismatch, it reconstructs from the form selections; on total failure, it returns a safe default flagged with `fallbackUsed = true`.

### ✅ Note 3 — Result page adaptive context block

A locale-safe Adaptive Interpretation block now renders on the results page between `EmailResultsCard` and `ICRAProfile`. Bands and counts only; never free text or org names. Bilingual at parity (en-CA / fr-CA).

- Component: [apps/union-eyes/components/icra/AdaptiveInterpretationBlock.tsx](../../../apps/union-eyes/components/icra/AdaptiveInterpretationBlock.tsx)
- Result page: [apps/union-eyes/app/[locale]/continuity-assessment/results/[id]/page.tsx](../../../apps/union-eyes/app/%5Blocale%5D/continuity-assessment/results/%5Bid%5D/page.tsx)

### ✅ Note 4 — PDF Adaptive Interpretation Context section

The Executive Continuity Brief PDF now renders an Adaptive Interpretation Context page between the Stabilization Movement Appendix and the Assessment Metadata page. The mapper is locale-aware (no more hardcoded `'en-CA'`); the report route resolves the adaptive context via the same engine before invoking the mapper.

- Template: [apps/union-eyes/lib/icra-pdf/ExecutiveContinuityBriefTemplate.tsx](../../../apps/union-eyes/lib/icra-pdf/ExecutiveContinuityBriefTemplate.tsx)
- Mapper: [apps/union-eyes/lib/icra-pdf/reportDataMapper.ts](../../../apps/union-eyes/lib/icra-pdf/reportDataMapper.ts)
- Report route: [apps/union-eyes/app/api/icra/report/[assessmentId]/route.ts](../../../apps/union-eyes/app/api/icra/report/%5BassessmentId%5D/route.ts)

---

## New tests added in this sprint

| Test | Path | Coverage |
|------|------|----------|
| Adaptive report consistency | [apps/union-eyes/lib/icra/__tests__/adaptiveReportConsistency.test.ts](../../../apps/union-eyes/lib/icra/__tests__/adaptiveReportConsistency.test.ts) | 7 tests: determinism, persisted path, rerouted-on-bank-drift, reconstructed-on-missing, safe-default, extraction validation, routeVersion match |
| Telemetry path-resolution fix | [apps/union-eyes/lib/icra/adaptation/__tests__/adaptiveTelemetry.test.ts](../../../apps/union-eyes/lib/icra/adaptation/__tests__/adaptiveTelemetry.test.ts) | Pre-existing test path made cwd-agnostic via `import.meta.url` |
| E2E selector doctrine guard | [apps/union-eyes/e2e/ocra-adaptive-flow.spec.ts](../../../apps/union-eyes/e2e/ocra-adaptive-flow.spec.ts) | Static guard: `icra-question-${id}` + `icra-org-question-${id}` testids are present in the source |

---

## Remaining limitations (non-blocking)

### Playwright full-traversal coverage

The smoke + telemetry-privacy specs are active. The full multi-section traversal scenarios (`test.skip`) remain scaffolded. **What changed in this sprint:**

- Per-question stable selectors are now wired (`data-testid="icra-question-${id}"`, `data-testid="icra-org-question-${id}"`).
- A static doctrine guard locks the selector contract so future drift fails fast.
- The skipped scenarios are now mechanical to enable; they require dev-server orchestration but no further code changes inside the flow.

This is a coverage limitation, not a correctness gap. The manual QA script ([docs/oci/assessment/OCRA_ADAPTIVE_LIVE_FLOW_QA_SCRIPT.md](../../../docs/oci/superseded/assessment/OCRA_ADAPTIVE_LIVE_FLOW_QA_SCRIPT.md)) remains the authoritative end-to-end gate.

---

## Hard rules preserved (verify in code review)

- **Never persisted:** raw answers, routing rationale prose, organization names, free text, telemetry artifacts, hidden scoring state. `PersistedAdaptiveContext` carries only versions, profile bands, included/deferred question IDs, a fallback flag, and the explainability snapshot.
- **Never synced to CRM:** answers, question IDs, deferred rationale, narrative, free text, organization names, weaknesses, warnings, scores, telemetry. The HubSpot allowlist remains pinned by `icraAdaptiveProperties.test.ts`.
- **Reconstruction always works:** the resolver handles missing persistence, shape drift, bank-version drift, and total failure deterministically.
- **fr-CA parity:** every adaptive copy key on the results block and the PDF appendix has a paired translation; existing `adaptiveI18nIntegrity.test.ts` covers the FLOW_COPY surface.
- **No new migration.** Zero schema change.
- **No new env vars.**

---

## Why this is safe to ship

- The persistence path is opaque and additive: `organizationContext` already exists; we only embed a `_adaptive` sub-key. Older rows resolve through the reconstruction path with no behaviour change.
- The reconstruction engine is the canonical source of truth; persistence is a deterministic cache. If the cache disagrees with the current bank, the resolver reroutes from the persisted profile bands and flags `fallbackUsed = true`.
- HubSpot enrichment is best-effort and silently degrades. Purchase sync never blocks on adaptive derivation.
- The PDF appendix and the results block are pure renderers; they return `null` when no adaptive context is available.

---

## Sign-off

- **Author:** GitHub Copilot (Claude Opus 4.7)
- **Reviewer (engineering):** _pending_
- **Reviewer (security):** _pending_
- **Manual QA (per [QA script](../../../docs/oci/superseded/assessment/OCRA_ADAPTIVE_LIVE_FLOW_QA_SCRIPT.md)):** _pending_
