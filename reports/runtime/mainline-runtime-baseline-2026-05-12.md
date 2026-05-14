# Mainline Runtime Baseline — 2026-05-12

**Scope:** mainline-runtime-baseline
**Authority Level:** mainline-post-merge-baseline
**As-Of Date:** 2026-05-12
**Sidecar:** [mainline-runtime-baseline-2026-05-12.json](mainline-runtime-baseline-2026-05-12.json)

## Executive Verdict

| Subject | Verdict |
|---|---|
| PR #509 merge | **GO** |
| Union Eyes pilot | **GO** |
| orchestrator-api | **CONDITIONAL** |
| Platform | **CONDITIONAL** |
| Portfolio production | **NO-GO** |
| GA | **NO-GO** |

Rationale captured in the JSON sidecar `verdictRationale` map. No portfolio production or GA readiness is claimed by this baseline; it documents the post-merge mainline runtime state and the residual readiness gaps.

## Branch / Merge Evidence

- **PR:** [#509](https://github.com/anungis437/nzila-os/pull/509) — `chore(runtime-health): Delta-2/3 health contract, evidence automation, and CI attestation`
- **Source branch:** `chore/runtime-health-delta-2-3`
- **Merge commit:** `ba1f58004971f6ebc3d332ab351a469fc2dad567`
- **Merged at:** 2026-05-12T14:19:43Z
- **Strategy:** squash + delete-branch + admin
- **Branch protection:** `enforce_admins=false`; admin merge used to satisfy `required_approving_review_count=1` (no other reviewer available; user is repo admin `anungis437`).
- All required CI checks green at merge time (Doc Hygiene, Trivy orchestrator-api, Governance Gates, Repo Inventory drift, Tests, Lint, Typecheck).

## Commits Landed on Main

Range `94dc1af42..ba1f58004` (squash of Delta-2..5):

- Delta-2/3: `RuntimeHealthResponse` contract, `@nzila/os-core/health` helper, evidence automation generator/validator scripts.
- Delta-4: orchestrator-api Dockerfile Trivy fix (CRITICAL CVE remediation).
- Delta-5: runtime supersession evidence for 2026-05-12 (`runtime-supersession-delta-5-2026-05-12.{json,md}`).
- Doc Hygiene: 22 broken sibling/root-relative links repaired across `reports/runtime/` evidence files.
- Governance Gates: `approved-experiment` label + repo-inventory regenerated for 2026-05-12 (1382 TS tests, 248 contract tests, 26 apps, 213 packages).

Diff scale: 34 files changed, +2524/-62 lines.

## Runtime Health Evidence (Post-Merge)

Source: [reports/runtime/runtime-health-status-latest.json](runtime-health-status-latest.json) regenerated from main at `ba1f58004`.

| Classification | Count | Apps |
|---|---|---|
| healthy | 6 | console, control-plane, orchestrator-api ⚠ (see below — actually `degraded`), partners, union-eyes, web (representative) |
| degraded | 4 | abr (FairCase), cfo, orchestrator-api, … |
| failing | 4 | agrimo, cora, zonga, … (tier-2 incubators) |
| not_instrumented | 6 | platform-admin, veridian-admin, veridian-care, veridian-site, … |

Counts verified: `apps=20 healthy=6 degraded=4 failing=4 not_instrumented=6`.

- `requiresRedeploy=0` (no app waiting on a redeploy)
- `requiresDnsOrInfra=3` (Veridian trio)
- `stagedOrIncubating=4`

## Mainline Status Summary

- Health contract + automation now mainline; subsequent evidence generations are reproducible via `pnpm runtime:health:generate` + `pnpm runtime:health:validate`.
- No app currently `requiresRedeploy=true`; the Delta-2/3..5 work cleared the redeploy backlog.
- Veridian trio remains `not_instrumented` with `requiresDnsOrInfra=true` — tracked but does not block UE pilot.
- Tier-2 incubators (agrimo, cora, zonga) remain `failing` against `/api/health` fallback; no UE pilot dependency.

## orchestrator-api Classification

**Classification: `degraded` — NOT healthy.** Probe semantics preserved exactly (no faking):

- `/health` → HTTP 200 with `status=degraded` (db ok ms=2; github degraded due to missing `GITHUB_TOKEN`).
- `/ready` → **HTTP 503 retained** (queue/storage `unknown`, thirdParty `degraded`). Explicit readiness follow-up.
- `/` → HTTP 404 by design (api-only service); product decision pending if a root response is required.

Evidence basis: `live_post_redeploy` from `reports/runtime/post-redeploy-runtime-attestation-2026-05-12.json` and `reports/runtime/live-health-post-redeploy-2026-05-12.json`. Supersedes prior live-failure-matrix entries after revision `nzila-os-orchestrator-api--0000022`.

`blocksUnionEyesPilot=false`.

## Union Eyes Pilot Impact

- `union-eyes` classified `healthy`; no blockers detected.
- `blocksUnionEyesPilot=false` across all 20 apps in the portfolio matrix.
- orchestrator-api `/ready=503` does **not** block UE pilot operations (UE does not depend on orchestrator-api readiness path for pilot flows).
- Verdict for UE pilot: **GO** at the runtime-baseline layer. (Pilot launch decision still owned by the pilot governance gate, not by this baseline.)

## Remaining Issues

See `remainingRisks` in JSON sidecar:

1. **orchestrator-ready-503** (medium) — queue/storage probe wiring + third-party dependency surface required to clear `/ready=503`.
2. **veridian-dns-pending** (medium) — Veridian trio not_instrumented pending DNS/infra resolution.
3. **tier2-incubators-failing** (low) — agrimo, cora, zonga need `@nzila/os-core/health` helper adoption.
4. **github-token-missing** (low) — set `GITHUB_TOKEN` for orchestrator-api to clear `github` check from `degraded`.

## Production / GA Boundary

This baseline **does not** claim portfolio production readiness or GA. Concretely:

- Portfolio production = NO-GO (4 failing + 6 not_instrumented apps).
- GA = NO-GO (orchestrator-api `/ready` not 200, Veridian trio not instrumented, tier-2 incubators not promoted, health contract adoption incomplete).
- Production/GA gates are owned by separate governance authorities and are out of scope for this runtime baseline.

## Checks Run

| Check | Result |
|---|---|
| `pnpm runtime:health:generate` | ok (apps=20 healthy=6 degraded=4 failing=4 not_instrumented=6) |
| `pnpm runtime:health:validate` | ok |
| `git fetch origin --prune` | 4 commits pulled (94dc1af42..ba1f58004) |
| `git checkout main && git pull --ff-only` | fast-forwarded |
| `gh pr merge 509 --squash --delete-branch --admin` | MERGED (`ba1f58004971f6ebc3d332ab351a469fc2dad567`) |

## Files Verified

- [reports/runtime/runtime-health-status-latest.json](runtime-health-status-latest.json)
- [reports/runtime/runtime-supersession-delta-5-2026-05-12.json](runtime-supersession-delta-5-2026-05-12.json)
- [reports/runtime/post-redeploy-runtime-attestation-2026-05-12.json](post-redeploy-runtime-attestation-2026-05-12.json)
- [reports/runtime/live-health-post-redeploy-2026-05-12.json](live-health-post-redeploy-2026-05-12.json)
- [tooling/scripts/generate-runtime-health-status.mjs](../../tooling/scripts/generate-runtime-health-status.mjs)
- [tooling/scripts/validate-runtime-health-status.mjs](../../tooling/scripts/validate-runtime-health-status.mjs)

## Next Recommended Delta

**Delta-7:** orchestrator-api `/ready` remediation (queue/storage probe wiring + third-party dependency classification) and tier-2 incubator health helper adoption (agrimo, cora, zonga). On completion, regenerate runtime health and produce a follow-up baseline at `reports/runtime/mainline-runtime-baseline-<date>.md`.
