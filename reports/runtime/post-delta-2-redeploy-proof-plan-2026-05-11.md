# Post-Delta-2 Redeploy Proof Plan — orchestrator-api

- **As-of date:** 2026-05-11
- **Scope:** Single ACA workload — `orchestrator-api` (Canada Central, env `jollydune-88c1e97f`)
- **Authority level:** current-runtime-remediation
- **Status:** `failing` (per [reports/runtime/runtime-health-status-latest.json](runtime-health-status-latest.json)) until evidence below is captured.

This plan is the only path by which `orchestrator-api` may be reclassified from `failing` to `healthy`. It is referenced by the Delta-3 generator (`tooling/scripts/generate-runtime-health-status.mjs`) and enforced by the Delta-3 validator (`tooling/scripts/validate-runtime-health-status.mjs`), which both forbid a `healthy` classification for `orchestrator-api` while live failure-matrix evidence remains the most recent observation.

---

## 1. Context and source of truth

- Live failure: three ACA fallback observations — `/`, `/health`, `/ready` — recorded in [reports/runtime/live-health-failure-matrix.json](live-health-failure-matrix.json).
- Source fix: commit `4ad83815f` — [apps/orchestrator-api/src/routes/health.ts](../../apps/orchestrator-api/src/routes/health.ts) — adopts `@nzila/os-core/health` with critical / non-critical split (only `failing` returns 503; `degraded` keeps 200).
- Shared contract: [packages/os-core/src/health.ts](../../packages/os-core/src/health.ts) — `RuntimeHealthCheck`, `HealthCheckState`, `RuntimeHealthStatus` ('healthy'|'degraded'|'failing'|'not_instrumented'); `ok = status !== 'failing'`.
- Contract test suite: [packages/os-core/src/**tests**/runtime-health.test.ts](../../packages/os-core/src/__tests__/runtime-health.test.ts) — 12/12 passing on commit `4ad83815f`.

Until the redeploy evidence in §4 is captured, the latest legitimate observation remains the live failure matrix, and the classification stays `failing`.

## 2. Pre-redeploy checklist

1. Confirm `main` includes commits `4ad83815f` (source fix) and `295b41c13` (Delta-2 report + sidecar JSON).
2. Confirm CI on `main` is green for the `orchestrator-api` filter (typecheck, vitest).
3. Confirm `runtime-governance-attestation` workflow is green on the post-merge commit (this includes `pnpm runtime:health:generate` and `pnpm runtime:health:validate`).
4. Confirm no in-flight migrations or KeyVault rotations are scheduled on the `nzila-canada-staging-rg` resource group during the redeploy window.
5. Confirm shared dependency reachability remains the same as Delta-2 (Postgres `nzila-staging-db`, KeyVault `nzila-staging-kv`, no Redis dependency).

## 3. Redeploy procedure (operational, not automated by this plan)

1. Build and push image from the `main` commit that contains `4ad83815f` to `nzilacanadaacr.azurecr.io/orchestrator-api:<commit-sha>`.
2. `az containerapp update --name nzila-os-orchestrator-api --resource-group nzila-canada-staging-rg --image nzilacanadaacr.azurecr.io/orchestrator-api:<commit-sha>` (or via `gitops-deploy.yml`).
3. Wait for ACA to report a new active revision and the prior revision to be drained.
4. Record the new revision name and image digest.

## 4. Evidence to capture (mandatory for reclassification)

For `orchestrator-api` to be reclassified from `failing` to `healthy`, all of the following must be captured under `reports/runtime/post-delta-2/<YYYY-MM-DD>/orchestrator-api/`:

1. `revision.json` — output of `az containerapp revision show ...` showing the new active revision and the image digest matching the build from §3.
2. `probe-root.txt` — `curl -sS -o /dev/null -w "%{http_code} %{time_total}\n" https://<orchestrator-api-fqdn>/` (expected: `200`).
3. `probe-health.json` — `curl -sS https://<orchestrator-api-fqdn>/health` (expected: HTTP 200 with `RuntimeHealthResponse` shape; `ok=true`; `status` is `healthy` or `degraded`; non-critical degradation is permitted).
4. `probe-ready.json` — `curl -sS https://<orchestrator-api-fqdn>/ready` (expected: HTTP 200; readiness contract per source fix).
5. `headers.txt` — full response headers for `/health` (must show no upstream 503/Gateway markers).
6. `signed-by.txt` — operator name + UTC timestamp + commit SHA used in §3.

All evidence must come from the live ACA FQDN, not from a portforward, sidecar, or local run.

## 5. Acceptance criteria (gating reclassification)

`orchestrator-api` is reclassified to `healthy` only when ALL are true:

- §4 evidence present and consistent (same revision across all artifacts).
- `/health` returns HTTP 200 with `ok: true` and `status` ∈ {`healthy`, `degraded`}.
- `/ready` returns HTTP 200.
- `/` returns HTTP 200.
- No new entries for `orchestrator-api` are added to `reports/runtime/live-health-failure-matrix.json` after the revision in §3 went active.
- The operator capturing evidence is not the same identity that approved the redeploy (two-person rule for the reclassification step).

If `/health` returns HTTP 200 but `status` is `degraded`, classification becomes `degraded`, NOT `healthy`. Only HTTP 503 from `/health` keeps the classification at `failing`.

## 6. Update procedure for the runtime-health JSON

After §4 and §5 are satisfied:

1. Append the new observation to `reports/runtime/live-health-failure-matrix.json` only if a failure was observed; success observations are recorded by §4 evidence files.
2. Re-run `pnpm runtime:health:generate`.
3. Re-run `pnpm runtime:health:validate` and confirm exit code `0`.
4. Open a PR titled `chore(runtime-health): clear orchestrator-api after post-delta-2 redeploy proof` referencing this plan and §4 evidence directory.
5. The generator's `clearsAfterRedeploy` flag for `orchestrator-api` continues to apply; the validator's "orchestrator-api must NOT be healthy without post-redeploy proof" rule is satisfied because the source-of-truth observation has shifted from the failure matrix to the new evidence directory.

## 7. Rollback

If any §4 probe fails or any §5 criterion is not met:

- Do NOT modify the classification.
- File an incident note under `reports/runtime/post-delta-2/<YYYY-MM-DD>/orchestrator-api/INCIDENT.md` with the failing artifact and operator initials.
- Roll back via `az containerapp revision deactivate` to the prior revision and re-activate the last known-good revision.
- The `failing` classification persists; Union Eyes is unaffected (orchestrator-api `blocksUnionEyesPilot=false`).

## 8. Non-goals

- This plan does NOT cover the `agrimo` failing classification (incubating, separate remediation track).
- This plan does NOT cover the `veridian-*` DNS/infra remediation (separate plan; `requiresDnsOrInfra=true`).
- This plan does NOT introduce live network probes into CI; CI only runs the deterministic offline generator and validator.

## 9. CI relationship

The `runtime-governance-attestation` workflow now runs:

1. `pnpm runtime:health:generate` — rebuilds `reports/runtime/runtime-health-status-latest.json` from inventory + failure matrix + Delta-2 sidecar.
2. `pnpm runtime:health:validate` — fails the workflow if `orchestrator-api` is ever marked `healthy` while the failure-matrix observation is still the latest source.

Both steps run without secrets, without live network access, and without `|| true` softening.

## 10. Sign-off matrix

| Role | Action | Evidence required |
| --- | --- | --- |
| Release engineer | Builds image, runs `az containerapp update` | §3 image digest, revision name |
| SRE on-call | Captures §4 probes | All six artifacts in §4 |
| Runtime governance reviewer | Re-runs generator + validator | Validator EXIT=0 + PR link |
| Second approver (≠ release engineer) | Confirms two-person rule | Signed `signed-by.txt` |

Until all four rows are signed off in the same evidence directory, `orchestrator-api` remains classified `failing` in `reports/runtime/runtime-health-status-latest.json`.
