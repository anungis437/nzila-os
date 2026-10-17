# CORA Source Authority Decision Packet

**Packet ID:** `CORA-DISCLOSURE-SOURCE-001`  
**Version:** `1.0.0`  
**Status:** `AWAITING_SOURCE_AUTHORITY`

Covers Lane B C1/C2/C5 in the
[human decision register](CORA_DISCLOSURE_HUMAN_DECISION_REGISTER.md).
All answers, signatories, mandates, dates and approval references remain
UNSET. Candidate `1.0.0` is inactive; no source authorization is presumed.
Use the [existing decision record](CORA_SOURCE_DISCLOSURE_APPROVAL_RECORD_TEMPLATE.md)
to capture real decisions, not a simulated signature.

## 1. Exact request and authority intake (C1)

The completed [C1 discovery and intake](CORA_C1_SOURCE_AUTHORITY_INTAKE.md)
records origin-scoped authority classes, relationship evidence, restrictions,
sendable request and unresolved C1 decision record. Its disposition is
`C1_AUTHORITY_MODEL = ORIGIN_SCOPED_READY` for the documentary model only.
The authority chain for this disclosure remains unresolved:
`C1_SOURCE_AUTHORITY = READY_FOR_HUMAN_DECISION` and
`C1_HUMAN = PENDING_SOURCE_AUTHORITY` are unchanged. No universal Agrimo
controller is presumed.
Use that record for the C1-only next decision; C2/C5 below are deferred.

Only Agrimo `agri_producers.status` / `producer.status`, provenance authority
`agrimo:operational-producer-record`, to CORA Farmer 360 profile read,
same organization, active canonical binding/membership,
`cora:farmer360:read`, purpose `farmer360.operational-read`.
No history, operational writes, cross-org access or onward disclosure is requested.
Technical source scope is proven by E1-E7 in the
[evidence catalogue](CORA_SOURCE_DISCLOSURE_AUTHORIZATION_PACKET.md#2-canonical-repository-evidence).

Routing: Agrimo business owner `team-agrimo-business@nzila.ai`, technical
owner `team-agrimo-engineering@nzila.ai`. These aliases are not the delegate.
Accountable reviewer: source institution's delegated data owner; legal
authority checks mandate/contract limitations.

| Mandatory question                                             | Answer/evidence required                                                                                    |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Which institutions have authority over this fact's disclosure? | UNSET: fact origin, operational steward, producer/source relationship, recipient, and relevant institutions |
| Who may authorize each required authority link?                | UNSET: person/body, role, institution, appointment, and mandate                                             |
| Which documents establish delegation and inherited terms?      | UNSET: executed mandate/instrument, covered facts/organizations, term, restrictions, and quorum if relevant |
| Does authority cover `producer.status` specifically?           | UNSET: explicit fact/scope authorization, not generic product or tenant ownership                           |
| Does it cover this same-org Cora purpose and recipient?        | UNSET: recipient institution/organization, purpose, relationship, conditions, and restrictions              |
| Which producer rights or upstream/provider terms apply?        | UNSET: evidenced relationship, applicable rights, and source/provider instruments; refer basis to C3        |

Closure: `C1_HUMAN = APPROVED_SOURCE_AUTHORITY` only with evidence.
Restriction/rejection/defer are valid outcomes. Failure to establish authority
retains withholding and blocks C2/C5 final approval.

## 2. Canonical meanings and allowlist (C2)

The [DB enum](../../../../packages/db/src/schema/agri.ts) and
[agri-core enum](../../../../packages/agri-core/src/enums.ts) establish values,
not business meanings or permission to disclose. The DB default `active`
does not establish verified operational eligibility, certification, legal
standing or capacity. Source owner must define each meaning.

| Value       | Canonical meaning      | Eligible for CORA? | Display interpretation                        | Conditions                         | Source-owner decision |
| ----------- | ---------------------- | ------------------ | --------------------------------------------- | ---------------------------------- | --------------------- |
| `active`    | UNSET: enum token only | UNSET              | UNSET; no eligibility/capacity inference      | UNSET                              | UNSET                 |
| `inactive`  | UNSET: enum token only | UNSET              | UNSET; no inferred reason for inactivity      | UNSET                              | UNSET                 |
| `suspended` | UNSET: enum token only | UNSET              | UNSET; no inferred disciplinary/legal meaning | UNSET; sensitivity review required | UNSET                 |

Required decisions: future/unrecognized values default withheld; deprecated
values remain excluded unless expressly versioned/approved; determine whether
`suspended` is particularly sensitive; confirm unknown/unrecognized values
always fail closed. Recommend **unlisted value = WITHHOLD**, without selecting
any value for production.

Closure: source-signed meanings/display/conditions table, explicit subset,
version and evidence reference supporting `C2_HUMAN = APPROVED_STATUS_ALLOWLIST`.
No selected values are materialized in runtime by this packet.

## 3. Freshness, correction and history (C5)

Engineering is `READY_FOR_APPROVED_FRESHNESS_POLICY`. No production freshness
interval has been institutionally approved. The 90-day presentation marker
does not authorize disclosure. Preserve `createdAt != status observation time`.
Changing that equivalence is not permitted by this mission; any later
source-documented alternative requires a separately reviewed change/proof.

| Decision required           | Response to record                                                          | Conservative recommendation                                                                                          |
| --------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Maximum usable age          | UNSET: finite positive duration, unit, rationale, evidence                  | No default duration                                                                                                  |
| Per-status freshness        | UNSET: same or differing limits and meaning                                 | Narrowest enforceable rule; do not imply current schema supports per-value limits                                    |
| Missing/invalid update time | UNSET: ratify fail-closed handling                                          | WITHHOLD; never substitute creation time                                                                             |
| Future update time          | UNSET: ratify handling and source clock correction                          | Preserve real time; WITHHOLD                                                                                         |
| Stale status                | UNSET: handling and user wording                                            | WITHHOLD, no fabricated replacement                                                                                  |
| Suspended/inactive handling | UNSET: disclose/withhold and conditions linked to C2/C3                     | Exclude unless explicitly approved                                                                                   |
| Correction SLA              | UNSET: responsible source party, timing, notification and incident channel  | Do not promise an engineering-selected SLA                                                                           |
| CORA propagation            | UNSET: expected next-read behavior, communication/verification and failures | No durable copy; source read per request, not a guaranteed latency SLA                                               |
| Historical status           | UNSET: confirm exclusion                                                    | No historical series or inferred changes                                                                             |
| Timestamp interpretation    | UNSET: confirm what `updatedAt` establishes for this fact                   | Creation time never supplies observation authority; record update is not necessarily independent status verification |

Current freshness schema accepts one `maxAgeMs` and optional `withheldValues`,
with mandatory stale/invalid/future withholding. Per-status ages, unlimited
freshness or different failure behavior are not assumed supported: mark as a
later implementation/proof dependency or revise the proposal. Do not weaken
certified controls to satisfy a decision.

Closure: `C5_HUMAN = APPROVED_FRESHNESS_CORRECTION_POLICY` only on source-signed
rules and product concurrence on correction/propagation, with C2/C3 constraints.
Submit resulting authority, contract and freshness evidence via the
[ingestion contract](CORA_DISCLOSURE_INSTITUTIONAL_ACTIVATION_CHECKLIST.md#3-evidence-ingestion-contract).
