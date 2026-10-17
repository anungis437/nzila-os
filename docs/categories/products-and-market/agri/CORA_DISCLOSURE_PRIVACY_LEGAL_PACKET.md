# CORA Privacy/Legal Review Packet

**Packet ID:** `CORA-DISCLOSURE-PRIVACY-001`  
**Version:** `1.0.0`  
**Status:** `AWAITING_PRIVACY_LEGAL`

Lane C C3/C6/C9, plus C7 concurrence. See the
[human decision register](CORA_DISCLOSURE_HUMAN_DECISION_REGISTER.md).
Accountable reviewers: Privacy Lead/DPO and qualified legal authority,
with identified source controller and CORA Surface Owner. Security Lead
consults; Platform Lead implements later approved controls. No jurisdiction,
lawful basis, exemption, classification, period or signature is selected here.

## 1. Scope and existing evidence

Exact flow: same-org Agrimo current `producer.status` to CORA Farmer 360 for
`farmer360.operational-read`, under active canonical membership and read
permission. Runtime registries are empty; status is withheld.
E1-E14 in the [existing catalogue](CORA_SOURCE_DISCLOSURE_AUTHORIZATION_PACKET.md#2-canonical-repository-evidence)
distinguish implemented controls from unresolved institutional evidence.
The source repository reads the full producer row (including contacts) before
in-memory status projection; include this processing in the assessment, even
though contact fields are not disclosed in the Farmer 360 status fact.

## 2. Flow-specific privacy determination (C3)

| Determination required                                    | Human answer / evidence                                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Controller/accountable entity and processor relationships | UNSET: identities, roles, agreements; use evidenced C1, not ownership aliases                                      |
| Applicable jurisdiction and law                           | UNSET: data subjects, controller, processing locations and legal analysis                                          |
| Personal-information classification                       | UNSET: status alone and linked producer/profile/actor identifiers; Surface Owner proposes, Privacy Lead arbitrates |
| Linked-data/profile implications                          | UNSET: linkage risk, excluded inferred attributes and permitted purpose                                            |
| Lawful basis                                              | UNSET: specific authority and applicability; generic schedule entries are not a flow determination                 |
| Consent requirement                                       | UNSET: required/not required with qualified rationale, scope and evidence                                          |
| Refusal/withdrawal effect                                 | UNSET: withholding, downstream restrictions, notification and timing                                               |
| Access/correction rights                                  | UNSET: controller contact, process, identity checks and correction propagation                                     |
| Deletion obligations                                      | UNSET: status/reference/audit separation, exceptions and executable process                                        |
| Disclosure logging                                        | UNSET: purpose, permissible metadata, access and minimization                                                      |
| Incident implications                                     | UNSET: breach handling, source/controller notification, suspension owner                                           |
| DPIA/PIA requirement                                      | UNSET: complete assessment or evidenced qualified non-applicability determination                                  |

Use [Privacy Operations roles](../../../../governance/privacy/README.md),
[DPIA template](../../../../governance/privacy/dpia/template.md) and
[classification policy](../../../../governance/privacy/policies/data-classification-policy.md).
A blank template is not a completed assessment.

Closure: `C3_HUMAN = PRIVACY_LEGAL_PASS`,
`PRIVACY_LEGAL_PASS_WITH_CONDITIONS`, or `REJECTED` only with a dated,
scope-bound qualified determination. Conditional outcomes list implementable
conditions, accountable owners, evidence and review triggers; no silent waiver.

## 3. Store-by-store retention, cache and rights (C6)

| Boundary                           | Existing technical fact                                                             | Required decision / recommendation                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Status projection                  | Request memory only; no Cora domain status column                                   | UNSET: recommend no durable copy; do not approve future persistence              |
| Browser/client/intermediary        | Private no-store, no-cache headers; no framework fetch cache                        | UNSET: expectations, residual copies, recipient/device obligations               |
| Source references                  | Cora profile stores Agrimo subject reference; assertion/evidence links are separate | UNSET: period, trigger, correction/deletion, rights and lawful purpose           |
| Authorization/disclosure decisions | Durable audit, minimized but actor-bearing                                          | UNSET: C9 schedule and purpose; no default period                                |
| Operational logs                   | No status-copy authorization                                                        | UNSET: inventory, fields, access, minimization and retention                     |
| Corrections                        | Source reads per request; assertions remain separate                                | UNSET: source/CORA responsibility, propagation and rights process                |
| Deletion and backups               | Governed by approved process, not read-route headers                                | UNSET: owner, trigger, worker/manual process, verification, backup disposal      |
| Legal holds                        | Counsel-issued written holds per schedule doctrine                                  | UNSET: issuing authority, scope, protected records, release and resumed disposal |

Recommend no status cache or durable CORA copy. This is a product posture
until Privacy/source approval, not permission to retain audit/reference data
indefinitely. Closure: `C6_HUMAN = APPROVED_RETENTION_CACHE_POLICY` with a
signed disposition per store, lawful purpose, period/trigger, rights, disposal,
holds and implementation/process evidence.

## 4. Audit doctrine issue paper (C9)

**Conflict requiring decision:** [Data Retention Policy](../../../../governance/privacy/policies/data-retention-policy.md)
section 4 caps personal-data logs at 30 days, while the
[Data Retention Schedule](../../../../governance/privacy/policies/data-retention-schedule.md)
security-events row lists 1 year hot / 6 years cold. These are conflicting
possible classifications, not a licence to choose the longer period.
Privacy Lead approves schedules/exceptions; Surface Owner defines inventory;
Platform Lead implements. Exceptions use `governance/exceptions/` with
justification, expiry and approver. Counsel-issued holds use the schedule's
documented legal-hold process.

Field inventory from
[writeSourceDisclosureDecisionAudit](../../../../packages/db/src/authorization-audit.ts):

- JSON: decision ID, decision, reason, actor ID, identity-binding ID,
  membership ID, application, surface, action, purpose, source system,
  fact class, correlation ID; optional source domain/entity/organization,
  policy ID/version.
- Audit row: organization ID, actor ID (legacy column name
  `actorClerkUserId`), action, target type, null target ID/actor role,
  JSON payload, occurred/created times, current/previous hash and hash version;
  generated audit row ID.
- Excluded: status value and source record ID. Exclusion does not make actor
  identifiers anonymous; qualified authority must classify personal/linkable
  information and the correlation/organization metadata.

| Required resolution                    | Human answer / evidence                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Personal-information determination     | UNSET: classify actual fields and linkability                                                                    |
| Operational/security purpose and basis | UNSET: necessity and legal/operational obligation                                                                |
| Minimum period necessary               | UNSET: rationale, not engineering preference                                                                     |
| Maximum privacy-acceptable period      | UNSET: reconcile conflicting doctrine explicitly                                                                 |
| Hot/cold storage and access            | UNSET: roles, encryption, transfer and retrieval controls                                                        |
| Holds                                  | UNSET: issuing/releasing authority and override evidence                                                         |
| Deletion/anonymization                 | UNSET: permitted method and proof, including hash-chain integrity implications; no destructive action authorized |
| Governing schedule/exception           | UNSET: canonical ID, version, approver, expiry and applicability to this flow                                    |

Closure: `C9_HUMAN = APPROVED_AUDIT_RETENTION_DOCTRINE` only with signed
Privacy/Legal disposition and executable owner/process evidence. Audit
minimization remains `PASS_MINIMIZED_AUDIT`; this does not resolve retention.
Send C3/C6/C9 and onward-use concurrence to the
[ingestion contract](CORA_DISCLOSURE_INSTITUTIONAL_ACTIVATION_CHECKLIST.md#3-evidence-ingestion-contract).
