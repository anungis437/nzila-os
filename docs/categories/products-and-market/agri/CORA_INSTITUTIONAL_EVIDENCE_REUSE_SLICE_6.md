# Cora Institutional Evidence Reuse — Slice 6

**Disposition:** `CORA_INSTITUTIONAL_REUSE_SLICE_6_PASS_WITH_LIMITATIONS`  
**Proof ceiling:** First bounded, complete **synthetic** cross-institutional
loop; not live institutional reuse, certification, recipient acceptance or
production readiness.

The runtime successor is [Slice 7 governed institutional workflow](CORA_GOVERNED_INSTITUTIONAL_WORKFLOW_SLICE_7.md).
It preserves this accepted proof and its source-rights/authority limits.

## Re-baseline and context map

Slice 6A remains accepted as
`SLICE_6A_CROSS_INSTITUTIONAL_RESOLUTION_PASS_WITH_LIMITATIONS`.
Its [resolution proof](CORA_SYNTHETIC_CROSS_INSTITUTIONAL_RESOLUTION_PROOF.md)
was a necessary middle layer, not closure of all Slice 6 obligations.
Slice 6B extends it; it does not replace the seven-state resolver.

| Surface reviewed                                                                                                        | Role / changes                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Evidence resolution](../../../../apps/cora/lib/evidence-resolution/)                                                   | Existing stable references, recipient-scoped authorization, seven technical states, and separate recipient dispositions. Added optional exact methodology/evidence/interpretation versions and time/freshness constraints while preserving unconstrained 6A behavior. |
| [Evidence foundation](CORA_EVIDENCE_FOUNDATION.md)                                                                      | Reused the immutable methodology-version reference schema. No persistence adapter, migration, permission or workflow activation.                                                                                                                                      |
| [Continuity capsule](CORA_CONTINUITY_CAPSULE_V1_CONTRACT.md) and [kernel](../../../../apps/cora/lib/source-continuity/) | Reused integrity, capture, mapping, rights and assembly helpers. No capsule field or source-continuity runtime behavior changed.                                                                                                                                      |
| [Slice 5](CORA_MULTI_PROVIDER_PROOF_SLICE_5.md)                                                                         | Preserved route/provider/authority separation and synthetic ceiling.                                                                                                                                                                                                  |
| [First proof contract](CORA_FIRST_CROSS_INSTITUTIONAL_PROOF_CONTRACT.md)                                                | Governs institutional independence, authority, rights, real-world acceptance and latency. No mismatch requiring a doctrinal amendment was found.                                                                                                                      |
| [Organic first-source decision](CORA_ORGANIC_FIRST_LIVE_SOURCE_DECISION.md)                                             | Live Organic Alpha remains blocked.                                                                                                                                                                                                                                   |
| [Architecture plan](../../../../plan/architecture-cora-parallel-provider-neutral-1.md)                                  | Separates accepted 6A from added 6B tasks.                                                                                                                                                                                                                            |

New modules are under [evidence-reuse](../../../../apps/cora/lib/evidence-reuse/):
`contracts.ts`, `authority.ts`, `resolve-use.ts`, `reuse.ts`, `metrics.ts`,
the synthetic Organic journey fixture, and authority/reuse tests. There is
no route, UI, source client, scheduled job, database adapter or live connector.

## Synthetic journey

```text
synthetic source capture
  -> rights-allowed semantic mapping in a continuity capsule
  -> EVIDENCE_SUPPORT with capsule/capture/source/mapping lineage
  -> exact synthetic issuer binding
  -> one governed EVIDENCE_ASSERTION ID/version
  -> independently authorized Organic-related Context A
  -> independently authorized synthetic Context B
  -> two technical resolutions
  -> qualified reuse event or explicit rejection
  -> internal reuse/friction measurement
```

Context A is a synthetic bounded Canada Organic-related status requirement,
not a real certifier or Canada Organic rule implementation. Context B is an
unnamed, separately governed synthetic institution, **not a selected second
consumer**. It differs in requirement scope, supplemental evidence,
interpretation/version and decision period. Requirements, purposes, recipients,
authorization references and decision authorities remain separately owned.
No protected standard text or real certification record is used.

The fixture creates `synthetic-organic-evidence-001`, version `v1`, once and
reuses the same immutable assertion envelope. Its synthetic status claim
comes from the provider-neutral capture/mapping route, not manually supplied
`MET` flags. B applies its own criterion rules to that claim. Source observation,
evidence validity, requirement validity and evaluation time are distinct;
`NOT_VERIFIED` is not promoted to source-currentness.

## A/B/C outcomes

| Scenario                        | Context A | Context B        | Reuse result                                                                                                                       |
| ------------------------------- | --------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A                               | `MATCHED` | `MATCHED`        | `QUALIFIED_REUSE`; same assertion meets both independent technical requirements.                                                   |
| B                               | `MATCHED` | `PARTIAL`        | `QUALIFIED_REUSE`; B still needs supplemental independent-review evidence.                                                         |
| C                               | `MATCHED` | `NOT_SATISFIED`  | `QUALIFIED_REUSE`; B's different expected status is not met. No global winner or contradictory certification judgment is invented. |
| Authorization asymmetry         | `MATCHED` | `NOT_AUTHORIZED` | No qualified reuse or eligible metric opportunity.                                                                                 |
| Disagreeing governed assertions | `MATCHED` | `CONFLICT`       | Both assertions/issuer references and source claims remain; no winner, no qualified reuse.                                         |

The three positive scenarios are alternative synthetic configurations, not
three actual institutional uses. Reuse is legitimate reference use, not
recipient acceptance.

## Reuse and reconstruction proof

[The event contract](CORA_CROSS_INSTITUTIONAL_REUSE_EVENT_CONTRACT.md)
records evidence identity/version, source provenance, independent contexts,
requirements/versions, authorizations, interpretation versions, technical
results, reconstruction trace and rejection reasons.

Duplicate uploads, reconstructed assertions and technical copies/caches/
internal processing are classified separately and excluded. Mere byte
equality, two resolutions against a loose reference, and a renamed technical
record do not qualify. Changed evidence version/provenance, same institution,
same context/authority or reliance on A's disposition are rejected.

Qualified reuse requires a trace bound to B's context and the exact evidence
version, with zero retrieval, re-entry, duplicate production and reconstruction.
Each positive count independently prevents qualification. Repeated evaluation
and new event IDs for unchanged evaluated content count once; contradictory
content requires explicit reconciliation.

## Internal metrics

- One qualified event evaluated three times: numerator **1**, denominator
  **1**, ratio **1**, repeated evaluations **2**.
- Mixed sample: numerator **1**, eligible denominator **2**, ratio **0.5**.
  The second eligible reference-use opportunity has unproven reconstruction
  avoidance. One duplicate upload, one reconstructed assertion and one
  technical copy are separately excluded.
- Unauthorized-only sample: numerator **0**, denominator **0**, ratio
  **null**, state `NO_ELIGIBLE_OPPORTUNITIES`; not a success-shaped zero/default.
- [Mobility friction](CORA_EVIDENCE_MOBILITY_FRICTION_CONTRACT.md): baseline
  B **7** synthetic actions, reuse B **3**, delta **4**. Retrieval, re-entry,
  duplicate production and reconstruction are avoided. Clarification,
  permission remediation and institutional re-verification remain.

These are fixture counts, not public KPIs, productivity measurements,
real-world latency reductions or market validation.

## Mandatory authority and capsule boundary

Normalized provider data without an established issuer binding returns
`REJECTED` as an authoritative assertion and remains `EVIDENCE_SUPPORT`.
Source capture, canonical observation, packaging integrity and normalization
alone cannot establish issuer authority.

The positive synthetic issuer port binds the complete candidate digest,
including evidence identity, class, subject/scope, methodology, support,
source lineage and temporal/rights metadata. Unknown, revoked, mismatched or
out-of-period authority fails closed; authority is checked again on use.
This is a trusted synthetic port, not production issuer verification.

Assertions retain capsule lineage references. Technical resolution and reuse
do not mutate the capsule. Strict capsule-envelope tests reject recipient
decision, institutional eligibility/approval, certification, funding,
procurement and disposition fields. Source status remains in source payload
as a source claim, not an institutional determination. This does not imply
that arbitrary permitted source JSON can be automatically classified by
content as institutional or non-institutional.

Recipient-owned dispositions retain different refs and authorities outside
the resolver and reuse event. No `MATCHED` result manufactures a recipient
decision, approval, certification, eligibility or funding result.

## Rights and frozen gates

Source disclosure and recipient disclosure are checked independently.
Tests cover unknown/denied/conditional/expired rights, wrong recipient/purpose,
future rights, revocation, expired authorization and upstream source
disclosure unknown. No such case counts as qualified reuse.

Recipient persistence, transformation, export, rehydration, deletion and
post-disconnect retention remain `UNKNOWN`. Protected-action evaluation fails
closed. The support fixture has separate synthetic capture/mapping/assembly
permissions only; recipient disclosure does not inherit them. The capsule
still reports retention duration unknown.

```text
CORA_ORGANIC_FIRST_LIVE_SOURCE = BLOCKED_RIGHTS_CONFIRMATION
PHASE_3_PERMISSION = NONE_GRANTED
PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN
```

JD001 and FV001 remain rights-gated. No source access, real producer/farm/
certifier data, selected second consumer, credentials, APIs, outreach,
deployment, commit or push was used.

## Verification and limitations

The focused suites cover the nineteen requested obligations plus authority
tampering, input isolation, reconstruction trace counts, explicit
zero-denominator handling and contradictory measurement rejection.
Validation uses focused and full Cora tests, Cora typecheck/lint, scoped
Prettier, docs validation, `git diff --check` and governance audit. Exact run
results are reported with the completion disposition.

**First complete synthetic cross-institutional loop: demonstrated for this
bounded local fixture.** Live institutional proof remains unproven, including:

- authentic issuer/accreditation/relationship verification and a current
  production rights/authority resolver;
- actual independent institutional requirements, acceptance and decisions;
- observed operator behavior, comparable latency baseline and the normative
  30% median-time reduction threshold;
- persisted/audited event lifecycle, durable idempotency, reconciliation,
  production scope controls, revocation and retention enforcement;
- operator-facing authorization/inspection/correction/export workflow;
- live source currentness, source corrections, and physical deletion proof.

These limitations prevent a live-proof or production-readiness disposition.
They do not make Deere rights a dependency for the provider-neutral core.
