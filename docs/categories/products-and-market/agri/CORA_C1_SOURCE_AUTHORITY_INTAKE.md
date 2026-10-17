# CORA C1 Source-Authority Intake

**Intake ID:** `CORA-C1-INTAKE-001`  
**Record version:** `1.0.0`  
**Prepared:** 2026-10-07 (preparation date, not decision date)  
**C1_SOURCE_AUTHORITY:** `READY_FOR_HUMAN_DECISION`  
**C1_AUTHORITY_CHAIN:** `REQUIRES_CONFIRMATION`  
**C1_HUMAN:** `PENDING_SOURCE_AUTHORITY`  
**CONTRACTUAL_RESTRICTIONS:** `NOT_ESTABLISHED`

Engineering remains `PASS`; human governance packaging remains
`READY_FOR_DECISIONS`; disclosure activation remains `BLOCKED_HUMAN_CONDITIONS`.
Farmer 360 remains `BLOCKED_GOVERNANCE_CONDITIONS`, capability `DESIGN_ONLY`.
Candidate `cora-farmer360-agrimo-producer-status-same-org-viewer` version
`1.0.0` remains `PROPOSED_NOT_ACTIVE`. No source authorization or rejection
has been established. Runtime registries remain empty and `WITHHOLD` remains correct.

## 1. Findings and evidence limits

The repository establishes **operational record origin and custody**, not
legal permission to redistribute that record. It supplies a
decision-routing path, not a verified approver. No named source institution,
organization-specific contract, disclosure delegation or executed C1
decision was found in the inspected repository material.

This intake uses an **origin-scoped authority model**: authority is resolved
for each proposed disclosure, not inferred from one universal Agrimo owner.
The scope includes the fact and its origin, the producer/institution
relationship, the recipient institution and organization, the purpose, and
the instrument that permits the transfer. This is a governance model for
human decisions; it is not implemented cross-institution authorization and
does not change the narrow same-organization candidate or its `WITHHOLD`
outcome.

The first repository-grounded case is the explicitly synthetic Farmer 360
acceptance fixture, documented in the
[C1 authority case dossier](CORA_C1_AUTHORITY_CASE_F360_ACCEPTANCE_001.md).
It demonstrates the resolution process only; its test organization, synthetic
producer and test purpose do not establish a real institution or disclosure
authority.

| Ref | Exact repository source                                                                                                                                                                                                                                                                                                                                          | Established fact / limitation                                                                                                                                                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | [ADR-AGRI-001](ADR/ADR-AGRI-001-cora-agrimo-product-boundary.md), Decision and Shared-Core Principle; [Agrimo README](../../../../apps/agrimo/README.md), Product boundary                                                                                                                                                                                       | Agrimo is the operational agricultural product; Cora is a peer product. Shared primitives do not convey shared record ownership. Architecture only, not institutional delegation.                                                                                                                                                                               |
| S2  | [ADR-AGRI-002](ADR/ADR-AGRI-002-cora-food-economy-ceiling.md), Domain and Shared-Core Model, Write-Authority Doctrine, Farmer Data Rights and Aggregation; [domain matrix](CORA_DOMAIN_OWNERSHIP_MATRIX.md), Producer row                                                                                                                                        | Agrimo/originating product retains operational producer records; Cora reads only by governed contract. Authorized reuse must respect purpose, consent, policy and access rights; no identifiable-producer-data sale.                                                                                                                                            |
| S3  | [agri.ts](../../../../packages/db/src/schema/agri.ts), `agriProducers`; [producers.ts](../../../../packages/agri-db/src/repositories/producers.ts), `getProducerById` / `updateProducer`; [adapter](../../../../apps/cora/lib/farmer-360/adapters.ts), producer fact projection                                                                                  | `agri_producers.status` is a canonical persisted source field; reads filter producer ID and `orgId`. Adapter labels source `agrimo:operational-producer-record`. Neither DB tenancy nor this provenance string identifies a controller/signatory.                                                                                                               |
| S4  | [application ownership](../../../../governance/release/app-ownership.json), `owners.agrimo`; [ownership registry](../../../ops/ownership-registry.md), Agrimo row; [on-call matrix](../../../../governance/sre/oncall-ownership-matrix.json), Agrimo row                                                                                                         | Business, technical, runtime, support and escalation aliases exist. They route accountability; they do not grant source-data disclosure authority.                                                                                                                                                                                                              |
| S5  | [agrotech compliance strategy](../../../../governance/business/verticals/agrotech/strategy/compliance-privacy.md), sections 2 and 3; [vertical README](../../../../governance/business/verticals/agrotech/README.md), supersession notice                                                                                                                        | Strategy describes farmer personal-data ownership, cooperative collective-data control, explicit collection consent and purpose limitation. Its vertical context is a superseded historical draft; no executed mandate or current flow-specific applicability is established. Treat as stewardship leads, not approval or verified legal statements.            |
| S6  | [legal framework](../../../../governance/corporate/legal/legal-compliance-framework.md), Legal Domains, Legal Repository, Roles and Responsibilities, Legal Stack; [venture agreement template](../../../../governance/corporate/legal/guide-operating-agreement-template-venture-level.md), Parties / Governance                                                | Framework identifies Nzila Ventures and names Founder/CEO Lumbanzila Aubert Nungisa as final legal approver/signatory for partnership, licensing and investment agreements. It points to off-repository signed-contract archives. It does not delegate Agrimo disclosure or prove control of these records. Agreement is a template, not executed source terms. |
| S7  | [privacy notice](../../../../governance/privacy/public/privacy-notice.md), Who we are / Sharing; [DPA template](../../../../governance/privacy/vendor/data-processing-agreement-template.md), Use / Parties                                                                                                                                                      | Generic notice uses Nzila Ventures, but dates/address/contact remain placeholders. DPA is explicitly a counsel-reviewed template for cases when Nzila is controller. Neither determines Agrimo's actual controller relationship.                                                                                                                                |
| S8  | [Privacy Operations](../../../../governance/privacy/README.md), Roles; [classification policy](../../../../governance/privacy/policies/data-classification-policy.md), Roles; [DPIA process](../../../../governance/privacy/dpia/README.md), Process / Acceptance                                                                                                | Surface Owner classifies; Privacy Lead arbitrates and approves PIAs/DPAs; Platform Lead implements protections. DPIA signed approvals are documented, not a source delegation for C1.                                                                                                                                                                           |
| S9  | [governance doctrine](../../../../governance/corporate/governance/governance-docs.md), sections 3, 4, 6; [board tracker](../../../../governance/corporate/governance/checklist-board-decision-tracker.md), Tracker Fields / Usage; [access matrix](../../../../governance/corporate/governance/framework-access-roles-matrix.md), Permissions / Special Controls | Legal/Compliance and Product & Impact committees and escalation exist. Tracker records dated decisions with linked evidence. IP/equity thresholds and file-access rights do not supply a disclosure mandate/quorum. Example tracker entries are not this decision.                                                                                              |
| S10 | [data-governance overview](../../../../governance/corporate/compliance/security-data-governance-overview.md), Foundational Principles / Lifecycle / Roles; [vendor review SOP](../../../../governance/corporate/legal/vendor-security-review-sop.md), Review Process / Tools                                                                                     | Purpose-linked approved use, consent/vendor sharing controls and legal contract review are documented. Vendor sign-off is not authorization for internal cross-product disclosure.                                                                                                                                                                              |
| S11 | [conditional decision record](CORA_SOURCE_DISCLOSURE_APPROVAL_RECORD_TEMPLATE.md), sections 1-2; [source packet](CORA_DISCLOSURE_SOURCE_AUTHORITY_PACKET.md), C1                                                                                                                                                                                                 | Conditional direction expressly leaves source institution, delegation, concurrence and attestation unset. It cannot be recycled as an authoritative C1 approval.                                                                                                                                                                                                |

## 1A. Authority classes and evidence boundary

These classes are separate questions. A party may occupy more than one role,
but one role does not establish another. Privacy/Legal must determine the
legally applicable controller/processor roles and individual rights; this
intake does not assign them.

| Authority class                          | What it can establish                                                                                                     | What it does not establish by itself                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Record-origin / operational steward      | Where the fact was created or maintained, the operational system, and the source record's custodian                       | Legal control, permission to disclose, or authority to bind a producer, cooperative, or other institution                    |
| Producer / subject relationship          | The producer's relationship to the record and any verified access, instruction, consent, correction, or revocation rights | That the producer is the only controller, that consent is always the required basis, or that an institutional mandate exists |
| Source-institution disclosure authority  | The institution's mandate to authorize this fact's disclosure within a defined source, recipient, purpose, and term       | A general Agrimo-to-Cora grant, privacy/legal basis, or recipient acceptance                                                 |
| Upstream / provider authority            | Restrictions, license, delegation, or rights inherited from an upstream provider or data origin                           | Authority to override the producer, source institution, contract, or applicable law                                          |
| Privacy/legal authority                  | Applicable controller/processor roles, jurisdiction, lawful basis, rights, and required assessment or safeguards          | Source-institution delegation unless separately evidenced                                                                    |
| Recipient-institution decision authority | Whether the recipient will request, accept, reject, classify, or independently verify evidence for its own process        | Permission to receive or reuse a fact beyond the source-approved scope                                                       |
| Platform / product operator              | Technical enforcement, identity and organization resolution, data handling, audit, and product-purpose proposals          | Source disclosure authority, lawful basis, or institutional approval                                                         |

The C1 evidence currently establishes only Agrimo as the operational origin
for the inspected field and the existence of repository routing aliases.
Neither the `orgId`, `sourceOrganizationId`, `sourceAuthorityRef`, product
ownership, nor a user's organization membership identifies the accountable
disclosure authority. No universal Agrimo controller or source mandate is
established.

## 1B. Origin-to-recipient relationship model

For every disclosure decision, record and evidence the following tuple;
unknown fields remain unresolved and block disclosure rather than being
filled by organizational inference:

1. **Fact and source:** exact fact class, source system/entity/field, record
   reference, schema/semantic version, and the source system's organization
   scope.
2. **Origin and stewardship:** the institution/person that originated the
   fact (if known), the operational record steward, and any upstream source
   or provider. Keep these distinct from tenant/database ownership.
3. **Producer relationship and control:** producer-subject reference and
   evidenced relationship to the record; access, instruction, consent,
   withdrawal/revocation, correction, and objection rights, each as a
   separate question. Privacy/Legal determines which rights and lawful
   mechanism apply.
4. **Authority chain:** the institution(s) whose authority is required;
   each delegated approver's identity, role, mandate, covered facts and
   organizations; source/provider/producer instruments and inherited
   restrictions; and the evidence establishing each link.
5. **Recipient relationship:** recipient institution and organization,
   source-to-recipient relationship (for this candidate, same organization
   is only a proposed technical scope), purpose, necessity, intended users,
   and any membership/producer relationship relied on. No name/contact
   inference or tenant equality substitutes for an evidenced relationship.
6. **Decision lifecycle:** permitted operations and exclusions, conditions,
   effective date, review/expiry, suspension, revocation, correction
   propagation, and how each is made enforceable.

The authority boundary is per fact, origin, relationship, recipient and
purpose. A decision for one producer, source institution, recipient,
organization or purpose does not authorize another. A source approval allows
only disclosure within its evidenced scope; it does not compel a receiving
institution to rely on the fact.

### Farmer 360 examples (illustrative, not activated)

| Example                                                                                                                     | Authority questions to resolve                                                                                                                                                                                                            | What must not be inferred                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| An Agrimo-maintained `producer.status` record is viewed by a Cora user in the same organization                             | Identify the institution with authority over that particular operational record; establish its mandate, producer relationship, permitted purpose, exact same-organization recipient scope, and any upstream terms                         | Agrimo product ownership, a matching database `orgId`, or the user's Cora permission is not disclosure approval                                                          |
| Farmer 360 requests a producer fact originating with a cooperative or another upstream source but held or relayed by Agrimo | Trace origin and custody; determine whether the cooperative/provider retains approval rights, what Agrimo was delegated to do, how producer access/instruction/consent or other basis applies, and whether onward disclosure is permitted | Possession by Agrimo or a contract with the platform does not prove an onward-sharing grant; producer consent is not presumed to cure missing institutional authority    |
| A Cora view is requested by an external lender, insurer, association, researcher, or public institution                     | Establish source authority for the external recipient, separate source-to-recipient instrument, producer/subject rights and privacy/legal basis, purpose and safeguards; obtain the recipient's own decision on evidentiary sufficiency   | Same-organization candidate approval, strategic partner hypotheses, or an institution's willingness to consume evidence does not authorize cross-organization disclosure |

## 1C. Producer-control and recipient decision doctrine

Privacy/Legal must decide, for the actual fact and relationship, whether and
how producer rights apply. The source institution must identify any
producer-facing access, instruction, consent, refusal, withdrawal/revocation,
correction and objection process and its operational owner. These are
distinct from source-institution delegation, Cora application permission,
organizational membership, and legal basis; this intake does not equate any
of them or presume consent is the applicable basis.

The recipient institution retains independent decision rights: it may
request additional evidence, decline the fact, classify its confidence,
apply its own criteria, or verify with the originator. Cora's presentation
is not a certification or decision and cannot transfer that responsibility.
Any onward use requires its own permitted scope and evidence.

## 1D. Evidence gaps and deferred engineering implications

For the first Agrimo `producer.status` case, the repository does not establish
the institution with authority over disclosure or its delegate, any
producer/source relationship instrument, applicable upstream restrictions,
a source-to-recipient mandate, a completed privacy/legal determination, or a
durable C1 decision. The current provenance's `sourceOrganizationId` and
`sourceAuthorityRef` are not a verified authority chain.

Future engineering may need separately typed origin institution, source
steward, producer-subject relationship, recipient organization, authority
instrument/evidence references, purpose scope, rights/basis state, and
effective/review/expiry/revocation lifecycle. Those fields are not present
as a complete record-level authority chain in the inspected runtime contract.
The current policy/evaluator enforces exact provenance and same-organization
matching only. Any cross-organization or richer origin-authority workflow
requires a separately approved design, human decisions, and engineering
proof; none is part of this intake.

**Disposition:** `C1_AUTHORITY_MODEL = ORIGIN_SCOPED_READY` means the
documentary decision model is ready for human review. It does not mean this
Agrimo source authority is established: `C1_SOURCE_AUTHORITY =
READY_FOR_HUMAN_DECISION`, `C1_HUMAN = PENDING_SOURCE_AUTHORITY`, and
disclosure remains withheld.

Discovery covered agricultural ADRs, overview/architecture/domain matrix,
source schema/repository/adapter, ownership/on-call registries, agricultural
strategy, privacy notice/process/templates, corporate legal/governance/access
doctrine and trackers, and existing disclosure records. Searches for
agricultural institutions/records in corporate legal/governance and privacy
assessment/vendor material found no flow-specific decision or executed source
agreement. This is a repository-bounded finding: external legal archives,
customer agreements and participant mandates may exist and must be obtained.
No external account, institution, email, contract archive or database was accessed.

Some broad agriculture architecture pages still describe an earlier no-live-read
baseline; use S3 and the existing certified ledger for current composition.
Historical implementation or strategy claims are not promoted into authority.
This intake does not repair unrelated documentation.

## 2. Authority routing

`ESTABLISHED` below is narrowly technical/architectural unless explicitly
stated otherwise. It never means C1 approval.

| Layer                                   | Entity / role                                                                                               | Evidence                                                       | Authority actually established?                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Source application owner                | Agrimo, operational agricultural product                                                                    | S1-S2                                                          | `ESTABLISHED`: application/domain responsibility only                                                  |
| Source technical owner                  | `team-agrimo-engineering@nzila.ai`; runtime `team-platform-ops@nzila.ai`; support `oncall-agrimo@nzila.ai`  | S4                                                             | `ROUTING_ONLY`: engineering/operations responsibility                                                  |
| Source business owner                   | `team-agrimo-business@nzila.ai`; escalation `director-product@nzila.ai`                                     | S4                                                             | `ROUTING_ONLY`: business intake, not a signatory                                                       |
| Data steward                            | Originating institution or record custodian; cooperative/farmer roles in S5 are unverified leads            | S5                                                             | `UNRESOLVED`: no named institution, stewardship appointment or source-record-specific scope            |
| Data controller/accountable institution | To be determined per fact, origin and relationship; Nzila/source/cooperative roles are candidates only      | S5-S7                                                          | `UNRESOLVED`: legal controller/processor/participant relationships require Privacy/Legal determination |
| Disclosure approver                     | Each institution whose authority is required for this origin-to-recipient transfer, acting through delegate | S8-S11 supply routing and missing fields only                  | `NOT_FOUND`: no verified mandate for this disclosure                                                   |
| Delegated signatory                     | Person/body authorized by that source institution                                                           | S6 identifies a corporate legal signatory, not this delegation | `NOT_FOUND`: no C1 signatory established                                                               |

**Disclosure-authority determination:** `REQUIRES_CONFIRMATION`, not
`ESTABLISHED`. Authority is not assigned to one universal Agrimo controller.
Nzila Ventures is an operator/controller candidate in generic
corporate/template documents (S6-S7); strategy describes source cooperatives
as collective-data stewards and farmers as personal-data rights holders (S5).
No document connects a named legal entity to control of the actual
Agrimo `producer.status` records or to a mandate covering this recipient and
purpose. Do not resolve the relevant institution's legal name from
inconsistent generic labels such as Nzila Corp/Nzila Ventures/Nzila Ventures Inc.
Require each relevant institution's actual identity and supporting
relationship instrument; Privacy/Legal determines controller roles.

Source and relationship scope is a combination: common producer semantics
belong to shared agricultural primitives; Agrimo/originating product
maintains the operational record; `orgId` bounds technical tenancy; and
participant and cooperative rights may constrain authorized reuse.
`cooperativeId` and organization IDs do not themselves establish ownership,
legal control or redistribution rights. The institution with authority over
each proposed transfer must be resolved separately.
Schema storage in `@nzila/db` and the shared control plane are not a legal owner.
Corporate software/IP ownership claims in S6 also do not establish control
over customer or participant records.

The legal framework is version `1.1`, last updated July 2025. Its named
signatory/interim privacy assignments are documentary routing leads, not
verification of current office holders, appointment terms or this source mandate.

## 3. Candidate approvers and next contact

| Candidate                                                             | Classification                | What to ask / limit                                                                                                                 |
| --------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Agrimo business/Surface Owner through `team-agrimo-business@nzila.ai` | `POSSIBLE_ROUTING_ROLE`       | Trace this fact's origin and source-to-recipient relationships; identify each relevant institution and its delegate/instrument      |
| Agrimo technical owner                                                | `POSSIBLE_ROUTING_ROLE`       | Confirm record origin and organization/source scope, not approve disclosure                                                         |
| Corporate CEO/legal function identified in S6                         | `POSSIBLE_ROUTING_ROLE`       | Retrieve/verify executed contracts and delegation via the legal custodian; corporate signing role does not prove source control     |
| COO/legal archive custodian                                           | `POSSIBLE_ROUTING_ROLE`       | Supply durable instruments and provenance, not infer approval from possession                                                       |
| Privacy Lead/DPO or legacy interim Privacy Officer                    | `POSSIBLE_ROUTING_ROLE`       | Confirm controller relationships and applicable restrictions; no source-disclosure mandate found                                    |
| Cooperative board/manager or participant                              | `NO_DISCLOSURE_MANDATE_FOUND` | Strategy is a lead; require evidence that this body/person has authority over this origin/fact and scope, not an assumed board vote |
| Legal/Compliance or Product & Impact committee / Board                | `NO_DISCLOSURE_MANDATE_FOUND` | Escalation/oversight is documented; obtain exact mandate/quorum if this body is proposed                                            |
| Platform Lead, runtime operator, repository administrator             | `NO_DISCLOSURE_MANDATE_FOUND` | Technical controls/access do not authorize disclosure                                                                               |

No candidate is `VERIFIED_DISCLOSURE_AUTHORITY`.

**Approach next:** Agrimo business/Surface Owner via the business alias,
with the qualified legal function/COO archive custodian supporting identity
and mandate verification. Escalate failed routing through `director-product@nzila.ai`.
The actual decision must then go to the **named controlling institution's
delegated data owner/body**, not automatically to Agrimo engineering, the
corporate CEO, Privacy Lead, or a cooperative manager.

## 4. Restrictions: doctrine versus executed source terms

| Restriction question                            | Evidence found                                                                                                                  | C1 finding                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Secondary use, analytics, downstream disclosure | S2 requires authorized purpose/consent/policy/access; S5 says no repurposing without consent; S10 requires defined approved use | Doctrine found; source-contract applicability `NOT_ESTABLISHED`                                       |
| Same-org or cross-product reuse                 | S1-S3 require governed read contracts; technical same-org scoping does not grant redistribution                                 | No blanket same-org exemption or executed cross-product permission found                              |
| Export and sale                                 | S2 protects participant portability and prohibits identifiable data sale; candidate excludes CORA export                        | Portability rights are not a CORA export grant; actual source terms `NOT_ESTABLISHED`                 |
| Consent and participant/member terms            | S5 describes explicit collection consent; S2 preserves participant purpose/consent/access rights                                | No executed producer/member consent or applicable terms found; do not decide C3 here                  |
| Contractual provider/source limitations         | S6-S7/S10 point to contracts/templates and external archives                                                                    | No executed Agrimo source/provider/data-sharing/DPA terms found                                       |
| External source owner                           | Current source is the Agrimo operational row, S3                                                                                | No evidence naming an external institution as its controller; do not infer absence of upstream rights |

`CONTRACTUAL_RESTRICTIONS = NOT_ESTABLISHED`, never `NONE`.
Ask the institutions with authority over this fact and transfer to provide
applicable source agreements or an evidenced determination of
non-applicability. Do not choose legal bases,
retention periods, status allowlists or freshness values in this intake.

## 5. Human-ready C1 request

**To:** identified controlling source institution's delegated data owner/body.
**Routing cover:** Agrimo business/Surface Owner must identify the addressee
and mandate before the decision is treated as authoritative.

> For the exact fact and origin described below, which institution has
> authority to decide whether the current Agrimo `producer.status` fact may
> be disclosed to CORA Farmer 360 within the same organization for
> `farmer360.operational-read`, and does its evidenced delegate authorize
> that exact disclosure, subject to the remaining C2-C9 governance
> conditions?

Requested scope: Agrimo `agri_producers.status` only, destination CORA,
surface Farmer 360 (`surface = farmer360`, action `read`, section
`evidence-confidence`), same
organization only, active canonical identity binding and membership,
required permission `cora:farmer360:read`, read-only. No cross-org use,
export, bulk extraction, historical series, unrelated secondary use, onward
redistribution or Agrimo writes. Candidate `1.0.0` proposes viewer scope;
recipient eligibility is still for C4 to ratify, not approved by C1.
No blanket Agrimo-to-CORA grant is requested.
The human purpose is a partial source-evidence indicator, not proof of
production, economics, eligibility, certification, capacity or consent.

Choose one:

- `APPROVE_SOURCE_AUTHORITY`
- `APPROVE_SOURCE_AUTHORITY_WITH_CONDITIONS`
- `REJECT_SOURCE_AUTHORITY`
- `NOT_AUTHORIZED_TO_DECIDE`

Return only the C1 answers: fact origin and operational steward (separately);
actual institution(s) with authority over disclosure and the basis for each
relationship; approver identity/institutional role and delegation instrument;
producer/source relationship and applicable rights or a referral to
Privacy/Legal; any upstream/provider restrictions; exact source, recipient,
organization, purpose and operation scope; decision and rationale; conditions;
decision date; durable evidence reference; and review/expiry, suspension and
revocation requirements. If any authority link is outside the delegate's
mandate or unresolved, identify the proper decision path and keep that scope
withheld.

C1 only permits this disclosure direction to proceed through the remaining
governance conditions. Defer values to C2, privacy/basis to C3, roles to C4,
freshness to C5, retention to C6, onward-use governance to C7, activation
to C8, audit retention to C9. Even positive C1 evidence leaves runtime withheld.

## 6. Unresolved C1 decision record

This is the canonical C1 intake record for later human completion.
Bind any future approval to the reviewed artifact hash/revision and the
specific fact origin, source and recipient organization/institution
relationship; a positive decision does not authorize all tenants or origins
implicitly. Preserve the prior conditional direction in S11.

```json
{
  "decision_id": "CORA-DISCLOSURE-C1-001",
  "condition": "C1",
  "record_version": "1.0.0",
  "candidate_id": "cora-farmer360-agrimo-producer-status-same-org-viewer",
  "candidate_version": "1.0.0",
  "source_system": "agrimo",
  "fact_class": "producer.status",
  "destination_application": "cora",
  "surface": "farmer360",
  "purpose": "farmer360.operational-read",
  "scope": {
    "source_domain": "agriculture",
    "source_entity": "producer",
    "source_table": "agri_producers",
    "source_authority_ref": "agrimo:operational-producer-record",
    "action": "read",
    "section": "evidence-confidence",
    "organization_relationship": "same-organization",
    "recipient_organization_id": null,
    "recipient_institution": null,
    "fact_origin_institution": null,
    "operational_record_steward": "agrimo",
    "producer_source_relationship_ref": null,
    "upstream_provider_or_restrictions_ref": null,
    "authority_instrument_ref": null,
    "authority_evidence_ref": null,
    "identity_binding_state": "active",
    "membership_state": "active",
    "membership_role_source": "canonical",
    "required_permission": "cora:farmer360:read",
    "read_only": true,
    "excluded": [
      "cross-org",
      "export",
      "bulk",
      "history",
      "onward-redistribution",
      "secondary-use",
      "agrimo-writes"
    ],
    "approved_source_institution_scope": null,
    "reviewed_artifact_reference": null,
    "reviewed_artifact_hash_or_revision": null
  },
  "disclosure_authority_chain": [],
  "decision": null,
  "approving_authority": null,
  "authority_basis": null,
  "evidence_reference": null,
  "decision_date": null,
  "review_or_expiry": null,
  "conditions": null,
  "status": "AWAITING_SOURCE_AUTHORITY"
}
```

The JSON is a documentary record, **not** the strict runtime evidence schema
or an installable activation package. Null means unresolved, not waived.
`decision_id` is a reserved intake identifier, not an institutional approval reference.
Each future `disclosure_authority_chain` entry must identify the institution,
authority class, approver's name/institutional role, mandate/instrument,
covered facts and organizations, evidence reference, and valid term.
`review_or_expiry` includes authority requirements and rationale. Preserve
immutable evidence IDs/versions and restricted instruments as in the
[ingestion contract](CORA_DISCLOSURE_INSTITUTIONAL_ACTIVATION_CHECKLIST.md#3-evidence-ingestion-contract).

## 7. Evidence acceptance and closure

Indispensable proof elements: identified fact origin and operational
steward; each institution whose authority is required and the evidenced
relationship between them; accountable decision-maker and delegation basis;
producer/source relationship and privacy/legal referral; upstream terms;
exact source, recipient, organization and purpose scope; actual decision,
conditions, date and durable evidence reference; and review/expiry,
suspension and revocation handling.

Repository doctrine supports a **formal dated governance decision with
linked instruments** (S9), signed privacy records (S8), and counsel-reviewed
executed contracts (S6-S7/S10). No inspected doctrine establishes that an
ordinary email or chat alone is sufficient for C1. An email may transmit
evidence; its sufficiency as the approval instrument must be explicitly
confirmed by the actual source institution's applicable decision rules and
qualified legal reviewer. Do not impose the DPIA signature process as a
substitute for source delegation.

Recommend the dated C1 record plus the mandate/relationship instrument,
validated by the source institution and qualified legal reviewer; evidence
form acceptance is itself still unresolved. Record applicable sign-off,
quorum and execution requirements from the institution, not IP/equity rules.

Only set `C1_HUMAN = APPROVED_SOURCE_AUTHORITY` and
`C1_SOURCE_AUTHORITY = APPROVED` after all proof elements, instrument
sufficiency and any C1-specific prerequisites are verified. Remaining C2-C9
conditions need not be decided to record a narrow C1 approval; they remain
activation blockers. A conditional C1 decision records its actual outcome
but cannot waive missing authority/scope proof or unmet C1-specific conditions.
`NOT_AUTHORIZED_TO_DECIDE` is not rejection. Rejection needs authoritative
decision evidence. No evidence was ingested and no request was sent in this mission.

## 8. Validation and stop

Documentation-only validation:

- Prettier formatting applied to the intake and three linked documents.
- Local reference check: 49 file/anchor links passed; documentary JSON parsed;
  exact `producer`/`read` scope and unresolved authority fields checked.
- `pnpm validate:docs`: passed; 2,471 files, 0 errors, 1,215 warnings,
  1,675 informational findings.
- `pnpm governance:audit`: passed. Its automatic financial-service health
  subcheck passed 553 tests in 29 files; lint reported 351 warnings, 0 errors.
- `git diff --check`: passed.

Snapshot: branch `main`; HEAD `1c337567635bb86ea0df7831557d8d2d22df1e6f`;
upstream `origin/main`; locally ahead/behind `0/0` (no fetch). Shared dirty
worktree, 123 status entries after adding this intake versus 122 at mission
baseline. No commit or push. Validation regenerates existing audit/report
artifacts; unrelated worktree changes are retained.

Read-only inspection confirms all four adapter runtime registries remain
empty. The prior certified real-source outcome remains `WITHHOLD`; no new
DB/HTTP acceptance or runtime certification is claimed by this documentary mission.
No runtime edits, registry population, policy activation, authenticated HTTP,
deployment or database operation. No C2/C5 decision or implementation work.
Stop after delivering this request; the next useful action is obtaining the
actual institution/mandate and source-authority decision outside the repository.
