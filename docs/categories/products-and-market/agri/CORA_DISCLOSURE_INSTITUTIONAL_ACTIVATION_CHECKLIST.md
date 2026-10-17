# CORA Final Institutional Activation Checklist

**Checklist ID:** `CORA-DISCLOSURE-INSTITUTIONAL-001`  
**Version:** `1.0.0`  
**Status:** `AWAITING_INSTITUTIONAL_APPROVER`  
**Activation authorization:** `NOT_GRANTED`

Lane D C8. This is a future approval checklist, not an activation instruction.
All items below are unchecked. Engineering remains `PASS`; human decisions
remain open in the [register](CORA_DISCLOSURE_HUMAN_DECISION_REGISTER.md).

## 1. Authority and policy materialization values

The accountable role is the **institutional delegated disclosure approver**.
No named person, quorum, or disclosure delegation is established by generic
board doctrine or ownership aliases. Route through the existing packet's
[authority table](CORA_SOURCE_DISCLOSURE_AUTHORIZATION_PACKET.md#7-approval-authority-and-routing).
Source owner, CORA product owner and Privacy/Legal concurrence must be evidenced.

| Required value                                  | Current value                                | Acceptance criterion                                                           |
| ----------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| Policy owner and deputy                         | UNSET                                        | Named accountable role/person, appointment and contact                         |
| Source owner and controlling entity             | UNSET                                        | C1 delegation and scope evidence                                               |
| CORA product owner                              | UNSET                                        | Product mandate and C4/C7 decisions                                            |
| Institutional approver/body                     | UNSET                                        | Identity, delegation instrument and applicable quorum                          |
| Approval authority reference                    | UNSET                                        | Stable mandate reference covering this disclosure                              |
| Candidate ID/version                            | Proposed same-org viewer candidate / `1.0.0` | Bind reviewed content/revision/hash; role change requires reviewed new version |
| Materialized policy/contract/freshness versions | UNSET                                        | Exact cross-references, no implicit latest-version selection                   |
| Effective/expiry/review dates                   | UNSET                                        | Finite ISO-8601 UTC values; effective < review <= expiry                       |
| Review cadence and triggers                     | UNSET                                        | Owner, schedule and material-change review rules                               |
| Suspension/revocation authorities               | UNSET                                        | Named delegate/mandate, deputy and evidence                                    |
| Revocation SLA                                  | UNSET                                        | Approved timing, request path, propagation and proof obligations               |
| Incident suspension process                     | UNSET                                        | Who triggers, who executes, how verified/notified and how reinstated           |
| Evidence references and conditions              | UNSET                                        | Complete scope-bound current evidence, closed obligations and prohibited uses  |

## 2. Final closure checklist

- [ ] C1 source authority approved with mandate, institution and contracts.
- [ ] C2 signed status meanings and allowlist; future/unlisted values withheld.
- [ ] C3 qualified privacy/legal pass or pass with closed enforceable conditions.
- [ ] C4 exact enforceable recipient roles, purpose and source concurrence.
- [ ] C5 approved finite freshness/correction policy; creation time not substituted.
- [ ] C6 approved cache/reference/retention/rights/holds disposition.
- [ ] C7 product exclusions and source/privacy residual-use obligations.
- [ ] C9 audit doctrine conflict resolved by approved schedule/exception.
- [ ] C8 actual delegated approver, owners, dates and evidence established.
- [ ] Conditions/unsupported rules have implementation and proof evidence;
      none silently treated as supported or waived.
- [ ] Signed approval instrument binds exact candidate scope, versions,
      prohibitions, review, suspension and revocation mechanisms.
- [ ] A later explicit mission is authorized separately for non-mutating
      preflight, policy installation and runtime acceptance.

`C8_HUMAN = POLICY_GOVERNANCE_COMPLETE` requires evidence for all C8 fields
and required concurrences, not completed checkboxes alone. No C1-C9 condition
is closed by this checklist. Rejection, expiry, missing evidence, changed
scope or unresolved obligations retain the activation block.

## 3. Evidence ingestion contract

Use repository governance documents, not a new database. Each real approval
is captured as an immutable/versioned decision section or record under the
existing [conditional decision record](CORA_SOURCE_DISCLOSURE_APPROVAL_RECORD_TEMPLATE.md).
Preserve the historical conditional direction; do not overwrite it as final
approval. Register the actual evidence reference in the corresponding Cn row.
Sensitive executed instruments stay in institution-approved restricted storage;
the repository records a durable access-controlled reference and content
hash, not personal signatures or confidential source records.

Every ingested approval must contain:

- Stable decision ID `CORA-DISCLOSURE-Cn-<sequence>`; evidence ID
  `cora-disclosure:evidence:Cn:<sequence>:<version>` (proposed namespace,
  not existing approval). Supersessions get a new version/reference.
- Approving authority's name/role/institution, mandate reference and consulted
  concurrences; actual signature/attestation verification metadata.
- Decision/outcome, rationale, date, record version, exact candidate
  ID/version, source class, same-org recipient/purpose and reviewed artifact
  hash/revision; conditions/prohibitions and scope exclusions.
- Effective/review/expiry dates, review owner/triggers, suspension/revocation
  authority and mechanism; restricted instrument reference/hash.
- Engineering/process dependencies with proof references; missing evidence,
  conditional direction or stale/revoked evidence never maps to `approved`.

| Approval | Canonical record                                          | Later preflight field(s)                                                                                                                                                   | Required payload beyond common fields                                                                                                      |
| -------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| C1       | Decision record C1 section + mandate instrument reference | `sourceAuthority`                                                                                                                                                          | Controller, delegated source authority and exact permitted scope                                                                           |
| C2       | Decision record C2 + completed source packet table        | Contract `evidenceRef`, package `factContract`                                                                                                                             | Versioned `id`, `version`, `sourceSystem`, `factClass`, nonempty approved `allowedValues`                                                  |
| C3       | Decision record C3 + completed assessment reference       | `privacyLegal`                                                                                                                                                             | Basis/consent/rights/classification and closed conditions                                                                                  |
| C4       | Decision record C4 + signed role table                    | `recipientEligibility`                                                                                                                                                     | Exact runtime `roles`, canonical mapping scope, membership/permission/purpose concurrence                                                  |
| C5       | Decision record C5 + approved freshness table             | Freshness `evidenceRef`, package `freshnessPolicy`                                                                                                                         | Versioned `id`, `version`, positive integer `maxAgeMs`; stale/invalid/future `withhold`; optional `withheldValues`; correction obligations |
| C6       | Decision record C6 + schedule/exception references        | `cacheRetentionDisposition`                                                                                                                                                | Per-store periods/triggers/disposal, no-copy posture and holds/process evidence                                                            |
| C7       | Decision record C7 + user-policy/contract references      | `exportOnwardDisclosure`                                                                                                                                                   | Prohibitions, manual-copy obligations and B/C concurrence                                                                                  |
| C8       | Final decision record C8 + delegated approval instrument  | `governanceApproval`, `conditionAttestation`, `suspensionProcedure`, `revocationProcedure`, `revocationAuthority`; policy `governingAuthorityRef`, `governanceEvidenceRef` | All owners/dates, closed C1-C9 dependencies, processes and signed final scope                                                              |
| C9       | Decision record C9 + governing schedule or exception      | `auditDisposition`                                                                                                                                                         | Classified audit inventory, chosen authority-approved doctrine and executable process                                                      |

Actual strict schema source:
[source-disclosure.ts](../../../../packages/platform-auth/src/source-disclosure.ts),
`sourceDisclosurePolicySchema`, `sourceDisclosureFactContractSchema`,
`sourceDisclosureFreshnessPolicySchema`, `sourceDisclosureActivationPackageSchema`.
Future evidence projection is exactly
`{ reference, state: "approved", effectiveFrom, expiresAt }`; do not add
signature/owner fields to that strict runtime object. Those remain in the
linked human instrument. Evidence must be current, scope-matched, and have
the identical reference used by policy/contract/freshness definitions.

The future preflight package has `policy`, `contracts`, `freshnessPolicies`,
and `evidence` containing all eleven policy evidence slots plus `factContract`
and `freshnessPolicy`. Supply `reviewBy` as well as effective/expiry dates.
Policy stays `draft` for preflight, which always returns `installsPolicy: false`.
This mission creates neither a package nor runtime evidence objects.
Preflight validates structural/evidence metadata; it does not verify legal
delegation or signatures by itself. Human verification precedes projection.

### Policy-field provenance for later materialization

| Exact policy field                                                                                                                                             | Required origin                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `id`, `version`, `rationale`, `decision`                                                                                                                       | C8 approved instrument binding the exact scoped grant or denial                                       |
| `status`                                                                                                                                                       | `draft` for non-mutating preflight; changing to active is outside this mission                        |
| `effectiveFrom`, `effectiveTo`, `reviewBy`                                                                                                                     | C8 approved effective, expiry and review timestamps                                                   |
| `governingAuthorityRef`, `governanceEvidenceRef`                                                                                                               | Verified C8 mandate and approval references                                                           |
| `source.system`, `source.domain`, `source.entity`, `source.authorityRef`, `source.factClass`                                                                   | Exact C1-approved source scope from the candidate; no wildcard substitution                           |
| `recipient.applicationId`, `recipient.surface`, `recipient.action`, `recipient.purpose`                                                                        | C4/C7 approved CORA purpose-bound surface                                                             |
| `recipient.organizationRelationship`, `recipient.requiredPermission`, `recipient.requiredMembershipState`, `recipient.eligibilityPrimitive`, `recipient.roles` | C4 exact same-organization, read permission, active, canonical-membership-role and enforceable roles  |
| `factContract.id`, `factContract.version`                                                                                                                      | C2 approved immutable contract reference                                                              |
| `freshnessPolicy.id`, `freshnessPolicy.version`                                                                                                                | C5 approved immutable freshness reference                                                             |
| `activationEvidence`                                                                                                                                           | The eleven C1/C3/C4/C6/C7/C8/C9 references mapped above; not the thirteen evidence objects themselves |

The `decision` field supports `ALLOW` or `DENY`; the present runtime
`WITHHOLD` outcome is not a policy decision value. A rejection remains a
documented outcome and blocker here, not an instruction to install a DENY
policy. Every later field must match the reviewed instrument, including
scope/version/date consistency; never derive a grant from enum membership.

## 4. Stop boundary

No runtime registry population, production allowlist/freshness threshold,
policy activation, HTTP acceptance, deployment or maturity change.
`CORA_DISCLOSURE_ACTIVATION = BLOCKED_HUMAN_CONDITIONS` remains correct.
First next action: source-authority intake using C1, not generic engineering
continuation. Technical readiness and completed packets are not approval.
