# UnionEyes — Demo Runbook

> Operator-facing recipe for a believable, stable executive / buyer / procurement demo.

## 0. 60-minute pre-flight

```bash
# From repo root
pnpm install
pnpm -C apps/union-eyes lint
pnpm -C apps/union-eyes typecheck
pnpm -C apps/union-eyes test
pnpm -C apps/union-eyes staging:seed
pnpm -C apps/union-eyes evidence:all
```

Confirm:

- `pnpm -C apps/union-eyes test` is green
- `curl http://localhost:3002/api/health` returns `status: ok`
- `curl http://localhost:3002/api/metrics/operational` returns non-zero domain numbers (after seed)
- `curl http://localhost:3002/api/governance/telemetry` returns a JSON with `service: union-eyes`
- `curl http://localhost:3002/api/evidence/export` returns the structured evidence summary

## 1. Required env vars (fail-closed)

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres. Boot fails if missing. |
| `AUTH_SECRET` | Application auth/session secret (NextAuth). Boot fails if missing. |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Rate limiting. Fails-closed under production. |
| `NZILA_RELEASE_ID` | Surfaces in governance envelopes. |
| `NZILA_ENVIRONMENT_CLASS` | Surfaces in governance envelopes. |
| `STAGING_SEED_ORG_ID` (optional) | Override default seed tenant. |

## 2. Demo script

### Scene 1 — "Operational truth"

1. Open `/api/health` in a browser tab — show the JSON.
2. Open `/api/metrics/operational` — point at `active_grievance_count` and `sla_violations`. Both come from real DB.
3. Open `/api/governance/telemetry` — point at `policy_denied_count` and `audit_event_volume`. Both come from real DB.

### Scene 2 — "Org isolation is structural"

1. Sign in as Org A user; show grievance list scoped to Org A.
2. Switch to Org B; show different (smaller) grievance list.
3. Open `apps/union-eyes/docs/ORG_SCOPE_AUDIT.md` to walk procurement through the three enforcement layers.

### Scene 3 — "Workflows are hard to misuse"

1. Take a `triage` grievance.
2. Attempt to transition straight to `resolved` via the UI — show the FSM blocking it.
3. Walk it through `triage → investigation → response_pending → resolved`.

### Scene 4 — "Evidence on demand"

1. `pnpm -C apps/union-eyes evidence:all` — show collect / seal / verify in three lines.
2. Open `/api/evidence/export` — show the structural summary.
3. Show the sealed bundle under `apps/union-eyes/reports/evidence/`.

### Scene 5 — "Honest amber"

1. Open `apps/union-eyes/docs/FINAL_READINESS_STATUS.md`.
2. Read the "What remains amber" section out loud. **Do not pretend otherwise.**
3. Procurement will trust you more for this than for any green checkmark.

## 3. Recovery cheatsheet

| Symptom | Action |
|---|---|
| Demo data missing | `pnpm -C apps/union-eyes staging:seed` |
| Health 503 | `curl /api/health` to see which dep failed; restart that dep |
| 401 on every page | Re-issue auth session; check `AUTH_SECRET` matches deployment |
| Metrics endpoint slow | Likely DB cold-start; warm with one query to `/api/grievances` |
| Evidence export empty | Run `pnpm -C apps/union-eyes evidence:all` first |

## 4. Never during a demo

- Do not run `db:migrate` live
- Do not toggle `RUNTIME_FAIL_CLOSED` while serving traffic
- Do not seed with `STAGING_SEED_ALLOW_PROD=true`
- Do not show endpoints that return raw error stacks; refresh the page first
