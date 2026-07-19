# BR-6 Organization Context Inventory (Phase 2)

- **As of:** 2026-07-03
- **Validators:** `pnpm validate:br6-org-context` (new) · `pnpm validate:org-resolver-guardrail` (forbidden-pattern scan)
- **Closure verdict:** see [br6-org-context-closure.md](br6-org-context-closure.md)

Classification: `AUTHORITATIVE` (exactly one) · `DERIVED` · `LEGACY` · `TEST_ONLY` · `DEMO_ONLY` · `UNSAFE` · `UNKNOWN`.

## Org-context paths

| Path | Role | Class | Notes |
| --- | --- | --- | --- |
| `apps/union-eyes/lib/organization-utils.ts` → `getOrganizationIdForUser` | per-request org resolver | **AUTHORITATIVE** | 52 call sites. Verifies membership before honoring cookie-selected org; **now fails closed** (no silent default) via `isDefaultOrgFallbackAllowed()` + `OrgContextRequiredError`. |
| `packages/org/src/context/*` (`@nzila/org`) | canonical types + guards (`requireOrgScope`, `assertSameOrg`, `toDbContext`) | DERIVED (contract) | Typed contract + fail-closed guards + legacy compat. union-eyes does not yet import it. |
| `apps/union-eyes/lib/api-auth-guard.ts` | API auth guard (2151 lines) | DERIVED | Delegates org resolution (comment references the resolver). No direct default-org usage after this pass. |
| `apps/union-eyes/lib/organization-utils.ts` → `getDefaultOrganizationId()` | explicit system default | LEGACY | Explicit (not silent) default for system ops; must be replaced by allowlisted system scope. |
| `apps/union-eyes/services/twilio-sms-service.ts` (L156) | SMS notify org resolve | **CLOSED (ORG_SCOPED / fail-closed)** | `resolveOrganizationIdFromPhoneNumber` returns `null` on unmatched number; no default-org fallback. |
| `apps/union-eyes/services/financial-service/src/jobs/payment-collection-workflow.ts` (L234) | background payment job | **CLOSED (ORG_SCOPED_REQUIRED)** | Receipt requires `member.organizationId`; missing org fails closed (no receipt), no default. |
| `apps/union-eyes/services/clc/remittance-notifications.ts` (sendSMS) | remittance notify | **CLOSED (ORG_SCOPED_REQUIRED)** | `sendSMS` threads the real `data.organizationId`; no default-org fallback. |
| `apps/union-eyes/app/[locale]/dashboard/**` pages | SSR page org init | DERIVED | Initialize `let organizationId = DEFAULT_ORGANIZATION_ID` then overwrite with resolver; the initializer is a demo default, not a silent authority fallback. Review for demo-only gating. |
| `apps/union-eyes/app/api/organizations/platform-id/route.ts` | returns platform org id | DERIVED | Exposes DEFAULT_ORGANIZATION_ID as the platform org id (constant), not a per-user authority. |
| `apps/union-eyes/app/api/pilot/overview/route.ts` | pilot overview | DERIVED | Uses resolver; compares against DEFAULT for platform-admin gating. |
| `apps/union-eyes/lib/__tests__/*`, `e2e/**` | tests | TEST_ONLY | Test fixtures only. |

## Rules status

- `UNKNOWN`: none.
- `UNSAFE`: none — all 3 legacy service/job fallbacks closed in Phase 2B.
- Exactly one `AUTHORITATIVE` resolver: yes (`getOrganizationIdForUser`).
- `AUTHORITATIVE` fails closed in production: yes.
- `pnpm validate:br6-org-context`: **PASS**.
