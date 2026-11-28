# CIU qualification batch 03 — agreement sources and integration execution
2026-11-28. Source baseline 7e45edc5c877a31ee0a0efd61236e6ee395b5255. No application changes, test execution or release acceptance.

## Official bilingual agreement source inventory
Base EN: https://www.canada.ca/en/treasury-board-secretariat/topics/pay/collective-agreements/
Base FR: https://www.canada.ca/fr/secretariat-conseil-tresor/sujets/remuneration/conventions-collectives/
Both language endpoints located for fb.html, pa.html, sv.html, eb.html, tc.html. Prior PA/SV PDF retrieval limitation bypassed using HTML. All five EN and FR source locations identified; full legal clause reconciliation and PSAC instrument review remain.
PSAC source index https://psacunion.ca/constitution-regulations ; November 2024 Constitution https://psacunion.ca/sites/psac/files/psac.constitution.november_2024_edition.eng_v002.pdf ; bargaining status https://www.canada.ca/en/treasury-board-secretariat/services/collective-agreements/collective-bargaining/collective-bargaining-update.html .
FB art18 maximum 3 levels; PA/SV/TC art18 maximum 4, permitted election to waive level 2 or 3 when 4 exist; EB art37 maximum 4. Actual configured CBSA procedure must be verified, not presumed 4. All use employer representative segregation subject to verified clauses. TC current published HTML includes separate XX article in RCMP civilian transition MOA, effective 2025-11-27 for designated RCMP classifications only. It is not the ordinary CIU/CBSA TC rule. PA/SV/EB current texts also contain RCMP transition amendments; require scope filters by employer/classification and effective date. Do not use expiry as automatic termination of applicable rules.
Additional acceptance:
REP-20 — employer representative cannot hear same grievance at multiple levels (FB/PA/SV/TC 18.11; verify EB37.11).
REP-21 — rule selection must scope employer, classification, agreement version, effective date, procedural route; reject RCMP-only TC XX article for CBSA TC.
REP-22 — PSAC good-standing exception and source authorization; no automatic removal of representation rights due to missing payroll deduction (https://psacunion.ca/node/7064).
REP-23 — telework letter periods and expiry separately tracked; do not apply expired temporary panel arrangements automatically (https://www.canada.ca/en/treasury-board-secretariat/services/collective-agreements/collective-bargaining/collective-bargaining-update/letter-agreement-telework-eb-pa-sv-tc.html).

## Source evidence and dispositions
F01.1/2: apps/union-eyes/lib/integrations/integration-fabric-hooks.ts processInboundCase maps, invokes identityLinker.link with internalId empty string, returns random UUID and success. executionEngine dependency unused in method. Indexed callers only implementation/test/playbook; full reachability not established.
F01.3: apps/union-eyes/lib/integrations/__tests__/integration-fabric-hooks.test.ts makes executionEngine an empty mock, tests success and truthy runId, mocks link; no durable case/run proof. Confirmed test assertion gap.
F01.4: packages/platform-integrations/src/execution-engine.ts executeInbound records idempotency after adapter result even when result.success false; existing idempotency hit cast as IntegrationRun without fetching run. Check actual IdempotencyStore implementation and retry policy before fix; cannot report replay as success without observed run.
F01.5: packages/platform-integrations/src/identity-linker.ts link resolves existing mapping, updates metadata if provided, returns existing without comparing requested internalId; conflict and stale-link policy require proof.
F01.6: executeInbound does not itself compare connection.orgId and context.orgId before creating run. Trace callers, store constraints and credential/tenant binding. No live vulnerability claim.
Severity: P0 pre-introduction qualification. F01.1–3 confirmed incomplete method/test contract; F01.4–6 source observations, reachability and impact pending. Reuse existing fabric and domain persistence; no separate CIU implementation.

## Canonical ownership crosswalk — initial
Gate 0 frozen matrix generator tooling/scripts/lib/ue-gate0-build-matrix.mjs and tooling/scripts/lib/ue-gate0b1-groups.mjs identify UE-CAP-K-010 for CASE_INGESTION and case read; UE-CAP-B-001 primary representative ownership; UE-CAP-F-002 document lifecycle; UE-CAP-D-003 financial mandates; UE-CAP-G-002/G-003 union-side referral/external counsel dependency; UE-OMIT-DEADLINE-OVERDUE deadline nav gap (historical canonical entry; current closure evidence must supersede).
CIU-03/04/11 -> UE-CAP-K-010, B-001, F-002 (partial mapping, not complete).
CIU-09 -> UE-CAP-D-001/D-002/D-003.
CIU-10 -> UE-CAP-F-002/G-001/G-002/G-003.
No inferred capability ID for untraced integration facade, employer conflict or agreement engine. Map them through full canonical register and current owning Step 2 task before implementation. Frozen historical generator status is not current readiness.

## Executable regression requirements (NOT_EXECUTED)
ID | Setup and assertion
---|---
INT-01 | valid inbound case: persisted canonical case, identity target exists, persisted run matches returned ID and mandatory audit; no empty internal ID
INT-02 | malformed mapped payload: no case, identity link or success event; explicit rejection
INT-03 | same source event repeated: same canonical entity and durable receipt, one domain effect
INT-04 | conflicting external ID mapping: quarantine with reason; no silent overwrite or stale link reuse
INT-05 | same external ID in unrelated tenant: distinct isolated outcomes; wrong connection context denied before write
INT-06 | concurrent retry: unique scoped key, no duplicate row, audit or notification
INT-07 | adapter failure before persistence: failed run; retry policy explicit, no fake completed result
INT-08 | failure after domain commit: durable recovery/reconciliation, no duplicate creation
INT-09 | audit failure: transaction rolls back or recoverable durable intermediate status; never success without mandatory audit
INT-10 | stale link or missing internal entity: reject or approved reconciliation; no implicit relink
INT-11 | payload or mapping schema evolution: versioned rules, deterministic replay and explicit drift errors
INT-12 | source revocation: unauthorized new ingest denied, previously imported history retained subject to policy
INT-13 | raw PII or credential in failure: redacted logs/receipts; restricted quarantine and retention
INT-14 | bulk import partial failure: counts reconcile, restart resumes only incomplete records, evidence digest and controlled rollback
INT-15 | cross-tenant export/event: deny unrelated case and sensitive fields; no notification before committed state
INT-16 | retry existing idempotency key: load authoritative persisted run and preserve failed/pending/completed disposition; no unsafe cast to success

## Next execution boundary
Full local checkout, current SHA, complete reference/caller census; inspect actual stores and authority gates. Add failing-before tests with real persistent test data, implement in owning workstream, run focused and full suites. No changes to S2.02 or staging/production gates. Current CIU-00 freeze NO, CIU runtime NOT_EXECUTED, introduction GO NO. No real data, external connection or sponsor contact.
