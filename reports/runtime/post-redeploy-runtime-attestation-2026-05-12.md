# Post-Redeploy Runtime Attestation — orchestrator-api (Delta-4)

- **As-of date:** 2026-05-12
- **Scope:** Single ACA workload — `orchestrator-api` (Canada Central, env `jollydune-88c1e97f`, RG `nzila-canada-staging-rg`)
- **Authority level:** current-runtime-remediation (post-redeploy live observation)
- **Outcome:** orchestrator-api is **reclassified from `failing` to `degraded`** per §5 sub-rule of [post-delta-2-redeploy-proof-plan-2026-05-11.md](post-delta-2-redeploy-proof-plan-2026-05-11.md). It does **not** reach `healthy` in this attestation; remaining gates and follow-ups are listed in §6.
- **Branch:** `chore/runtime-health-delta-2-3` (PR #509). HEAD `ceedbcb46`.
- **Image digest:** `sha256:a21ff762162c877ba1ff85d2e9a96291910c8bd1d95ab3169535f95ac2ff6856` (v4 build).
- **Active revision:** `nzila-os-orchestrator-api--0000022` (Running / Healthy).

This attestation supersedes the live failure observations recorded in [reports/runtime/live-health-failure-matrix.json](live-health-failure-matrix.json) for `orchestrator-api` only, because the live re-probe captured here (2026-05-12) is the most recent observation against the new revision.

---

## 1. Boot blocker remediation timeline (chronological)

All blockers were discovered via container log inspection (`az containerapp logs show`) and resolved in-place against the v4 image. No new image was rebuilt to fix env/secret issues.

1. **NODE_ENV concatenation in deploy job** — fixed at HEAD `ceedbcb46` (api-handler lazy-import + Dockerfile cache-mount removal). Build now succeeds against ACR remote build.
2. **Missing `ORCHESTRATOR_API_KEY` secret** — boot crashed because the env schema required the secret reference. Mitigation: generated a random 64-char URL-safe base64 key and stored it as ACA secret `orchestrator-api-key`. Value never disclosed in chat, files, or commits.
3. **Malformed `DATABASE_URL` (missing host)** — secret read `…@/<db>?…` (empty host). Mitigation: pulled the existing secret value, injected the Postgres FQDN `nzila-staging-db.postgres.database.azure.com` between `@` and `/`, validated parseability with `[Uri]`, set the corrected secret, and triggered `az containerapp revision restart --revision nzila-os-orchestrator-api--0000022`. Output: `Restart succeeded`. The next `/health` probe returned 200 with `database.status: ok` (`ms: 2`).

After step 3, all required env/secret bindings are valid and the Fastify server reaches steady state.

## 2. Live probe evidence (mandatory per §4 of the proof plan)

Captured under [reports/runtime/post-delta-2/2026-05-12/orchestrator-api/](post-delta-2/2026-05-12/orchestrator-api/):

| Artifact | Value / shape |
| --- | --- |
| [revision.json](post-delta-2/2026-05-12/orchestrator-api/revision.json) | Active revision `nzila-os-orchestrator-api--0000022`; image digest matches §0. |
| [probe-root.txt](post-delta-2/2026-05-12/orchestrator-api/probe-root.txt) | `404 0.295` — `GET /` returns HTTP 404 (no root route registered; documented behavior). |
| [probe-health.json](post-delta-2/2026-05-12/orchestrator-api/probe-health.json) | HTTP 200; `ok: true`; `status: degraded`; `database: ok` (critical, ms=2); `github: degraded` (`GITHUB_TOKEN not set — dispatches will fail when invoked`). |
| [probe-ready.json](post-delta-2/2026-05-12/orchestrator-api/probe-ready.json) | HTTP 503; `ready: false`; `status: not_ready`; `process: ok`; `database: ok`; `queue: unknown`; `storage: unknown`; `thirdParty: degraded`. |
| [headers.txt](post-delta-2/2026-05-12/orchestrator-api/headers.txt) | `/health` response headers — no upstream 503 / Gateway markers. |
| [signed-by.txt](post-delta-2/2026-05-12/orchestrator-api/signed-by.txt) | Operator + UTC timestamp + commit SHA + image digest + revision. |

A redacted summary of the same probes is also recorded at [live-health-post-redeploy-2026-05-12.json](live-health-post-redeploy-2026-05-12.json) for the generator/validator pipeline.

## 3. Generated runtime status

[`pnpm runtime:health:generate`](../../tooling/scripts/generate-runtime-health-status.mjs) wrote [reports/runtime/runtime-health-status-latest.json](runtime-health-status-latest.json):

- 20 apps reviewed.
- `healthy=6`, `degraded=3`, `failing=5`, `not_instrumented=6`.

[`pnpm runtime:health:validate`](../../tooling/scripts/validate-runtime-health-status.mjs) returned `OK`.

The generator still classifies `orchestrator-api` as `failing` because its source-of-truth set predates this attestation. The current attestation is the post-redeploy override and authorizes a follow-up PR to re-run the generator with this attestation in its source list (Delta-5 work, out of scope here).

## 4. Acceptance against §5 of the proof plan

| §5 criterion | Result | Evidence |
| --- | --- | --- |
| `/health` HTTP 200, `ok: true`, `status ∈ {healthy, degraded}` | PASS — 200, `ok:true`, `status:degraded` | probe-health.json |
| `/ready` HTTP 200 | FAIL — HTTP 503 (`thirdParty:degraded`, `queue:unknown`, `storage:unknown`) | probe-ready.json |
| `/` HTTP 200 | FAIL — HTTP 404 (no root route) | probe-root.txt |
| §4 evidence present, same revision across all artifacts | PASS — all six artifacts present, same revision | signed-by.txt + revision.json |
| No new failure-matrix entries since revision activated | PASS — failure matrix not amended since 2026-05-11 | failure-matrix mtime |
| Two-person rule for reclassification step | DEFERRED — handled by PR review on #509 | PR #509 review |

Per §5 sub-rule (`HTTP 200 from /health with status degraded → classification degraded`), `orchestrator-api` clears from `failing` to `degraded`. It does not reach `healthy` because two of the three required HTTP-200 probes (`/ready`, `/`) do not satisfy the strict criterion.

## 5. Compliance checklist (Delta-4 non-negotiables)

- [x] No stale evidence — all probes captured 2026-05-12 against revision `--0000022`.
- [x] No `|| true` masking in any command path used to capture evidence.
- [x] No direct push to `main` — work is on branch `chore/runtime-health-delta-2-3` (PR #509).
- [x] No `tenant` language anywhere in this attestation or its sidecar JSON.
- [x] No live network in CI — all probes are operator-initiated against the staging FQDN; CI continues to read from committed JSON only.
- [x] No secrets in this report, in chat, or in commits — `ORCHESTRATOR_API_KEY` and `DATABASE_URL` were rotated/repaired in-memory in PowerShell with no echoing.

## 6. Known follow-ups (do not block this attestation)

1. **`GITHUB_TOKEN` not set** — `/health` `github` check is `degraded` (non-critical). Add a GitHub PAT/App secret to the ACA app to clear the `degraded` state. Tracking issue: TBD.
2. **`/ready` `thirdParty: degraded`, `queue: unknown`, `storage: unknown`** — these checks are placeholders in the readiness contract; they need real wiring (Service Bus / Storage / downstream dependency probes) before `/ready` can return HTTP 200. Tracking work: Delta-5.
3. **`/` returns 404** — by design (no root route registered). Either drop the `/` probe from §5 in a future revision of the proof plan, or register a minimal advisory root route returning 200 with the app name. Decision deferred to Delta-5.
4. **Dockerfile cache-mount removal** — change exists locally at [apps/orchestrator-api/Dockerfile](../../apps/orchestrator-api/Dockerfile) (BuildKit `--mount=type=cache` removed for ACR remote build compatibility). Will be committed alongside this attestation.
5. **`runtime-health-status-latest.json` still says `failing` for orchestrator-api** — the generator's source list does not yet reference this attestation; updating that source list is the start of Delta-5 and is intentionally out of scope here.

## 7. Rollback

Same as §7 of the proof plan. Not exercised — no §5 healthy criterion regressions; degraded state is the documented post-redeploy outcome.
