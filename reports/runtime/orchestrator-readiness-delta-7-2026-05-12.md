# Orchestrator Readiness — Delta-7 Closure

- Date: 2026-05-12
- Branch: `chore/orchestrator-readiness-delta-7`
- Scope: `apps/orchestrator-api`
- Hard rule (verbatim): **never weaken readiness for optics; missing `GITHUB_TOKEN` must NOT cause `not_ready`.**

## Executive Verdict

Orchestrator `/ready` was returning **HTTP 503 / `not_ready`** in staging because the
optional `GITHUB_TOKEN` dependency flipped readiness regardless of whether the
critical database connection was healthy. This conflated "I cannot dispatch a
GitHub workflow right now" with "I cannot serve traffic", which is **wrong** by
the platform health doctrine and was actively poisoning the runtime
attestation/report pipeline.

Delta-7 introduces an explicit dependency-criticality model and rewires `/ready`
to mirror `/health` semantics: **only critical-dependency failures flip
readiness**. Optional dependency degradation reports `degraded_ready` (HTTP 200,
`ready=true`). The hard rule is now codified in code, comments, and tests.

## Files Changed

- `apps/orchestrator-api/src/runtime-dependencies.ts` *(new)* — declarative
  catalog of orchestrator runtime dependencies with criticality (`critical` |
  `important` | `optional`). Header comments restate the hard rule so future
  edits cannot quietly weaken it.
- `apps/orchestrator-api/src/routes/ready.ts` *(rewrite)* — critical-aware
  readiness using `buildRuntimeHealthResponse` from `@nzila/os-core/health`,
  with explicit `criticalFailures` / `degradedDependencies` / `readiness` fields
  in the response.
- `apps/orchestrator-api/src/api-guards.ts` — `/ready` added to the public
  allowlist (mirrors `/health`, `/health/deep`, `/metrics`).
- `apps/orchestrator-api/src/routes/__tests__/ready.test.ts` *(new)* — three
  Fastify-inject tests pinning the three readiness states.

## Dependency Criticality Model

| Dependency | Criticality | Rationale                                                                 |
|------------|-------------|---------------------------------------------------------------------------|
| `database` | critical    | Without Postgres, no command persistence or run state — cannot serve.     |
| `github`   | optional    | Required only when dispatching workflows; absence is `degraded_ready`.    |

Future additions (Redis, EventBus when promoted from `/health/deep`, evidence
store) should be appended to `ORCHESTRATOR_DEPENDENCIES` with explicit
criticality. Health-deep additions are intentionally not promoted yet to keep
the surgical scope of this delta.

## `/ready` Decision Table

| DB     | GITHUB_TOKEN | HTTP | `ready` | `readiness`        | `criticalFailures` | `degradedDependencies` |
|--------|--------------|------|---------|--------------------|--------------------|------------------------|
| ok     | set          | 200  | true    | `ready`            | `[]`               | `[]`                   |
| ok     | missing      | 200  | true    | `degraded_ready`   | `[]`               | `["github"]`           |
| fail   | any          | 503  | false   | `not_ready`        | `["database"]`     | (computed)             |

This matches `/health` semantics: only critical failures cause `ok=false` /
HTTP 503.

## `/health` ↔ `/ready` Alignment

`/ready` now uses the same `buildRuntimeHealthResponse` envelope as `/health`,
so consumers see identical `app`, `environment`, `version`, `timestamp`,
`status`, `checks` fields and only the readiness-specific extras
(`ready`, `readiness`, `criticalFailures`, `degradedDependencies`,
`dependencyCatalog`) are additive. Deeper dependencies (eventBus, evidence)
remain in `/health/deep` per existing convention.

## Root Route Decision

`/` continues to return 404 — orchestrator-api is an API surface, not a portal.
Adding a banner route here would create false-positive readiness signals from
naive HTTP probes that hit `/`. Probes should target `/health` or `/ready`.

## Runtime Generator/Validator Impact

Deferred for this delta. Current attestation accurately reports the orchestrator
as `not_ready` against staging until the redeploy lands; subsequent probe runs
will refresh naturally once the new image is live. Generator/validator changes
would be premature optimisation and would expand scope beyond a fix.

## Checks Run

- `pnpm --filter orchestrator-api typecheck` — **pass**.
- `pnpm --filter orchestrator-api test` — **27/27 pass** (including 3 new
  `/ready` cases).
- `pnpm --filter orchestrator-api lint` — no `lint` script in this package
  (workspace-level lint runs in CI).

## Remaining Risks

1. Staging probe will still report `not_ready` until the new image is built and
   the container app is updated. Expected, not a regression.
2. `important`-tier handling is defined in the type but unused today; first
   `important` dependency added must verify the helper paths compute the right
   readiness state (currently treated as non-critical, same as `optional`).
3. Runtime attestation generator/validator do not yet ingest the new
   `dependencyCatalog` / `readiness` fields — informational only for now.

## Next Recommended Delta

- Promote eventBus and evidence-store from `/health/deep` into the dependency
  catalog with explicit criticality, then have `/ready` evaluate them as well.
- Teach the runtime attestation generator to surface `dependencyCatalog` and
  `degradedDependencies` so dashboards can distinguish "down" from "running
  with reduced capability".
