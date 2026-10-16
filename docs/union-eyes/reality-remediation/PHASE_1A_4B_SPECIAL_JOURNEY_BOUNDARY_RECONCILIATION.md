# Phase 1A.4b — Special Journey and External-Specialist Boundary Reconciliation

**Gate: PASS.** This source-only reconciliation uses accepted 1A.4a, 1A.3b, 1A.2, 1A.1, and user-surface census artifacts. No application source was inspected, no runtime action was executed, and no capability was built or inferred.

## Phase status and closeout

| Item | Disposition |
| --- | --- |
| Phase 1A.4a | PASS |
| Phase 1A.4b | PASS |
| Phase 1A.4 | PASS |
| Core persona journey source model | CLOSED |
| Special journey boundary source model | CLOSED |
| LIUNA runtime proven / WorkAid runtime proven | NO / NO |
| Phase 1A | NOT YET PROVEN |
| Phase 1B / Phase 2 | NOT AUTHORIZED / NOT AUTHORIZED |
| Product ready | NO |
| Phase 1A final source reconciliation | AUTHORIZED (not started) |

The Phase 1A final source reconciliation is authorized only as the next recommended phase; it was not started.

## LIUNA leadership-continuity journey

**Journey:** `LIUNA_LEADERSHIP_CONTINUITY`  
**Source status:** `PARTIAL_SOURCE_SUPPORT`  
**Runtime / authorization / persistence / human usability proven:** NO / NO / NO / NO

The accepted Phase 1A.3b review contains eight institutional-continuity source signals. Each is explicitly assessed as `SOURCE_MODEL_SIGNAL_ONLY`; none proves operational continuity, ownership, recovery, service-level behavior, or actual transition execution. The census contains no LIUNA step inventory.

| Required dimension | Source disposition | Accepted capability concepts | Bindings | Defects | Ceiling obligations | Discoverability | Boundary / gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CONTEXT_CAPTURE | SOURCE_CEILING | KNOWLEDGE_HANDOFF | 17 | 0 | 3 | NO_SOURCE_TRANSITION | The accepted model contains a knowledge-transfer signal, but does not establish an outgoing-owner context-capture action or its ordered entry path. |
| ACTIVE_MATTER_VISIBILITY | SOURCE_SUPPORTED_WITH_DEFECT_AND_CEILING | CASE_RECORDS | 23 | 2 | 10 | SOURCE_LINK | Matter-record source signals exist, but the static links are not a LIUNA continuity sequence and do not establish that all active matters are visible to a successor. |
| RESPONSIBILITY_ASSIGNMENT | SOURCE_SUPPORTED_WITH_DEFECT_AND_CEILING | CASE_RESPONSIBILITY | 12 | 2 | 4 | DIRECT_ROUTE_ONLY | The accepted assignment concept is source-bounded and has inherited defects and ceilings; the dispatch surface has no static inbound navigation edge. |
| RESPONSIBILITY_REASSIGNMENT | PARTIALLY_SOURCE_SUPPORTED | CASE_RESPONSIBILITY, KNOWLEDGE_HANDOFF | 29 | 2 | 7 | DIRECT_ROUTE_ONLY | Assignment and successor-handoff concepts exist separately; the accepted model does not establish a predecessor-to-successor reassignment transition. |
| DEADLINE_CONTINUITY | PARTIALLY_SOURCE_SUPPORTED | CALENDAR_MEETINGS, CASE_DEADLINES | 48 | 6 | 9 | NO_SOURCE_TRANSITION | A deadline-continuity source signal exists, but the accepted CASE_DEADLINES definition explicitly does not infer reminder-engine behavior or survival across reassignment. |
| EVIDENCE_CONTINUITY | SOURCE_CEILING | CASE_EVIDENCE | 30 | 0 | 11 | DIRECT_ROUTE_ONLY | The accepted model contains a case-evidence signal with open ceilings; the route candidate has no static inbound entry and does not prove continuity across actors. |
| RESTRICTED_EVIDENCE_BOUNDARY | NOT_SOURCE_SUPPORTED | None | 0 | 0 | 0 | NO_SOURCE_TRANSITION | CASE_EVIDENCE does not establish classification, least-privilege scope, successor eligibility, authorization, or access revocation for restricted evidence. |
| SUCCESSOR_HANDOFF | SOURCE_CEILING | CASE_RESPONSIBILITY, KNOWLEDGE_HANDOFF | 29 | 2 | 7 | NO_SOURCE_TRANSITION | The accepted model has a successor-handoff signal, but no ordered or discoverable LIUNA handoff flow is established. |
| KNOWLEDGE_PRESERVATION | SOURCE_CEILING | KNOWLEDGE_HANDOFF | 17 | 0 | 3 | NO_SOURCE_TRANSITION | The knowledge-preservation capability is a source-model signal with open obligations; durable post-transition retention is not proven. |
| AUDIT_PROVENANCE | PARTIALLY_SOURCE_SUPPORTED | GOVERNANCE_ADMINISTRATION | 28 | 0 | 17 | PRIMARY_NAV | The accepted model includes an auditability signal and a leadership navigation surface, but neither establishes transaction-level handoff provenance or a preserved audit trail. |
| POST_HANDOFF_CONTINUITY | PARTIALLY_SOURCE_SUPPORTED | CASE_DEADLINES, CASE_EVIDENCE, CASE_RECORDS, KNOWLEDGE_HANDOFF | 72 | 4 | 24 | NO_SOURCE_TRANSITION | Separate continuity-related source signals exist, but the accepted corpus establishes no joined post-handoff state, access, or operational result. |

### LIUNA source-status totals

| Classification | Count |
| --- | ---: |
| SOURCE_SUPPORTED | 0 |
| SOURCE_SUPPORTED_WITH_DEFECT | 0 |
| SOURCE_CEILING | 4 |
| SOURCE_SUPPORTED_WITH_DEFECT_AND_CEILING | 2 |
| PARTIALLY_SOURCE_SUPPORTED | 4 |
| NOT_SOURCE_SUPPORTED | 1 |
| **Total** | **11** |

### Required transition reconciliation

| Transition | From → to | Classification | Capability concepts |
| --- | --- | --- | --- |
| CONTEXT_TO_MATTER | INSTITUTIONAL_CONTEXT → ACTIVE_MATTER | CAPABILITY_RELATION_ONLY | KNOWLEDGE_HANDOFF, CASE_RECORDS |
| MATTER_TO_RESPONSIBILITY | ACTIVE_MATTER → CURRENT_RESPONSIBILITY | CAPABILITY_RELATION_ONLY | CASE_RECORDS, CASE_RESPONSIBILITY |
| RESPONSIBILITY_TO_SUCCESSOR | CURRENT_RESPONSIBILITY → SUCCESSOR_ASSUMES_RESPONSIBILITY | CAPABILITY_RELATION_ONLY | CASE_RESPONSIBILITY, KNOWLEDGE_HANDOFF |
| MATTER_TO_DEADLINE | ACTIVE_MATTER → DEADLINE_OR_OPEN_COMMITMENT | CAPABILITY_RELATION_ONLY | CASE_RECORDS, CASE_DEADLINES, CALENDAR_MEETINGS |
| MATTER_TO_EVIDENCE | ACTIVE_MATTER → RESTRICTED_EVIDENCE | CAPABILITY_RELATION_ONLY | CASE_RECORDS, CASE_EVIDENCE |
| EVIDENCE_TO_SUCCESSOR_ACCESS | RESTRICTED_EVIDENCE → SUCCESSOR_ACCESS | NO_SOURCE_TRANSITION | None |
| HANDOFF_TO_RETAINED_CONTEXT | SUCCESSOR_HANDOFF → RETAINED_INSTITUTIONAL_CONTEXT | CAPABILITY_RELATION_ONLY | KNOWLEDGE_HANDOFF |

| Transition class | Count |
| --- | ---: |
| LIUNA_SOURCE_TRANSITIONS_ESTABLISHED | 0 |
| LIUNA_STATIC_RELATIONS_ONLY | 0 |
| LIUNA_CAPABILITY_RELATIONS_ONLY | 6 |
| LIUNA_NO_SOURCE_TRANSITIONS | 1 |
| **Total** | **7** |

The capability-relation classifications indicate only that concepts occur in the accepted model; they do not establish connected steps. No ordered source transition was found.

### Discoverability and adversarial answers

- **LIUNA_DIRECT_ROUTE_ONLY_STEPS:** 3
- **LIUNA_NO_SOURCE_TRANSITION_STEPS:** 6
- Static route/navigation evidence does not establish a LIUNA role, authorization, complete path, or usable transition.

| Adversarial question | Answer | Source-bounded rationale |
| --- | --- | --- |
| Can an outgoing leader expose the relevant institutional context? | PARTIAL_SOURCE_SIGNAL | A knowledge/context-preservation signal exists, but no outgoing-actor action or ordered path is established. |
| Can active matters be identified? | PARTIAL_SOURCE_SIGNAL | Matter-record signals exist, but completeness and successor visibility are not established. |
| Can responsibility be reassigned? | PARTIAL_SOURCE_SIGNAL | Assignment and handoff concepts exist, but the predecessor-to-successor transition is not established. |
| Can deadline state survive reassignment? | PARTIAL_SOURCE_SIGNAL | The review records a deadline-continuity signal; it explicitly does not prove reminder delivery or deadline survival after reassignment. |
| Can evidence remain institutionally available? | PARTIAL_SOURCE_SIGNAL | Evidence-handling and retention signals exist, but cross-actor continuity remains unproven and obligations are open. |
| Can restricted evidence remain bounded? | NO_SOURCE_SIGNAL | No accepted capability establishes a restricted-evidence access boundary or successor-specific authorization. |
| Can the successor inherit only appropriate context? | NO_SOURCE_SIGNAL | No source establishes least-privilege context selection or successor access scope. |
| Can knowledge survive the actor transition? | PARTIAL_SOURCE_SIGNAL | Knowledge handoff is a source-model signal only; durable post-transition retention is not proven. |
| Can the transition be audited? | PARTIAL_SOURCE_SIGNAL | A general auditability signal exists, but handoff provenance and persisted audit history are not established. |
| Can the original actor lose access where required? | NO_SOURCE_SIGNAL | The accepted model establishes neither transition-triggered revocation nor offboarding for this sequence. |

**LIUNA_RECORDING_SOURCE_CANDIDATE = NO.** Required continuity dimensions remain partial or unsupported, required transitions are not established, and the source corpus includes direct-route-only and no-source-transition steps. **LIUNA_RUNTIME_ACCEPTANCE_REQUIRED = YES.**

## External-specialist boundary and WorkAid

The accepted Phase 1A.3b external-specialist review has `supportedDimensions: []` and records no inferred WorkAid integration. Every specialized dimension below is outside the current external-specialist source model. Reusable internal capability IDs are foundations only and do not imply external identity, assignment, access, handoff, or integration.

| External-specialist dimension | Classification | Internal foundation only | Registered gap class |
| --- | --- | --- | --- |
| SPECIALIST_IDENTITY | OUTSIDE_CURRENT_SOURCE_MODEL | None | MISSING_ACTOR_MODEL, MISSING_EXTERNAL_IDENTITY_MODEL |
| SPECIALIST_ASSIGNMENT | OUTSIDE_CURRENT_SOURCE_MODEL | CASE_RESPONSIBILITY | MISSING_ASSIGNMENT_MODEL |
| BOUNDED_EXTERNAL_ACCESS | OUTSIDE_CURRENT_SOURCE_MODEL | USER_ACCESS | MISSING_ACCESS_BOUNDARY |
| CASE_HANDOFF | OUTSIDE_CURRENT_SOURCE_MODEL | CASE_RECORDS, CASE_RESPONSIBILITY | MISSING_CASE_HANDOFF |
| DOCUMENT_INTAKE | OUTSIDE_CURRENT_SOURCE_MODEL | DOCUMENT_LIBRARY | MISSING_DOCUMENT_INTAKE |
| EVIDENCE_HANDOFF | OUTSIDE_CURRENT_SOURCE_MODEL | CASE_EVIDENCE | MISSING_EVIDENCE_HANDOFF |
| CASE_STATUS_EXCHANGE | OUTSIDE_CURRENT_SOURCE_MODEL | CASE_RECORDS | MISSING_STATUS_EXCHANGE |
| COMMUNICATION_EXCHANGE | OUTSIDE_CURRENT_SOURCE_MODEL | CASE_COMMUNICATIONS | MISSING_COMMUNICATION_EXCHANGE |
| RESTRICTED_EVIDENCE_ACCESS | OUTSIDE_CURRENT_SOURCE_MODEL | CASE_EVIDENCE, USER_ACCESS | MISSING_ACCESS_BOUNDARY |
| ACCESS_EXPIRY | OUTSIDE_CURRENT_SOURCE_MODEL | USER_ACCESS | MISSING_EXPIRY_REVOCATION |
| ACCESS_REVOCATION | OUTSIDE_CURRENT_SOURCE_MODEL | USER_ACCESS | MISSING_EXPIRY_REVOCATION |
| SPECIALIST_DISENGAGEMENT | OUTSIDE_CURRENT_SOURCE_MODEL | CASE_RESPONSIBILITY, USER_ACCESS | MISSING_EXPIRY_REVOCATION |
| AUDIT_OF_SPECIALIST_ACTIVITY | OUTSIDE_CURRENT_SOURCE_MODEL | GOVERNANCE_ADMINISTRATION | MISSING_EXTERNAL_AUDIT_BOUNDARY |

### External-specialist totals

| Classification | Count |
| --- | ---: |
| SOURCE_SUPPORTED | 0 |
| PARTIALLY_SOURCE_SUPPORTED | 0 |
| NOT_SOURCE_SUPPORTED | 0 |
| OUTSIDE_CURRENT_SOURCE_MODEL | 13 |
| **Total** | **13** |

| Adversarial question | Answer | Rationale |
| --- | --- | --- |
| Can an external specialist exist as a bounded UE actor? | NO_SOURCE_SUPPORT | The accepted Phase 1A.3b external-specialist review establishes no supported dimensions; internal capabilities are not treated as external actor or access support. |
| Can they be assigned only specific matters? | NO_SOURCE_SUPPORT | The accepted Phase 1A.3b external-specialist review establishes no supported dimensions; internal capabilities are not treated as external actor or access support. |
| Can access exclude unrelated organizational data? | NO_SOURCE_SUPPORT | The accepted Phase 1A.3b external-specialist review establishes no supported dimensions; internal capabilities are not treated as external actor or access support. |
| Can documents be exchanged safely? | NO_SOURCE_SUPPORT | The accepted Phase 1A.3b external-specialist review establishes no supported dimensions; internal capabilities are not treated as external actor or access support. |
| Can evidence be restricted appropriately? | NO_SOURCE_SUPPORT | The accepted Phase 1A.3b external-specialist review establishes no supported dimensions; internal capabilities are not treated as external actor or access support. |
| Can status and communications flow back? | NO_SOURCE_SUPPORT | The accepted Phase 1A.3b external-specialist review establishes no supported dimensions; internal capabilities are not treated as external actor or access support. |
| Can access expire automatically? | NO_SOURCE_SUPPORT | The accepted Phase 1A.3b external-specialist review establishes no supported dimensions; internal capabilities are not treated as external actor or access support. |
| Can access be revoked? | NO_SOURCE_SUPPORT | The accepted Phase 1A.3b external-specialist review establishes no supported dimensions; internal capabilities are not treated as external actor or access support. |
| Can specialist activity be audited? | NO_SOURCE_SUPPORT | The accepted Phase 1A.3b external-specialist review establishes no supported dimensions; internal capabilities are not treated as external actor or access support. |

### WorkAid design-obligation register (not an implementation plan)

| Obligation | Dimension | Severity | Gap class | Reusable internal foundation only | New capability required |
| --- | --- | --- | --- | --- | --- |
| EXT-SPECIALIST-01 | SPECIALIST_IDENTITY | BLOCKING | MISSING_ACTOR_MODEL, MISSING_EXTERNAL_IDENTITY_MODEL | None | YES |
| EXT-SPECIALIST-02 | SPECIALIST_ASSIGNMENT | BLOCKING | MISSING_ASSIGNMENT_MODEL | CASE_RESPONSIBILITY | YES |
| EXT-SPECIALIST-03 | BOUNDED_EXTERNAL_ACCESS | BLOCKING | MISSING_ACCESS_BOUNDARY | USER_ACCESS | YES |
| EXT-SPECIALIST-04 | CASE_HANDOFF | BLOCKING | MISSING_CASE_HANDOFF | CASE_RECORDS, CASE_RESPONSIBILITY | YES |
| EXT-SPECIALIST-05 | DOCUMENT_INTAKE | BLOCKING | MISSING_DOCUMENT_INTAKE | DOCUMENT_LIBRARY | UNDETERMINED |
| EXT-SPECIALIST-06 | EVIDENCE_HANDOFF | BLOCKING | MISSING_EVIDENCE_HANDOFF | CASE_EVIDENCE | UNDETERMINED |
| EXT-SPECIALIST-07 | CASE_STATUS_EXCHANGE | MATERIAL | MISSING_STATUS_EXCHANGE | CASE_RECORDS | YES |
| EXT-SPECIALIST-08 | COMMUNICATION_EXCHANGE | MATERIAL | MISSING_COMMUNICATION_EXCHANGE | CASE_COMMUNICATIONS | YES |
| EXT-SPECIALIST-09 | RESTRICTED_EVIDENCE_ACCESS | BLOCKING | MISSING_ACCESS_BOUNDARY | CASE_EVIDENCE, USER_ACCESS | YES |
| EXT-SPECIALIST-10 | ACCESS_EXPIRY | BLOCKING | MISSING_EXPIRY_REVOCATION | USER_ACCESS | YES |
| EXT-SPECIALIST-11 | ACCESS_REVOCATION | BLOCKING | MISSING_EXPIRY_REVOCATION | USER_ACCESS | YES |
| EXT-SPECIALIST-12 | SPECIALIST_DISENGAGEMENT | MATERIAL | MISSING_EXPIRY_REVOCATION | CASE_RESPONSIBILITY, USER_ACCESS | YES |
| EXT-SPECIALIST-13 | AUDIT_OF_SPECIALIST_ACTIVITY | BLOCKING | MISSING_EXTERNAL_AUDIT_BOUNDARY | GOVERNANCE_ADMINISTRATION | YES |

| Gap severity | Dimensions |
| --- | --- |
| BLOCKING_GAPS (10) | SPECIALIST_IDENTITY, SPECIALIST_ASSIGNMENT, BOUNDED_EXTERNAL_ACCESS, CASE_HANDOFF, DOCUMENT_INTAKE, EVIDENCE_HANDOFF, RESTRICTED_EVIDENCE_ACCESS, ACCESS_EXPIRY, ACCESS_REVOCATION, AUDIT_OF_SPECIALIST_ACTIVITY |
| MATERIAL_GAPS (3) | CASE_STATUS_EXCHANGE, COMMUNICATION_EXCHANGE, SPECIALIST_DISENGAGEMENT |
| SUPPORTING_GAPS (0) | None |

The `CURRENT_CAPABILITY_REUSE` entries are explicitly internal foundations. No schemas, code, Clio design, integration, or product implementation is proposed. Every obligation requires authorization before build.

### Current-vs-future disposition

| Item | Classification |
| --- | --- |
| Internal case and matter record concepts | CURRENT_SOURCE_CAPABILITY |
| Internal assignment, deadline, communication, evidence, governance, knowledge, and document concepts | CURRENT_SOURCE_CAPABILITY |
| Potential reuse of internal records and document/evidence foundations in a separately authorized future design | CURRENT_REUSABLE_FOUNDATION |
| External actor/identity, scoped assignment/access, external document/evidence exchange, expiry/revocation, and external audit | FUTURE_REQUIRED_CAPABILITY |
| Clio integration, synchronization, or any external-provider connection | NOT_SUPPORTED |

**LIUNA_RECORDING_SOURCE_CANDIDATE = NO**  
**LIUNA_RUNTIME_ACCEPTANCE_REQUIRED = YES**  
**WORKAID_DOCUMENTATION_SOURCE_CANDIDATE = YES** — only for accurately describing current source-bounded internal capabilities and explicitly excluding an established external-specialist workflow.  
**WORKAID_ENABLEMENT_READY = NO**  
**AUTH_START_WORKAID = NO**

## Inherited evidence and false-success exposure

- LIUNA binding IDs, known-defect IDs, source-ceiling obligation IDs, residual chain IDs, and residual obligation IDs are retained exactly in the JSON artifact.
- Source-supported and potential-only false-success binding sets remain separate; their overlap remains 0.
- External-specialist absence is registered as a gap, not a defect. No unrelated source-ceiling obligation is attached to an external gap.
- No WorkAid integration, product build, contact, journey execution, recording, Phase 1A final work, Phase 1B, or Phase 2 was started.

## Gate checks

| Validation | Result |
| --- | --- |
| all11LiunaDimensionsClassified | true |
| all7LiunaTransitionsClassified | true |
| allLiunaCapabilityReferencesInFinalModel | true |
| allTransitionCapabilityReferencesInFinalModel | true |
| allLiunaBindingReferencesInCloseout | true |
| allRelevantDefectsInherited | true |
| allRelevantSourceCeilingAndResidualObligationsInherited | true |
| all13ExternalSpecialistDimensionsClassified | true |
| noUnsupportedExternalSpecialistCapabilityInvented | true |
| workAidIntegrationNotInferred | true |
| allFutureExternalSpecialistGapsRegistered | true |
| gapClassesUseApprovedTaxonomy | true |
| liunaAndExternalBoundariesKeptDistinct | true |
| noRuntimeClaimIntroduced | true |
| noAuthorizationClaimIntroduced | true |
| noPersistenceClaimIntroduced | true |
| noApplicationSourceInspected | true |
| noRuntimeActionExecuted | true |
| sourceCorpusInputsAccepted | true |

**PHASE_1A_4B_GATE = PASS**  
**PHASE_1A_4 = PASS**  
**PHASE_1A_FINAL_SOURCE_RECONCILIATION = AUTHORIZED** — not started.

The asymmetric conclusion is intentional: LIUNA has partial internal continuity source signals but no established transitions; the external-specialist/WorkAid operating boundary has no current source support.
