# Proof Scenario: Compliance-Sensitive Action

## Scenario Summary

Proves that a regulated action — such as a financial claim approval in a
compliance-sensitive domain — is subject to a stricter governance branch.
The scenario demonstrates: explicit deny path → allow path with elevated
privileges → governance decision logging → audit evidence export with full
hash chain integrity.

This maps to the ABR (Advisory/Insights) policy profile where financial
operations require explicit admin authorization.

## Entrypoint

```bash
pnpm proof:run compliance-sensitive-action
```

Or via the test runner:

```bash
npx vitest run tests/e2e/platform/compliance-sensitive-action.test.ts
```

## Request Sample

### Attempt 1 — Denied (insufficient role)

```json
{
  "action": "approve",
  "resourceType": "financial-claim",
  "route": "/api/claims/claim-001/approve",
  "actor": {
    "id": "user_junior_001",
    "tenantId": "tenant_abr",
    "roles": ["viewer"]
  }
}
```

### Attempt 2 — Allowed (compliance officer)

```json
{
  "action": "approve",
  "resourceType": "financial-claim",
  "route": "/api/claims/claim-001/approve",
  "actor": {
    "id": "user_compliance_001",
    "tenantId": "tenant_abr",
    "roles": ["compliance-officer"]
  }
}
```

## Expected Control Path

### Denied path

1. **Auth** — actor resolved with `viewer` role
2. **Governance** — policy evaluated, outcome `deny` (no matching allow rule for viewer on approve)
3. **Pipeline** — short-circuits at 403, handler never executes
4. **Audit** — denial recorded in decision store
5. **Evidence** — denial event is inspectable

### Allowed path

1. **Auth** — actor resolved with `compliance-officer` role
2. **Governance** — policy evaluated, outcome `allow` (compliance-officer matches `allow-compliance-approve` rule)
3. **Rate limit** — checked
4. **Handler** — claim approval executed
5. **Audit** — approval event recorded with full payload
6. **Chain** — hash continuity maintained across deny + allow entries
7. **Export** — audit log exportable as JSON

## Expected Artifact Files

```
proof-artifacts/compliance-sensitive-action/
  summary.json          — normalized proof metadata
  trace.json            — trace context
  request.json          — both request attempts
  response.json         — both pipeline results
  governance.json       — both governance decisions (deny + allow)
  audit.json            — recorded audit entries
  audit-chain.json      — chain verification across entries
```

## How to Run Locally

```bash
pnpm proof:run compliance-sensitive-action
```

## How to Validate in CI

Verified automatically by `pnpm proof:verify`.

## What "Pass" Means

- First attempt returns `{ success: false, status: 403 }`
- Governance decision explicitly says `deny` with reason
- Second attempt returns `{ success: true, status: 200 }`
- Both decisions are logged in the decision store
- Audit chain validates across all entries
- Audit export contains both events with correct metadata
- All artifact files are written

## What Regression Would Look Like

- First attempt succeeds → governance bypass, security regression
- Second attempt denied → role mapping or policy rule broken
- Audit chain invalid → hash computation changed
- Missing denial record → audit layer not recording denials
- Export missing entries → export filter bug
