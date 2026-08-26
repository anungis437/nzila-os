# 15 — Remediation Baseline Record

**Programme state:** `PARTIALLY_IMPLEMENTED`.
**Recorded by:** Reality Remediation Programme.
**Recorded at:** 2026-07-20 (Wave 0 continuation session).

## Git baseline

- Branch: `fix/union-eyes-reality-remediation`
- HEAD after Wave 0 containment commit: `897d70a1948987c6da547f4af15ee17d596e20df`
- Merge base: `c77f0cf091ddd7b54085d90a3583c1b46b7de003` (`origin/main`).
- Working tree state at continuation start:
  - Modified (unrelated, preserved): `ops/outputs/data-residency-runtime.json`,
    `ops/outputs/governance-runtime-budget.json`,
    `ops/outputs/onboarding-kpis.json`,
    `ops/outputs/strategic-resilience-report.json`,
    `reports/doc-consistency.json`,
    `reports/doc-consistency.md`.
  - No staged files.
  - No untracked remediation files pending.
- No user work was reset or discarded.

## Wave 0 containment status

`PARTIALLY_IMPLEMENTED`. The Wave 0 commit `897d70a19` delivered:

- Five cron routes now return HTTP 501 (`ApiError.notImplemented`).
- BOC FX rate resolution returns typed `BocRateResult` with truthful `source`
  and `cacheStatus`; cached fallbacks are labelled `bank_of_canada_cached` /
  `stale-fallback`.
- `/api/admin/pilot-status` runs real DB counts for users and worksites;
  unmeasured checks return `null` and force overall `remediation_in_progress`.
- Machine-readable capability registry seeded with 8 entries
  (`apps/union-eyes/lib/reality/capability-registry.ts`).
- Programme documentation folder created (15 artefacts, most as skeletons).

## What Wave 0 did NOT yet do

- Complete repository-wide capability inventory.
- Independent verification of the 25+ adversarial findings.
- Anti-theatre CI gate implementation and wiring.
- Demo-profile deployment guard (build / deploy / runtime layers).
- Expanded pilot-status aggregator (DB connectivity, migrations, Redis,
  Django sidecar, queues, cron freshness, providers, backups, monitoring).
- Full baseline validation matrix.
- Live Azure staging attestation.
- Any pilot-critical implementation (deadline scheduling, communications,
  malware scanning, durable financial persistence, dues processing,
  tenant-isolation proof, observability, backup/restore).

## Interpretation

Wave 0 is honest containment. It is NOT a claim of pilot readiness. All
five converted cron routes now cleanly declare their unimplemented state;
that is superior to the prior deceptive HTTP 200, but it does not make the
underlying capabilities exist.

The correct current assessment: **Priority 0 containment partially
implemented; no pilot-readiness improvement proven yet.**
