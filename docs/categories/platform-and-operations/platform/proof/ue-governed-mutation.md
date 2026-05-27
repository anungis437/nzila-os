# Proof Scenario: UE Governed Mutation

## Scenario Summary

Proves that a state-mutating request in a governed app flows through the complete
enforcement pipeline: trace context → actor resolution → tenant resolution →
governance evaluation → rate limit check → mutation execution → audit event
recording → audit hash chain verification.

This scenario uses the UnionEyes–style enforcement surface: a financial record
mutation that must be fully governed before any state change occurs.

## Entrypoint

```bash
pnpm exec tsx scripts/proof/run-proof.ts ue-governed-mutation
```

Or via the test runner:

```bash
npx vitest run tests/e2e/platform/ue-governed-mutation.test.ts
```

## Request Sample

```json
{
  "action": "update",
  "resourceType": "financial-record",
  "route": "/api/financial-records/fr-001",
  "headers": {
    "authorization": "Bearer tok_admin_001",
    "x-tenant-id": "tenant_ue_main"
  },
  "body": "{\"status\":\"approved\",\"amount\":15000}"
}
```

## Expected Control Path

1. **Trace layer** — `traceId` generated, `traceStart` recorded
2. **Auth layer** — actor resolved to `{ actorId: "user_admin_001", tenantId: "tenant_ue_main", roles: ["admin"] }`
3. **Rate limit layer** — checked and allowed (`remaining > 0`)
4. **Governance layer** — policy evaluated, outcome `allow` (admin role matches `allow-admin-all` rule)
5. **Handler** — mutation executed, returns `{ success: true, status: 200 }`
6. **Audit layer** — audit entry recorded with all correlation IDs
7. **Audit chain** — hash continuity verified from genesis

## Expected Artifact Files

```
proof-artifacts/ue-governed-mutation/
  summary.json          — normalized proof metadata
  trace.json            — trace context with timing
  request.json          — original request envelope
  response.json         — pipeline result
  governance.json       — policy evaluation decision
  audit.json            — recorded audit entries
  audit-chain.json      — chain verification result
```

## How to Run Locally

```bash
pnpm exec tsx scripts/proof/run-proof.ts ue-governed-mutation
```

Artifacts are written to `proof-artifacts/ue-governed-mutation/`.

## How to Validate in CI

The `proof-publish` CI job runs `pnpm exec tsx scripts/proof/run-proof.ts` and uploads `proof-artifacts/**`
as a build artifact. Verification is performed automatically by `pnpm exec tsx scripts/proof/verify-artifacts.ts`.

## What "Pass" Means

- Pipeline returns `{ success: true, status: 200 }`
- `trace_id` is present and non-empty
- `actor_id` and `tenant_id` are resolved correctly
- Governance decision is `allow` with matched rule ID
- Audit entry is recorded with correct payload
- Audit chain verifies as valid (no broken links)
- All artifact files are written and parseable as JSON

## What Regression Would Look Like

- Pipeline returns non-200 status → layer misconfiguration
- Missing `trace_id` → trace layer not running
- Null `actor_id` → auth layer extractActor failing
- Governance outcome `deny` → policy rules changed
- Audit chain `valid: false` → hash computation or ordering bug
- Missing artifact files → proof runner serialization failure
