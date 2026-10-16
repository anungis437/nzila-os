# Cora Data Sovereignty and Continuity Architecture

**Status:** Design doctrine only. Not implemented, deployed, or approved for
source access.  
**Reference connector:** John Deere Operations Center, `JD001`.  
**Principle:** **Integrate deeply. Preserve independently. Rehydrate openly.**

## Purpose and boundary

**V3 scope qualification:** the operator-authorized reference connector flow
below is one design path, not a universal producer-consent/key/custody model.
Institutional/public evidence uses its actual authority and access mechanism.
Reference-only, attestations-only, no-single-owner and absolute no-data-pooling
are not constitutional requirements; lawful minimized evidence carriage
remains possible without transferring issuer authority. The
[binding doctrine](ADR/ADR-AGRI-002-cora-food-economy-ceiling.md) and
[stress-test framework](CORA_STRESS_TEST_FRAMEWORK.md) change no connector
rights, runtime policies or source activation state.

This architecture defines how a future Cora connector could integrate with an
external agricultural system without making Cora the owner of operational
records or making continued access to that system a condition of data
continuity. `JD001` is a reference architecture, not a live connector,
provider commitment, or evidence that Deere currently exposes a particular
API capability.

This document authorizes none of the following: Deere authentication or API
use; account or producer-record access; collection, synchronization, or
ingestion; retention, reuse, onward disclosure, or commercial use of Deere
data; runtime configuration or secrets; production changes; or external
outreach. No connector, integration, source registry entry, or permission is
activated.

The current Cora boundary remains read-only. Agrimo operational records
remain Agrimo-owned. Cora authorization is not source-disclosure authority.
The organic source state remains
`CORA_ORGANIC_FIRST_LIVE_SOURCE = BLOCKED_RIGHTS_CONFIRMATION`,
`PHASE_3_PERMISSION = NONE_GRANTED`, and
`PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN`; this Deere design changes none
of them.

The doctrine aligns with the [Cora authorization composition](CORA_AUTHORIZATION_COMPOSITION.md),
[Cora evidence foundation](CORA_EVIDENCE_FOUNDATION.md),
[domain ownership matrix](CORA_DOMAIN_OWNERSHIP_MATRIX.md),
[first cross-institutional proof contract](CORA_FIRST_CROSS_INSTITUTIONAL_PROOF_CONTRACT.md),
and [shared integration security model](../../platform-and-operations/platform/integration-security-model.md).
These references describe separate platform boundaries; none grants Deere
access or rights.

## Seven-layer reference architecture

The following layers are logical trust boundaries. Their description does not
mean that any Deere-related component exists.

| Layer                                              | Responsibility                                                                                                                                                            | Required invariant                                                                                                                                                    | Deere status                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1. Actor, organization, and purpose authority      | Resolve the authenticated actor and organization from canonical platform authority; bind the requested action to a purpose, recipient, and scope.                         | A user-selected org or provider account never creates authority. A Cora grant and a source-disclosure grant are distinct decisions.                                   | Design requirement; no Deere actor/account binding established.                                   |
| 2. Source access and permission gate               | Hold any future source connection behind an explicit, current, source- and action-specific rights decision.                                                               | API authentication, if available, is not permission to read, retain, derive, export, or reuse. Fail closed for absent, ambiguous, expired, or out-of-scope authority. | No Deere access, credentials, terms, or permission established.                                   |
| 3. Provider adapter and capability allowlist       | Translate only individually approved source operations and versions.                                                                                                      | No generic “sync all” behavior. Deny unlisted operations, fields, directions, and source scopes.                                                                      | No Deere adapter or operation capability established.                                             |
| 4. Ingress validation and quarantine               | Validate structure, tenant/subject binding, source attribution, timestamps, schema version, signatures where provided, and payload limits before any accepted processing. | Invalid, unmatched, duplicate, conflicting, or untrusted input is quarantined or rejected; it does not become a Cora fact.                                            | Design requirement; no Deere payload inspected.                                                   |
| 5. Canonical evidence and operational boundary     | Preserve source facts as source-attributed observations; represent mappings and derived interpretations separately.                                                       | Source records remain externally owned. Cora may not silently rewrite source facts or infer a Deere assertion from a Cora mapping.                                    | No Deere schema mapping or semantics established.                                                 |
| 6. Continuity capsule and independent preservation | Create a portable, rights-bounded package with manifest, provenance, version, integrity checks, and export controls.                                                      | Portability includes both payload and the ability to interpret it; a source ID, Cora database backup, or PDF alone is not sufficient.                                 | [Capsule contract](CORA_CONTINUITY_CAPSULE_V1_CONTRACT.md) is proposed only.                      |
| 7. Rehydration and recipient decision surface      | Restore permitted capsule content into an implementation-independent reader and expose evidence with freshness and rights states.                                         | Rehydration restores evidence state, not source authority or a recipient’s decision. Unknown, expired, stale, or unpermitted content stays visibly so.                | [Rehydration test](CORA_JD001_REHYDRATION_TEST_CONTRACT.md) is a future acceptance contract only. |

### Cross-cutting controls

Audit, data minimization, retention/deletion, key management, tenant isolation,
incident response, observability, schema evolution, and human review apply to
all seven layers. These are design obligations, not evidence of a Deere
implementation or of deployed controls.

### Information flow

```text
Operator-authorized purpose and scope
        │
        ├── canonical Cora authorization (not source permission)
        └── separate source / onward-use rights gate
                         │
                  approved adapter
                         │
         validate → quarantine/reject → source-attributed evidence
                         │
          rights-bounded continuity capsule
                         │
             independent open rehydration
                         │
       operator or recipient makes its own decision
```

No line in this diagram represents an existing Deere data flow.

## Sovereignty and authority rules

1. **Origin remains visible.** Every source assertion keeps source identity,
   source reference or a permitted substitute, observation time, effective
   interval when known, source/schema version when known, and any source
   qualification. Missing values remain missing; they are not filled by Cora.
2. **Rights are operation-specific.** Evaluate permission independently for
   authentication, read, transient processing, persistence, transformation,
   export, rehydration, cross-context reuse, onward disclosure, and deletion.
   A right for one action does not imply another.
3. **Operator choice is necessary but may not be sufficient.** Operator
   authorization is scoped to actor, subject, purpose, recipient, fields,
   period, and handling. It cannot grant rights held by Deere or another
   rights holder.
4. **Source authority is not decision authority.** Deere, if it is the source
   for a given fact, controls its source assertion and its corrections.
   Cora may preserve and present permitted evidence. It must not certify,
   adjudicate, or decide eligibility, insurance, procurement, credit, or
   funding.
5. **Recipient authority remains independent.** A recipient applies its own
   versioned requirement and records its own decision. A match or integrity
   check is not acceptance.
6. **Continuity is bounded by lawful content.** A capsule must not preserve
   content beyond its rights. If the payload cannot be retained or exported,
   the capsule may record only permitted provenance and explicit
   unavailability; it must not claim that the underlying source fact is
   independently rehydratable.
7. **No silent identity merge.** External identifiers are namespaced by
   provider and organization. Similar names, acreage, or contact data do not
   establish identity equivalence.

## Portability, fidelity, and captivity-risk measures

Any later test must report this vector; a single “portable” label is
insufficient.

| Measure                         | Definition                                                                                                                                                                                          | Proposed hard gate                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Authorized-content completeness | Number of manifest-declared, permitted mandatory items rehydrated with valid integrity checks divided by the number of such items. Report numerator and denominator.                                | 100%; any absent mandatory item fails or is explicitly classified as a documented, permitted omission before the test. |
| Provenance coverage             | Mandatory items with preserved issuer/source, subject binding, acquisition/observation context, and chain of custody divided by mandatory items. Unknown fields are counted as unknown, not passed. | 100% of provenance fields required by the test profile are preserved or explicitly unknown.                            |
| Semantic fidelity               | Mandatory concepts that an independent reader can interpret with the declared schema/version and without Cora-specific runtime divided by mandatory concepts.                                       | 100%; no silent lossy transform or undocumented unit/scope conversion.                                                 |
| Reference integrity             | Manifest references that resolve within the capsule or to an explicitly permitted external reference divided by declared references.                                                                | 100% resolve or carry an explicit unavailable/withheld state; never substitute another record.                         |
| Rights coverage                 | Mandatory content/actions with a current, applicable permission record divided by mandatory content/actions.                                                                                        | 100%; any unknown, expired, or conflicting right blocks that action.                                                   |
| Independent-reader portability  | Required manifest and permitted content parsed and rendered by a clean, Deere-independent, Cora-independent reader.                                                                                 | Pass without Cora runtime, Deere credentials, or a live Deere call.                                                    |
| Staleness disclosure            | Source values for currentness/validity retained where permitted; every unverifiable current-state claim shown as not verified.                                                                      | No capsule is labelled “current” merely because it rehydrates successfully.                                            |

Captivity risk is reported as a set of flags, not a fabricated aggregate
score. For each release, record whether: (a) an essential format is proprietary
or undocumented; (b) the only interpretation path requires Cora; (c) restoring
requires a live Deere credential/API; (d) a source identifier has no permitted
portable representation; (e) export/retention rights are unresolved; or (f)
an unavailable source makes a mandatory fact unrecoverable. Any affirmative
flag is a visible dependency requiring mitigation or an accepted exception.
An unresolved rights flag is a stop condition, not a risk accepted by a
technical owner.

## Resilience and failure behavior

- Source unavailability, credential revocation, rate limits, schema drift,
  ambiguous identity, expired authorization, and rights uncertainty are
  explicit non-success states. They must not produce success-shaped empty
  data or an inferred current status.
- Use bounded retries, idempotent processing, tenant-scoped quarantine, and
  append-only audit evidence if a future implementation is separately
  approved. Replays preserve the original source event/reference and create a
  new processing attempt.
- A backup of Cora alone is not source continuity. A copy of provider data
  without rights is not sovereignty. A capsule with only a provider pointer
  does not prove payload recovery.
- Any recovery objective must be set and tested for the specific connector
  and data class. Existing platform recovery targets do not establish a
  Deere-specific RTO, RPO, or recovery result.
- Key loss, corrupt capsule, missing manifest, hash mismatch, or a failed
  provenance chain blocks rehydration and is escalated; do not repair by
  guessing or querying a source without current permission.

## Lifecycle and acceptance gates

`JD001` advances only through explicit, separately approved gates:

1. **Reference-only:** public documentation links and unknowns are recorded.
   Current state.
2. **Capability discovery:** current official technical documentation is
   reviewed and each proposed operation/field is tied to a versioned source.
   Public documentation alone does not grant use rights.
3. **Rights and privacy review:** source/provider terms, operator authority,
   purpose, jurisdiction, data categories, retention, onward use, and deletion
   are approved for the exact action set. Unresolved rights block progression.
4. **Synthetic contract validation:** adapter and capsule semantics are
   tested without Deere credentials or real operator records.
5. **Deere-independent rehydration acceptance:** the test in
   [CORA_JD001_REHYDRATION_TEST_CONTRACT.md](CORA_JD001_REHYDRATION_TEST_CONTRACT.md)
   passes on synthetic, rights-cleared fixtures.
6. **Operational authorization:** a separate written decision approves named
   environment, accountable owner, user cohort, fields, limits, monitoring,
   retention, incident response, and rollback. This document does not grant
   it.
7. **Production acceptance:** independent legal/security/privacy review,
   source and recipient rights, all hard gates, recovery evidence, and
   explicit production authorization are on file.

No stage is implied by completion of another. There is no automatic
transition from a design artifact to a live source.

## Canonical companion contracts

- [Connector governance contract](CORA_CONNECTOR_GOVERNANCE_CONTRACT.md)
- [JD001 reference connector architecture](CORA_JD001_REFERENCE_CONNECTOR_ARCHITECTURE.md)
- [JD001 capability and rights matrix](CORA_JD001_CAPABILITY_RIGHTS_MATRIX.md)
- [Continuity Capsule v1 contract](CORA_CONTINUITY_CAPSULE_V1_CONTRACT.md)
- [JD001 rehydration test contract](CORA_JD001_REHYDRATION_TEST_CONTRACT.md)
- [JD001 adversarial review](CORA_JD001_ADVERSARIAL_REVIEW.md)
