# UnionEyes — Ops Validation Checklist

> Run this before every demo, every staging release, every procurement call.

## Pre-demo (~10 min)

- [ ] `pnpm -C apps/union-eyes lint` exits 0
- [ ] `pnpm -C apps/union-eyes typecheck` exits 0
- [ ] `pnpm -C apps/union-eyes test` exits 0
- [ ] `pnpm -C apps/union-eyes staging:seed` exits 0 (idempotent)
- [ ] `pnpm -C apps/union-eyes narrative:check` exits 0 (no forbidden marketing terms)
- [ ] `curl -fsS http://localhost:3002/api/health` returns `status: ok`
- [ ] `curl -fsS http://localhost:3002/api/health/liveness` returns 200
- [ ] `curl -fsS http://localhost:3002/api/metrics/operational` returns non-zero `request_count`
- [ ] `curl -fsS http://localhost:3002/api/governance/telemetry` returns `service: union-eyes`
- [ ] `curl -fsS http://localhost:3002/api/evidence/export` returns the structural summary

## Pre-staging-release (~30 min)

All pre-demo items, plus:

- [ ] `pnpm -C apps/union-eyes test:qa:api` exits 0
- [ ] `pnpm -C apps/union-eyes test:e2e:ue:auth` exits 0
- [ ] `pnpm -C apps/union-eyes test:e2e:ue:stakeholders` exits 0
- [ ] `pnpm -C apps/union-eyes test:e2e:ue:pilot` exits 0
- [ ] `pnpm -C apps/union-eyes evidence:all` exits 0
- [ ] `apps/union-eyes/reports/evidence/<latest>.json` verifies
- [ ] `pnpm governance:audit` (repo root) exits 0
- [ ] `pnpm platform:contract:check` exits 0 if available
- [ ] Schema drift snapshot up to date: `pnpm tsx tooling/db/schema-snapshot.ts check` exits 0

## Pre-procurement-review (~60 min)

All pre-staging items, plus:

- [ ] `apps/union-eyes/docs/UE_STAGING_AUDIT.md` reviewed and current
- [ ] `apps/union-eyes/docs/ORG_SCOPE_AUDIT.md` reviewed and current
- [ ] `apps/union-eyes/docs/FINAL_READINESS_STATUS.md` reviewed and current
- [ ] Red-team test: `pnpm vitest run security/redteam/adversarial.test.ts` exits 0
- [ ] `platform/registry/apps.json` UE entry reflects current endpoints
- [ ] Latest sealed evidence bundle attached to procurement pack

## Post-incident

- [ ] Document failure in `apps/union-eyes/docs/UE_STAGING_AUDIT.md` § "Recovery instructions"
- [ ] Update `FINAL_READINESS_STATUS.md` if status changes
- [ ] If new governance counter helps detect this class of failure, add it per `GOVERNANCE_RUNTIME_MODEL.md` § 7

## Never skip

The marketing vocabulary check (`narrative:check`) is a hard CI gate. The boundary tests (`db-boundary`, `adversarial`) are hard CI gates. Schema drift detection is a hard CI gate. Do not push to bypass these — fix the root cause.
