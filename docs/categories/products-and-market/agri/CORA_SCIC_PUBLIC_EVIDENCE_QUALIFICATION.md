# SCIC Public-Evidence Qualification

**Status:** public-evidence qualification only. SCIC is not selected as the
second consumer. No producer record, source account, portal, or live workflow
was accessed.

## Finding

SCIC is the strongest currently documented institutional decision context:
organic certification affects whether insured land receives organic coverage
and, where certification is not attained or is lost, the applicable insured
price. SCIC requires proof when requested. Its public material does not specify
the proof artifact, fields, handling workflow, recurrence of requests, or
acceptance of an issuer-attributed reference in place of producer-submitted
proof.

**Readiness:** `PROMISING_REQUIRES_DISCOVERY`

**Selection:** none. Public evidence does not establish a true same-evidence
reuse event.

## Publicly established workflow

| Question                      | Public-evidence finding                                                                                                                                                          | Limit                                                                                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| What decision does SCIC make? | It determines coverage and insured-price treatment under its crop-insurance program.                                                                                             | No individual insured decision record was accessed.                                                                                                                |
| Organic coverage rule         | SCIC says land must be certified by an approved certification body in the current year to qualify for organic coverage.                                                          | The public page does not identify every approved body or describe how approval is checked.                                                                         |
| Who may qualify?              | The rule concerns insured land under SCIC's organic-coverage program.                                                                                                            | The page does not fully state all producer, crop, parcel, or enrollment eligibility conditions.                                                                    |
| Evidence required             | “Proof of certification” must be supplied when requested.                                                                                                                        | It does not state whether proof means a certificate copy, certificate number, status response, scope schedule, issuer reference, declaration, or another artifact. |
| Timing                        | Proof is supplied when SCIC requests it; the certification rule is current-year based.                                                                                           | No deadline, automatic submission, portal workflow, or request trigger is specified.                                                                               |
| Required fields               | Current-year certification and land coverage are material.                                                                                                                       | Certificate year, issuer identifier, scope, crop, acreage, parcel, and provenance fields are not enumerated as accepted evidence fields.                           |
| Certifier authority           | The certification body must be approved by SCIC.                                                                                                                                 | The public wording does not establish SCIC's accreditation-verification method or a machine-readable source check.                                                 |
| Repeated proof                | No automatic check is stated.                                                                                                                                                    | Whether proof is requested once, annually, or in response to a claim or audit is unknown.                                                                          |
| Consequence                   | SCIC says that if certification is lost or not attained, the insured price reverts to the commercial price; organic premium and yield treatment remain as described on its page. | The wording does not establish treatment of every mid-year status change or a specific operator's case.                                                            |
| Specialized crop terms        | SCIC's Khorasan/Kamut terms separately refer to an organic certification number or expected certification in the upcoming year for that coverage.                                | This is a crop-specific term, not evidence of a general reference-acceptance workflow.                                                                             |
| Dispute path                  | SCIC publishes a crop-insurance appeal path involving further review and a Provincial Appeal Panel; the Panel's recommendations go to the SCIC Board for the final decision.     | This does not establish a specific correction route for certification source data or proof intake.                                                                 |
| Independent decision          | SCIC, not the certification body, makes the insurance coverage/price decision.                                                                                                   | The operational decision-maker and evidence disposition record are not publicly identified.                                                                        |

Primary sources:

- [SCIC — Organic Certification](https://www.scic.ca/crop-insurance/program-overview/organic-coverage/organic-certification)
- [SCIC — Khorasan/Kamut coverage terms](https://www.scic.ca/crop-insurance/program-overview/organic-coverage)
- [SCIC — Appeals](https://www.scic.ca/about-scic/appeals)
- [SCIC — Crop insurance contract and terms](https://www.scic.ca/crop-insurance/contract-and-terms)

The organic-coverage page is the clearest public statement of the rule. The
publicly retrievable contract material did not resolve the evidence-format or
reference-acceptance questions; absence of a located clause is not treated as
proof that no such procedure exists.

## Handoff and reuse test

| Handoff                                     | Publicly supported fact                                                                | Reconstruction / reuse finding                                                                                                                                                |
| ------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Certification body → authoritative evidence | SCIC requires certification by an approved certification body.                         | The evidence originates with a certification body, but the certificate/status record, stable identifier, provenance fields, and correction process are not described by SCIC. |
| Evidence → insured operator                 | The operator is expected to supply proof when SCIC requests it.                        | The operator-to-SCIC proof handoff is established at a high level. Its artifact and channel are not.                                                                          |
| Operator → SCIC requirement                 | Current-year certification must support organic coverage.                              | A real requirement is established; an accepted evidence envelope is not.                                                                                                      |
| SCIC requirement → independent decision     | SCIC sets coverage and insured-price treatment.                                        | Independent recipient authority is clear at the institutional level.                                                                                                          |
| Decision → outcome                          | Coverage eligibility and insured-price treatment can change with certification status. | The consequence is explicit, but event-level timing and decision records are not public.                                                                                      |

**Current apparent mechanism:** operator supplies proof to SCIC on request.
Automatic source verification and re-entry/re-upload are not described.

**Reconstruction point:** `RECONSTRUCTION_NOT_PUBLICLY_ESTABLISHED`. The public
record does not show whether an operator currently re-enters certificate facts,
re-uploads a document already held elsewhere, or merely presents existing
evidence.

**Possible reusable reference point:** the certification body's issuer-
attributed certificate/status reference, if one exists and SCIC accepts it.
Neither a stable reference nor SCIC's acceptance of it is publicly evidenced.

**Failure state:** certification is absent, not current, not approved, or not
accepted as proof; SCIC may deny organic coverage or revert the insured price
under its published terms. The correction treatment for disputed source data
is unknown.

## Three proof architectures

Scores use a 1–5 ordinal scale, where 5 is more favorable to a narrow,
rights-respecting first proof. For source dependency, 5 means low dependency
(more favorable); the rating is not a claim that SCIC has agreed to a method.

| Architecture                                         | Rights burden                                                                                                | Implementation burden                                                   | Integrity                                                             | Freshness                                                                    | Operator burden                                          | Recipient trust                                                      | Auditability                                                     | Repeatability                                                      | Source dependency                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| A. Operator-carried existing evidence                | 3 — operator-to-SCIC proof is contemplated; Cora processing/retention rights remain distinct and unresolved. | 4 — no live source connector is needed; recipient procedure is unknown. | 4 — original issuer artifact can preserve attribution if not altered. | 3 — current-year rule exists, but evidence freshness checks are unspecified. | 2 — still requires the operator to provide the evidence. | 3 — proof is required, but exact acceptable artifact is unpublished. | 3 — a copy and receipt could be recorded, subject to permission. | 2 — repeated request cadence is unknown.                           | 4 — avoids source endpoint dependency.                            |
| B. Operator-authorized source-reference verification | 2 — purpose, source, and recipient permissions are unconfirmed.                                              | 2 — reference and verification process are not documented.              | 5 — potentially preserves issuer attribution and scope.               | 5 — potentially checks current status at decision time.                      | 4 — could reduce repeated document handling.             | 2 — SCIC has not publicly accepted reference-only proof.             | 4 — a decision-time verification record could be auditable.      | 3 — technically repeatable only if issuer/receiver support exists. | 1 — depends on a functioning, permitted source verification path. |
| C. Supported institutional source integration        | 1 — no source permission or approved interface is evidenced.                                                 | 1 — interface, governance, and operational support are unknown.         | 5 — potentially direct and issuer-attributed.                         | 5 — potentially current at check time.                                       | 4 — could reduce operator handling.                      | 3 — no SCIC acceptance or source support is evidenced.               | 5 — potentially strong event lineage.                            | 4 — could scale if explicitly supported.                           | 1 — directly dependent on source institution and its service.     |

Architecture A could be explored without Cora directly accessing a certifier
source, but merely copying or re-uploading a certificate is not, by itself,
the proof contract's same-reference reuse event. Architecture B is the
narrowest plausible target only if SCIC confirms acceptance and all rights are
separately established. Architecture C is not recommended absent source
authorization.

## Rights and handling boundary

- SCIC's request for proof establishes a recipient evidence need; it does not
  grant Cora permission to retrieve certifier data.
- An operator-carried certificate is a distinct rights and authority path.
  The operator may be able to provide evidence in response to SCIC's
  requirement, but public evidence does not define Cora's right to copy,
  normalize, retain, redistribute, or use that document for another purpose.
- Whether SCIC needs a copy or would accept source-reference verification is
  unknown. Retention, onward disclosure, correction, and commercial-use terms
  are not public in the reviewed material.
- Unresolved Pro-Cert/Ecocert rights continue to block direct source access
  and source-supported integration. A source-supported verification endpoint
  would simplify the technical proof but would not itself establish rights.
- A proof based solely on operator-supplied evidence could avoid direct source
  access, but it would not establish that SCIC accepts the same authoritative
  reference without reconstruction.

## Exact discovery fact

SCIC must confirm whether its current organic-coverage process accepts an
operator-authorized, issuer-attributed reference to current-year certification
and land scope in place of a newly supplied certificate/proof object; if so,
what freshness, scope, and correction requirements apply and whether SCIC
retains its normal independent decision.

This is a narrow, answerable recipient question. The appropriate authority is
SCIC's crop-insurance program/policy owner or the operational official
responsible for organic-coverage evidence acceptance. Public material cannot
settle it. Recipient discovery is justified as a future authorized step, but
no outreach is drafted or sent here. Source-rights outreach remains separate
and premature until an exact evidence method, purpose, and handling plan are
defined.

## State preserved

```text
CORA_ORGANIC_FIRST_LIVE_SOURCE = BLOCKED_RIGHTS_CONFIRMATION
PHASE_3_PERMISSION = NONE_GRANTED
PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN
SCIC_SECOND_CONSUMER = NOT_SELECTED
```
