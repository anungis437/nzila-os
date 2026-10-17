# JD001 Deere Human Discovery Contract

**Profile:** `JD001` — John Deere Operations Center  
**Status:** Prepared for internal authorization review only.  
**Contact state:** `PREPARED_NOT_AUTHORIZED_TO_SEND`  
**Implementation state:** `REFERENCE_ONLY_NOT_IMPLEMENTED`

## Purpose

Resolve only the Deere-specific production-access, bounded API capability,
contractual rights, continuity, freshness, and exit questions that reviewed
public documentation did not answer. This pack is not an implementation plan,
source-access request, product pitch, or evidence that Deere has accepted any
proposed use.

No Deere contact is authorized. No Deere application has been created; no
producer or organization authorization, Production Agreement, persistence,
redistribution, rehydration, commercial-use, or post-disconnect retention
right has been established. The reviewed public API Development License
Agreement remains
`PUBLIC_TEXT_REVIEWED_NOT_ACCEPTED_NOT_CONFIRMED_CURRENT`; it is not treated
as Cora's governing production contract.

If an authoritative answer says a right is conditional on a Production
Agreement, record the operation as `REQUIRES_PRODUCTION_AGREEMENT` until the
applicable agreement is executed by the authorized entity and reviewed for
that exact data class, purpose, recipient, and operation. Do not classify a
conditional answer as allowed.

## Decision and core question

The decision for discovery is whether any narrowly bounded,
producer-authorized, Deere-originated historical state can be lawfully
received, preserved, interpreted, and exported for continuity after a Deere
connection ends, under a supported production path and applicable written
terms.

> If a producer authorizes Cora to receive Deere-originated farm information,
> may Cora preserve a bounded, purpose-limited continuity copy so the producer
> can later understand and reuse legitimate historical state after the Deere
> connection ends?

This question is a request to clarify Deere's supported capability and
contractual terms. It presumes no permission and must be answered by the
appropriate technical and contractual authorities.

## Separate authorities

| Authority                           | Decision it controls                                                                                                                 | What it does not grant                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Producer authorization              | Who may access producer-linked information and the producer's authorized scope, purpose, and period.                                 | Does not grant Deere's application license, persistence rights, Cora policy approval, or recipient authority. |
| Deere contractual/API permission    | What the application may access, process, retain, transform, export, disclose, and use under applicable agreements.                  | Does not itself establish a producer's consent or a recipient's acceptance.                                   |
| Cora governance                     | Whether Cora will handle information within the narrower envelope permitted by Deere, the producer, applicable law, and Cora policy. | Cannot enlarge another authority's permission.                                                                |
| Receiving-institution authorization | Whether a named recipient may receive and rely on specified evidence for its own purpose and decision.                               | Does not alter Deere source authority or make Cora the decision-maker.                                        |

`FARMER_AUTHORIZED = CORA_MAY_PERSIST` is not an established inference.
Permission, if any, must be explicit for each action and data class.

## Minimum continuity slice

Initial discussion is limited to the conceptual relationship:

`Organization → Farm → Field → Boundary`

Only the minimum source metadata needed to preserve identity, provenance,
timestamps, relationships, units, and source state is in scope. The named
terms are a requested discovery slice, not an assertion that Deere exposes
these objects or relationships. Machine telemetry, FieldOperation history,
Operator, Product/Input, Measurement, WorkPlan, Prescription, and
PlannedActivity data remain excluded from a minimal proof unless technical or
contractual discovery shows a necessary dependency and that scope is
separately approved.

## Neutral continuity representation

For discussion, describe the proposed output as:

> A bounded, producer-authorized, vendor-neutral representation of historical
> state preserving source attribution, identifiers, relationships, dates,
> units, and known limitations for continuity purposes.

This does not mean copying all Operations Center information. Ask separately
whether creation, storage, normalization, producer export, long-term
retention, recipient reuse, and rehydration into another system are permitted.
Portability, redistribution, and source-side verification are distinct
operations; an affirmative answer to one does not settle the others.

## Evidence and state distinction

The discovery must determine whether source interfaces expose enough
information to label a permitted snapshot as `HISTORICALLY_CAPTURED` and,
separately, whether a supported current-source check can establish
`CURRENTLY_CONFIRMED_BY_SOURCE`. Historical capture, source currentness,
record deletion, correction, and archive status must not be conflated.

## Discovery outcome thresholds

| Eventual state                                 | Minimum evidence threshold                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JD001_RIGHTS_SUPPORT_CONTINUITY_PROOF`        | Current production access and written terms explicitly support the approved minimal data slice and every necessary action through bounded persistence, normalization, producer export, permitted recipient reuse, post-disconnect retention, and independent rehydration; technical semantics support provenance and historical/current distinction; all other authorities and approvals are separately documented. |
| `JD001_RIGHTS_SUPPORT_LIMITED_CONTINUITY_ONLY` | Written current terms support a clearly specified subset (for example, a short retention period or producer-only export) but do not support the full continuity objective. The design is reduced to exactly that subset; no unsupported behavior is implied.                                                                                                                                                        |
| `JD001_REQUIRES_NEGOTIATED_PRODUCTION_TERMS`   | Production path or general API use may exist, but required data/action rights depend on an unexecuted, negotiated, or unreviewed agreement. Keep every conditional operation `REQUIRES_PRODUCTION_AGREEMENT`.                                                                                                                                                                                                       |
| `JD001_RIGHTS_PROHIBIT_REQUIRED_CONTINUITY`    | An authoritative current agreement or Deere rights owner explicitly prohibits one or more indispensable operations, and no permitted reduced scope meets the stated objective. Stop the continuity architecture; do not invent a workaround.                                                                                                                                                                        |
| `JD001_DISCOVERY_INCONCLUSIVE`                 | A material technical or legal question lacks an answer from its accountable authority, answers conflict, or evidence is not current/authoritative enough to classify. All affected gates stay RED or AMBER.                                                                                                                                                                                                         |

No state is awarded on a verbal blanket “yes.” Record exact speaker
authority, agreement/version, data class, operation, purpose, duration,
recipient, restrictions, and written evidence for every conclusion.

## Authorization and stop rules

Every outreach artifact is `PREPARED_NOT_AUTHORIZED_TO_SEND`. Before any
contact, obtain explicit human authorization identifying the sender,
recipient/function, exact artifact and version, channel, purpose, permitted
attachments, and scope. No Deere outreach, application registration,
authentication, API call, producer record access, credential creation, or
runtime modification is permitted by this pack.

Discovery preparation does not move an implementation gate to GREEN.
`JD001` remains `REFERENCE_ONLY_NOT_IMPLEMENTED`; no runtime path exists.
Existing Organic Alpha states remain
`CORA_ORGANIC_FIRST_LIVE_SOURCE = BLOCKED_RIGHTS_CONFIRMATION`,
`PHASE_3_PERMISSION = NONE_GRANTED`, and
`PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN`.

See the [rights question set](CORA_JD001_DEERE_RIGHTS_QUESTION_SET.md),
[technical question set](CORA_JD001_DEERE_TECHNICAL_QUESTION_SET.md),
[discovery agenda](CORA_JD001_DEERE_DISCOVERY_AGENDA.md),
[outreach draft](CORA_JD001_DEERE_OUTREACH_DRAFT.md), and
[implementation planning gates](CORA_JD001_IMPLEMENTATION_PLANNING_GATES.md).
