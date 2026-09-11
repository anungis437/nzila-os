# Union Eyes Simple-Tenant Exception Remediation Report (round 53)

Generated: 2026-09-08T17:31:34.656Z

Advisory only -- does not rewrite the manifest. See db/rls-storage-authority/*.ts for the authoritative classification of each table.

This report closes the final 11-table SIMPLE_TENANT:org:HIGH lane, deferred since round 41.

SIMPLE_TENANT lane: 11 -> 0

## Family counts

| Family | Count |
| --- | --- |
| AI_BUDGET_CONTROL | 1 |
| CALENDAR_AND_SCHEDULING | 2 |
| TRAINING_AND_REGISTRATION | 3 |
| PILOT_CONTROL_PLANE_STORAGE | 3 |
| REPORTING | 1 |
| SSO_CREDENTIAL_CONFIGURATION | 1 |

## 11-table disposition matrix

| Table | Family | First deferred | Final classification | Invocation | DB principal | Concrete defect fixed | Residual blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ai_budgets | AI_BUDGET_CONTROL | round 41 | CONTAINED_NO_AUTHORITY | NONE | NONE | (none) | Real ai_budgets table has RLS enabled with broken CREATE POLICY statements referencing a nonexistent auth.user_id() function (round-35 finding, not re-litigated) — a schema/migration hygiene defect, not an authority-classification blocker |
| calendars | CALENDAR_AND_SCHEDULING | round 41 | TENANT_RLS_REQUIRED | MIXED | TENANT_RUNTIME | Same-org peer exposure of personal (isPersonal=true) calendars via GET/PATCH/DELETE (any member could list/read/edit/delete any other member's personal calendar); ownerId was fully client-controllable on create (identity-spoofing) | (none) |
| meeting_rooms | CALENDAR_AND_SCHEDULING | round 41 | TENANT_RLS_REQUIRED | TENANT_USER | TENANT_RUNTIME | (none) | (none) |
| training_programs | TRAINING_AND_REGISTRATION | round 41 | TENANT_RLS_REQUIRED | TENANT_USER | TENANT_RUNTIME | (none) | (none) |
| training_courses | TRAINING_AND_REGISTRATION | round 41 | TENANT_RLS_REQUIRED | TENANT_USER | TENANT_RUNTIME | (none) | (none) |
| course_registrations | TRAINING_AND_REGISTRATION | round 41 | TENANT_RLS_REQUIRED | TENANT_USER | TENANT_RUNTIME | memberId was fully client-controllable on the self-registration route (identity spoofing — registering another member without consent); courseId/sessionId were not validated against the caller's own organization (cross-org FK injection) | (none) |
| pilot_checklist_items | PILOT_CONTROL_PLANE_STORAGE | round 41 | TENANT_RLS_REQUIRED | TENANT_USER | TENANT_RUNTIME | (none) | (none) |
| pilot_enrollments | PILOT_CONTROL_PLANE_STORAGE | round 41 | MIXED_GLOBAL_TENANT_RLS_REQUIRED | MIXED | SYSTEM_RUNTIME | (none) | (none) |
| pilot_milestones | PILOT_CONTROL_PLANE_STORAGE | round 41 | TENANT_RLS_REQUIRED | MIXED | SYSTEM_RUNTIME | (none) | (none) |
| reports | REPORTING | round 41 | TENANT_RLS_REQUIRED | TENANT_USER | TENANT_RUNTIME | (none) | ReportExecutor's own dynamic SQL-generation injection-safety was not audited this round (out of scope — does not touch the reports table's own row-level authority) |
| sso_providers | SSO_CREDENTIAL_CONFIGURATION | round 41 | TENANT_RLS_REQUIRED | TENANT_USER | TENANT_RUNTIME | POST create response echoed raw samlCertificate/oidcClientSecret in the clear (GET already redacted these fields) — fixed to apply identical redaction | oidcClientSecret is stored plaintext despite a schema comment claiming encryption (CREDENTIAL_STORAGE_MODEL_UNRESOLVED); no unique constraint on samlEntityId/oidcIssuer (theoretical domain-collision risk, not currently exploitable since no pre-auth discovery path exists) |

## Pilot control-plane doctrine

UNCHANGED — storage authority only, no pilot business/readiness doctrine touched

## Finance freeze (must remain PRESERVED)

PRESERVED — none of these 10 tables, their manifest classifications, or their runtime principal architecture were touched this round

- contribution_rates
- currency_enforcement_audit
- fx_rate_audit_log
- t106_filing_tracking
- bank_of_canada_rates
- currency_enforcement_policy
- currency_enforcement_violations
- transaction_currency_conversions
- transfer_pricing_documentation
- fee_settlement_batches
