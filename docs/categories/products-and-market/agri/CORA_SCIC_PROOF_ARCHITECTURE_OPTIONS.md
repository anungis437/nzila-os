# SCIC Proof Architecture Options

**Status:** discovery comparison only; no architecture is approved for
implementation. Architecture C remains `FUTURE_OPTION_REQUIRES_SOURCE_RIGHTS`.

## Decision context

SCIC publicly requires proof of current-year certification by an approved
certification body when requested for organic coverage. Its exact evidence
format and acceptance of issuer references are unresolved. The [SCIC Human
Discovery Contract](CORA_SCIC_HUMAN_DISCOVERY_CONTRACT.md) and [Discovery
Question Set](CORA_SCIC_DISCOVERY_QUESTION_SET.md) frame the recipient-side
question. The [First Cross-Institutional Proof Contract](CORA_FIRST_CROSS_INSTITUTIONAL_PROOF_CONTRACT.md)
continues to govern what counts as reuse.

Ratings below are qualitative discovery prompts, not measured performance,
permissions, or a decision to build. `Unknown` is retained where evidence is
absent.

## A — Operator-carried evidence

**Description:** The operator provides SCIC an existing legitimate
certificate/evidence object, rather than Cora retrieving it from the
certifier.

| Question                                                    | Bounded assessment                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does Cora need source access?                               | Not inherently. The operator could carry the object to SCIC. Cora would need separate authority for any copy, parsing, normalization, retention, or onward sharing.                                                                                                                                                    |
| What could Cora store?                                      | No certificate bytes by default. If later authorized, only the minimum event metadata needed to show the operator's authorization, evidence identity/provenance (if present on the object), recipient, purpose, observation/receipt time, and SCIC disposition. Data fields and retention require a separate decision. |
| Can provenance be preserved without querying the certifier? | Potentially, if the original issuer attribution, identifier, scope, version, and date remain intact and are not represented as independently verified by Cora. Public SCIC evidence does not establish that those attributes are present or sufficient.                                                                |
| Freshness limitation                                        | The object may show issuance/effective/expiry details but does not by itself establish current status at SCIC's decision time. SCIC's required freshness check is unknown.                                                                                                                                             |
| Operator burden                                             | The operator still has to provide an object. Current re-upload/reconstruction burden and frequency are not public.                                                                                                                                                                                                     |
| Can A alone prove cross-institutional reuse?                | No, not under the existing proof contract. The same PDF being copied or uploaded again is not the same stable source-reference reuse event. It could avoid direct Cora source access but is not sufficient proof as currently contracted.                                                                              |

## B — Issuer-reference verification

**Discovery target; not approved.** The operator authorizes use of the
certifier-issued reference or verification identifier. SCIC receives that
unchanged reference and independently decides whether its own requirement is
met. If verification requires Cora to query the certifier, that is a distinct
variant and requires source rights.

| Question                    | Bounded assessment                                                                                                                                                                                                                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What must SCIC trust?       | The issuer identity and authority, reference-to-operator binding, relevant certification status and scope, currentness/observation time, and integrity of the source response. SCIC must define its own acceptance rule.                                                                                         |
| Is source access necessary? | Not necessarily for Cora. SCIC might verify a producer-provided reference through an existing process, if it supports one. Whether SCIC can do so is unknown. Cora-initiated lookup is not assumed.                                                                                                              |
| Minimum fields              | To be specified by SCIC. Candidate concepts to validate—not assumed requirements—are operator/source identity binding, certifier identifier, evidence reference/version, status, relevant land/crop scope, effective/expiry dates, and observation time. Acres/parcels are included only if SCIC says necessary. |
| Source-rights dependency    | The ability to share or verify a reference, any response content, purpose limitation, retention, and onward use must be checked with the applicable rights holder before proof. Operator consent alone cannot grant certifier/provider rights.                                                                   |
| Same-reference reuse        | This is the narrowest plausible architecture for the proof contract if the same stable evidence identity was already used in a separately documented first institutional context and SCIC accepts it without underlying-fact reconstruction. That institutional acceptance is not established.                   |
| Operator burden             | Could reduce repeated document handling if SCIC confirms the reference path and it removes a recurring operator step. Baseline and reduction remain to be measured.                                                                                                                                              |

## C — Supported institutional source verification

**`FUTURE_OPTION_REQUIRES_SOURCE_RIGHTS`**

**Description:** A certifier provides a documented, approved machine-readable
verification method (for example, an API, feed, or endpoint) with defined
identity, scope, status, freshness, correction, and audit semantics.

- No such supported method is assumed to exist.
- It would require source authorization, permitted purposes, data minimization,
  security and retention terms, service ownership, and an approved integration
  design before any technical work.
- A supported endpoint would not transfer certification authority to Cora or
  decision authority to the source.
- Cora would not infer SCIC acceptance merely because an endpoint exists.
- This is not needed to ask the narrow recipient-side question and is not the
  preferred first proof architecture.

## Comparison for discovery

| Dimension                   | A — operator-carried object                                                                                                                            | B — issuer-reference verification                                                                           | C — supported source verification                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Rights burden               | Operator-to-SCIC provision may be contemplated by SCIC's proof-on-request language; Cora's processing/retention rights are still separate and unknown. | Unknown; source/provider rights for reference disclosure or verification must be bounded.                   | Highest and explicitly gated on source rights and approved support.                   |
| Implementation burden       | Lowest for SCIC/Cora if the operator handles the object, but it does not alone satisfy the current reuse definition.                                   | Potentially bounded if SCIC can verify the reference through an existing process; process is unknown.       | High; interface, governance, security, and operations all need approval.              |
| Evidence integrity          | Original object can retain issuer attribution if unchanged; freshness and scope mapping are unresolved.                                                | Potentially strong if issuer, stable identity, scope, and observation context are preserved.                | Potentially strong if the source response is attributable and versioned.              |
| Freshness                   | Limited to the object's contents and SCIC's check; freshness requirement unknown.                                                                      | Potentially current if issuer verification is performed at decision time; not established.                  | Potentially current at query time; no endpoint is established.                        |
| Operator burden             | Operator still supplies the object; existing burden is unknown.                                                                                        | Could reduce repeated handling if SCIC can accept and resolve the reference; unverified.                    | Could reduce operator handling but creates source/recipient operational dependencies. |
| Receiving-institution trust | SCIC's acceptance of a particular object is unknown.                                                                                                   | SCIC must define and accept the reference and its issuer binding; unknown.                                  | SCIC acceptance and source support both required; unknown.                            |
| Auditability                | Receipt and decision could be logged if permitted; copying a file is not proof of same-reference reuse.                                                | Reference, authorization, observation, and SCIC disposition could form a bounded event record if permitted. | Could provide richer event lineage if the source supports it and rights allow.        |
| Repeatability               | Repeated operator-provided files may be possible, but cadence and procedure are unknown.                                                               | Could repeat with stable reference and defined process; no current evidence.                                | Could repeat technically only with approved source service and recipient use.         |
| Source dependency           | No direct Cora source query is inherently needed.                                                                                                      | Source dependency varies: SCIC may verify independently; Cora lookup would require source permission.       | Direct and material dependency on the certifier's approved service.                   |

## Discovery recommendation

Ask about **B**, with the precise distinction that the operator would present
an unchanged issuer-attributed reference for SCIC to evaluate under its own
rules. Also ask whether an existing SCIC-supported manual verification
mechanism already exists. Do not ask SCIC to design or approve a Cora
integration.

Use **A** to establish what the current operator-carried process actually
requires and as a possible non-source-access path, but do not describe a
document re-upload as satisfying the current cross-institutional proof
contract.

Keep **C** out of the initial request except to ask whether an already
supported verification method exists. Do not contact a certifier or request
endpoint access as part of this pack.

## Gate

```text
ARCHITECTURE_A = DISCOVERY_ONLY_NOT_SUFFICIENT_FOR_CURRENT_REUSE_PROOF
ARCHITECTURE_B = PREFERRED_DISCOVERY_TARGET_NOT_ACCEPTED_OR_AUTHORIZED
ARCHITECTURE_C = FUTURE_OPTION_REQUIRES_SOURCE_RIGHTS
```
