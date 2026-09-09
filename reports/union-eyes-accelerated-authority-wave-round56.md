# Round 56 — Accelerated High-Risk Authority Convergence Wave

**Branch:** `fix/ue-runtime-rls-foundation` · **PR:** #752
**Start SHA:** `38bb2fe868db2bdc8a4466148db8771b95921c39`

## 1. Exact starting boundary

Verified before any change: `git rev-parse HEAD` == `git rev-parse origin/fix/ue-runtime-rls-foundation` == `gh pr view 752 --json headRefOid` == `38bb2fe868db2bdc8a4466148db8771b95921c39`.

## 2. Mechanically derived 52-table universe

Derived directly from a fresh `pnpm tsx scripts/generate-storage-authority-census.ts` run (not hand-maintained):

```
COMPLEX:org:HIGH          = 30
COMPLEX:user:HIGH         = 6
COMPLEX:user:NORMAL       = 14
votes + voting_options    = 2
-----------------------------
TOTAL                     = 52
```

This matched the expected counts exactly — no delta to explain.

## 3. Cohort accounting

| Cohort | Starting | Closed | Residual |
|---|---|---|---|
| org-high | 30 | 27 (+2 closed-non-TENANT: SYSTEM_ONLY, MIXED_GLOBAL) | 1 (payments, ejected) |
| user-high | 6 | 3 | 3 (finance, ejected) |
| user-normal | 14 | 4 | 10 (reachability incomplete, ejected) |
| voting | 2 | 0 | 2 (ejected) |
| **Total** | **52** | **36** | **16** |

## 4. Archetype matrix

See `reports/union-eyes-accelerated-authority-wave-round56.json`'s `archetypeMatrix` for the exact table lists. Summary:

| Archetype | Count | Closed | Residual |
|---|---|---|---|
| DIRECT_TENANT_RESOURCE | 22 | 22 | 0 |
| APPEND_ONLY_EVIDENCE | 2 | 2 | 0 |
| WORKER_OR_CRON_EXECUTION | 1 | 1 | 0 |
| CREDENTIAL_OR_INTEGRATION_CONFIG | 3 | 3 | 0 |
| CROSS_TENANT_PLATFORM_RESOURCE | 1 | 1 | 0 |
| DERIVED_TENANT_DATA | 1 | 1 | 0 |
| USER_PRIVATE_RESOURCE | 1 | 1 | 0 |
| PRIVACY_SENSITIVE | 5 | 5 | 0 |
| FINANCE_EXECUTION | 4 | 0 | 4 |
| MULTI_PARTY_AUTHORITY / VOTING_INTEGRITY | 2 | 0 | 2 |
| UNKNOWN (reachability incomplete) | 10 | 0 | 10 |

## 5. Security defects found and fixed this round

1. **pilot_feedback** — `app/api/pilot/feedback/route.ts` trusted client-supplied `userId`/`organizationId` in the POST body (cross-user/cross-org impersonation) and an arbitrary `?organizationId=` query param on GET (cross-org IDOR reading another org's feedback summary). Fixed to derive both from the authenticated `withRoleAuth()` context. 4 regression tests added.
2. **external_calendar_connections** — stores raw OAuth `access_token`/`refresh_token`; the crud-factory routes were org-scoped only (`readRole: 'member'`), so any org member could read every other member's tokens. Fixed via `ownerColumn: 'userId'` + a `beforeCreate` hook forcing `userId` from the authenticated caller. 2 regression tests added.
3. **integration_api_keys** — Django `IntegrationApiKeysViewSet` was `IsAuthenticated` + `objects.all()` with zero legitimate consumer, a cross-tenant metadata leak. Contained via `DenyAllPermission`.
4. **integration_webhooks** — Django `IntegrationWebhooksViewSet` was `IsAuthenticated` + `objects.all()` + `fields = '__all__'`, leaking the raw webhook signing secret cross-tenant. Contained via `DenyAllPermission`.
5. **budget_pool** — Django `BudgetPoolViewSet` had the identical orphaned-ViewSet pattern; its sibling `BudgetReservationsViewSet` was already fixed in round 42 but this one was missed. Contained via `DenyAllPermission`.
6. **payments** — Django `PaymentsViewSet` had the identical orphaned-ViewSet pattern (no org filter at all); its siblings (strike fund, tax slips) were already fixed in rounds 30/32 but this one was missed. Contained via `DenyAllPermission`.

All 6 fixes have dedicated regression tests (TS: vitest; Django: `python -m unittest`), all passing locally.

## 6. Security findings documented but not fixed (ejected with concrete blocker)

- **payments**: `services/financial-service/src/routes/payments.ts` falls back to a client-supplied `req.body.organizationId` whenever the authenticated context's `organizationId` is falsy — requires a financial-service auth-model review before a safe fix can be written without risking legitimate multi-org staff flows. Ejected to the Round 57 finance tranche.
- **poll_votes**: the generic CRUD factory does not cross-validate that a client-supplied `poll_id` belongs to the caller's own organization before inserting a vote row — a poll-results data-integrity gap, not a cross-tenant confidentiality breach. Documented in the manifest `reason` as a residual finding; recommended follow-up is a `beforeCreate` hook validating the parent's organization.

## 7. Exception ledger

| Table | Blocker code | Proven facts | Next required step |
|---|---|---|---|
| payments | FINANCE_EXECUTION | Django leak fixed this round; financial-service body-fallback vuln proven; 89+ referencing files | Round 57 finance/settlement authority tranche |
| rl1_tax_slips | FINANCE_EXECUTION | Django already contained (round 32) | Round 57 finance/tax-document tranche |
| t4a_tax_slips | FINANCE_EXECUTION | Django already contained | Round 57 finance/tax-document tranche |
| strike_fund_disbursements | FINANCE_EXECUTION | Django already contained (round 30); no organization_id column | Round 57 finance tranche + schema/backfill design |
| votes | MULTI_PARTY_POLICY_REQUIRED | No direct org column (scopes via session_id); ballot uses anonymized voter_id+hash+signature+receipt_id (deliberate secrecy design); Django already denies all | Dedicated VOTING_INTEGRITY tranche (rules 21-31: eligibility, duplicate-vote invariant, option-injection, mutability, result-visibility tiers) |
| voting_options | MULTI_PARTY_POLICY_REQUIRED | Same election/session graph as votes; Django already denies all | Same dedicated VOTING_INTEGRITY tranche |
| autopay_settings | REACHABILITY_VERIFICATION_INCOMPLETE | user_id NOT NULL, no org column; zero caller found for lib/utils/autopay-utils.ts | Trace autopay-utils.ts's exported functions for a real caller |
| blind_trust_registry | REACHABILITY_VERIFICATION_INCOMPLETE | user_id NOT NULL, no org column; zero caller found for services/founder-conflict-service.ts | Confirm genuinely dormant (LATENT_UNREACHABLE candidate) or find the caller |
| certification_alerts | REACHABILITY_VERIFICATION_INCOMPLETE | user_id NOT NULL, no org column; only found via a Django-proxy client (lib/api/django-client.ts) | Trace Django-side reachability/auth boundary |
| conflict_disclosures | REACHABILITY_VERIFICATION_INCOMPLETE | Same as blind_trust_registry (shared service file) | Same as blind_trust_registry |
| continuing_education | REACHABILITY_VERIFICATION_INCOMPLETE | Same Django-proxy uncertainty as certification_alerts | Trace Django-side reachability/auth boundary |
| indigenous_data_access_log | REACHABILITY_VERIFICATION_INCOMPLETE | user_id NOT NULL, no org column; only referrer is a barrel re-export | Locate the actual consumer — privacy-sensitive, should not close without one |
| key_holder_registry | REACHABILITY_VERIFICATION_INCOMPLETE | Reachable via a 2nd-hop caller (force-majeure-integration.ts) not fully traced | Trace force-majeure-integration.ts's own callers |
| recusal_tracking | REACHABILITY_VERIFICATION_INCOMPLETE | Same as blind_trust_registry/conflict_disclosures | Same as blind_trust_registry |
| staff_certifications | REACHABILITY_VERIFICATION_INCOMPLETE | Same Django-proxy uncertainty as certification_alerts/continuing_education | Trace Django-side reachability/auth boundary |
| weekly_threshold_tracking | REACHABILITY_VERIFICATION_INCOMPLETE | user_id NOT NULL, no org column; caller not traced | Trace caller |

## 8. Counts before → after

| Metric | Before | After |
|---|---|---|
| NEEDS_REVIEW | 85 | 49 |
| RLS policy expansion required | 248 | 283 |
| Closed-with-TBD | 0 | 0 |
| Invariant violations | 0 | 0 |
| Ready for explicit GRANT | 615 | 651 |

## 9. Residual topology after Round 56

```
COMPLEX:org:NORMAL              = 23  (unchanged — out of scope this round)
COMPLEX:none:NORMAL             = 10  (unchanged — Round-53/pre-existing finance/no-org deferred set)
COMPLEX:org:HIGH (finance)      = 1   (payments — ejected)
COMPLEX:user:HIGH (finance)     = 3   (rl1_tax_slips, t4a_tax_slips, strike_fund_disbursements — ejected)
COMPLEX:user:NORMAL (unresolved)= 10  (ejected, REACHABILITY_VERIFICATION_INCOMPLETE)
PARENT_OWNED:parent:HIGH        = 2   (votes, voting_options — ejected, MULTI_PARTY_POLICY_REQUIRED)
```

Round 57 can now scope directly from this exact residual list.

## 10. Frozen tranches (unchanged this round)

- Round 55 authority conclusions unmodified.
- Dependency stabilization commit `38bb2fe868db2bdc8a4466148db8771b95921c39` unmodified (no Next.js/sharp/multer changes, no override removals).
- Round-53 residual blockers (`ai_budgets` RLS DDL defect, `ReportExecutor` dynamic-SQL audit gap, `sso_providers` plaintext secret storage) NOT remediated this round.
- Pre-existing CodeQL task-queue stack-trace finding NOT touched.
- The 10 known no-org finance/reference tables from prior rounds NOT pulled into this round.

## 11. Final status

**ROUND56 = CLOSED / LOCAL VALIDATED** (pending remote CI green — see completion report for exact validation commands run).

Programme status is unchanged: **PR #752 = NO_GO / DO NOT MERGE** — NEEDS_REVIEW has not reached zero, finance authority has not converged, RLS policies are not yet implemented in Postgres, blanket runtime CRUD has not been revoked, and no live runtime/system principal attestation exists.
