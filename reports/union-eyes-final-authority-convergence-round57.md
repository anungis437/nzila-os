# Round 57 — Final Authority Convergence & Enforcement Readiness Gate

**Start SHA:** `6e553c42a986725e46e4b62151b8274467e4d9f6` (verified local == origin == PR head)
**Active universe:** 49 tables (exact match to the round's expected list)
**Closed this round:** 48
**Remaining NEEDS_REVIEW:** 1 (`strike_fund_disbursements`)

## 1. Outcome

Round 57 mechanically processed all 49 NEEDS_REVIEW tables carried over from Round 56 in one
convergence cycle. 48 received a final, evidence-backed disposition. Exactly **one** table
(`strike_fund_disbursements`) remains NEEDS_REVIEW — a genuine, documented architecture blocker
(no `organization_id` column exists at all; a real per-organization backfill key and schema
migration are required before any disposition can be assigned), not unfinished analysis.

There is **no Round 58 storage-table review tranche**. The remaining work is enforcement
(compile RLS policies + explicit GRANTs, remove blanket runtime CRUD) and live attestation.

## 2. Final classification counts

| Classification | Count | Tables |
|---|---|---|
| TENANT_RLS_REQUIRED | 12 | payments, chargeback_statements, fee_adjustments, transaction_fee_events, transaction_fee_rules, automation_rules, data_quality_warnings, ai_clause_reasonings, grievance_timeline_events, pilot_events, reward_redemptions, satisfaction_surveys |
| USER_RLS_REQUIRED | 4 | user_notification_preferences, user_signatures, gdpr_data_requests, ai_copilot_sessions |
| PARENT_OWNED_RLS_REQUIRED | 2 | votes, voting_options |
| GLOBAL_REFERENCE_DATA | 1 | contribution_rates |
| LATENT_UNREACHABLE | 2 | fee_settlement_batches, fee_settlement_lines |
| CONTAINED_NO_AUTHORITY | 27 | rl1_tax_slips, t4a_tax_slips, t106_filing_tracking, transfer_pricing_documentation, fx_rate_audit_log, transaction_currency_conversions, currency_enforcement_audit, currency_enforcement_policy, currency_enforcement_violations, bank_of_canada_rates, autopay_settings, blind_trust_registry, certification_alerts, conflict_disclosures, continuing_education, indigenous_data_access_log, key_holder_registry, recusal_tracking, staff_certifications, weekly_threshold_tracking, integration_sync_schedules, sync_jobs, sms_templates, event_attendees, international_addresses, precedent_citations, public_content |
| NEEDS_REVIEW (retained) | 1 | strike_fund_disbursements |

**Total: 49.**

## 3. Corrected false negatives (barrel-export reachability misses)

Initial file-name-only reachability checks incorrectly flagged 4 tables as unreachable. Deeper
verification (checking actual exported function names and barrel `export *` re-exports) found
real production callers:

- **chargeback_statements** — reachable via `services/platform-economics` barrel re-exporting
  `allocation-engine.ts`; `app/api/finance/chargebacks/route.ts` calls `getChargebacks()`.
- **fee_adjustments** — reachable via `reverseTransactionFee()`, invoked from the live Stripe
  webhook.
- **transaction_fee_rules** — read-reachable via `findApplicableRule()` inside `evaluateFee()`,
  invoked from the live Stripe webhook.
- **grievance_timeline_events** — reachable via `lib/ingestion/batch-ingest.ts`'s
  `ingestGrievanceBatch()`, called from `app/api/admin/ingest/route.ts` (a raw-SQL caller missed
  by Drizzle-symbol-only reachability tracing).

## 4. Finance authority matrix

| Table | Economic owner | Tenant | System/Processor | Tenant DML | System DML | Principal | Final classification |
|---|---|---|---|---|---|---|---|
| payments | Org (dues/donations) | organization_id NOT NULL | Stripe/PayPal webhooks | SELECT/INSERT/UPDATE | INSERT/UPDATE | MIXED | TENANT_RLS_REQUIRED |
| strike_fund_disbursements | Org (strike fund) | none (no org column) | — | — | — | TBD | **NEEDS_REVIEW (exception)** |
| rl1_tax_slips / t4a_tax_slips | Member (tax slip) | user_id only | Django DenyAll | none (dead writer) | none | NONE | CONTAINED_NO_AUTHORITY |
| chargeback_statements | Org | organization_id NOT NULL | — | SELECT | — | TENANT_USER | TENANT_RLS_REQUIRED |
| fee_adjustments | Org | organization_id NOT NULL | Stripe webhook (reversal) | — | INSERT | WEBHOOK/SYSTEM_RUNTIME | TENANT_RLS_REQUIRED |
| fee_settlement_batches / lines | Org (design) | organization_id NOT NULL (lines) | — | none (dead) | none | NONE | LATENT_UNREACHABLE |
| transaction_fee_events | Org | organization_id NOT NULL | Stripe webhook | SELECT | INSERT/UPDATE | WEBHOOK/SYSTEM_RUNTIME | TENANT_RLS_REQUIRED |
| transaction_fee_rules | Org | organization_id nullable | Stripe webhook (read) | — | SELECT | WEBHOOK/SYSTEM_RUNTIME | TENANT_RLS_REQUIRED |
| autopay_settings | Member | user_id only | Django DenyAll | none (dead) | none | NONE | CONTAINED_NO_AUTHORITY |
| bank_of_canada_rates / currency_enforcement_* / t106_filing_tracking / transfer_pricing_documentation / fx_rate_audit_log / transaction_currency_conversions | Platform (design) | none | Django DenyAll (dead TransferPricingService class) | none (dead) | none | NONE | CONTAINED_NO_AUTHORITY |
| contribution_rates | Platform (wage benchmarks) | none | GraphQL read + system enrichment job | — | SELECT/INSERT/UPDATE | MIXED/SYSTEM_RUNTIME | GLOBAL_REFERENCE_DATA |

## 5. Voting integrity

For `votes` / `voting_options`:

- **Election root:** `votingSessions` (organization_id NOT NULL); both children scope through
  `session_id` (PARENT_OWNED_RLS_REQUIRED).
- **Eligibility:** `voter_eligibility` table + `checkVoterEligibility()`; the safe route
  (`app/api/voting/sessions/[id]/vote/route.ts`) already enforced this via `castVote()`.
- **Ballot secrecy:** `voterId` is an HMAC-anonymized derivation of `(memberId, sessionId)`, not
  the real identity, when `isAnonymous=true`.
- **Duplicate-vote protection:** ~~broken~~ **fixed** — `generateAnonymousVoterId()` embedded
  `Date.now()`, making every vote's derived `voterId` unique and silently defeating the
  "already voted" check on every single cast. Fixed to be deterministic. A DB-level unique index
  `votes_session_voter_unique` on `(session_id, voter_id)` was added for defense-in-depth against
  a concurrent-request race.
- **Cross-election option injection:** already prevented in both routes
  (`eq(votingOptions.id, optionId) AND eq(votingOptions.sessionId, sessionId)`).
- **Mutation lifecycle:** votes are insert-only at the API surface (no PATCH/DELETE route).
  `voting_options` currently has no live mutation route at all (create/update/delete helpers
  exist in `voting-service.ts` but have zero real callers) — no live option-tampering risk today.
- **IDOR fixed:** `app/api/governance/elections/sessions/[id]/vote/route.ts` accepted a
  client-supplied `voterId` and never checked eligibility — fixed to delegate to `castVote()`.

## 6. User/subject residual cohort

Same-org isolation findings, using the A1/A2/B1 model:

- **user_notification_preferences**, **user_signatures**, **gdpr_data_requests**: all
  self+org scoped (`eq(userId, ctx.userId) AND eq(organizationId, ctx.organizationId)`) —
  classified USER_RLS_REQUIRED. No defect found (already correctly scoped).
- **ai_copilot_sessions**: self+org scoped by design (a copilot session is inherently
  per-user) — USER_RLS_REQUIRED.
- **blind_trust_registry, conflict_disclosures, recusal_tracking, certification_alerts,
  continuing_education, staff_certifications, indigenous_data_access_log, key_holder_registry,
  weekly_threshold_tracking**: all backed by dead service classes (zero real instantiations
  confirmed via `new ClassName(` search) — CONTAINED_NO_AUTHORITY after Django containment.

## 7. Sidecar programme blockers

| Blocker | Status | Next action |
|---|---|---|
| `ai_budgets` RLS policy DDL (nonexistent `auth.user_id()`) | EXPLICIT PROGRAMME BLOCKER | Needs a real policy DDL fix; out of this round's classification scope |
| `ReportExecutor` dynamic SQL audit | EXPLICIT PROGRAMME BLOCKER | Needs a dedicated security-audit round |
| `sso_providers` plaintext `oidcClientSecret` | EXPLICIT PROGRAMME BLOCKER | No established secret-encryption primitive to reuse; requires new infrastructure, not invented this round |
| `task_enqueue_views.py` CodeQL stack-trace exposure | EXPLICIT PROGRAMME BLOCKER (frozen) | Not touched this round |

None of these are NEEDS_REVIEW tables; their classifications are unchanged.

## 8. Canonical counts — before → after

| Metric | Before | After |
|---|---|---|
| NEEDS_REVIEW | 49 | **1** |
| TENANT_RLS_REQUIRED | 248 | 260 |
| PARENT_OWNED_RLS_REQUIRED | 34 | 36 |
| USER_RLS_REQUIRED | 9 | 13 |
| RLS expansion required | 283 | 301 |
| closed-with-TBD | 0 | 0 |
| invariant violations | 0 | 0 |
| ready-for-explicit-GRANT | 651 | 699 |

## 9. Enforcement readiness gate

```
AUTHORITY_MANIFEST_CONVERGED   = NO (1 intentional residual)
NEEDS_REVIEW                   = 1
CLOSED_WITH_TBD                = 0
INVARIANT_VIOLATIONS           = 0
RLS_POLICY_EXPANSION_TABLES    = 301
EXPLICIT_GRANT_INPUT_COMPLETE  = NO (699/700)
FINAL_RLS_MIGRATION_READY      = NO
FINAL_GRANT_MIGRATION_READY    = NO
```

## 10. Validation

- `pnpm --filter @nzila/union-eyes typecheck`: clean
- `npx vitest run` (union-eyes): 1222 files / 17241 tests passed
- `pnpm contract-tests`: 278 files / 9539 tests passed
- Red-team (`security/redteam`): 7 files / 106 tests passed, no baseline increase
- Django `manage.py check`: 0 issues
- Django targeted tests: all round-57 modules + affected round-52/round-46/round-47/round-42
  lock-test updates pass

## 11. Status

**ROUND57 = PARTIAL.** Per the round's own success criterion, CLOSED requires NEEDS_REVIEW = 0;
one genuine, documented architecture blocker (`strike_fund_disbursements` — no `organization_id`
column exists at all) remains, honestly retained rather than fabricating a classification. All
other 48 tables received a final, evidence-backed disposition this round, and this is explicitly
**not** a further classification tranche — there is no Round 58 storage-table review. The
remaining blocker is now a concrete, scoped input for whoever performs the `strike_fund_disbursements`
schema migration/backfill (a security-defect-shaped task), not more analysis.

PR #752 remains **NO_GO / DO NOT MERGE**: 1 table still NEEDS_REVIEW, RLS policies are not yet
implemented in Postgres, no live runtime/system principal attestation exists. The next stage is
enforcement (Round 58: compile RLS expansion + explicit GRANTs, remove blanket runtime CRUD),
then live attestation and final acceptance (Round 59) — not further classification.
