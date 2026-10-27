# Representative 2.2 — Decision Package 2.2-R1

**Status: PROPOSED_FOR_RATIFICATION.** PROPOSED FOR RATIFICATION. This package is prepared for a decision by an authorized product owner. It is not a ratified canonical, not the recovered historical canonical and not an institutional authorization. Engineering cannot accept it.

- Package: `UE-REPRESENTATIVE-PROPOSED-CANONICAL-2.2-R1` version `2.2-R1`
- Package register: `docs/union-eyes/convergence/register/ue-persona-decision-package-representative-0c2.json`
- Package sha256: `e4dcbf3635b8807c9e923f2f12b5a1dc9b53196fadf864664393ff19f3af6861`
- Decision record: `PDR-0C2-REPRESENTATIVE-V1` state `PROPOSED_FOR_RATIFICATION`
- Decision-owner role: `AUTHORIZED_PRODUCT_OWNER`
- Source baseline: `docs/union-eyes/convergence/register/ue-persona-proposed-baseline-representative.json` (`34f3d145e945a11bf8cba049d16bd66998fe5ee2b2f6a3e817bdebfdf6b891d0`), unchanged, status `PROPOSED_NOT_ADOPTED`
- Historical canonical recovered: **no**. UE-REPRESENTATIVE-CANONICAL-2.2 is cited by a frozen disposition and its text was not recovered. This package is a reconstruction candidate built from the proposed baseline and is not that document.

## Action universe

67 requirements. Kinds: ACTION 25, DOMAIN 24, JOURNEY 7, NAVIGATION 7, SCENARIO 4. Authority classes: IMPLEMENTED_SOURCE_BEHAVIOR 28, PROPOSED_PERMISSION 39. Adopted institutional authorizations: 0.

## Visibility and workflow matrix (eleven domains)

| Domain | Coverage | Requirements | Open product decision |
| --- | --- | --- | --- |
| Identity and eligibility | COVERED | REP-ACT-25, R01, R24 | _none_ |
| Organization and federation scope | PARTIAL | R12, R16, REP-SCN-CAPE, REP-SCN-CUPE, REP-SCN-LIUNA, REP-SCN-SMALL-LOCAL | DEC-PD-0C2-04 |
| Case, member and document visibility | COVERED | REP-NAV-1, REP-NAV-2, REP-NAV-3, REP-NAV-4, REP-NAV-5, REP-NAV-6, REP-NAV-7, REP-ACT-01, REP-ACT-10, REP-ACT-11, REP-ACT-15, REP-ACT-23, R09, R13, R20 | _none_ |
| Record creation and updates | COVERED | REP-ACT-03, REP-ACT-06, REP-ACT-07, REP-ACT-08, REP-ACT-12, REP-ACT-14, REP-ACT-18, REP-ACT-19, R02, R03, R04, R06, R07, R10, R11, R14, R15, R17, R21 | _none_ |
| Delegation and substitution | COVERED | REP-ACT-04, REP-ACT-05, REP-ACT-22, R08, R22 | _none_ |
| Confidentiality and privileged records | COVERED | REP-ACT-16, REP-ACT-17 | _none_ |
| Financial or administrative approvals | PARTIAL | REP-ACT-13, REP-ACT-20 | DEC-PD-0C2-05 |
| Audit and accountability | COVERED | R19, R23 | _none_ |
| Notifications and workflow transitions | COVERED | REP-ACT-02, R05, REP-JRN-A, REP-JRN-B, REP-JRN-C, REP-JRN-D, REP-JRN-E, REP-JRN-F, REP-JRN-G | _none_ |
| Revocation, termination and historical access | PARTIAL | REP-ACT-09 | DEC-PD-0C2-06 |
| Cross-persona handoffs | COVERED | REP-ACT-21, REP-ACT-24, R18 | _none_ |

- **Identity and eligibility** (COVERED): A live membership in the active organization is eligibility only. Triage, assignment, collaboration and approval each need a separate issued instrument or a case relationship. Nothing is inferred from the role name or seniority.
- **Organization and federation scope** (PARTIAL): Scope dimensions are named and held inactive until an institution adopts them. Workplace and bargaining-unit context is NOT_IMPLEMENTED, and the institutional scenarios have no source backing. Scope is never inferred from office or seniority.
- **Case, member and document visibility** (COVERED): Case queues, detail, member profiles, documents and the member-visible projection are filtered by the live case relationship or designation. Triage sees metadata only and cannot open the case.
- **Record creation and updates** (COVERED): Notes, state advances, correspondence drafts, evidence and meeting records are written on held cases with an atomic audit record. Claim and grievance transitions are the two implemented paths.
- **Delegation and substitution** (COVERED): Collaborator delegation and revocation, supervisory assignment, transfer with continuity and the recusal, territory, privileged-matter and delegation controls are specified. The controls themselves are UNDECIDED_INSTITUTIONAL_OFFICE and need adoption.
- **Confidentiality and privileged records** (COVERED): Privileged material is excluded by default. Legal hold, retention and sealed evidence export need a governance mandate or the primary handler, and each disclosure to the member is a separate affirmative act.
- **Financial or administrative approvals** (PARTIAL): Correspondence approval, dispatch and senior review are administrative approvals held by an unnamed institutional office. The package has no explicit financial denial, unlike the Steward and Financial Officer packages.
- **Audit and accountability** (COVERED): Mutations commit with an audit record, sensitive reads are logged, the accountability view shows who did what and workload reporting is limited to what the viewer may see.
- **Notifications and workflow transitions** (COVERED): Tasks, deadlines, reminders, handover, correspondence states and WorkAid milestones are specified. Overdue handling rests on a scheduler and institutional rules that do not exist yet.
- **Revocation, termination and historical access** (PARTIAL): Collaborator revocation, continuity on transfer and mandate identity are specified. The end of a representative’s own mandate and any historical access for a former representative are not.
- **Cross-persona handoffs** (COVERED): Senior review, closure and transfer with continuity, WorkAid referral, the member-visible projection and the outcomes and precedent record name their counterpart persona.

## Action and visibility rows

| Requirement | Kind | Domain | Authority class | Implementation | Gate |
| --- | --- | --- | --- | --- | --- |
| REP-NAV-1 | NAVIGATION | CASE_MEMBER_DOCUMENT_VISIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 10 |
| REP-NAV-2 | NAVIGATION | CASE_MEMBER_DOCUMENT_VISIBILITY | PROPOSED_PERMISSION | SOURCE_PRESENT | 10 |
| REP-NAV-3 | NAVIGATION | CASE_MEMBER_DOCUMENT_VISIBILITY | PROPOSED_PERMISSION | PARTIAL_SOURCE | 10 |
| REP-NAV-4 | NAVIGATION | CASE_MEMBER_DOCUMENT_VISIBILITY | PROPOSED_PERMISSION | SOURCE_PRESENT | 11 |
| REP-NAV-5 | NAVIGATION | CASE_MEMBER_DOCUMENT_VISIBILITY | PROPOSED_PERMISSION | SOURCE_PRESENT | 6 |
| REP-NAV-6 | NAVIGATION | CASE_MEMBER_DOCUMENT_VISIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| REP-NAV-7 | NAVIGATION | CASE_MEMBER_DOCUMENT_VISIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 10 |
| REP-ACT-01 | ACTION | CASE_MEMBER_DOCUMENT_VISIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 10 |
| REP-ACT-02 | ACTION | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | PARTIAL_SOURCE | 4 |
| REP-ACT-03 | ACTION | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 4 |
| REP-ACT-04 | ACTION | DELEGATION_SUBSTITUTION | PROPOSED_PERMISSION | SOURCE_PRESENT | 2 |
| REP-ACT-05 | ACTION | DELEGATION_SUBSTITUTION | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 2 |
| REP-ACT-06 | ACTION | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | PARTIAL_SOURCE | 4 |
| REP-ACT-07 | ACTION | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 4 |
| REP-ACT-08 | ACTION | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 4 |
| REP-ACT-09 | ACTION | REVOCATION_TERMINATION_HISTORY | PROPOSED_PERMISSION | PARTIAL_SOURCE | 2 |
| REP-ACT-10 | ACTION | CASE_MEMBER_DOCUMENT_VISIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| REP-ACT-11 | ACTION | CASE_MEMBER_DOCUMENT_VISIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| REP-ACT-12 | ACTION | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 11 |
| REP-ACT-13 | ACTION | FINANCIAL_ADMIN_APPROVALS | PROPOSED_PERMISSION | PARTIAL_SOURCE | 11 |
| REP-ACT-14 | ACTION | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 11 |
| REP-ACT-15 | ACTION | CASE_MEMBER_DOCUMENT_VISIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 6 |
| REP-ACT-16 | ACTION | CONFIDENTIALITY_PRIVILEGED | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 6 |
| REP-ACT-17 | ACTION | CONFIDENTIALITY_PRIVILEGED | PROPOSED_PERMISSION | PARTIAL_SOURCE | 6 |
| REP-ACT-18 | ACTION | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | PARTIAL_SOURCE | 10 |
| REP-ACT-19 | ACTION | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | SOURCE_PRESENT | 4 |
| REP-ACT-20 | ACTION | FINANCIAL_ADMIN_APPROVALS | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 10 |
| REP-ACT-21 | ACTION | CROSS_PERSONA_HANDOFFS | PROPOSED_PERMISSION | PARTIAL_SOURCE | 2 |
| REP-ACT-22 | ACTION | DELEGATION_SUBSTITUTION | PROPOSED_PERMISSION | PARTIAL_SOURCE | 10 |
| REP-ACT-23 | ACTION | CASE_MEMBER_DOCUMENT_VISIBILITY | PROPOSED_PERMISSION | PARTIAL_SOURCE | 10 |
| REP-ACT-24 | ACTION | CROSS_PERSONA_HANDOFFS | PROPOSED_PERMISSION | PARTIAL_SOURCE | 7 |
| REP-ACT-25 | ACTION | IDENTITY_ELIGIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| R01 | DOMAIN | IDENTITY_ELIGIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| R02 | DOMAIN | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| R03 | DOMAIN | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 10 |
| R04 | DOMAIN | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| R05 | DOMAIN | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | PARTIAL_SOURCE | 10 |
| R06 | DOMAIN | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | SOURCE_PRESENT | 10 |
| R07 | DOMAIN | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | SOURCE_PRESENT | 10 |
| R08 | DOMAIN | DELEGATION_SUBSTITUTION | PROPOSED_PERMISSION | SOURCE_PRESENT | 10 |
| R09 | DOMAIN | CASE_MEMBER_DOCUMENT_VISIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| R10 | DOMAIN | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | PARTIAL_SOURCE | 10 |
| R11 | DOMAIN | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| R12 | DOMAIN | ORG_FEDERATION_SCOPE | PROPOSED_PERMISSION | PARTIAL_SOURCE | 10 |
| R13 | DOMAIN | CASE_MEMBER_DOCUMENT_VISIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 6 |
| R14 | DOMAIN | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | PARTIAL_SOURCE | 10 |
| R15 | DOMAIN | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| R16 | DOMAIN | ORG_FEDERATION_SCOPE | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 10 |
| R17 | DOMAIN | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| R18 | DOMAIN | CROSS_PERSONA_HANDOFFS | PROPOSED_PERMISSION | PARTIAL_SOURCE | 7 |
| R19 | DOMAIN | AUDIT_ACCOUNTABILITY | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| R20 | DOMAIN | CASE_MEMBER_DOCUMENT_VISIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| R21 | DOMAIN | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| R22 | DOMAIN | DELEGATION_SUBSTITUTION | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 10 |
| R23 | DOMAIN | AUDIT_ACCOUNTABILITY | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 10 |
| R24 | DOMAIN | IDENTITY_ELIGIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| REP-JRN-A | JOURNEY | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 10 |
| REP-JRN-B | JOURNEY | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 10 |
| REP-JRN-C | JOURNEY | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 10 |
| REP-JRN-D | JOURNEY | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 10 |
| REP-JRN-E | JOURNEY | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 10 |
| REP-JRN-F | JOURNEY | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 10 |
| REP-JRN-G | JOURNEY | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 10 |
| REP-SCN-CAPE | SCENARIO | ORG_FEDERATION_SCOPE | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 10 |
| REP-SCN-CUPE | SCENARIO | ORG_FEDERATION_SCOPE | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 10 |
| REP-SCN-LIUNA | SCENARIO | ORG_FEDERATION_SCOPE | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 10 |
| REP-SCN-SMALL-LOCAL | SCENARIO | ORG_FEDERATION_SCOPE | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 10 |

## Negative security and tenant-isolation criteria

- **NSC-REP-01** (TENANT_ISOLATION): In a synthetic two-organization fixture, a representative of organization A cannot read, list, search or export a case, member, document or conversation of organization B, and receives no existence signal. Requirements: REP-ACT-01, REP-ACT-03, REP-ACT-10, REP-ACT-11, REP-ACT-15, R09.
- **NSC-REP-02** (SENIORITY_IS_NOT_SCOPE): A senior or supervising representative gains no territory, unit or organization scope from office or seniority. Scope exists only as an issued instrument. Requirements: R22, REP-ACT-22, R16.
- **NSC-REP-03** (TRIAGE_IS_METADATA_ONLY): A triage designee sees intake metadata only and cannot open the case, its documents or its notes. Requirements: REP-ACT-02, R05.
- **NSC-REP-04** (ASSIGNMENT_NEEDS_MANDATE): Seeing the unassigned queue is not a power to assign. Assignment and self-assignment are refused without a live supervisory mandate that covers the case. Requirements: REP-ACT-04, REP-ACT-05, R08.
- **NSC-REP-05** (CONFLICT_PRECEDES_AUTHORITY): A recusal or adverse-party status on a case denies every action on it before any source of authority is consulted. Requirements: REP-ACT-22, R22.
- **NSC-REP-06** (PRIVILEGED_EXCLUDED): Privileged material is excluded from representative reads and from the member-visible projection unless a separate disclosure decision is recorded. Requirements: REP-ACT-15, REP-ACT-16, REP-ACT-17, REP-ACT-23.
- **NSC-REP-07** (DISPOSITION_IS_NOT_DISPATCH): Approval, dispatch, delivery and receipt of formal correspondence are distinct states, and a draft is never recorded as dispatched. Requirements: REP-ACT-12, REP-ACT-13, R12.
- **NSC-REP-08** (REVOKED_DELEGATION): After a collaborator grant is revoked, the next read or comment on the case is refused and the revocation is audited. Requirements: REP-ACT-09.
- **NSC-REP-09** (ATOMIC_AUDIT): If the audit record cannot be written, the representative mutation is rolled back and nothing persists. Requirements: REP-ACT-06, REP-ACT-07, REP-ACT-08.

## Dependencies on other personas

- financial-officer via SHARED_OBLIGATION: SHR-0C2-LANGUAGE-ACCESSIBILITY, SHR-0C2-WORKAID-REFERRAL
- steward via RELATED_REQUIREMENT: R01->STW-NAV-2, R02->STW-ACT-02, R03->STW-ACT-28, R05->STW-ACT-28, R08->STW-ACT-04, R09->STW-ACT-34, R11->STW-ACT-25, R11->STW-ACT-26, R12->STW-ACT-27, R13->STW-ACT-13, R14->STW-ACT-21, R15->STW-ACT-36, R15->STW-ACT-37, R18->STW-ACT-32, R19->STW-ACT-03, R22->STW-ACT-05, R24->STW-ACT-40, REP-ACT-01->STW-ACT-01, REP-ACT-02->STW-ACT-28, REP-ACT-03->STW-ACT-06, REP-ACT-03->STW-ACT-07, REP-ACT-03->STW-ACT-14, REP-ACT-04->STW-DENY-02, REP-ACT-05->STW-ACT-30, REP-ACT-06->STW-ACT-08, REP-ACT-06->STW-ACT-09, REP-ACT-07->STW-ACT-10, REP-ACT-08->STW-ACT-10, REP-ACT-09->STW-ACT-20, REP-ACT-10->STW-ACT-34, REP-ACT-11->STW-ACT-35, REP-ACT-12->STW-ACT-27, REP-ACT-13->STW-DENY-05, REP-ACT-14->STW-ACT-25, REP-ACT-15->STW-ACT-39, REP-ACT-16->STW-ACT-38, REP-ACT-17->STW-ACT-14, REP-ACT-17->STW-DENY-07, REP-ACT-18->STW-ACT-21, REP-ACT-18->STW-ACT-22, REP-ACT-18->STW-ACT-23, REP-ACT-18->STW-ACT-24, REP-ACT-18->STW-ACT-33, REP-ACT-19->STW-ACT-18, REP-ACT-20->STW-ACT-19, REP-ACT-21->STW-ACT-11, REP-ACT-21->STW-ACT-33, REP-ACT-22->STW-ACT-05, REP-ACT-22->STW-DENY-03, REP-ACT-22->STW-DENY-08, REP-ACT-23->STW-ACT-09, REP-ACT-23->STW-ACT-17, REP-ACT-24->STW-ACT-32, REP-ACT-25->STW-ACT-40, REP-NAV-1->STW-NAV-1, REP-NAV-2->STW-NAV-2, REP-NAV-3->STW-NAV-3, REP-NAV-4->STW-NAV-4, REP-NAV-5->STW-NAV-5, REP-NAV-6->STW-NAV-6, REP-NAV-7->STW-NAV-7
- steward via SHARED_OBLIGATION: SHR-0C2-CASE-ASSIGNMENT, SHR-0C2-CORRESPONDENCE, SHR-0C2-DEADLINES, SHR-0C2-ESCALATION, SHR-0C2-EVIDENCE-DOCUMENTS, SHR-0C2-LANGUAGE-ACCESSIBILITY, SHR-0C2-MEMBER-DIRECTORY, SHR-0C2-NAVIGATION, SHR-0C2-WORKAID-REFERRAL

## Outstanding product decisions

- `DEC-IA-03` Who may assign or route cases (OUTSTANDING)
- `DEC-IA-07` Recusal lifting and conflict adjudication (OUTSTANDING)
- `DEC-IA-08` Temporary delegation, substitute coverage and succession (OUTSTANDING)
- `DEC-IA-09` Senior review and approval authority (OUTSTANDING)
- `DEC-IA-10` Territory and bargaining-unit mandates per operating model (OUTSTANDING)
- `DEC-IA-11` Representation protocol approval (OUTSTANDING)
- `DEC-PD-01` Steward as a distinct persona (OUTSTANDING)
- `DEC-PD-03` Default visibility of working notes (OUTSTANDING)
- `DEC-PD-04` Intake classification (OUTSTANDING)
- `DEC-PD-05` Assignment acknowledgement and handoff summary (OUTSTANDING)
- `DEC-PD-06` Representative R-domain meanings (OUTSTANDING)
- `DEC-PD-07` R18 status vocabulary (OUTSTANDING)
- `DEC-PD-08` Journeys A–G acceptance form (OUTSTANDING)
- `DEC-PD-12` Deadline extension workflow (OUTSTANDING)
- `DEC-PD-14` Organization scenario coverage (OUTSTANDING)
- `DEC-PD-0C2-04` Representative scope across federations and affiliated organizations (OUTSTANDING)
- `DEC-PD-0C2-05` Explicit denial of financial authority for the representative (OUTSTANDING)
- `DEC-PD-0C2-06` Former representative access and mandate termination (OUTSTANDING)
- `DEC-PD-0C2-10` Order of product acceptance and the Steward structure (OUTSTANDING)

## Outstanding institutional authority decisions

These are institutional decisions. A product acceptance of this package cannot issue them. They are outstanding and stay so.

- `DEC-IA-01` Who holds a triage designation (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-02` Self-assignment from triage (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-03` Who may assign or route cases (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-04` Who may close a case (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-05` Member-disclosable labels (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-06` Privileged-matter access grants (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-07` Recusal lifting and conflict adjudication (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-08` Temporary delegation, substitute coverage and succession (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-09` Senior review and approval authority (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-10` Territory and bargaining-unit mandates per operating model (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-11` Representation protocol approval (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-12` WorkAid referral authority and consent wording (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-13` Deadline extension approval (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-14` Correspondence approval, signature and dispatch (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-15` Conversation legal hold and retention (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)

## Known source gaps and irreducible historical uncertainty

- `GAP-REP-CANONICAL-CITED-NOT-RECOVERED` (IRREDUCIBLE_HISTORICAL): UE-REPRESENTATIVE-CANONICAL-2.2 is cited as FROZEN by a disposition and exists in no ref. The package is a reconstruction candidate and is not that document.
- `GAP-REP-R-RANGE` (IRREDUCIBLE_HISTORICAL): The first disposition carried the R01 to R24 matrix and was rewritten. Only R01, R02, R09, R13, R14, R15 and R18 carry their own titles. The other seventeen share group labels, and pairing a label to an identifier is an inference.
- `GAP-REP-R18-CONFLICT` (IRREDUCIBLE_HISTORICAL): R18 is recorded BLOCKED in the first disposition and MISSING in the second. The conflict is preserved, not resolved. Both agree nothing is operational.
- `GAP-REP-JOURNEYS-UNDEFINED` (IRREDUCIBLE_HISTORICAL): Journeys A to G and the institutional scenario proofs are named by range only. No journey or scenario is defined in any source.

Historical evidence by class: DIRECT_INDIVIDUAL 39, GROUP_LABEL_ONLY 8, NAME_RANGE_ONLY 11, STATUS_ONLY 9.

## Implementation obligations by engineering gate

- Gate 2 (Case ownership and representation): 4 requirements. NOT_IMPLEMENTED 1, PARTIAL_SOURCE 2, SOURCE_PRESENT 1.
- Gate 4 (Claims/grievances convergence): 6 requirements. PARTIAL_SOURCE 4, SOURCE_PRESENT 2.
- Gate 6 (Documents, privacy and records): 5 requirements. PARTIAL_SOURCE 3, SOURCE_PRESENT 2.
- Gate 7 (WorkAid union-side completion): 2 requirements. PARTIAL_SOURCE 2.
- Gate 10 (Frozen persona journeys): 46 requirements. NOT_IMPLEMENTED 14, PARTIAL_SOURCE 23, SOURCE_PRESENT 9.
- Gate 11 (Member/staff messaging): 4 requirements. PARTIAL_SOURCE 3, SOURCE_PRESENT 1.

Obligations to build and prove. Nothing here claims an implementation, a security status or a runtime qualification.

## Decision options

- **APPROVE** → `ACCEPTED_BY_AUTHORIZED_PRODUCT_OWNER`. Establishes the named artifact version as the engineering canonical for this persona. Settles or explicitly defers each listed product decision. Issues no institutional authority and activates nothing.
- **REJECT** → `REJECTED_BY_AUTHORIZED_PRODUCT_OWNER`. The artifact version is not the engineering canonical. The persona stays unresolved and its Gate 0 blocker stays.
- **RETURN_FOR_REWORK** → `RETURNED_FOR_REWORK`. The named reasons are recorded and a new artifact version is prepared. The returned version stays preserved.

A product approval does not:

- Issue, approve or activate any of the 79 outstanding institutional decisions or the 32 baseline institutional authority decisions.
- Issue a financial mandate, a triage designation, a supervisory mandate, a delegation, an appointment or any other instrument.
- Create, name or fill an institutional office, including a steward office.
- Change an implementation status, a security status, a release disposition or a runtime qualification status.
- Resolve any ratchet, test or route defect.

