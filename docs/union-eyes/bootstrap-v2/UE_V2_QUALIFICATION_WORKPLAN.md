# Union Eyes V2 canonical bootstrap — qualification work plan

> Directive item 1 (New Azure Subscription Migration Directive, 2026-11-04): qualify the V2 canonical
> database bootstrap, reconcile the schema compatibility gaps and the failing bootstrap tests.
> `UE_V2_CANONICAL_FRESH_BOOTSTRAP` stays **UNQUALIFIED** until every step below has its evidence.
> Analysis date 2026-11-04, source `ue/prod-prep-closure` at `72096a779` (PR #1014 + #1078 + `main`).

## 1. The gap, measured against current source

`UE_V2_APP_SCHEMA_COMPATIBILITY.json` in this folder was generated on 2026-10-17. Re-running its
generator (`scripts/bootstrap-v2/app-schema-compat.ts`) against the **committed** V2 plan and the
current Drizzle declarations gives:

| Status | 2026-10-17 report | Current source |
| --- | ---: | ---: |
| OK | 373 | 387 |
| COLUMNS_MISSING_IN_V2 (tables) | 237 (3,378 columns) | **151 (1,723 columns)** |
| ABSENT_IN_V2 (tables) | 49 | **34** |
| EXCLUDED_IN_V2 | 2 | 4 |

The committed report is stale and must be regenerated as part of step Q2; the figures above are
not yet committed evidence.

## 2. Which gaps block a working application

Each of the 185 gap tables was classified by whether a live part of the application can reach it.
Roots: every `app/**/page.tsx` and `layout.tsx`, every `app/api/**/route.ts` that does not answer
501 or a retired handler, `middleware.ts` and `instrumentation.ts`. Edges: static `import`, `export
… from`, `import()` and `require()` resolved within `apps/union-eyes`. A table counts as used when
its Drizzle export name, or a raw `FROM/JOIN/INTO/UPDATE <table>`, appears in a reached file.

| Class | Tables | Missing columns | Meaning |
| --- | ---: | ---: | --- |
| LIVE_ROUTE | 18 | | a live route uses the table directly |
| REACHABLE_INDIRECT | 49 | | a live route or page reaches it through `lib/`, `services/`, `db/queries/` |
| **Required subtotal** | **67** (23 absent, 44 partial) | **360** | must exist in V2, or the reaching path must fail closed |
| UNREACHABLE_INDIRECT | 89 | | only code no live root imports |
| UNUSED | 29 | | declared, never referenced outside schema and tests |
| **Deferrable subtotal** | **118** | **1,363** | may stay out of V2 if their declarations are not reachable |

Limits of this analysis (to be closed by a committed script in Q1): dynamic table names, string-built
SQL, background workers started outside `app/`, and Django-only callers are not seen; the 501
detection is a text match.

**Required and absent (23):** `cba_intel_freshness_log`, `contact_submissions`, `dunning_cases`,
`dunning_policies`, `dunning_steps`, `email_address_suppressions`, `fee_settlement_lines`,
`member_roles`, `ml_prediction_feedback`, `permission_exceptions`, `pilot_fixture_rows`,
`pricing_discount_rules`, `pricing_regional_deployments`, `pricing_template_modules`,
`pricing_templates`, `public_intake_audit_events`, `rbac_audit_log`, `role_definitions`,
`satisfaction_survey_responded`, `shared_clause_versions`, `ue_governance_job_cancellation_audit_event`,
`ue_governance_job_cancellation_request`, `ue_governance_job_execution_state`.

**Required and partial (44, missing column count):** `alert_recipients`(6), `anti_scab_violations`(1),
`arbitration_decisions`(1), `arbitrator_profiles`(20), `benefit_comparisons`(9),
`budget_reservations`(3), `cba_contacts`(8), `cba_footnotes`(10), `cba_version_history`(6),
`chart_of_accounts`(20), `claims`(1), `clc_chart_of_accounts`(7), `cms_pages`(1),
`committee_meetings`(1), `committee_memberships`(15), `data_anonymization_log`(10), `documents`(4),
`donations`(20), `event_attendees`(12), `event_reminders`(9), `exit_interviews`(1),
`external_document_access_grants`(1), `grievances`(5), `kpi_configurations`(1), `member_documents`(16),
`ml_predictions`(2), `notification_log`(8), `organization_sharing_settings`(13),
`precedent_citations`(7), `precedent_tags`(1), `privacy_breaches`(17), `room_bookings`(26),
`shopify_config`(5), `signature_audit_log`(11), `signature_workflows`(20), `signers`(15),
`sms_campaign_recipients`(7), `ue_copilot_conversations`(1), `ue_reasoning_sessions`(1),
`user_management.users`(6), `user_uuid_mapping`(1), `voting_audit_log`(11),
`voting_notifications`(10), `wage_progressions`(10).

Two observations change the size of the work:

- **Part of the gap is plan staleness, not missing models.** `grievances` lacks exactly the five
  ingestion-traceability columns that Django `grievances/0009` recorded on 2026-11-02, and
  `documents` lacks the matching four. Regenerating the V2 plan from current Django models closes
  such gaps without schema design work.
- **Part of the gap is launch scope.** Pricing, dunning, donations, fee settlement, Shopify and
  chart-of-accounts tables serve commercial features that the V2 README places outside initial launch
  (dues read-only, Stripe post-launch). For those, the reaching routes should answer 501 in the
  launch feature profile rather than the tables being added.

## 3. Failing bootstrap tests (10 files, all failing on the unmodified branch)

| File | Cause | Resolution |
| --- | --- | --- |
| `system-mutation-contracts.test.ts` | source digests of bound SYSTEM callers changed after #1014 | requalify each changed caller (review the diff, re-derive the contract); never re-pin hashes without review |
| `system-component-integration.test.ts`, `system-mutation-native.test.ts` | `UE_V2_SYSTEM_MUTATION_EXACT_DENOMINATOR_REQUIRED`, downstream of the drift above | resolves with the requalification |
| `bootstrap-v2.test.ts` | plan lacks lookups current source performs (commercial transition `id, contract_number`; sync log `sync_id`) | regenerate the plan (Q2) |
| `reward-source.test.ts` | Django reward model now declares fields the prospective contract forbids | decide model vs. contract; fix one, with the reason |
| `local-vault-fixture.test.ts` | `spawnSync python ENOENT` on macOS (`python3` only) | environmental: run under the pinned interpreter (Q0) |
| `rls-storage-reachability-audit`, `runtime-schema-authority-oracle` | oracle reports `READY_FOR_BOOTSTRAP_PROOF` where the test pins `BLOCKED`; reachability expectations stale | re-derive after Q2; do not relax assertions to pass |

## 4. Steps

| Step | Work | Evidence |
| --- | --- | --- |
| Q0 | Pinned toolchain: CPython 3.11 via `uv`, hash-locked wheelhouse from `apps/union-eyes/backend/requirements.lock` (`pip download --require-hashes`), recorded digest | interpreter version, wheelhouse manifest digest |
| Q1 | Commit the reachability classification as a script (replacing this one-off analysis) with a test, so the required set is reproducible per SHA | script, test, output JSON |
| Q2 | Regenerate `UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json` from current Django models (including `grievances/0009`, `0010`) and scoped migrations (including `migrations-cache/0019`); regenerate the compatibility report | new plan digest, compat summary |
| Q3 | For each remaining required gap: add the model/migration (Django is the schema owner), or make the reaching route answer 501 in the launch profile and register it in the capability registry | per-table disposition table |
| Q4 | Requalify SYSTEM mutation contracts and fix the remaining failing tests per §3 | the ten files pass |
| Q5 | Fresh bootstrap on native PostgreSQL 15 and 16 from the new plan; catalog digest; RLS verify; application HTTP smoke against it | `UE_BOOTSTRAP_V2_LOCAL_VALIDATION.json` with `engineeringReadiness` re-evaluated |
| Q6 | Record the qualified candidate (source SHA, plan digest, catalog digest) for staging step S6 | ledger entry; `UE_V2_CANONICAL_FRESH_BOOTSTRAP` re-evaluated, not assumed |

Q0–Q2 are prerequisites for everything else. Q3 needs product decisions for the commercial tables.
Nothing here touches Azure.

## 5. Progress, 2026-11-04

**Q0 done.** CPython 3.11.15 via `uv`; Linux x86_64 cp311 wheelhouse of 87 wheels downloaded with
`pip download --require-hashes` from `apps/union-eyes/backend/requirements.lock` into a cache
outside the repository (manifest digest `33381c8236cb9ad970ba980295152b7eed75a33805848ee1444158731716b4d2`,
SHA-256 of the sorted per-wheel SHA-256 list). On Apple silicon the pinned multi-arch
`python:3.11-slim` image must run as `linux/amd64` (`DOCKER_DEFAULT_PLATFORM=linux/amd64`) to match
the wheels.

**Q2 done (plan regenerated, not qualified).** `plan.ts` now runs against current source. Three
source fixes were needed, each a real drift found by the run:

- `current_models.py` rendered no `Decimal` or `date` DDL parameters; current models declare
  `billing.MemberArrears.total_owed db_default=Decimal('0')` and
  `organizations.fiscal_year_end db_default='2024-12-31'`. Finite decimals and plain dates are now
  rendered; datetimes stay refused. Errors now name the statement.
- `source.ts` required `organization_id` to be **nullable** on `claims`, `grievances` and
  `security_events`, but tranche 10 (`d42d05ba5`) made it `NOT NULL` in Django (and Drizzle agrees).
  The canonical decision is now `UUID NOT NULL`, per the compiler's own "current Django source wins"
  rule; `README.md` updated.

| Plan | Before | After |
| --- | ---: | ---: |
| Tables | 722 | 735 (+13: `member_roles`, `role_definitions`, `rbac_audit_log`, `permission_exceptions`, `claim_status_transitions`, `email_address_suppressions`, `scim_provisioned_users`, …) |
| Columns | 9,141 | 11,406 |
| Prospective `ADD COLUMN` supplements | 3,065 | 0 (now declared by models) |
| Foreign keys | 623 | 598 (48 no longer emitted, 23 new) |
| Security blockers | 0 | 0 |

Compatibility against the new plan: **549 OK, 1 table missing 6 columns, 22 absent, 4 excluded**
(was 387 / 151 / 34 / 4 before regeneration).

**Needs review before Q5 (not decided here):**

- *Foreign keys.* The five `grievance_*` → `claims` links now reference `claims.claim_id` (the key
  the application uses) instead of `claims.id`. About 40 actor links (`created_by`, `user_id`, …
  → `profiles.user_id` / `user_management.users`) are no longer enforced because current Django
  declares those columns as plain fields. `signature_audit_trail` → `signature_documents` /
  `document_signers` is no longer enforced; that one concerns evidence integrity.
- *Two columns dropped from the plan:* `data_classification_policy.allow_grievance_participation`,
  `knowledge_base.embedding`.
- *Remaining gaps:* `user_management.users` lacks `phone_verified_at`, `two_factor_secret`,
  `two_factor_backup_codes`, `encrypted_sin`, `encrypted_ssn`, `encrypted_bank_account`, reached by
  the live SCIM and social-media routes (decide: model them, or keep them out and prove those paths
  never select them). Nine absent tables are commercial platform-economics (dunning, pricing, fee
  settlement: launch profile answers 501); three governance-job tables are reached only through
  `services/financial-service` (separate database); `cba_intel_freshness_log` is reached by the CBA
  freshness service; ten are unused.

**Tests:** the bootstrap-v2 set fails exactly as before the regeneration (no new failure). The two
`bootstrap-v2.test.ts` failures concern the authority manifest, which must also be regenerated (Q4).

**Not done:** Q1 (committed reachability script), Q3–Q6.
