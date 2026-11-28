# CIU enterprise qualification — pre-introduction ceiling
Date: 2026-11-28 | Priority: P0 strategic | Baseline: 7e45edc5c877a31ee0a0efd61236e6ee395b5255

## Mandate
Demonstrate a mature, institution-neutral Union Eyes product and repeatable enterprise onboarding process before client introductions. Client discovery concerns their actual systems, permissions, operating variations and mappings, not unresolved generic product capability. No client contact, real member data, client branding, mandate issuance, live integrations or production/staging activation authorized by this record. Preserve frozen Step 2 scope and S2.02 acceptance holds; route genuine residuals to existing owning work packages, not a parallel security program.

## Public evidence inventory (initial; not clause-complete)
- S01 https://ciu-sdi.ca/en/rules-regulations/ — policy precedence.
- S02 https://www.ciu-sdi.ca/wp-content/uploads/documents/bylaws_en.pdf — 2026-11-05, bylaws 1–20.
- S03 https://www.ciu-sdi.ca/wp-content/uploads/documents/ciu-regs-en.pdf — regulations.
- S04 https://www.ciu-sdi.ca/wp-content/uploads/documents/branch-rules-en.pdf — branch rules.
- S05 https://www.ciu-sdi.ca/wp-content/uploads/documents/local_mod_branch_rules_en.pdf — branch-specific amendments, 14 listed branches.
- S06 https://www.ciu-sdi.ca/wp-content/uploads/memos/2023-07-20-NO-13-2023-membership-allocation.pdf — allocation by physical work location, disputed allocation.
- S07 https://ciu-sdi.ca/en/standard-operating-procedures-on-grievance-handling/ — FB SOP, levels, signatures, handoff, alternative recourse.
- S08 https://ciu-sdi.ca/en/collective-agreements/ — EB, FB, PA, SV, TC; published expiry dates do not alone determine applicability.
- S09 https://ciu-sdi.ca/en/forms/ — CIU, PSAC and TBS forms incl. group consent, privacy authorization, abandonment, ATIP.
- S10 https://ciu-sdi.ca/en/vssa/ — appointment, consultation, national review, ratification, bilateral agreement.
- S11 https://ciu-sdi.ca/en/workforce-adjustment/ — WFA resources.
- S12 https://ciu-sdi.ca/en/branch-elections/ — national coordination and Intelivote.
- S13 https://psacunion.ca/our-constitution — parent constitutional authority.
- S14 https://psacunion.ca/membership-good-standing — Phoenix and leave exceptions.
- S15 https://psacunion.ca/membership-dues-faq — layered dues and transfers.
- S16 https://ciu-sdi.ca/en/national-convention/ — convention process.
- S17 https://ciu-sdi.ca/en/contact-us/ — functional national offices.
- S18 https://ciu-sdi.ca/en/home/ — 12,000+ represented workers and operational issue catalogue.

## Requirements and acceptance register (initial; all runtime NOT_EXECUTED)
ID | Source | Required positive and negative proof
---|---|---
CIU-01 | S01–06 | Effective-dated policy hierarchy and 22-branch synthetic fixture; local amendments cannot override higher authority; branch ID preserved as string; no implied access from parent affiliation.
CIU-02 | S02,S06,S13–15 | Distinguish represented worker/Rand/member/good standing/leave/discipline; preserve transfer history and branch dues; disputed allocation routed to authorized decision; no duplicate or identity merge by name alone.
CIU-03 | S07,S09 | Member intake, steward assignment, alternate recourse, member and steward signatures, employer receipt and independent external grievance number; unauthorized representative denied.
CIU-04 | S07–09 | FB standard levels and final-level exceptions; no unlawful skip; final transmittal executive signature; policy grievance dual CIU/PSAC presidential approval; group consent tracked; complete case bundle accepted by assigned national LRO only.
CIU-05 | S07–08 | Five agreement versions; exact clause-effective selection; awareness event vs incident; statutory/contract calendar, holidays, non-response, mutual extensions; old decisions retained; no unsupported automatic deadlines.
CIU-06 | S02–05,S16 | Convention credentials, alternates, quorum, resolutions, committees, internal member discipline and appeal, conflicts, succession; restricted investigations and revocation.
CIU-07 | S02–05,S12 | Election eligibility snapshot and external result certification; no live voting until authority issued; no duplicate result import; succession revokes outgoing authority.
CIU-08 | S10–11,S18 | VSSA committee appointment, affected worker consultation, national review, ratification and effective dates; WFA cohort/options/deadlines; privacy, classification, telework, accommodation and safety journeys; human decisions.
CIU-09 | S02–03,S15 | Dues, remittance, waivers, small-branch subsidy, expenses, disbursement and segregation; synthetic reconcile only; live authority denied when absent.
CIU-10 | S07,S09,S13 | PSAC referral/approval, CBSA correspondence, adjudication exports, counsel consent and revocation; no broad external access; no restricted government material ingested.
CIU-11 | S06–09,S12,S15 | Source profiling, versioned mappings, dry run, identity links, complete historical cases/documents, reconciliation, idempotent retry, quarantine and rollback; no fabricated success.
CIU-12 | S01,S17–18 | en-CA/fr-CA parity, responsive mobile, accessibility, no operational credentials in demo, institution-neutral labels.
CIU-13 | engineering | Load, isolation, security, observability, backup restoration, recovery, audit integrity, data export/deletion, failure injection; no false passes.
CIU-14 | delivery | Repeatable provisioning, implementation plan, security/privacy package, support/SLA proposal, commercial scope, discovery workbook, synthetic demonstration evidence; no unverified claims.

## Source-inspected residuals (not yet app-wide confirmed defects)
F01: apps/union-eyes/lib/integrations/integration-fabric-hooks.ts: processInboundCase maps and links using empty internalId then returns generated runId and success; trace all consumers to prove durable execution, domain persistence and identity link transaction before disposition.
F02: apps/union-eyes/lib/services/grievance-import-service.ts: normalization, fingerprint and tenant transaction present; inspected schema does not establish historical stages, documents, approvals, external references and deadline migration. Trace other paths before design changes.
F03: apps/union-eyes/lib/deadline-engine/reminder-scheduler.ts: caller must expand business-day offsets; trace agreement rule calculation and exact federal holiday/calendar exceptions. No generic 30-day fallback.
F04: apps/union-eyes/db/schema-organizations.ts: hierarchy enum has no explicit component/branch labels; prove configurable semantics and tenant/authority independence; do not introduce a fork.
F05: apps/union-eyes/lib/services/payroll-integration-service.ts: configurable CSV and reconciliation foundation; verify authorization, idempotency, durable postings and PSAC-specific identity mapping; live financial mandates remain prohibited until adopted.
F06: apps/union-eyes/db/schema/collective-agreements-schema.ts: version history foundation; verify binding to applicable historical rules and renewal handling.
F07: Intelivote connector and full WFA/VSSA journeys not established; assess reusable generic orchestration first.

## Synthetic qualification target (proposed, not client telemetry)
22 branches, 12,500 synthetic member records, five agreement groups, 5,000 synthetic cases, 30+ capacities, three governance terms, two languages, unrelated tenant, and load profiles 100/500/1,000 concurrent sessions. Establish measured SLOs and realistic workload distribution before load certification. Use isolated disposable test infrastructure only; staging execution subject to existing gates.

## Integration discovery contract
Inventory systems and owners; source identifiers and cardinalities; permitted transport and frequency; read/write authority per field; retention and classification; sample schema or sanitized records; mapping and conflict rules; cutover/coexistence; reconciliation and rollback acceptance. Candidate sources: PSAC membership, CIU grievance database, branch records, employer case references, identity, finance, Intelivote. Do not assume live API availability or employer access. Client-approved data handling agreement and credentials through secure channels only. No production data via sponsor.

## Evidence and release contract
For each requirement record exact source clause, owner, canonical capability ID, route/storage/authority trace, positive and denial test IDs, execution SHA, environment and evidence URI, observed result and residual. Classify SOURCE_INSPECTED, TEST_PROVEN, LOCAL_RUNTIME_PROVEN, STAGING_PROVEN, NOT_PROVEN or CLIENT_DISCOVERY. Only current execution evidence supports pass. Require complete clause inventory including both official languages and five agreement texts before CIU-00 freeze. No changes to existing release flags. Current: CIU_PUBLIC_DISCOVERY_INITIAL=YES; CIU_00_FREEZE=NO; CIU_RUNTIME_VALIDATION=NOT_EXECUTED; CIU_PRE_INTRODUCTION_GO=NO; STAGING_GO=HELD; PRODUCTION_GO=HELD. S2.02_PREIMAGE_COMPLETE=NO.
