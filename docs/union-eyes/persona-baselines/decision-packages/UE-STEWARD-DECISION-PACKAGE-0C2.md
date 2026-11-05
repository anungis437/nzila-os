# Steward — Decision Package 1.0-R1

**Status: PROPOSED_FOR_RATIFICATION.** PROPOSED FOR RATIFICATION. This package is prepared for a decision by an authorized product owner. It is not a ratified canonical, not the recovered historical canonical and not an institutional authorization. Engineering cannot accept it.

- Package: `UE-STEWARD-PROPOSED-CANONICAL-R1` version `1.0-R1`
- Package register: `docs/union-eyes/convergence/register/ue-persona-decision-package-steward-0c2.json`
- Package sha256: `a01076343d199a98554756e577edabb8150fec6353baddab749d6efe00fa9cea`
- Decision record: `PDR-0C2-STEWARD-V1` state `PROPOSED_FOR_RATIFICATION`
- Decision-owner role: `AUTHORIZED_PRODUCT_OWNER`
- Source baseline: `docs/union-eyes/convergence/register/ue-persona-proposed-baseline-steward.json` (`9b7eae86da9598160abb6aae144e8cbcfef1fe12cc465a4fcaab1a084a03d207`), unchanged, status `PROPOSED_NOT_ADOPTED`
- Historical canonical recovered: **no**. No Steward canonical exists in any scanned reference. This package is a new design and is not a recovered historical document.

## Action universe

55 requirements. Kinds: ACTION 40, DENIAL 8, NAVIGATION 7. Authority classes: ENGINEERING_REQUIREMENT 3, IMPLEMENTED_SOURCE_BEHAVIOR 34, PROPOSED_PERMISSION 18. Adopted institutional authorizations: 0.

## Visibility and workflow matrix (eleven domains)

| Domain | Coverage | Requirements | Open product decision |
| --- | --- | --- | --- |
| Identity and eligibility | COVERED | STW-ACT-40, STW-DENY-04, STW-DENY-05 | _none_ |
| Organization and federation scope | PARTIAL | STW-DENY-01 | DEC-PD-0C2-02 |
| Case, member and document visibility | COVERED | STW-NAV-1, STW-NAV-2, STW-NAV-3, STW-NAV-4, STW-NAV-5, STW-NAV-6, STW-NAV-7, STW-ACT-13, STW-ACT-14, STW-ACT-15, STW-ACT-16, STW-ACT-34, STW-ACT-36, STW-ACT-39 | _none_ |
| Record creation and updates | COVERED | STW-ACT-01, STW-ACT-02, STW-ACT-03, STW-ACT-04, STW-ACT-06, STW-ACT-07, STW-ACT-08, STW-ACT-09, STW-ACT-10, STW-ACT-11, STW-ACT-12, STW-ACT-18, STW-ACT-21, STW-ACT-22, STW-ACT-23, STW-ACT-24, STW-ACT-25, STW-ACT-26, STW-ACT-27, STW-ACT-35, STW-ACT-37 | _none_ |
| Delegation and substitution | PARTIAL | STW-ACT-30, STW-ACT-31, STW-DENY-02 | DEC-PD-0C2-03 |
| Confidentiality and privileged records | COVERED | STW-ACT-17, STW-ACT-38, STW-DENY-03, STW-DENY-07 | _none_ |
| Financial or administrative approvals | COVERED | STW-DENY-06 | _none_ |
| Audit and accountability | COVERED | STW-ACT-05, STW-DENY-08 | _none_ |
| Notifications and workflow transitions | COVERED | STW-ACT-28, STW-ACT-29 | _none_ |
| Revocation, termination and historical access | GAP | STW-ACT-20 | DEC-PD-0C2-01 |
| Cross-persona handoffs | COVERED | STW-ACT-19, STW-ACT-32, STW-ACT-33 | _none_ |

- **Identity and eligibility** (COVERED): Eligibility is a live membership in the active organization that carries the steward platform role. The role is eligibility for a representation capacity and never authority. The Steward workspace is a presentation profile. No institutional office is named or implied.
- **Organization and federation scope** (PARTIAL): Every steward contract is bounded to the active organization and to matters the steward holds. No federation, local or territory dimension is specified, and none may be read from the hierarchy.
- **Case, member and document visibility** (COVERED): A steward sees a case, its timeline, its evidence list and its members only through a live owner, assignee or explicit collaborator relationship to that case. The role title and organization membership alone show nothing.
- **Record creation and updates** (COVERED): Notes, comments, drafts, evidence uploads, document annotations, task completion and in-authority case transitions are written only on a held case, each with an atomic audit record.
- **Delegation and substitution** (PARTIAL): A steward may grant a collaborator on a case the steward owns and may prepare a handoff summary. Assignment and reassignment need a supervisory mandate and are denied from the role. No absence cover is specified.
- **Confidentiality and privileged records** (COVERED): Privileged and counsel-controlled material is excluded from steward reads, search, extraction and export. Staff-held records reach the member only through a separate authorized disclosure by the primary handler.
- **Financial or administrative approvals** (COVERED): The steward holds no financial, administrative, correspondence-approval or retention authority. Each is an explicit denial, and the steward may only draft and submit correspondence for approval by an unnamed office.
- **Audit and accountability** (COVERED): Every steward mutation commits with an audit record, sensitive reads are logged and a refusal is recorded. A recusal is declared by the steward and cannot be lifted by the recused steward.
- **Notifications and workflow transitions** (COVERED): Assignment acknowledgement, deadline completion, extension requests and overdue reminders are specified as workflow steps. Several rest on a scheduler that does not exist in source and on institutional rules.
- **Revocation, termination and historical access** (GAP): Only the revocation of a collaborator grant and the recusal denial are specified. The end of an assignment, removal of the role, departure and historical read access are not specified.
- **Cross-persona handoffs** (COVERED): Triage ownership, routing, senior review, WorkAid referral with consent, correspondence submission and the handoff summary each name the Representative 2.2 or WorkAid counterpart they hand to.

## Action and visibility rows

| Requirement | Kind | Domain | Authority class | Implementation | Gate |
| --- | --- | --- | --- | --- | --- |
| STW-NAV-1 | NAVIGATION | CASE_MEMBER_DOCUMENT_VISIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 10 |
| STW-NAV-2 | NAVIGATION | CASE_MEMBER_DOCUMENT_VISIBILITY | PROPOSED_PERMISSION | SOURCE_PRESENT | 10 |
| STW-NAV-3 | NAVIGATION | CASE_MEMBER_DOCUMENT_VISIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 10 |
| STW-NAV-4 | NAVIGATION | CASE_MEMBER_DOCUMENT_VISIBILITY | PROPOSED_PERMISSION | SOURCE_PRESENT | 10 |
| STW-NAV-5 | NAVIGATION | CASE_MEMBER_DOCUMENT_VISIBILITY | PROPOSED_PERMISSION | SOURCE_PRESENT | 10 |
| STW-NAV-6 | NAVIGATION | CASE_MEMBER_DOCUMENT_VISIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 10 |
| STW-NAV-7 | NAVIGATION | CASE_MEMBER_DOCUMENT_VISIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 10 |
| STW-ACT-01 | ACTION | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 4 |
| STW-ACT-02 | ACTION | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| STW-ACT-03 | ACTION | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 4 |
| STW-ACT-04 | ACTION | RECORD_CREATION_UPDATE | ENGINEERING_REQUIREMENT | NOT_IMPLEMENTED | 2 |
| STW-ACT-05 | ACTION | AUDIT_ACCOUNTABILITY | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 10 |
| STW-ACT-06 | ACTION | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 4 |
| STW-ACT-07 | ACTION | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 4 |
| STW-ACT-08 | ACTION | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | PARTIAL_SOURCE | 4 |
| STW-ACT-09 | ACTION | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | PARTIAL_SOURCE | 4 |
| STW-ACT-10 | ACTION | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| STW-ACT-11 | ACTION | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 4 |
| STW-ACT-12 | ACTION | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 11 |
| STW-ACT-13 | ACTION | CASE_MEMBER_DOCUMENT_VISIBILITY | PROPOSED_PERMISSION | PARTIAL_SOURCE | 6 |
| STW-ACT-14 | ACTION | CASE_MEMBER_DOCUMENT_VISIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 6 |
| STW-ACT-15 | ACTION | CASE_MEMBER_DOCUMENT_VISIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 6 |
| STW-ACT-16 | ACTION | CASE_MEMBER_DOCUMENT_VISIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 6 |
| STW-ACT-17 | ACTION | CONFIDENTIALITY_PRIVILEGED | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 6 |
| STW-ACT-18 | ACTION | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | SOURCE_PRESENT | 4 |
| STW-ACT-19 | ACTION | CROSS_PERSONA_HANDOFFS | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 10 |
| STW-ACT-20 | ACTION | REVOCATION_TERMINATION_HISTORY | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 2 |
| STW-ACT-21 | ACTION | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| STW-ACT-22 | ACTION | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| STW-ACT-23 | ACTION | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 10 |
| STW-ACT-24 | ACTION | RECORD_CREATION_UPDATE | ENGINEERING_REQUIREMENT | NOT_IMPLEMENTED | 9 |
| STW-ACT-25 | ACTION | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 11 |
| STW-ACT-26 | ACTION | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 11 |
| STW-ACT-27 | ACTION | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | PARTIAL_SOURCE | 11 |
| STW-ACT-28 | ACTION | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | SOURCE_PRESENT | 2 |
| STW-ACT-29 | ACTION | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | SOURCE_PRESENT | 11 |
| STW-ACT-30 | ACTION | DELEGATION_SUBSTITUTION | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 2 |
| STW-ACT-31 | ACTION | DELEGATION_SUBSTITUTION | PROPOSED_PERMISSION | SOURCE_PRESENT | 2 |
| STW-ACT-32 | ACTION | CROSS_PERSONA_HANDOFFS | PROPOSED_PERMISSION | PARTIAL_SOURCE | 7 |
| STW-ACT-33 | ACTION | CROSS_PERSONA_HANDOFFS | ENGINEERING_REQUIREMENT | NOT_IMPLEMENTED | 2 |
| STW-ACT-34 | ACTION | CASE_MEMBER_DOCUMENT_VISIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| STW-ACT-35 | ACTION | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| STW-ACT-36 | ACTION | CASE_MEMBER_DOCUMENT_VISIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| STW-ACT-37 | ACTION | RECORD_CREATION_UPDATE | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| STW-ACT-38 | ACTION | CONFIDENTIALITY_PRIVILEGED | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 6 |
| STW-ACT-39 | ACTION | CASE_MEMBER_DOCUMENT_VISIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 13 |
| STW-ACT-40 | ACTION | IDENTITY_ELIGIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | PARTIAL_SOURCE | 10 |
| STW-DENY-01 | DENIAL | ORG_FEDERATION_SCOPE | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 10 |
| STW-DENY-02 | DENIAL | DELEGATION_SUBSTITUTION | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 10 |
| STW-DENY-03 | DENIAL | CONFIDENTIALITY_PRIVILEGED | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 10 |
| STW-DENY-04 | DENIAL | IDENTITY_ELIGIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 10 |
| STW-DENY-05 | DENIAL | IDENTITY_ELIGIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 10 |
| STW-DENY-06 | DENIAL | FINANCIAL_ADMIN_APPROVALS | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 10 |
| STW-DENY-07 | DENIAL | CONFIDENTIALITY_PRIVILEGED | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 10 |
| STW-DENY-08 | DENIAL | AUDIT_ACCOUNTABILITY | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 10 |

## Negative security and tenant-isolation criteria

- **NSC-STW-01** (TENANT_ISOLATION): In a synthetic two-organization fixture, a steward of organization A who holds live relationships in A addresses every read action to resources of organization B and receives a refusal, no rows, no existence signal and a recorded denial. Requirements: STW-ACT-01, STW-ACT-06, STW-ACT-07, STW-ACT-14, STW-ACT-34, STW-ACT-35, STW-ACT-39.
- **NSC-STW-02** (ROLE_IS_NOT_RELATIONSHIP): A principal who holds the steward role but has no live owner, assignee or collaborator relationship to a case reads nothing about that case, including its existence. Requirements: STW-ACT-06, STW-DENY-01.
- **NSC-STW-03** (HIERARCHY_IS_NOT_SCOPE): A steward in a local that belongs to a federation or region gains no visibility of a parent, sibling or child organization from the hierarchy. Requirements: STW-NAV-2, STW-ACT-34, STW-DENY-01.
- **NSC-STW-04** (PRIVILEGED_EXCLUDED): A privileged document is absent from the steward’s list, search, text extraction and evidence export, and an attempt to fetch it by identifier is refused. Requirements: STW-ACT-14, STW-ACT-15, STW-ACT-38, STW-ACT-39, STW-DENY-03.
- **NSC-STW-05** (CLIENT_FLAG_IS_NOT_DISCLOSURE): A visibility flag sent by the client never makes a staff note member-visible. Disclosure needs classification and a server-side decision by the primary handler. Requirements: STW-ACT-08, STW-ACT-09, STW-ACT-17.
- **NSC-STW-06** (NO_SELF_ESCALATION): A steward cannot assign or reassign a case, issue a triage designation, lift their own recusal or approve, sign or dispatch correspondence from the role. Requirements: STW-ACT-05, STW-ACT-30, STW-ACT-31, STW-DENY-02, STW-DENY-05, STW-DENY-08.
- **NSC-STW-07** (REVOKED_RELATIONSHIP): After a collaborator grant is revoked or an assignment ends, the next read or write on that case is refused. Historical access is as DEC-PD-0C2-01 decides. Requirements: STW-ACT-20, STW-ACT-06.
- **NSC-STW-08** (ATOMIC_AUDIT): If the audit record cannot be written, the steward mutation is rolled back and nothing persists. Requirements: STW-ACT-08, STW-ACT-10, STW-ACT-13, STW-ACT-16.
- **NSC-STW-09** (NO_FINANCIAL_OR_ADMIN_AUTHORITY): The steward role never yields a financial, administrative, legal-hold or retention action. Requirements: STW-DENY-04, STW-DENY-06, STW-DENY-07.

## Dependencies on other personas

- financial-officer via SHARED_OBLIGATION: SHR-0C2-LANGUAGE-ACCESSIBILITY, SHR-0C2-WORKAID-REFERRAL
- representative via RELATED_REQUIREMENT: STW-ACT-01->REP-ACT-01, STW-ACT-02->REP-ACT-18, STW-ACT-02->REP-NAV-1, STW-ACT-03->REP-ACT-18, STW-ACT-04->REP-ACT-04, STW-ACT-04->REP-ACT-21, STW-ACT-05->REP-ACT-22, STW-ACT-06->REP-ACT-03, STW-ACT-07->REP-ACT-03, STW-ACT-08->REP-ACT-06, STW-ACT-09->REP-ACT-06, STW-ACT-09->REP-ACT-23, STW-ACT-10->REP-ACT-07, STW-ACT-10->REP-ACT-08, STW-ACT-10->REP-ACT-23, STW-ACT-11->REP-ACT-21, STW-ACT-12->REP-ACT-12, STW-ACT-13->REP-ACT-15, STW-ACT-13->REP-ACT-17, STW-ACT-14->REP-ACT-16, STW-ACT-14->REP-ACT-17, STW-ACT-15->REP-ACT-15, STW-ACT-16->REP-ACT-15, STW-ACT-17->REP-ACT-23, STW-ACT-18->REP-ACT-19, STW-ACT-19->REP-ACT-20, STW-ACT-20->REP-ACT-09, STW-ACT-21->REP-ACT-18, STW-ACT-21->REP-NAV-6, STW-ACT-22->REP-ACT-18, STW-ACT-23->REP-ACT-18, STW-ACT-24->REP-ACT-18, STW-ACT-25->REP-ACT-12, STW-ACT-26->REP-ACT-12, STW-ACT-27->REP-ACT-13, STW-ACT-28->REP-ACT-02, STW-ACT-29->REP-ACT-12, STW-ACT-30->REP-ACT-05, STW-ACT-31->REP-ACT-04, STW-ACT-32->REP-ACT-24, STW-ACT-33->REP-ACT-21, STW-ACT-34->REP-ACT-10, STW-ACT-35->REP-ACT-11, STW-ACT-36->REP-ACT-25, STW-ACT-36->REP-NAV-7, STW-ACT-37->REP-NAV-7, STW-ACT-38->REP-ACT-16, STW-ACT-39->REP-ACT-15, STW-ACT-40->REP-ACT-25, STW-DENY-01->REP-ACT-03, STW-DENY-01->REP-ACT-15, STW-DENY-02->REP-ACT-04, STW-DENY-02->REP-ACT-05, STW-DENY-03->REP-ACT-17, STW-DENY-04->REP-ACT-01, STW-DENY-05->REP-ACT-13, STW-DENY-06->REP-ACT-01, STW-DENY-07->REP-ACT-17, STW-DENY-08->REP-ACT-22, STW-NAV-1->REP-NAV-1, STW-NAV-2->REP-NAV-2, STW-NAV-3->REP-NAV-3, STW-NAV-4->REP-NAV-4, STW-NAV-5->REP-NAV-5, STW-NAV-6->REP-NAV-6, STW-NAV-7->REP-NAV-7
- representative via SHARED_OBLIGATION: SHR-0C2-CASE-ASSIGNMENT, SHR-0C2-CORRESPONDENCE, SHR-0C2-DEADLINES, SHR-0C2-ESCALATION, SHR-0C2-EVIDENCE-DOCUMENTS, SHR-0C2-LANGUAGE-ACCESSIBILITY, SHR-0C2-MEMBER-DIRECTORY, SHR-0C2-NAVIGATION, SHR-0C2-WORKAID-REFERRAL

## Outstanding product decisions

- `DEC-PD-01` Steward as a distinct persona (OUTSTANDING)
- `DEC-PD-02` Steward navigation (OUTSTANDING)
- `DEC-PD-03` Default visibility of working notes (OUTSTANDING)
- `DEC-PD-04` Intake classification (OUTSTANDING)
- `DEC-PD-05` Assignment acknowledgement and handoff summary (OUTSTANDING)
- `DEC-PD-12` Deadline extension workflow (OUTSTANDING)
- `DEC-PD-0C2-01` Steward access when a relationship or the platform role ends (OUTSTANDING)
- `DEC-PD-0C2-02` Steward scope across federations, locals and territories (OUTSTANDING)
- `DEC-PD-0C2-03` Steward absence cover and substitution (OUTSTANDING)
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
- `DEC-IA-32` Steward role scope per organization (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)

## Known source gaps and irreducible historical uncertainty

- `GAP-STW-NO-CANONICAL` (IRREDUCIBLE_HISTORICAL): No Steward canonical exists in any of the 526 refs scanned. The eight recovered evidence items S1 to S8 define no action. Every one of the Steward contracts is a new design, and no historical Steward action list can be recovered.
- `GAP-STW-STRUCTURE` (PRODUCT_DECISION): Whether Steward is a distinct persona or a scoped profile of Representative 2.2 is undecided (DEC-PD-01).
- `GAP-STW-OFFICE` (INSTITUTIONAL): No source names a steward office, and none may be created here (DEC-IA-32).

Historical evidence by class: NONE 55.

## Implementation obligations by engineering gate

- Gate 2 (Case ownership and representation): 6 requirements. NOT_IMPLEMENTED 3, SOURCE_PRESENT 3.
- Gate 4 (Claims/grievances convergence): 8 requirements. NOT_IMPLEMENTED 1, PARTIAL_SOURCE 3, SOURCE_PRESENT 4.
- Gate 6 (Documents, privacy and records): 6 requirements. NOT_IMPLEMENTED 1, PARTIAL_SOURCE 3, SOURCE_PRESENT 2.
- Gate 7 (WorkAid union-side completion): 1 requirements. PARTIAL_SOURCE 1.
- Gate 9 (Runtime and installation architecture): 1 requirements. NOT_IMPLEMENTED 1.
- Gate 10 (Frozen persona journeys): 27 requirements. NOT_IMPLEMENTED 3, PARTIAL_SOURCE 9, SOURCE_PRESENT 15.
- Gate 11 (Member/staff messaging): 5 requirements. PARTIAL_SOURCE 4, SOURCE_PRESENT 1.
- Gate 13 (Generic CRUD and route authorization): 1 requirements. PARTIAL_SOURCE 1.

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

