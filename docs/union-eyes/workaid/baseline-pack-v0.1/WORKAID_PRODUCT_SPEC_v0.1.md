# WorkAid × Union Eyes — Operational Product Specification

**Version:** 0.1 — adversarial review candidate  
**Baseline:** 23 October 2026; Nzila OS `main` observed at `38a824918cf2e7d7cfb7fcb0e796cbde45433be8`  
**State:** DESIGN IN PROGRESS — NOT IMPLEMENTATION COMPLETE; NOT EXTERNAL PILOT APPROVAL  
**Owner boundary:** Union Eyes product/engineering; WorkAid confirms its professional operations; unions control their own institutional records.

## 1. Mission, product boundaries and outcomes

Build a reusable **External Specialist Coordination** capability in Union Eyes with **WorkAid — Ontario WSIB / WSIAT** as the first configured specialization. Avoid WorkAid-only assumptions in the platform kernel. WorkAid remains responsible for representation and professional judgments; Clio remains WorkAid's professional system of work, unless a future evidence-backed integration contract changes this. Union Eyes coordinates referrals and member-facing institutional continuity, not decisions or professional advice.

**Problem statement (WorkAid-reported, not yet independently measured):** approximately 95% of referrals lack requested materials; Clio reminders require repeated manual entry and do not deliver useful pop-up alerts; members lack understandable, permissioned case visibility; duplicate manual transcription consumes professional staff time. The WSIB file wait typically lasts 4–6 weeks for WorkAid, according to Domenic, and is a service observation rather than a rule.

**Outcome hypotheses:** increase first-pass complete referrals; reduce resubmission chases and time-to-acknowledgement; guarantee each outbound WSIB document has a tracked receipt-follow-up; reduce duplicate identity and claim-number typing; provide truthful, approved status; keep every prohibited document or datum inaccessible across all access paths; measure specialist administrative minutes per matter rather than promising savings.

### Explicit exclusions until a separately proven contract
- No automatic WSIB or WSIAT filing, deadline certification, legal sufficiency finding or legal advice.
- No claim of live Clio synchronization, automatic data export, or general medical-record mirroring.
- No unsupervised release of medical, legal, privileged or sensitive professional information.
- No real counterpart credentials, live medical data, production rollout or user migration as part of design preparation.
- No change to Union Eyes staging candidate, migration state, cloud resources or shared release branches.

## 2. Evidence and capability honesty

| Source | Verified reading | Design implication |
|---|---|---|
| Domenic's post-v2 correspondence | Seven work stages, four WorkAid authorization forms, government photo ID, all letters and claim numbers, 4–6 week file wait, next-day receipt calls, Clio gaps | Source for *desired* workflow, not deployed software evidence |
| `apps/union-eyes-demo/DEMO_SANDBOX_P0.md` | Four synthetic personas, matter/document grants, limited member visibility; explicitly `DEMO_CONFIGURED`, no counterpart credentials, no Clio connector | Reuse demo *ideas/tests*, not assume production feature completeness |
| `apps/union-eyes/db/schema/representation-authority-schema.ts` | Representation authority, external matter and document grants with lifecycle and permissions | Reuse after tenant/security verification; do not conflate authority with access |
| `apps/union-eyes/lib/deadline-engine/recipient-resolver.ts` | Current Phase A supports `grievance_deadlines`, **rejects `claim_deadlines`**, admin escalation not implemented | WSIB tasks and claim deadlines need a deliberately separate/reconciled contract |
| `apps/union-eyes/app/api/cases/intake/route.ts` | Existing CUPE-vocabulary grievance/case intake and idempotency | Do not reuse as WSIB-specific intake without independent domain and authorization tests |
| `docs/union-eyes/reality-remediation/30_UE_PRODUCTION_READINESS_20261021.md` on current main | Last documented `NO_GO`, RLS/identity/worker and workflow gates pending; not a fresh staging attestation | No customer-data execution or operational pilot until freshly proven |
| Official WSIB and WSIAT pages (sources in §13) | Different objection pathways/time limits; separate ITO per claim; Tribunal NOA requirements | Human-confirmed obligations, versioned policy basis, never one universal timer |

**Proof vocabulary:** `PROVEN_IN_REAL_RUNTIME`, `SOURCE_TESTED`, `DEMO_CONFIGURED`, `PROPOSED`, `UNVERIFIED` and `BLOCKED`. Do not use `READY`, `DEPLOYED` or `INTEGRATED` without supporting runtime evidence.

## 3. Personas and ownership

| Persona | Responsible domain | Typical permitted behaviour | Never infer |
|---|---|---|---|
| Union referral representative | Institutional referral and member support | Request and submit referral material, see receipt/completeness and approved status for their own union | WorkAid professional notes, raw medical details, unrelated members/locals |
| Union institutional administrator | Governance and accountability | Oversight of referrals and anonymized/authorized aggregate metrics | Blanket access to every professional document |
| Member/claimant | Their own account, actions and lawful access channels | Complete required forms, upload material, see released updates/documents and requests, request access/correction | Authority to read another claimant, or automated denial of statutory access rights |
| WorkAid specialist (Domenic) | Intake acceptance, professional WSIB work | Review packets, record receipt follow-up, create case and submission worklists, approve status disclosures | Automatically expanded access beyond signed representation and assigned matter |
| WorkAid principal (Angelo) | WorkAid supervision, exception escalation and WSIAT pathway | Caseload oversight; approve supervisory exceptions; validate tribunal stage requirements | Union tenant administration or cross-union raw medical access without necessity |
| UE platform operations/security | Infrastructure, verified tenant boundaries | Manage technical service health and traceable incidents | Automatic claim-data reading or consent bypass |

**Separation of powers:** representation authority, institutional responsibility, service-account credentials, technical access grants, document-release authority, and worker/member access rights are distinct, auditable dimensions. Revocation must invalidate *future* access and credentials; already-downloaded files cannot literally be recalled.

## 4. Canonical concepts (logical objects, not migration instructions)

1. `Person`: canonical identity inside correct organization; separate from external WSIB claimant identifiers and Clio contact reference.
2. `SpecialistReferral`: union-to-WorkAid invitation; intake requirements version; completeness state; sender; intended specialist; explicit offer/accept/return/decline trail.
3. `RepresentationMatter`: professional engagement coordination boundary. Referral is not acceptance, acceptance not legal authorization, technical view grant not acceptance of representation.
4. `WSIBClaim`: claim number (`string`, preserve exact format and leading zeros), member, owner, provenance, history state. One member may have many active/closed claims; historical claims must not be ignored.
5. `WSIBDecision`: *one record per separately identifiable decision or issue* with letter, date communicated, issues in dispute, applicable authority and reference; one claim has many decisions; one decision letter may cover multiple issues.
6. `Objection`: ITO and objection status associated with the relevant claim/decision issue(s), not a generic matter-wide checkbox. The official WSIB instructions require separate ITOs under each claim number when decisions under multiple claims are disputed; a single decision letter can address several entitlement issues. Domenic describes an ITO for every denial letter. The precise grouping within a single claim remains a WorkAid validation item, not an automatic `ITO_count = denial_letter_count` rule. Preserve amended/corrected and late/extension paths. Historical claims relating to other employers must not be automatically cross-referenced on a submitted ITO; WSIB worker instructions caution against including those numbers in the optional reasons section.
7. `AuthorizationEvidence`: WorkAid Client Intake Form, Medical Authorization, Retainer Agreement, Share Information Release, photo ID; plus WSIB Direction of Authorization and other representation instruments. Each has issuer, subject, scope, version, signature/provenance, validity and revocation.
8. `Document`: classification, source, uploader, claim/decision linkage, checksum, access policy, retention and immutable audit chain. Support duplicates, superseded versions, restricted professional material, identity documents and accidental cross-claim uploads.
9. `OutboundSubmission`: DOA, WRF, per-claim ITO, ARF plus written submission, WSIAT NOA, subsequent Confirmation of Appeal (COA) where applicable, or other professional dispatch. Contains object/version, destinations, intended recipient, human approval, `PREPARED -> APPROVED -> SENT_REPORTED -> RECEIPT_UNCONFIRMED -> RECEIVED_CONFIRMED|DELIVERY_EXCEPTION`; no automatic 'received' from a local send event.
10. `ReceiptFollowUpTask`: source submission, related matter and claim/decision, named owner, follow-up due date, context shortcut, reschedule reason, outcome, reminder delivery attempt and evidence; generated idempotently upon `SENT_REPORTED`.
11. `ExternalDependency`: e.g. WSIB claim file, ARF disposition, ARO decision, waiting since, owner, follow-up, received date and change history; 4–6 weeks is configurable operational guidance, **not legal deadline**.
12. `EvidenceRequest`: medical/non-medical, party authorized to request, request evidence, provenance, status. WorkAid may contact physicians only with appropriate valid authority.
13. `MemberStatusPublication`: plain-language, professionally/institutionally approved, audience, released timestamp, version, withdrawal/retraction record; never mirror the internal state machine directly.
14. `AccessGrant` and `DisclosureDecision`: explicit subject, organization, matter, document, purpose, data class, permitted action, authorizer, expiry/revocation, and audit. Worker access rights outside portal must remain available via appropriate process.
15. `ExternalSystemReference` and `IntegrationLedger`: Clio object key per tenant, mapping version, sync intent, input/output hash, status, replay key, error handling and reconciliation. A proposal only, not implemented.
16. `DeadlineObligation`: claim/decision/issue, event date(s), official rule provenance/version/effective window, timezone, calculated candidate, *human-confirmed* due date and exception/extension/supersession history.

**Identity invariant:** relationship joins use internal immutable keys plus organization scope; external claim numbers must never be assumed globally unique or serve as authorization keys. No client-controlled organization/person identifiers may establish grants.

## 5. State machines and transitions

### Referral
`DRAFT -> AWAITING_REQUIRED_ITEMS -> PACKET_COMPLETE_FOR_REVIEW -> OFFERED -> ACCEPTED | RETURNED_FOR_CORRECTION | DECLINED`. A packet may be *document-complete* while clinically/legally insufficient; WorkAid explicitly decides acceptability. Corrections loop without erasing prior evidence.

### Representation and professional phases
`AWAITING_AUTHORITY -> AUTHORIZED -> WSIB_DOCUMENTS_PREPARED -> REQUESTS_SENT -> AWAITING_WSIB_FILE -> FILE_RECEIVED -> EVIDENCE_DEVELOPMENT -> ARF_PREPARED -> ARF_SENT -> AWAITING_ARO -> ARO_DECIDED -> RESOLVED | WSIAT_ASSESSMENT -> WSIAT_NOTICE_PREPARED -> WSIAT_SUBMITTED -> TRIBUNAL_WORK -> CLOSED`. Model per-decision and per-claim child lifecycles so one matter can have overlapping decisions and submissions. The professional phases are a **proposal for validation**, not a state-machine migration.

### Submission, receipt and reminder
Manual send approval and dispatch acknowledgement are independent. `SENT_REPORTED` creates exactly one active initial next-day confirmation task per submission version, with local timezone/calendar rule configurable. A human records `RECEIVED_CONFIRMED` with method, actor, contact/evidence and time. No response -> `FOLLOW_UP_DUE` and escalation after approved business rules; a failed reminder is retried and visible, never silently counted as delivered. Superseded/withdrawn sends cancel or rebind follow-ups with audit.

### Document/publication
`QUARANTINED -> CLASSIFIED -> PROFESSIONAL_ONLY | UNION_RELEASE_APPROVED | MEMBER_RELEASE_APPROVED`. Reclassification requires explicit authorized action and audit; restricted material never appears in titles, previews, indexes, counts, email text, search autocomplete, thumbnails, exports or metadata to unauthorized roles. Avoid using alleged emotional fragility as a release rule. If a worker requests information outside portal publication, show the lawful access/request channel without obstruction.

## 6. WorkAid user journeys, first candidate

**J1 — Union referral to WorkAid:** union selects correct member and institution; identifies all current/prior claims (including closed); provides four WorkAid forms, government photo ID and all WSIB denials/correspondence; UI flags missing files, signatures, duplicates, unreadable scans and wrong-claim associations. Union can submit for clarification where urgency or professional exception is recorded even if packet is incomplete. WorkAid can accept/return/decline independently.

**J2 — Domenic prepares representation and objections:** creates/links Clio profile externally; records DOA + WRF and an ITO for each applicable claim/decision path; human confirms issues, date source, authority and target. Every submission version generates a receipt-confirmation task from its own reference; clicking it opens correct WorkAid context without retyping names/numbers. Physical transmission to WSIB stays manually recorded until a future connector is verified.

**J3 — Awaiting the file and evidence:** 4–6 week operational expectation shown as an adjustable forecast. WorkAid records receipt checks and outstanding documents, gets member sworn statement, requests medical material from member or authorized physicians, stores professional notes in Clio or appropriate restricted boundary, and updates a safe public status only after approval.

**J4 — ARF / ARO / WSIAT:** WorkAid professionally drafts ARF and written submissions; an authorized staff member records sending and receipt verification; while waiting on ARO, user sees next action/owner, not invented decision dates. The potential WSIAT path is conditional and owned for substantive validation by Angelo. Source-specific Notice of Appeal, required worker-appellant disclosure/signature steps, later Confirmation of Appeal (COA), and applicable time limits/exceptions require human confirmation. The WSIAT NOA is not equivalent to the WSIB ARF.

**J5 — Member account:** sees plain-language stage, assigned contact, completed approved milestones, what's requested and released documents. Medical/professional information not authorized for that surface is absent from *all* projections. Requests for fuller records go through a proper access request pathway rather than a silent or unlawful blanket denial.

**J6 — Principal & union:** Angelo sees workload, aging by stage, overdue tasks, intake quality, source of incomplete materials, escalations. Union sees only institutionally permissible metadata. Across-union management views must not expose WorkAid material from a different client institution without distinct lawful authority.

## 7. Permissions and data-minimization contract

Authorization evaluation order: authenticate session -> resolve **one scoped active membership** -> purpose + legitimate relationship -> matter authorization -> per-action grant -> document classification -> publication/release decision -> revocation check -> tenant-RLS enforcement -> redact response -> audit. Deny on any missing/contradictory context. All reads incl. search, notifications, PDFs, screenshots/thumbs, object-store URLs, reports, background jobs and mobile endpoints obey equivalent policy. Attribute propagation and query filtering must not rely on UI hiding controls.

**Default posture:** raw medical evidence, government ID, professional notes, privileged strategy and contact with clinicians remain in WorkAid-restricted storage/workflows unless a precise authorized exchange is confirmed. Do not send an entire Clio matter file to a union. Member release and union release are different decisions. Share-information form is not blanket, irrevocable permission for every union officer to see all documents.

## 8. Task ergonomics (specific rather than generic reminders)

- One action: **Confirm WSIB receipt** from a submitted DOA/WRF/ITO/ARF; task already contains member display name, matter, exact claim number, submission type/version and deep link (within user's authorized scope).
- Staff enter only what needs a call and choose or confirm target date. Configuration must resolve *calendar-day vs business-day*, local holiday schedule, and dispatches near midnight. Default must not fabricate Domenic's intent.
- Task states `OPEN`, `SNOOZED_WITH_REASON`, `IN_PROGRESS`, `RECEIPT_CONFIRMED`, `EXCEPTION_ESCALATED`, `CANCELLED_SUPERSEDED`; completion requires disposition and optionally evidence; owners cannot simply erase failures.
- Task UX supports due/overdue queue, focused filtering, keyboard/mobile interaction, bulk owner reassignment with audit, audit-safe in-app notification and fallback when browser permissions are disabled.
- Deliveries use durable outbox, dedupe key, retries, dead-letter handling, and observed sink receipts; clicking a notification rechecks authorization.

## 9. Integration policy and phased ownership

**First pilot candidate:** manually attested, minimally shared WorkAid status; Clio authoritative for professional file; no automatic Clio writeback. Need explicit designation of task-of-record to prevent *two separate work queues*. Preferred option to validate: WorkAid's own Clio professional work remains there; Union Eyes owns new **inter-institutional coordination and receipt-follow-up tasks** only if Domenic accepts that experience. If he needs everything in Clio, design one-way read or deep link first and do not create dual active follow-ups.

**Future Clio integration design:** validate official API capabilities, WorkAid consent/admin grant, rate limiting, field mapping, per-tenant credentials, OAuth refresh, webhook signing, event freshness, backfills, idempotency, conflict resolution, retry/dead-letter and withdrawal semantics; no medical binary sync by default. No implementation assumption from a commercial roadmap mention.

## 10. Operational, UX and compliance quality bars

- Data residency, retention, access request, breach response, medical privacy, privileged information, authorized representation, and audit/consent basis require Canadian legal/privacy review suited to these actual roles (do **not** assume a single statute governs every dataset).
- WCAG 2.2 AA targeted for public/member workflows; bilingual expansion planned subject to partner content validation. Plain English important even if FR localisation is deferred.
- Handle partial/incomplete data, inconsistent WSIB claim identifiers, two unions claiming a member, claim closures/reopenings, changed representation, superseded decisions, emergencies, wrong uploads, duplicate import, offline/failed delivery and mobile small screens.
- Every material workflow action records who, which tenant, which matter/claim, what happened, when, rule/evidence, source version, correlation and before/after state (without putting restricted content in logs).

## 11. Measurable success and release evidence

| Metric | Definition | Measurement guard |
|---|---|---|
| Referral first-pass completeness | WorkAid accepts packet without return / all referred packets | Do not equate checklist-complete with legally sufficient |
| Referral-to-accept median | AcceptedAt - firstSubmittedAt | Handle declined and withdrawn separately |
| Follow-up assurance | Sent outbound submissions with a tracked receipt follow-up / all sent outbound submissions | Distinguish task generated vs actually delivered vs receipt confirmed |
| Missed statutory obligation | A human-confirmed deadline passed without professional disposition | Zero-tolerance escalation; never claim zero risk without coverage |
| Context re-entry burden | Repeated manual claim/client fields per new task | Before/after task time study with Domenic |
| Member clarity | Status inquiries and avoidable confusion per active matter | Measure, do not infer clinical/emotional state |
| Confidentiality | Unauthorized access/projection/metadata exposures in tests and pilot | **Zero** allowed; fail-closed |
| Administrative load | WorkAid minutes per matter by stage | Compare comparable matter cohorts, avoid sales promises |

## 12. Definition of complete form

The specification is **DESIGN_COMPLETE** only if every substantive requirement is traced to owner, canonical data contract, role and permission rule, state transitions, acceptance test and negative test; unknown legal/WorkAid process decisions are either resolved or explicitly configured and non-misleading; a first-party reviewer can execute the case journeys in a synthetic environment with reproducible evidence; no critical/high adversarial finding remains without either fix or justified signed risk treatment. **IMPLEMENTATION_COMPLETE** adds running service, integrated tests, verified security, actual notification receipts, accessible browser acceptance and release evidence. **PILOT_READY** adds current platform/runtime GO, documented privacy and WorkAid permission basis, verified identities, support/incident plan and separately authorized real-data start. These three states are not interchangeable.

## 13. Authoritative external starting points (rules must be verified by professionals)

- WSIB worker forms — https://www.wsib.ca/en/forms (including Direction of Authorization, Worker Request for File, ITO).
- WSIB appeals practices — https://www.wsib.ca/en/appeals-practices-and-procedures (objection deadlines, variations, extensions, appeal process).
- WSIB worker ITO instructions — https://www.wsib.ca/en/document/worker-instruction-sheet-intent-object-form (separate ITOs across contested claims; multiple issues in a decision letter; do not include claim numbers arising at a different employer in ITO reasons; do not delay ITO while waiting for new information).
- WSIAT Practice Directions — https://wsiat.on.ca/en/print/pd/pdAllEnglish.pdf (NOA, worker disclosure/signature obligations, COA stage, general time limit and exception process; professionals must confirm currently applicable direction).
- WorkAid current operating requirements — Domenic's written response to v2, received 21 October 2026; partner validation still required for exact exceptions.

## 14. Unresolved product decisions for targeted validation (not blanket approval gates)

D-01: Does “next day” mean next calendar day or next working day? Who is alerted when a sent form is not acknowledged?  
D-02: Which system owns *WorkAid internal* task completion, and how will the other surface avoid duplicates?  
D-03: What is the authorized member information-release rule, who can approve/revoke, and how are records-access rights met?  
D-04: What does WorkAid regard as safe “packet complete” for urgent deadline cases missing forms?  
D-05: Per letter, issue or claim: precisely how many ITOs and related records are used for multiple denials within one claim, recognizing WSIB requires distinct ITOs when *different claims* are contested? Do not auto-populate different-employer claim numbers on ITO submissions.  
D-06: How are WSIAT NOA, worker disclosure/signature, COA/hearing readiness, supervision and client communications distributed between Angelo and Domenic?  
D-07: Does WorkAid want Clio read-only context, controlled data entry, or no integration for the pilot?  
D-08: How are members with prior unions or parallel representation managed without tenant leakage?  
D-09: Which communications remain WorkAid-only, including client statements, legal notes and mental-health material?  
D-10: What are the exact organizational permissions and lawful privacy/retention controls for each data class?  
D-11: When objection timelines and WSIB mail-disruption exception windows apply, which professional validates the applicable dated policy source?  
D-12: What subset of prior-claim numbers can appear on specific WSIB submissions without improperly exposing claims from another employer?
