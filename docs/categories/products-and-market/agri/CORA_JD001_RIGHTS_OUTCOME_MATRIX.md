# JD001 Deere Rights Outcome Matrix

**Status:** Internal decision aid; no Deere outreach or implementation is
authorized.  
**External-send state:** `PREPARED_NOT_AUTHORIZED_TO_SEND`

## Decision rule

Evaluate every permission by operation, data class, field, purpose,
recipient, and lifecycle event against an authoritative current production
agreement. A general statement, OAuth scope, operator authorization, or
technical capability does not authorize another operation.

Allowed answers may proceed only to the next planning gate; they do not
authorize application creation, authentication, ingestion, a pilot, or
production use. Conditional rights require the architecture and controls to
implement every stated condition. Inconclusive or absent answers remain
blocked.

## Outcome vocabulary

| Outcome                               | Required interpretation                                                                                 | Architecture consequence                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `RIGHT_ALLOWED`                       | Authoritative written terms explicitly permit the exact operation and bounded use.                      | Capability may proceed to implementation planning, subject to all other gates and approvals.                         |
| `RIGHT_ALLOWED_WITH_CONDITIONS`       | Authoritative written terms permit it only with explicit conditions.                                    | Proceed only if every condition is represented as a verifiable design/control requirement; otherwise remain blocked. |
| `RIGHT_REQUIRES_PRODUCTION_AGREEMENT` | The answer depends on an agreement, addendum, approval, or entitlement not yet executed or established. | No implementation of the affected capability until the required agreement/approval is executed and reviewed.         |
| `RIGHT_PROHIBITED`                    | Applicable authoritative terms prohibit the operation for the proposed data, purpose, or recipient.     | Remove or disable the affected capability. Do not route around the restriction.                                      |
| `RIGHT_INCONCLUSIVE`                  | The answer is absent, ambiguous, non-binding, conflicting, or not tied to the applicable terms.         | Remain blocked; request an authoritative, operation-specific written answer.                                         |

## Six continuity-critical rights

| Operation                                              | Required answer to establish                                                                                                                              | If `RIGHT_ALLOWED`                                                                   | If conditional / agreement required                                                       | If `RIGHT_PROHIBITED` / `RIGHT_INCONCLUSIVE`                                                                                                                                                                  |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persistence (`PERSIST`)                                | Whether Cora may retain a bounded historical representation, for what duration, fields, purpose, location, backups, and legal-hold conditions.            | May design a bounded durable history subject to the remaining gates.                 | Encode exact retention, storage, backup, and purpose limits; wait for required agreement. | Prohibited: remove the durable-copy capability. Inconclusive: remain blocked pending authoritative written disposition.                                                                                       |
| Normalization (`NORMALIZE`)                            | Whether source values/relationships may be mapped into a stable representation while preserving attribution, source identity, units, and mapping version. | May model only the expressly covered fields and semantics.                           | Apply the exact transformation, attribution, and output restrictions.                     | Prohibited: do not normalize affected data. Inconclusive: remain blocked pending authoritative written disposition.                                                                                           |
| Producer export (`EXPORT`)                             | Whether the operator may retrieve/export the bounded representation, in what format and under what downstream terms.                                      | May implement the explicitly permitted producer-controlled export.                   | Enforce specified formats, access controls, recipients, and handling.                     | Prohibited: remove export. Inconclusive: keep export blocked pending authoritative written disposition.                                                                                                       |
| Recipient sharing (`SHARE`)                            | Whether a separately authorized recipient class may receive and use the exact representation, including onward-disclosure restrictions.                   | May support only named recipient classes and purposes after recipient authorization. | Limit recipient, purpose, duration, and onward access to the written conditions.          | Prohibited: no recipient handoff. Inconclusive: keep sharing blocked pending authoritative written disposition.                                                                                               |
| Independent rehydration (`REHYDRATE`)                  | Whether a producer or replacement/receiving system may independently parse and interpret the representation without an active Deere connection.           | May design and test the permitted independent reader.                                | Restrict the reader, fields, formats, and post-disconnect use precisely.                  | Prohibited: no independent rehydration. Inconclusive: keep reader blocked pending authoritative written disposition.                                                                                          |
| Retention after disconnect (`RETAIN_AFTER_DISCONNECT`) | Whether and how long lawfully captured history may remain usable after disconnect, revocation, account closure, or termination.                           | May retain only the permitted historical state and purpose.                          | Implement per-trigger deletion, archive, backup, notice, and use limits.                  | Prohibited: delete or cease use as required; if no meaningful lawful history may remain, declare `JD001_CONTINUITY_PROOF_NOT_VIABLE`. Inconclusive: remain blocked pending authoritative written disposition. |

Each row still requires separate consideration of `READ`, `CACHE`, `DERIVE`,
`DELETE_ON_REVOCATION`, `COMMERCIAL_USE`, and any other applicable operation.
Permission for the six rows does not silently authorize those operations.

## Kill and route distinction

Record `JD001_CONTINUITY_PROOF_NOT_VIABLE` if authoritative Deere terms
prohibit every lawful means of preserving enough historical state for
meaningful independent continuity.

Record `JD001_SOURCE_ROUTE_NOT_VIABLE` when the direct Deere route cannot
lawfully or practically support the required proof, but the broader Cora
continuity thesis has not been independently evaluated. This is not
`CORA_CONTINUITY_THESIS_INVALID`.

Neither outcome permits circumvention through scraping, reverse engineering,
operator credential capture, unofficial exports, hidden retention,
aggregator laundering, or indirect acquisition intended to evade Deere
terms. Alternative lawful routes are outside the scope of this decision.

See the [rights question set](CORA_JD001_DEERE_RIGHTS_QUESTION_SET.md) and
[implementation planning gates](CORA_JD001_IMPLEMENTATION_PLANNING_GATES.md).
