# SCIC Human Discovery Contract

**Status:** `PREPARED_NOT_AUTHORIZED_TO_SEND`

**Scope:** prepare a narrow recipient-side discovery step only. No outreach,
source access, producer-record access, second-consumer selection, or Phase 3
permission is authorized by this document.

## Purpose

Resolve whether Saskatchewan Crop Insurance Corporation (SCIC) has a real,
repeatable organic-coverage evidence handoff that could accept the same
issuer-attributed evidence reference used for another legitimate institutional
requirement, without the operator reconstructing the underlying certification
fact and without transferring SCIC's independent decision authority.

This is a discovery contract, not a product requirement, integration plan,
partnership proposal, or permission to handle certification data.

## Frozen public-evidence baseline

The current public record establishes that:

- SCIC has an organic coverage decision context.
- Current-year organic certification by an SCIC-approved certification body
  is materially relevant.
- SCIC may request proof of certification.
- Loss of certification or failure to attain it can change insured-price
  treatment to the commercial price.

The public record does not establish the accepted evidence object or fields,
reference-only or direct-verification acceptance, request cadence, current
manual/reconstruction burden, handling and retention, certification-specific
correction/dispute procedure, sufficiency of operator-carried evidence for a
bounded reuse proof, or rights for any proposed architecture. These unknowns
remain unknown, not negative findings.

See [SCIC Public-Evidence Qualification](CORA_SCIC_PUBLIC_EVIDENCE_QUALIFICATION.md),
[Second-Consumer Handoff Reconstruction](CORA_SECOND_CONSUMER_HANDOFF_RECONSTRUCTION.md),
and the canonical [First Cross-Institutional Proof Contract](CORA_FIRST_CROSS_INSTITUTIONAL_PROOF_CONTRACT.md).

## Exact institutional decision

| Element                         | Contract statement                                                                                                                                                                                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision owner                  | SCIC owns its crop-insurance coverage and insured-price decisions. The operational role that reviews organic evidence is not publicly identified and must be confirmed.                                                                                                                                                               |
| Coverage decision               | SCIC determines whether the applicable insured land satisfies its organic-coverage terms for the relevant crop/program year.                                                                                                                                                                                                          |
| Organic-specific consequence    | SCIC's public rule ties current-year certification by an approved body to organic coverage; loss or failure to attain certification can result in commercial rather than organic insured-price treatment. Exact case-specific timing and treatment remain for SCIC to confirm.                                                        |
| Evidence required               | Publicly stated at a high level as proof of current-year certification by an SCIC-approved certification body, supplied when requested. Artifact, exact fields, freshness test, and scope-to-land mapping are not established publicly.                                                                                               |
| Timing                          | Proof may be requested under SCIC's process; the trigger, response deadline, cadence, and any event-driven update obligations are unresolved.                                                                                                                                                                                         |
| Authority retained by SCIC      | SCIC decides its insurance requirement, accepts or rejects evidence for that requirement, and determines coverage and price outcome, including any review or appeal under its process.                                                                                                                                                |
| Authority retained by certifier | The certifier remains the source authority for its certification assertion, status, scope, effective dates, and correction of its records, subject to the certifier's governing rules.                                                                                                                                                |
| Operator role                   | The producer/operator is the insured subject and may supply or authorize disclosure of evidence only within applicable rights and terms. Operator permission does not grant Cora certifier-side access rights.                                                                                                                        |
| Cora's role                     | If separately authorized, Cora may coordinate an evidence reference, provenance, authorization, and a recipient disposition record. Cora does not certify, interpret missing certification facts, adjudicate land eligibility, make coverage or pricing decisions, resolve source disputes, or represent that SCIC accepted evidence. |

The authority chain remains:

```text
CERTIFIER → authoritative certification evidence
SCIC → independent insurance/coverage decision
CORA → coordination and evidence layer only
```

## Minimum discovery boundary

The question set in [SCIC Discovery Question Set](CORA_SCIC_DISCOVERY_QUESTION_SET.md)
is limited to the specific unknowns that could raise, lower, or invalidate
SCIC's fit. The first request should seek the accountable organic-coverage
policy or operational owner; if the recipient is not that owner, it should
request a referral rather than ask them to speculate.

The discovery must not request:

- producer, policy, claim, acreage, parcel, or other live case records;
- access to SCIC or certifier systems, portals, APIs, or feeds;
- a test transaction, sample credential, certificate, or source lookup;
- a commitment to accept evidence, partner, procure, or change policy;
- permission to retrieve or process certifier data;
- any change to SCIC's decision authority.

## True cross-institutional proof event

The intended event, if later authorized and all gates are met, is:

> An operator authorizes a receiving institution to use the same
> certifier-attributed evidence identity that has already supported a
> separately documented legitimate institutional requirement. SCIC receives
> that unchanged source reference (or a source-supported verification of it),
> maps it to its own current-year organic-coverage requirement, and makes and
> records its independent coverage decision. The operator does not re-enter,
> recreate, or re-upload the underlying certification assertion for this
> second context.

For this event:

- **First context:** one real, independently governed requirement must be
  named and documented before proof setup. The existing Alpha context is not
  yet a populated first recipient/requirement and cannot be assumed to be the
  first use.
- **Second context:** SCIC's documented organic-coverage requirement, if its
  accountable owner confirms the current process.
- **Same evidence identity:** both contexts resolve to the same stable
  certifier-attributed evidence reference/version, not merely equivalent
  values or two copies of a certificate.
- **Provenance:** issuer, source reference/version, relevant scope and
  validity context, observation time, and permitted lineage remain visible.
- **Operator authorization:** authorization names the recipient, purpose,
  evidence scope, and applicable period; it does not override source/provider
  rights.
- **SCIC decision:** SCIC independently records accept, reject, defer, or
  request-more-evidence according to its own rules.
- **Avoided reconstruction:** no operator re-entry, recreation, or second
  upload of the certification fact is needed for the SCIC context, and both
  contexts refer to the same evidence identity.
- **Invalidating events:** no genuine first requirement; unrelated or unstable
  evidence identities; scope mismatch; stale or disputed status; absent
  authorization or rights; Cora asserting certification or deciding SCIC
  eligibility; or SCIC being unable to make its own disposition.

Re-uploading the same PDF, even if it is a legitimate operator-carried
document, does not alone satisfy this contract. The current proof contract
requires reuse of the same stable source evidence reference and excludes
simple copying/re-upload as proof.

## Discovery outcome thresholds

These are decision rules for interpreting a future authorized conversation;
they do not classify SCIC now or select a second consumer.

### `DISCOVERY_SUPPORTS_SELECTION`

Use only if SCIC's accountable owner confirms all of the following:

1. A current organic-coverage requirement leads to an actual evidence handoff
   and an SCIC-owned coverage/price decision.
2. The handoff recurs in practice (request cadence or another repeatable
   trigger is described), and the requirement is stable enough to state by
   program year, evidence scope, and freshness.
3. SCIC can consider the same issuer-attributed evidence identity/reference
   without requiring the operator to reconstruct or re-enter the underlying
   fact; any scope, status, freshness, and correction conditions are explicit.
4. SCIC retains final accept/reject/defer and coverage/price authority, while
   the certifier retains authority over its assertion and correction.
5. A bounded route appears feasible without broad source integration, the
   operator's actions and burden can be measured, and the evidence handling,
   retention, and rights dependencies are sufficiently bounded for a later
   rights review.
6. Separately, an actual first institutional requirement and same evidence
   identity can be documented before the proof is instantiated.

This result supports considering SCIC for selection after internal review; it
does not select SCIC, authorize a proof, grant source rights, or permit Phase 3.

### `DISCOVERY_REQUIRES_REDESIGN`

Use if a real, consequential, recurring SCIC evidence handoff exists and SCIC
retains independent authority, but the confirmed process requires a document
re-upload, a different evidence identity, fields or verification steps that
cannot preserve the current proof contract, or retention/handling incompatible
with the proposed narrow flow. Record the conflict and stop. Any proof-contract
change requires a separate review and authorization; do not silently relax
the same-reference or no-reconstruction conditions.

### `DISCOVERY_INVALIDATES_SCIC_AS_FIRST_SECOND_CONSUMER`

Use if the accountable owner confirms there is no current organic evidence
handoff or no material SCIC-controlled decision; organic certification is
merely contextual; there is no recurring/useful requirement; SCIC does not
retain decision authority; no permitted evidence form can satisfy its rule;
or a material rights/handling prohibition makes even a bounded path
infeasible. A lack of public documentation alone is not sufficient for this
classification.

If an answer is unknown, incomplete, or from a non-accountable respondent,
leave the result unresolved and seek only the appropriate referral through a
future separately authorized step.

## State and authorization

```text
CORA_ORGANIC_FIRST_LIVE_SOURCE = BLOCKED_RIGHTS_CONFIRMATION
PHASE_3_PERMISSION = NONE_GRANTED
PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN
SCIC_SECOND_CONSUMER = NOT_SELECTED
DISCOVERY_PACK = PREPARED_NOT_AUTHORIZED_TO_SEND
```

Nothing may be sent until an explicit authorization identifies the exact
approved draft, recipient/contact function, channel, and scope of the
recipient-side inquiry. Source/certifier-rights outreach remains a separate
later decision and is not implied by authorizing recipient discovery.
