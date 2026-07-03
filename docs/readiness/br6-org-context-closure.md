# BR-6 Organization Context Substrate Drift — Closure Certification

- **As of:** 2026-07-03 · Commit base `0e95c11`
- **Validators:** `pnpm validate:br6-org-context` · `pnpm validate:org-resolver-guardrail`
- **Inventory:** [br6-org-context-inventory.md](br6-org-context-inventory.md)

## Verdict

```
BR-6 CLOSED
```

The single authoritative org resolver **fails closed** in production (silent
Default Organization fallback removed), and all legacy service/job default-org
fallbacks have been closed. `pnpm validate:br6-org-context` passes (exit 0) and
fails on any reintroduced fallback (negative test proven). Broader production
readiness is unchanged (`final:go` still red) — this cert only covers BR-6.

## Old risk

`getOrganizationIdForUser` (52 call sites) ended in a **silent fallback to
`DEFAULT_ORGANIZATION_ID`**: an authenticated user with no verified membership
was silently given the Default Organization, validating only that the org row
*exists* — a cross-tenant substrate drift. Separately, `validate:org-resolver-guardrail`
passed but only scans two forbidden patterns; it did not prove fail-closed behavior.

## Final architecture (this pass)

- **Canonical resolver:** `apps/union-eyes/lib/organization-utils.ts` →
  `getOrganizationIdForUser`. Cookie/slug selectors are honored **only after
  membership verification**; with no verified membership it now throws
  `OrgContextRequiredError` unless `isDefaultOrgFallbackAllowed()` is true.
- **Fail-closed gate:** `isDefaultOrgFallbackAllowed()` returns true **only** when
  `NODE_ENV !== 'production'` **and** `UE_ALLOW_DEFAULT_ORG === 'true'`. Default-org
  fallback is therefore **impossible in production**.
- **Error taxonomy:** `OrgContextRequiredError` (`code: ORG_CONTEXT_REQUIRED`).

## Production rules enforced

- Missing / unverified org → fail closed (production). ✅
- Client cookie/slug may *select* an org but only membership makes it authority. ✅ (pre-existing + preserved)
- Default-org fallback impossible in production. ✅
- Demo/test default only via explicit non-production `UE_ALLOW_DEFAULT_ORG`. ✅

## Remaining legacy paths (CLOSED in Phase 2B)

1. `apps/union-eyes/services/twilio-sms-service.ts` — `resolveOrganizationIdFromPhoneNumber` now returns `null` (fail closed) for an unmatched inbound number; no default-org fallback.
2. `apps/union-eyes/services/financial-service/src/jobs/payment-collection-workflow.ts` — payment receipt now **requires** `member.organizationId`; a member with no verified org fails closed (logged, no receipt) instead of using the default org.
3. `apps/union-eyes/services/clc/remittance-notifications.ts` — `sendSMS` now takes the real per-remittance `organizationId` (`data.organizationId`); no default-org fallback.

No broad "system mode" helper was introduced — none of these paths legitimately
needed system scope, and adding one would risk accidental misuse by request
handlers (mission rule 6). `getDefaultOrganizationId()` remains as an *explicit*
(non-silent) system default, unused by these paths.

## Files changed

- `apps/union-eyes/lib/organization-utils.ts` — fail-closed guard + `OrgContextRequiredError` + `isDefaultOrgFallbackAllowed`.
- `apps/union-eyes/lib/__tests__/organization-utils.test.ts` — BR-6 fail-closed + explicit-opt-in tests.
- `tooling/scripts/validate-br6-org-context.mjs` — new validator.
- `package.json`, `governance/gates/gate-authority-registry.json` — script + advisory gate registration.

## Tests added

- `BR-6: fails closed when user has no verified membership (production)` → rejects.
- `BR-6: default org fallback only when explicitly opted in (non-production)` → returns default.
- `throws when default org not found in DB (explicit dev fallback)`.
- Full `organization-utils.test.ts`: **26 passed**.

## Validators added

- `validate-br6-org-context` (advisory, target production-blocking). Negative test
  proven: injecting a `|| process.env.DEFAULT_ORGANIZATION_ID` fallback raises the
  count (6), removal restores baseline (5). B1 structural = 0 (resolver fix recognized).

## Remaining exceptions

None fabricated. `getDefaultOrganizationId()` remains as an *explicit* system
default (not silent) pending allowlisted system-scope redesign.

## Commands run

`pnpm validate:br6-org-context` (exit 0, BR-6 CLOSED; negative test: inject → exit 1,
remove → exit 0), `validate:org-resolver-guardrail` (pass), `organization-utils.test.ts`
+ `twilio-sms-service.test.ts` (50 pass), `remittance-notifications.test.ts` (14 pass),
`payment-collection-workflow.test.ts` (11 pass), union-eyes typecheck (pass),
`gate-authority:validate/selftest`, `validate:docs`.
