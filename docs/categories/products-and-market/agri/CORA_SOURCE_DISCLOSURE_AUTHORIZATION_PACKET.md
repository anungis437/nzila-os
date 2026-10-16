# Cora Source-Disclosure Authorization Decision Packet

**Decision:** `APPROVE_WITH_CONDITIONS`  
**Decision recorded:** 2026-10-07, from explicit human instruction in this session  
**Candidate status:** `PROPOSED_NOT_ACTIVE`  
**CORA_SOURCE_DISCLOSURE_FOUNDATION:** `PASS_POLICY_AUTHORIZATION_REQUIRED`  
**CORA_FARMER_360:** `BLOCKED_GOVERNANCE_CONDITIONS`  
**Capability truth:** `DESIGN_ONLY`  
**CORA_DISCLOSURE_CONDITIONAL_APPROVAL:** `RECORDED` (`APPROVE_WITH_CONDITIONS`; direction in principle only)  
**CORA_PREACTIVATION_ENGINEERING:** `PASS`  
**CORA_DISCLOSURE_ACTIVATION:** `BLOCKED_HUMAN_CONDITIONS`  
**Decision boundary:** The narrow direction is approved in principle only.
This records no source-owner, privacy, legal or runtime authorization.
Activation remains prohibited until C1-C9 in the
[condition ledger](CORA_SOURCE_DISCLOSURE_CONDITION_LEDGER.md) are closed
with their required evidence and final authorization.

## 1. Frozen boundary and rebaseline

Preparation baseline: 2026-10-07; branch `main`; HEAD
`1c337567635bb86ea0df7831557d8d2d22df1e6f`; upstream `origin/main`;
ahead/behind `0/0` against the local upstream reference, without fetching.
The worktree already contains extensive modified and untracked accepted and
unrelated work. `git diff --check` passed at rebaseline. This packet describes
the inspected worktree, not a claim that the foundation is committed in HEAD.

The runtime registry remains empty (E2). Agrimo facts therefore receive
`WITHHOLD`, are omitted from Farmer 360 facts and conflict alternatives, and
an otherwise-empty section becomes `UNKNOWN` (E3). App permission is necessary
but not source-disclosure authority. Durable audit failure prevents a read
from succeeding (E1, E5).

The original governance preparation changed documentation only; the subsequent
C5 mission surgically corrected timestamp handling and added regression tests.
The runtime registry remains empty;
do not register a policy, create an executable positive rule, resume
authenticated HTTP acceptance, deploy, change capability maturity, or mutate
any database. Conditional direction, condition closure, final activation
authorization, policy installation and runtime acceptance are separate gates.

C1 uses an origin-scoped authority model: authority must be established for
the specific fact origin, producer/institution relationship, source-to-
recipient relationship, recipient, purpose and applicable instrument. This
does not posit one universal Agrimo controller and does not expand the
candidate beyond its proposed same-organization scope. The detailed
documentary model is in the [C1 intake](CORA_C1_SOURCE_AUTHORITY_INTAKE.md#1a-authority-classes-and-evidence-boundary);
`ORIGIN_SCOPED_READY` describes model readiness only, not source approval.

## 2. Canonical repository evidence

Evidence proves implementation or doctrine, not institutional authorization.
References identify exact files and symbols/sections in the inspected worktree.

| ID  | Canonical source                                                                                                                                                                                                                                   | Repository-supported fact                                                                                                                                                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | [source-disclosure.ts](../../../../packages/platform-auth/src/source-disclosure.ts): `sourceDisclosurePolicySchema`, `sourceDisclosureProvenanceSchema`, `createSourceDisclosureAuthority`, `matchesDisclosureRequest`                             | Exact source/app/surface/action/purpose matching; same-org only; active binding and membership; permission and optional role restriction; effective dates, inactive/revoked withholding, ambiguous-version withholding, awaited audit.                                                                                                                                          |
| E2  | [adapters.ts](../../../../apps/cora/lib/farmer-360/adapters.ts): `governedSourceDisclosurePolicies`, `getProducerFarmer360Snapshot`, `createFarmer360RuntimePorts`                                                                                 | Empty policy/contract/freshness/evidence registries; status-only projection and exact provenance; display-only 90-day freshness label. Only valid `updatedAt` supplies observation time; missing/invalid time remains absent and cannot be rescued by `createdAt`. No agricultural consent grant in runtime defaults.                                                           |
| E3  | [service.ts](../../../../apps/cora/lib/farmer-360/service.ts): `filterSourceDisclosure`                                                                                                                                                            | `cora` request context, `farmer360`, `read`, `farmer360.operational-read`; fact and conflict filtering; explicit denial fails read.                                                                                                                                                                                                                                             |
| E4  | [route.ts](../../../../apps/cora/app/api/farmer-360/[profileId]/route.ts): `GET`; [resolve-org.ts](../../../../apps/cora/lib/resolve-org.ts): `resolveOrgContext`                                                                                  | GET API requires canonical `cora:farmer360:read`; app identity/membership/grants are server-resolved; route is dynamic, fetch cache is disabled, and responses carry `private, no-store`, `Pragma: no-cache`, and `Vary: Cookie, Authorization`. Unit and disposable-DB route tests verify these headers.                                                                       |
| E5  | [authorization-audit.ts](../../../../packages/db/src/authorization-audit.ts): `writeSourceDisclosureDecisionAudit`; [acceptance.integration.test.ts](../../../../apps/cora/lib/farmer-360/acceptance.integration.test.ts): source-audit assertions | Org-scoped `audit_events`, `canonical-v1` hash chain, decision/actor/binding/membership/purpose/policy metadata; local DB acceptance verifies no fact value or source record ID is persisted; actor metadata is not anonymous.                                                                                                                                                  |
| E6  | [agri.ts](../../../../packages/db/src/schema/agri.ts): `agriProducers`, `agriProducerStatusEnum`; [producers.ts](../../../../packages/agri-db/src/repositories/producers.ts): `getProducerById`, `toProfile`                                       | `agri_producers.status` enum is `active`, `inactive`, `suspended`; query filters producer ID and org. Repository internally reads the full producer row, including contact fields, before adapter projects the status fact.                                                                                                                                                     |
| E7  | [CORA_DOMAIN_OWNERSHIP_MATRIX.md](CORA_DOMAIN_OWNERSHIP_MATRIX.md): Producer row                                                                                                                                                                   | Originating product retains operational record ownership; Cora is read-only. This is architectural ownership, not a source institution's delegation.                                                                                                                                                                                                                            |
| E8  | [app-ownership.json](../../../../governance/release/app-ownership.json): `owners.agrimo`, `owners.cora`                                                                                                                                            | Business, technical, runtime, release and escalation team aliases; no personal signatory or disclosure delegation established.                                                                                                                                                                                                                                                  |
| E9  | [Privacy Operations Program](../../../../governance/privacy/README.md): Roles; [DPIA template](../../../../governance/privacy/dpia/template.md): Approvals                                                                                         | Privacy Lead/DPO, Security Lead and Surface Owner responsibilities; DPIA sign-off roles. Template is not a completed assessment for this flow.                                                                                                                                                                                                                                  |
| E10 | [Data Classification Policy](../../../../governance/privacy/policies/data-classification-policy.md): sections 3-5; [Standard](../../../../governance/privacy/policies/data-classification-standard.md): control matrix                             | Surface Owner classifies stores, Privacy Lead arbitrates, Platform Lead enforces; PII at least Confidential. No producer-status-specific tier approval established here.                                                                                                                                                                                                        |
| E11 | [Data Retention Policy](../../../../governance/privacy/policies/data-retention-policy.md): sections 3-5; [Schedule](../../../../governance/privacy/policies/data-retention-schedule.md): security audit row and Verification                       | Surface Owner defines, Privacy Lead approves, Platform Lead implements. Schedule lists security audit retention of 1 year hot/6 years cold; policy caps logs containing personal data at 30 days. Applicability to these actor-bearing disclosure audits requires explicit privacy reconciliation, not automatic adoption. No producer-status disclosure schedule is specified. |
| E12 | [Governance doctrine](../../../../governance/corporate/governance/governance-docs.md): sections 3, 4, 6; [Board decision tracker](../../../../governance/corporate/governance/checklist-board-decision-tracker.md): Tracker Fields and Usage Notes | Legal/Compliance and Product & Impact committees, governance escalation and recorded decision evidence. No delegated approver/quorum for this source disclosure is specified; IP/equity voting thresholds cannot be repurposed.                                                                                                                                                 |
| E13 | [acceptance.integration.test.ts](../../../../apps/cora/lib/farmer-360/acceptance.integration.test.ts): authenticated route, source-change and audit assertions; [cora-farmer360.ts](../../../../packages/db/src/schema/cora-farmer360.ts)          | Disposable local PostgreSQL acceptance exercises an actual Agrimo producer row, proves withheld status is absent from the response, no-store headers are present, source reads do not alter Cora context/assertion history, and source-disclosure audit metadata omits value and source record ID.                                                                              |
| E14 | [CORA Farmer 360 API and app surface inventory](CORA_SOURCE_DISCLOSURE_CONDITION_LEDGER.md#verified-engineering-boundary)                                                                                                                          | At this inspected worktree, the only Farmer 360 route is profile GET; no Farmer 360 export/bulk/report API, server action, scheduled job, analytics consumer, or UI service consumer was found. Post-display copying cannot be controlled by this API.                                                                                                                          |

## 3. Exact candidate boundary

Approved in principle, subject to all mandatory conditions in C1-C9:

- Source: `agrimo` / `agriculture` / `producer`; authority class
  `agrimo:operational-producer-record`; field/fact class `producer.status`.
- Destination: `cora`; surface `farmer360`; action `read`; only the
  `evidence-confidence` section. The existing GET API is the proposed
  exposure path, not evidence of approved UI display or HTTP acceptance.
- Recipient: exact same canonical organization as the source record; active
  canonical identity binding and membership; `cora:farmer360:read`.
  Proposed role allowlist is only `viewer`, narrower than unrestricted
  permission holders; role eligibility remains subject to human approval.
- Purpose token: `farmer360.operational-read`. Human purpose statement:
  view current producer-record status as a partial source-evidence indicator,
  never as proof of production, economics, eligibility, certification,
  capacity, or consent.
- Provenance: source system/domain/entity/authority, record ID, source org,
  fact class, observed timestamp and provenance reference must exist;
  system/record/org/class/timestamp must match the fact. No inferred
  cross-product identity based on contact details or names. Adapter reference
  format: `agrimo:producer:<producer.id>:<sourceObservedAt>` (E2).
- Values submitted for review: `active`, `inactive`, `suspended`.
  Their sensitivity and permissibility are unresolved. The schema has no
  value-level allowlist: approving a subset would require later enforcement.
- No historical status series, export, onward disclosure, secondary analytics,
  marketing, AI use, contact details, geography, farm economics or operational
  writes. External vendor integration is not applicable to this candidate.
- Proposed storage boundary: transient request projection only, no persistent
  status snapshot/cache; separate minimized decision audit. No browser,
  intermediary or shared caching is authorized by this proposal.

**Engineering certification and limits:** the source-disclosure evaluator
requires an exact versioned fact contract and allowed value, and a separately
versioned freshness policy as an authorization input. Its tests cover inside,
exact, and outside age boundaries, invalid/future timestamps, and missing
freshness policy. The prior defect substituted `createdAt` for missing/invalid
`updatedAt`, allowing record creation time to masquerade as observation time.
The C5 repair removes that substitution: only a valid `updatedAt` supplies
`observedAt`; missing, null or invalid update time becomes absent observation
time in the typed fact and provenance contracts. The evaluator withholds it
with `FACT_TIMESTAMP_INVALID`. Future update time is preserved and rejected
with `FACT_TIMESTAMP_IN_FUTURE`; stale time is withheld under the synthetic
test-only policy. Tests traverse the real adapter, shared authority and service
response filter, including a recent valid `createdAt` that cannot rescue
disclosure. Creation time is not needed in this status projection and is not
copied into authority metadata. The canonical producer record retains it.

The 90-day adapter threshold only labels presentation freshness; it is not an
authorization duration. No production freshness interval has been
institutionally approved. The production freshness-policy registry remains
empty. `C5_ENGINEERING = READY_FOR_APPROVED_FRESHNESS_POLICY`;
`C5_HUMAN = PENDING_SOURCE_AUTHORITY`. Technical readiness to enforce a policy
is not itself an approved policy.

The source-disclosure evaluator independently requires
`membershipRoleSource === "canonical"` and an exact policy role match.
`resolve-org.ts` still maps otherwise-unmatched canonical role strings to the
presentation category `viewer`, but tags that role as `fallback`; that category
cannot satisfy source-disclosure eligibility. The human decision on which
canonical roles are appropriate remains open.

The Farmer 360 route is dynamic, has framework revalidation/cache disabled,
and sets explicit private no-store response headers. Source status is projected
in memory and is not a Cora domain-storage field or durable cache entry;
disclosure audit records omit source status and source record ID. The source
repository still reads a full producer row internally, and retention, consent,
onward-use and revocation governance remain unresolved. The activation
preflight validates a draft package with current, cross-referenced evidence and
never installs a policy; the recorded conditional direction alone does not
satisfy it or activate the candidate.

## 4. Ten-question answer classification

Each sub-answer is independently classified. `REPOSITORY_PROVEN` means a
technical/doctrinal fact only; all other states name the required authority.
Nothing in this section is `APPROVED`.

| #   | Original question / sub-answer                                        | Classification                    | Answer or unresolved decision                                                                                                                                                                                                                                             | Evidence / required authority                                                                                                                     |
| --- | --------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1a  | Operational source ownership                                          | `REPOSITORY_PROVEN`               | Originating product owns operational producer records; Cora cannot write them.                                                                                                                                                                                            | E6, E7                                                                                                                                            |
| 1b  | Accountable source institution and power to bind it                   | `SOURCE_OWNER_DECISION_REQUIRED`  | Identify institution, data authority, delegated signatory and mandate evidence.                                                                                                                                                                                           | Source institution's data owner; Agrimo business owner routes request (E8), not presumed signatory.                                               |
| 2a  | Exact technical source/field/value domain                             | `REPOSITORY_PROVEN`               | Exact source tuple in section 3; status enum in current schema; no dataset version identifier in policy.                                                                                                                                                                  | E1, E2, E6                                                                                                                                        |
| 2b  | Authorized source/schema coverage and future changes                  | `SOURCE_OWNER_DECISION_REQUIRED`  | Approve this inspected field and enum, require re-review on schema/semantic change; decide if all three values may be disclosed.                                                                                                                                          | Source data owner with Agrimo technical owner.                                                                                                    |
| 3   | Controller, jurisdiction and privacy tier                             | `LEGAL_PRIVACY_REVIEW_REQUIRED`   | Establish accountable controller(s), applicable law, assessment need and classification of linked status/IDs/audit.                                                                                                                                                       | Privacy Lead/DPO and qualified legal authority for source/recipient institutions (E9, E10).                                                       |
| 4a  | Technical recipient gate                                              | `REPOSITORY_PROVEN`               | Cora app/surface, same-org, active canonical binding/membership, exact permission, canonical-role provenance, and exact policy role match.                                                                                                                                | E1, E3, E4                                                                                                                                        |
| 4b  | Which recipient organizations/roles are authorized                    | `INSTITUTIONAL_DECISION_REQUIRED` | Ratify this candidate's same-org relationship and proposed viewer-only role for the specific source origin and purpose; this does not decide cross-org participation or presume one source authority for all origins.                                                     | Authority evidenced for this fact/origin and recipient relationship, Cora product owner; institutional delegated approver.                        |
| 5a  | Implemented purpose token                                             | `REPOSITORY_PROVEN`               | `farmer360.operational-read`; no export purpose is submitted.                                                                                                                                                                                                             | E3                                                                                                                                                |
| 5b  | Necessity, purpose compatibility and prohibited secondary uses        | `INSTITUTIONAL_DECISION_REQUIRED` | Ratify the human purpose statement and prohibitions in section 3.                                                                                                                                                                                                         | Source data authority and Cora product owner, with Privacy Lead review.                                                                           |
| 6   | Lawful basis, consent need, refusal/withdrawal/expiry                 | `LEGAL_PRIVACY_REVIEW_REQUIRED`   | No agricultural disclosure consent/basis approval is established; app permission is not consent. Determine basis and enforceable withdrawal controls.                                                                                                                     | Privacy Lead/DPO, legal authority and source controller; if consent is required, later technical enforcement is mandatory.                        |
| 7a  | Identity/org verification mechanism                                   | `REPOSITORY_PROVEN`               | Server-owned identity binding, active membership and app grant; source org equality. No cross-org relationship is supported by this policy schema.                                                                                                                        | E1, E4, E6                                                                                                                                        |
| 7b  | Sufficiency of linkage and recipient relationship                     | `SOURCE_OWNER_DECISION_REQUIRED`  | Ratify exact source-subject reference and same-org membership as sufficient for this purpose; no name/contact inference.                                                                                                                                                  | Source data authority with Cora Surface Owner and Privacy Lead.                                                                                   |
| 7c  | Cross-org exception                                                   | `NOT_APPLICABLE`                  | Excluded, not an unresolved request to broaden this candidate.                                                                                                                                                                                                            | E1 and section 3; any future cross-org use needs a separate proposal.                                                                             |
| 8a  | Existing freshness/source-change behavior                             | `REPOSITORY_PROVEN`               | Versioned freshness enforcement covers missing/invalid/future/stale timestamps and exact boundaries. The repaired adapter preserves absent observation time; recent creation time cannot rescue disclosure. End-to-end adapter/authority/service tests prove withholding. | E1, E2, source-disclosure tests and Farmer 360 adapter tests                                                                                      |
| 8b  | Freshness eligibility, correction SLA, suspension meaning             | `SOURCE_OWNER_DECISION_REQUIRED`  | Decide maximum usable age, whether stale/unknown or suspended values can be shown, correction process and authority/consent-change handling; no production authorization freshness duration is configured.                                                                | Source data owner with Privacy Lead and Cora technical owner.                                                                                     |
| 9a  | Actual API/audit/minimization boundary                                | `REPOSITORY_PROVEN`               | Status is projected after an org-filtered full-row read; withheld facts are absent from response; disclosure audit is value/source-record-ID free; route is dynamic and no-store.                                                                                         | E2-E6, E13                                                                                                                                        |
| 9b  | Retention, caching, export prohibition and deletion                   | `LEGAL_PRIVACY_REVIEW_REQUIRED`   | Ratify no export/onward use/cache; establish status and audit lifecycle, reconcile log retention doctrine, resolve data-subject rights/legal holds.                                                                                                                       | Privacy Lead/DPO and source controller, with Cora Surface Owner/Platform Lead (E9-E11).                                                           |
| 10a | Policy/audit mechanisms and organizational roles                      | `REPOSITORY_PROVEN`               | Version/effective dates, inactive/revoked withholding and durable decision audit; accountable team aliases and privacy roles exist.                                                                                                                                       | E1, E5, E8-E12                                                                                                                                    |
| 10b | Actual approver, policy owner, review/expiry and revocation authority | `INSTITUTIONAL_DECISION_REQUIRED` | Establish delegation/quorum, accountable policy owner, finite dates, review cadence, suspension/revocation SLA and attestation evidence.                                                                                                                                  | Delegated institutional disclosure approver plus source/product/privacy authorities; route via product escalation and Legal/Compliance (E8, E12). |

## 5. Governance decision matrix

Status is an answer classification, not an approval. All proposed rules need
ratification; repository evidence does not authorize disclosure.

| Dimension                 | Proposed rule                                                                                                           | Evidence                                                                   | Authority                                                                   | Status                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------- |
| Source ownership          | Source institution retains status authority; Cora read-only                                                             | E6, E7; institution/delegation absent                                      | Source institution's delegated data owner                                   | `SOURCE_OWNER_DECISION_REQUIRED`  |
| Fact classification       | Only linked `producer.status`; assess sensitivity of all enum values and identifiers; do not call it public             | E6, E10                                                                    | Source Surface Owner + Privacy Lead/DPO                                     | `LEGAL_PRIVACY_REVIEW_REQUIRED`   |
| Recipient scope           | Cora Farmer 360 only; participating recipient orgs to be ratified                                                       | E1-E4                                                                      | Source authority + Cora business owner                                      | `INSTITUTIONAL_DECISION_REQUIRED` |
| Organization relationship | Exact same canonical source/recipient org; never cross-org                                                              | E1, E4, E6 enforce equality                                                | Platform authority mechanism proven; human ratification Q4b/Q7b             | `REPOSITORY_PROVEN`               |
| Purpose                   | Exact token and narrow human statement in section 3; no secondary uses                                                  | E3 proves token only                                                       | Source authority + Cora product owner                                       | `INSTITUTIONAL_DECISION_REQUIRED` |
| Application permission    | `cora:farmer360:read`; canonical active binding and membership also required                                            | E1, E4                                                                     | Canonical platform authorization; source approval separate                  | `REPOSITORY_PROVEN`               |
| Role restrictions         | Only `viewer` proposed; no other role admitted by candidate                                                             | E1 supports exact role list; no approval                                   | Source authority + Cora business owner                                      | `INSTITUTIONAL_DECISION_REQUIRED` |
| Lawful/privacy basis      | Document controller, jurisdiction, necessity and applicable lawful basis before installation                            | E9, E10; flow-specific assessment absent                                   | Privacy Lead/DPO + legal authority                                          | `LEGAL_PRIVACY_REVIEW_REQUIRED`   |
| Consent requirements      | No implied consent; if required, condition installation on enforceable grant/withdrawal checks                          | E1-E3 do not implement read consent                                        | Source controller + Privacy Lead/DPO/legal                                  | `LEGAL_PRIVACY_REVIEW_REQUIRED`   |
| Freshness                 | Current-row view; decide acceptable age and stale/unknown eligibility; 90 days is not approved                          | E2 labels only                                                             | Source data owner + Cora Surface Owner                                      | `SOURCE_OWNER_DECISION_REQUIRED`  |
| Historical data           | Exclude status history/reconstruction; existing label is not historical eligibility                                     | E2 reads one current row                                                   | Source data authority                                                       | `SOURCE_OWNER_DECISION_REQUIRED`  |
| API/UI exposure           | Existing authenticated GET response, evidence-confidence section only; no new UI or HTTP acceptance                     | E3, E4, E14                                                                | Cora Surface Owner + source authority                                       | `INSTITUTIONAL_DECISION_REQUIRED` |
| Export                    | Prohibited for this candidate; no CSV/PDF/passport/bulk use                                                             | E1, E14 show no matching export/bulk surface; client copying not prevented | Source authority + Privacy Lead                                             | `INSTITUTIONAL_DECISION_REQUIRED` |
| Onward disclosure         | Prohibited; requires independent approval, never inferred from read access                                              | E1, E14; API cannot prevent post-display copying                           | Source authority + Privacy Lead/legal                                       | `INSTITUTIONAL_DECISION_REQUIRED` |
| Caching                   | No persistent/browser/shared cache proposed; maintain no-store and define invalidation requirements before installation | E4, E13 prove dynamic/no-store route headers; no cache-purge workflow      | Privacy Lead + Cora/Platform technical owners                               | `LEGAL_PRIVACY_REVIEW_REQUIRED`   |
| Retention                 | No status snapshot; approve separate actor-bearing audit lifecycle and legal holds; reconcile 30-day vs audit schedule  | E5, E11                                                                    | Privacy Lead/DPO + source controller; Surface Owner proposes                | `LEGAL_PRIVACY_REVIEW_REQUIRED`   |
| Correction                | Source corrects status; next read reflects current row; no Agrimo writes by Cora; define notification/propagation SLA   | E2, E6, E7                                                                 | Source data owner + Cora Surface Owner                                      | `SOURCE_OWNER_DECISION_REQUIRED`  |
| Revocation                | Suspend/revoke or remove approved rule, then prove next-read withholding; define owner, SLA and cache treatment         | E1, E2; no admin workflow/cache purge proof                                | Source authority + institutional policy owner; Platform Lead executes later | `INSTITUTIONAL_DECISION_REQUIRED` |
| Audit                     | Per-decision durable org/actor/purpose/policy metadata, hash chained, no status values/source IDs; failure blocks read  | E1, E5                                                                     | Platform audit implementation proven; Privacy Lead sets retention           | `REPOSITORY_PROVEN`               |
| Policy review cadence     | Finite expiry and review date required; exact cadence decided, plus review on material source/use/legal change          | E1 supports expiry; E10/E11 are general doctrine                           | Institutional policy owner + Privacy Lead/source authority                  | `INSTITUTIONAL_DECISION_REQUIRED` |
| Policy owner              | Named accountable role/person and deputy, with evidenced mandate; engineering cannot self-authorize                     | E8/E12 route only, not delegation                                          | Institutional delegated disclosure approver                                 | `INSTITUTIONAL_DECISION_REQUIRED` |

## 6. Candidate policy record -- inactive documentary proposal

`STATUS = PROPOSED_NOT_ACTIVE`

Candidate ID: `cora-farmer360-agrimo-producer-status-same-org-viewer`  
Version: `1.0.0`  
Candidate location: this section only; NOT the runtime registry.

The following JSON is a documentary candidate, deliberately **not an
installable `SourceDisclosurePolicy`**. Nulls are mandatory unresolved fields,
not defaults. `status: draft` is the runtime schema's inactive status if a
later authorized implementation materializes a draft; it does not alter the
registry. Conditional approval of the direction is not a policy decision that
can produce `ALLOW`. A separately authorized record must supply actual
authority/evidence references, finite ISO-8601 UTC effective and expiry dates,
approved status allowlist and enforceable conditions. Activation is outside
this mission.

```json
{
  "candidateStatus": "PROPOSED_NOT_ACTIVE",
  "runtimePolicyDraft": {
    "id": "cora-farmer360-agrimo-producer-status-same-org-viewer",
    "version": "1.0.0",
    "status": "draft",
    "effectiveFrom": null,
    "effectiveTo": null,
    "governingAuthorityRef": null,
    "governanceEvidenceRef": null,
    "rationale": "Current producer-record status as a partial Farmer 360 source-evidence indicator only; no operational, economic, eligibility or certification inference.",
    "source": {
      "system": "agrimo",
      "domain": "agriculture",
      "entity": "producer",
      "authorityRef": "agrimo:operational-producer-record",
      "factClass": "producer.status"
    },
    "recipient": {
      "applicationId": "cora",
      "surface": "farmer360",
      "action": "read",
      "purpose": "farmer360.operational-read",
      "organizationRelationship": "same-organization",
      "requiredPermission": "cora:farmer360:read",
      "requiredMembershipState": "active",
      "eligibilityPrimitive": "canonical-membership-role",
      "roles": ["viewer"]
    },
    "factContract": {
      "id": null,
      "version": null
    },
    "freshnessPolicy": {
      "id": null,
      "version": null
    },
    "activationEvidence": {
      "sourceAuthority": null,
      "privacyLegal": null,
      "governanceApproval": null,
      "cacheRetentionDisposition": null,
      "auditDisposition": null,
      "recipientEligibility": null,
      "exportOnwardDisclosure": null,
      "conditionAttestation": null,
      "suspensionProcedure": null,
      "revocationProcedure": null,
      "revocationAuthority": null
    },
    "decision": null
  }
}
```

Scope restrictions in section 3 and the matrix are inseparable from this
candidate. They are not additional runtime schema fields. Approval must
explicitly resolve or condition every control unsupported by that schema.
Changing field, role, purpose, surface or organization scope requires a new
reviewed candidate/version, not an implied extension.

## 7. Approval authority and routing

| Approval responsibility            | Repository-established role or routing evidence                                                                                                                                                        | Required authority evidence before decision                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source ownership/data authority    | Agrimo business owner `team-agrimo-business@nzila.ai`; technical owner `team-agrimo-engineering@nzila.ai` (E8); operational origin-system ownership E7                                                 | For this fact and source-to-recipient relationship, identify each institution with disclosure authority and its evidenced delegation. Product/team ownership alone is insufficient; no universal Agrimo controller is inferred. |
| Product/application owner          | Cora business owner `team-cora-business@nzila.ai`; technical owner `team-cora-engineering@nzila.ai` (E8); Surface Owner responsibilities E9-E11                                                        | Accountable product representative confirms purpose, roles, exposure and ability to meet conditions. No named person is established.                                                                                            |
| Privacy/legal                      | Privacy Lead/DPO, qualified institutional legal authority; Security Lead participates in risk/control review (E9-E11); Legal/Compliance routing E12                                                    | Completed applicable privacy/legal assessment, basis/consent, classification, rights and retention disposition; name and appointment/mandate evidence.                                                                          |
| Institutional governance           | Required role: institutional delegated disclosure approver. `director-product@nzila.ai` is the Agrimo/Cora escalation alias (E8); Legal/Compliance and Product & Impact committees are described (E12) | Identify actual decision-making body/person, delegation, required concurrences and quorum if applicable. Neither escalation alias, document owner nor generic board threshold proves authority.                                 |
| Technical implementation custodian | Platform Lead, Cora technical owner and runtime owner `team-platform-ops@nzila.ai` (E8-E11)                                                                                                            | Implements a later approved rule and conditions; cannot substitute tests, deployment access or technical ownership for institutional approval.                                                                                  |

No person is appointed by this packet. No signature, vote, lawful basis,
consent exemption or institutional mandate is simulated. The human authority
must establish the approval chain before executing the
[approval record template](CORA_SOURCE_DISCLOSURE_APPROVAL_RECORD_TEMPLATE.md).

## 8. Decision procedure and stop gate

The [human decision register](CORA_DISCLOSURE_HUMAN_DECISION_REGISTER.md)
now indexes C1-C9 review packets, workflow states, authority lanes,
recommended dependencies and the future evidence-ingestion contract.
`CORA_HUMAN_GOVERNANCE_CLOSURE = READY_FOR_DECISIONS` means prepared questions
and explicit missing evidence, not approved conditions or activation.

1. Preserve the recorded `APPROVE_WITH_CONDITIONS` direction and close C1-C9
   only against the evidence and authorities identified in the condition
   ledger. Repository evidence cannot satisfy a human decision by inference.
2. Complete the decision record with authority mandate, actual approval
   evidence, dates and conditions. The present conversation direction is not
   a verified institutional delegation or signed approval instrument.
3. A conditional decision does not authorize installation. Any unsupported
   control is a separate implementation/proof prerequisite.
4. Only a later explicitly authorized mission may validate and install an
   approved narrow policy, prove its positive and revocation paths, and
   resume authenticated HTTP acceptance. Approval alone does not change
   Farmer 360's `DESIGN_ONLY` capability truth.

Preparation is decision-ready when evidence and unknowns are separated,
the inactive candidate and unsigned template are complete, authority is
identified by role with delegation gaps explicit, and required checks pass
without runtime mutation. Decision-ready does not mean disclosure-approved.

Until then and until a later authorized activation, Agrimo facts remain
`WITHHOLD`. Do not start Value Opportunity.
