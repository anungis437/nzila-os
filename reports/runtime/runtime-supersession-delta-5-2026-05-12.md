# Delta-5 — Post-Redeploy Evidence Supersedes Stale Failure Matrix (orchestrator-api)

- **As-of date:** 2026-05-12
- **Branch:** `chore/runtime-health-delta-2-3`
- **PR:** [#509](https://github.com/anungis437/nzila-os/pull/509)
- **Authority level:** current-runtime-remediation
- **Predecessors:**
  - Delta-3: [reports/runtime/runtime-health-proof-delta-3-2026-05-11.md](runtime-health-proof-delta-3-2026-05-11.md)
  - Delta-4 redeploy proof: [reports/runtime/post-redeploy-runtime-attestation-2026-05-12.md](post-redeploy-runtime-attestation-2026-05-12.md)
- **Source-of-truth artifact (regenerated):** [reports/runtime/runtime-health-status-latest.json](runtime-health-status-latest.json)
- **Companion JSON:** [reports/runtime/runtime-supersession-delta-5-2026-05-12.json](runtime-supersession-delta-5-2026-05-12.json)

## 1. Mandate

Make the runtime-health generator/validator pipeline consume the post-redeploy evidence captured in Delta-4, supersede the stale `live_failure_matrix` row that still classified `orchestrator-api` as `failing`, and either close or explicitly justify the remaining `/ready=503` and `/=404` behaviour — without faking probe results.

This delta does NOT touch application source. It only re-wires evidence ingestion + adds a symmetric (inverse) validator invariant so that supersession cannot drift in either direction.

## 2. Decisions matrix

| Decision | Status | Evidence |
| --- | --- | --- |
| Generator consumes post-redeploy attestation + live probe artifacts as authoritative for `orchestrator-api` | GO | [tooling/scripts/generate-runtime-health-status.mjs](../../tooling/scripts/generate-runtime-health-status.mjs) (`SOURCE_FILES`, `VALID_EVIDENCE`, orchestrator-api branch in `classifyApp`) |
| Validator enforces the inverse invariant — when a `post-redeploy-runtime-attestation/v1` artifact exists, the latest JSON MUST NOT classify the app as `failing` and MUST NOT advertise `clearsAfterRedeploy=true` | GO | [tooling/scripts/validate-runtime-health-status.mjs](../../tooling/scripts/validate-runtime-health-status.mjs) — Invariant 5b |
| `orchestrator-api` reclassified to `degraded` (HTTP 200 with runtime status `degraded`) | GO | `runtime-health-status-latest.json` `apps[].app="orchestrator-api"` |
| `requiresRedeploy=false` for `orchestrator-api`; portfolio `summary.requiresRedeploy=0` | GO | `runtime-health-status-latest.json` `summary` |
| `/ready=503` accepted as readiness follow-up (queue/storage unknown, thirdParty degraded) — NOT faked to 200 | GO | [reports/runtime/post-redeploy-runtime-attestation-2026-05-12.json](post-redeploy-runtime-attestation-2026-05-12.json) `probes.ready` + JSON notes |
| `/=404` accepted as by-design (orchestrator-api is API-only) — open product decision tracked, no code change | GO | Same attestation `probes.root` + JSON notes |
| `evidence-authority.json` registers post-redeploy artifacts and supersedes the failure matrix rows for orchestrator-api | GO | [reports/runtime/evidence-authority.json](evidence-authority.json) |
| Validator + generator are symmetric (both honour supersession) | GO | Invariant 5b is the inverse of generator's `live_post_redeploy` classification path |
| Other failing apps reclassified | NO-GO | `agrimo`, `cora` are incubating and not Union Eyes pilot dependencies; veridian-{admin,care,site} remain `requiresDnsOrInfra=true` (out of scope for this delta) |
| Union Eyes pilot blocked by any remaining non-healthy entry | NO-GO | All non-healthy entries have `blocksUnionEyesPilot=false`; UE remains unblocked |

## 3. Portfolio summary delta

| Field | Pre-Delta-5 (2026-05-11) | Post-Delta-5 (2026-05-12) | Delta |
| --- | --- | --- | --- |
| `totalAppsReviewed` | 20 | 20 | 0 |
| `healthy` | 6 | 6 | 0 |
| `degraded` | 3 | 4 | +1 (orchestrator-api) |
| `failing` | 5 | 4 | −1 (orchestrator-api) |
| `notInstrumented` | 6 | 6 | 0 |
| `requiresRedeploy` | 1 | 0 | −1 (orchestrator-api cleared) |
| `requiresDnsOrInfra` | 3 | 3 | 0 |
| `stagedOrIncubating` | 4 | 4 | 0 |

## 4. Evidence chain (chronological)

1. **Pre-Delta-2 baseline (2026-05-11):** [reports/runtime/live-health-failure-matrix.json](live-health-failure-matrix.json) — `orchestrator-api` rows: `/=404`, `/health=404`, `/ready=404` against revision `--0000021` (pre-fix image).
2. **Delta-2 (commit `4ad83815f`):** os-core `health` helper landed; orchestrator-api source rewired to `@nzila/os-core/health`.
3. **Delta-3 (2026-05-11):** generator + validator + CI wiring + post-redeploy proof plan ([post-delta-2-redeploy-proof-plan-2026-05-11.md](post-delta-2-redeploy-proof-plan-2026-05-11.md)). `orchestrator-api` remained `failing` with `clearsAfterRedeploy=true`, `requiresRedeploy=1`.
4. **Delta-4 (2026-05-12):** ACA redeploy executed. Revision `nzila-os-orchestrator-api--0000022` reached `Running`/`Healthy`. Image digest `sha256:a21ff762162c877ba1ff85d2e9a96291910c8bd1d95ab3169535f95ac2ff6856` (commit `ceedbcb46`). Live probes captured in [live-health-post-redeploy-2026-05-12.json](live-health-post-redeploy-2026-05-12.json); attestation written at [post-redeploy-runtime-attestation-2026-05-12.json](post-redeploy-runtime-attestation-2026-05-12.json) (`schema=post-redeploy-runtime-attestation/v1`, `outcome.newClassification=degraded`).
5. **Delta-5 (this report):**
   - Generator's `SOURCE_FILES` extended to include both Delta-4 artifacts; `VALID_EVIDENCE` accepts `live_post_redeploy`; `classifyApp` orchestrator-api branch reads `attestation.outcome.newClassification` and emits `clearsAfterRedeploy=false`, `requiresRedeploy=false`.
   - Validator gained Invariant 5b (inverse): when an attestation artifact exists for an app, the generated JSON MUST NOT classify it `failing`, MUST NOT advertise `clearsAfterRedeploy=true`, and (when classification is `degraded` with `evidenceBasis=live_post_redeploy`) MUST mention `/ready`+`503`/readiness AND root+`404`/by-design in `notes` so the open follow-ups are not silently dropped.
   - `evidence-authority.json` updated: `asOfDate=2026-05-12`; both Delta-4 artifacts registered with `consumedBy=["generator","validator"]`, `authorityLevel=current-runtime-remediation`, and the attestation entry declares `supersedes=["live-health-failure-matrix.json (orchestrator-api rows)"]`.
   - `runtime-health-status-latest.json` regenerated deterministically — counts match this report's table in §3.

## 5. /ready=503 — explicit justification (not faked)

`/ready` returned HTTP 503 against revision `--0000022`. The dependency mix that produced this:

| Dependency | Status | Reason |
| --- | --- | --- |
| `db` | ok (ms=2) | Postgres reachable |
| `queue` | unknown | No queue probe wired in this revision |
| `storage` | unknown | No storage probe wired in this revision |
| `thirdParty.github` | degraded | `GITHUB_TOKEN` not configured in this ACA env |

Per `@nzila/os-core/health` semantics, `unknown` + `degraded` collapse to `not-ready` and `/ready` returns 503. The probe is **truthful**. We are explicitly choosing NOT to:

- inject a fake `GITHUB_TOKEN` to mask the third-party degradation, or
- short-circuit `queue`/`storage` to `ok` without real probes, or
- weaken the contract so that `unknown` reads as `ready`.

Follow-up tracked for the next delta: wire real `queue` / `storage` probes (or mark them `not-applicable` in `RuntimeHealthResponse`) and provision a non-secret `GITHUB_TOKEN` in the staging ACA environment. None of these block Union Eyes pilot — orchestrator-api is `infrastructure` layer with `blocksUnionEyesPilot=false`.

## 6. `/`=404 — explicit justification (by design)

`orchestrator-api` is an API-only Fastify service. There is no root route registered; the runtime emits the framework default 404. This is consistent with every other API-layer container in the portfolio and does not represent a regression. A product decision on whether to register a root JSON banner is captured in §7 follow-ups; this delta intentionally does not add one (no scope creep, no source change in Delta-5).

## 7. Files changed in this delta

- Modified: [tooling/scripts/generate-runtime-health-status.mjs](../../tooling/scripts/generate-runtime-health-status.mjs)
- Modified: [tooling/scripts/validate-runtime-health-status.mjs](../../tooling/scripts/validate-runtime-health-status.mjs) (Invariant 5b + post-redeploy artifact discovery + path constants)
- Modified: [reports/runtime/evidence-authority.json](evidence-authority.json) (asOfDate bump + post-redeploy artifact entries with supersedes)
- Regenerated: [reports/runtime/runtime-health-status-latest.json](runtime-health-status-latest.json) (deterministic generator output)
- Added: [reports/runtime/runtime-supersession-delta-5-2026-05-12.md](runtime-supersession-delta-5-2026-05-12.md) (this report)
- Added: [reports/runtime/runtime-supersession-delta-5-2026-05-12.json](runtime-supersession-delta-5-2026-05-12.json) (machine-readable companion)

No runtime application code changed. No package contract changed. No `tenant` language introduced. No `|| true`. No live network in CI. No secrets logged.

## 8. Open follow-ups (bounded)

| Item | Owner | Blocks UE pilot | Tracked in |
| --- | --- | --- | --- |
| Wire real `queue` + `storage` probes in orchestrator-api `/ready` | orchestrator-api owner | No | Delta-6 candidate |
| Provision non-secret `GITHUB_TOKEN` in staging ACA env (or mark third-party `not-applicable`) | platform | No | Delta-6 candidate |
| Product decision on root `/` JSON banner for API-only services | product | No | Delta-6 candidate |
| Reclassify `agrimo` / `cora` from `failing` → `degraded`/`healthy` by adopting `@nzila/os-core/health` | each app owner | No | separate incubation track |
| veridian-{admin,care,site} DNS/infra remediation | platform | No | separate infra track |

## 9. Verification (what was run for this delta)

- `pnpm runtime:health:generate` — wrote `reports/runtime/runtime-health-status-latest.json`; counts: `healthy=6 degraded=4 failing=4 not_instrumented=6`.
- `pnpm runtime:health:validate` — `OK` (all invariants 1–5b satisfied).
- Lint / typecheck / test results recorded in the PR commit body.
