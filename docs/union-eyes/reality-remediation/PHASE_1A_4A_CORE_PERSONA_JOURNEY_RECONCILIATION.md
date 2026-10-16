# Phase 1A.4a — Core Persona Journey Reconciliation

**Artifact status: generated from accepted source evidence only.** The accepted Phase 1A.3b capability-coherence review is the primary capability source. Phase 1A.2 contributes retained binding-level obligations, defect identifiers, false-success classifications, and priorities. Phase 1A.1 and the Phase 1A user-surface census contribute static route and navigation evidence only.

## Phase boundary and current ruling

| Item | Evidence disposition |
| --- | --- |
| Phase 1A.3b capability review | PASS |
| Phase 1A | NOT_YET_PROVEN |
| SaaS operational readiness | NO_GO — RUNTIME_PROOF_REQUIRED |
| Phase 1A.4b (LIUNA continuity and WorkAid) | DEFERRED |
| Phase 1B / Phase 2 | NOT_AUTHORIZED / NOT_AUTHORIZED |
| Phase 3B recording work | BLOCKED_UNTIL_OPERATIONAL_READINESS_PASS |
| Application source inspected / runtime actions executed | No / No |

This reconciliation does not reopen or resolve the Phase 1A.3b source model, execute product journeys, prove capabilities, or authorize later work. Static route existence and menu entries do not establish user actions, authorization, persistence, business effects, or readiness.

## Persona reconciliation

| Persona | Primary capability concepts | Historical static sequence | Canonical candidate | Source-complete journeys | Disposition |
| --- | --- | --- | --- | --- | --- |
| MEMBER | 3 | Yes | MEMBER_CASE_REVIEW | 0 | CANONICAL_CANDIDATE_SOURCE_DERIVED_UNVERIFIED |
| STAFF | 3 | Yes | STAFF_CASE_CORRESPONDENCE | 0 | CANONICAL_CANDIDATE_SOURCE_DERIVED_UNVERIFIED |
| EXECUTIVE | 2 | Yes | EXECUTIVE_GOVERNANCE_REPORTING | 0 | CANONICAL_CANDIDATE_SOURCE_DERIVED_UNVERIFIED |
| GOVERNANCE | 0 | Yes | None | 0 | NO_PRIMARY_PERSONA_CAPABILITY_EVIDENCE |
| ADMIN | 12 | Yes | ADMIN_ORGANIZATION_ACCESS | 0 | CANONICAL_CANDIDATE_SOURCE_DERIVED_UNVERIFIED |
| PUBLIC | 2 | No | PUBLIC_INQUIRY_SUBMISSION | 0 | CANONICAL_CANDIDATE_SOURCE_DERIVED_UNVERIFIED |

The `GOVERNANCE` persona has a static navigation sequence but no canonical capability with `GOVERNANCE` as a primary persona in the accepted 1A.3b model. It is therefore retained as a navigation-only historical record, not promoted to a business journey. `PUBLIC` has a primary `PUBLIC_INQUIRIES` capability and route candidates, but no named public E2E sequence in the historical census.

## Canonical journey candidates

| Persona | Journey ID | Candidate | Criticality | Capability IDs | Bindings | Source-ceiling obligations | Residual obligations | Known-defect IDs | Highest open priority | False-success exposure |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MEMBER | MEMBER_CASE_REVIEW | Access and follow a representation case | CORE | CASE_RECORDS, CASE_DEADLINES | 25 | 10 | 15 | 4 | P2 | 0 source-supported / 0 potential-only |
| STAFF | STAFF_CASE_CORRESPONDENCE | Record case-related correspondence | CORE | CASE_COMMUNICATIONS | 9 | 1 | 1 | 0 | P2 | 0 source-supported / 0 potential-only |
| EXECUTIVE | EXECUTIVE_GOVERNANCE_REPORTING | Review institutional governance and reporting surfaces | CORE | GOVERNANCE_ADMINISTRATION, INSTITUTIONAL_REPORTING | 54 | 24 | 36 | 4 | P2 | 0 source-supported / 0 potential-only |
| ADMIN | ADMIN_ORGANIZATION_ACCESS | Administer organizational structure and user access | CORE | ORGANIZATION_STRUCTURE, USER_ACCESS | 104 | 49 | 56 | 7 | P2 | 0 source-supported / 1 potential-only |
| PUBLIC | PUBLIC_INQUIRY_SUBMISSION | Submit a public inquiry or pilot request | SUPPORTING | PUBLIC_INQUIRIES | 4 | 2 | 1 | 0 | P2 | 0 source-supported / 0 potential-only |

Every candidate is marked `SOURCE_DERIVED_UNVERIFIED`. Historical step sequences are retained as static records; candidates without an ordered historical sequence are represented by route candidates in the JSON artifact, not by invented steps. Capability associations are evidence-bounded; they are not a claim that a complete workflow exists or that any action succeeded. The exact inherited binding IDs, source-ceiling obligation IDs, residual effect-chain IDs and obligation IDs, known-defect IDs, and separated false-success binding sets are preserved in the JSON artifact.

### Historical static journey records

| Historical persona | Steps | Disposition | Canonical candidate |
| --- | --- | --- | --- |
| MEMBER | 4 | RECONCILED_TO_SOURCE_DERIVED_UNVERIFIED_CANDIDATE | MEMBER_CASE_REVIEW |
| STAFF | 5 | RECONCILED_TO_SOURCE_DERIVED_UNVERIFIED_CANDIDATE | STAFF_CASE_CORRESPONDENCE |
| EXECUTIVE | 5 | RECONCILED_TO_SOURCE_DERIVED_UNVERIFIED_CANDIDATE | EXECUTIVE_GOVERNANCE_REPORTING |
| GOVERNANCE | 4 | NAVIGATION_SEQUENCE_ONLY_NO_PRIMARY_PERSONA_CAPABILITY | — |
| ADMIN | 5 | RECONCILED_TO_SOURCE_DERIVED_UNVERIFIED_CANDIDATE | ADMIN_ORGANIZATION_ACCESS |
| LIUNA_CONTINUITY | 0 | DEFERRED_TO_PHASE_1A_4B | — |
| WORKAID_OPERATING_MODEL | 0 | DEFERRED_TO_PHASE_1A_4B | — |

### MEMBER — Access and follow a representation case

| Step | Source label | Route | Surface | Persona nav entries | Contextual inbound edges | Exact route capability candidates | Action evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MEMBER_CASE_REVIEW_STEP_01 | My Cases | /dashboard/inbox | Present in static census | 5 | 8 | None | STATIC_SURFACE_AND_NAVIGATION_ONLY |
| MEMBER_CASE_REVIEW_STEP_02 | Open Representation Case | /dashboard/claims/new | Present in static census | 2 | 8 | CASE_RECORDS, USER_ACCESS | EXACT_ROUTE_CANDIDATE_MATCH_ONLY |
| MEMBER_CASE_REVIEW_STEP_03 | Messages | /dashboard/inbox | Present in static census | 5 | 8 | None | STATIC_SURFACE_AND_NAVIGATION_ONLY |
| MEMBER_CASE_REVIEW_STEP_04 | Documents | /dashboard/documents | Present in static census | 1 | 3 | None | STATIC_SURFACE_AND_NAVIGATION_ONLY |

### STAFF — Record case-related correspondence

| Step | Source label | Route | Surface | Persona nav entries | Contextual inbound edges | Exact route capability candidates | Action evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| STAFF_CASE_CORRESPONDENCE_STEP_01 | Casework Console | /dashboard/work | Present in static census | 0 | 1 | None | STATIC_SURFACE_ONLY |
| STAFF_CASE_CORRESPONDENCE_STEP_02 | Representation Cases | /dashboard/inbox | Present in static census | 2 | 8 | None | STATIC_SURFACE_AND_NAVIGATION_ONLY |
| STAFF_CASE_CORRESPONDENCE_STEP_03 | Communications | /dashboard/correspondence | Present in static census | 1 | 0 | None | STATIC_SURFACE_AND_NAVIGATION_ONLY |
| STAFF_CASE_CORRESPONDENCE_STEP_04 | Assignments | /dashboard/priorities | Present in static census | 0 | 4 | None | STATIC_SURFACE_ONLY |
| STAFF_CASE_CORRESPONDENCE_STEP_05 | Documents | /dashboard/documents | Present in static census | 1 | 3 | None | STATIC_SURFACE_AND_NAVIGATION_ONLY |

### EXECUTIVE — Review institutional governance and reporting surfaces

| Step | Source label | Route | Surface | Persona nav entries | Contextual inbound edges | Exact route capability candidates | Action evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EXECUTIVE_GOVERNANCE_REPORTING_STEP_01 | Executive Overview | /dashboard/intelligence | Present in static census | 3 | 2 | None | STATIC_SURFACE_AND_NAVIGATION_ONLY |
| EXECUTIVE_GOVERNANCE_REPORTING_STEP_02 | Continuity Insights | /dashboard/continuity-intelligence | Present in static census | 2 | 0 | None | STATIC_SURFACE_AND_NAVIGATION_ONLY |
| EXECUTIVE_GOVERNANCE_REPORTING_STEP_03 | Leadership Continuity | /dashboard/leadership | Present in static census | 1 | 0 | GOVERNANCE_ADMINISTRATION | EXACT_ROUTE_CANDIDATE_MATCH_ONLY |
| EXECUTIVE_GOVERNANCE_REPORTING_STEP_04 | Continuity Operations | /dashboard/executive-operating-intelligence | Present in static census | 2 | 0 | None | STATIC_SURFACE_AND_NAVIGATION_ONLY |
| EXECUTIVE_GOVERNANCE_REPORTING_STEP_05 | Member Outcomes Ledger | /dashboard/outcomes | Present in static census | 1 | 0 | None | STATIC_SURFACE_AND_NAVIGATION_ONLY |

### ADMIN — Administer organizational structure and user access

| Step | Source label | Route | Surface | Persona nav entries | Contextual inbound edges | Exact route capability candidates | Action evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ADMIN_ORGANIZATION_ACCESS_STEP_01 | Organization | /dashboard/admin/organizations | Present in static census | 2 | 6 | ELECTIONS, ORGANIZATION_STRUCTURE | EXACT_ROUTE_CANDIDATE_MATCH_ONLY |
| ADMIN_ORGANIZATION_ACCESS_STEP_02 | Users & Roles | /dashboard/admin/members | Present in static census | 2 | 0 | None | STATIC_SURFACE_AND_NAVIGATION_ONLY |
| ADMIN_ORGANIZATION_ACCESS_STEP_03 | Policies | /dashboard/governance | Present in static census | 1 | 3 | None | STATIC_SURFACE_AND_NAVIGATION_ONLY |
| ADMIN_ORGANIZATION_ACCESS_STEP_04 | Security | /dashboard/security | Present in static census | 1 | 17 | None | STATIC_SURFACE_AND_NAVIGATION_ONLY |
| ADMIN_ORGANIZATION_ACCESS_STEP_05 | Audit | /dashboard/audits | Present in static census | 1 | 0 | None | STATIC_SURFACE_AND_NAVIGATION_ONLY |

Historical step ordering is retained exactly from the census. Per-step capability association is reported only where the normalized route exactly matches an accepted capability route candidate. Other steps remain surface/navigation evidence only.

## Other documented targets (not journey execution evidence)

| Record | Source | Documented target | Disposition |
| --- | --- | --- | --- |
| PILOT_CASE_LIFECYCLE | docs/union-eyes/pilot-evidence-pack/PILOT_SUCCESS_METRICS.md | Intake → resolution or formal deferral | DOCUMENTED_OUTCOME_TARGET_NOT_JOURNEY_EXECUTION_EVIDENCE |
| EXECUTIVE_PROCUREMENT_WALKTHROUGHS | docs/union-eyes/runtime-convergence/full-executive-procurement-experience-convergence.md | Executive, governance, trust-center, procurement, pilot, onboarding, and operational-proof flows | DOCTRINAL_TARGETS_WITHOUT_ORDERED_SOURCE_STEPS |
| DEMO_PILOT_WALKTHROUGHS | docs/union-eyes/runtime-convergence/full-demo-pilot-experience-reconvergence.md | Executive, procurement, steward, and member operational walkthroughs | DOCTRINAL_TARGETS_WITHOUT_ORDERED_SOURCE_STEPS |

The pilot case lifecycle is a target metric, not an observed intake-to-outcome sequence. The executive/procurement and demo/pilot materials describe desired walkthroughs but provide no ordered source steps here; those targets are not elevated into verified or runtime journeys.

## False-success classifications

The Phase 1A.2 closeout's **5 source-supported** false-success binding IDs and **4 potential-only** binding IDs remain separate. Their overlap count is **0**. Journey-level intersections are similarly reported in separate JSON fields; the two dimensions are not combined.

## Limitations

- Historical stakeholder-demo paths are static source inventories; no journey was executed.
- Route and navigation presence do not establish action completion, authorization, persistence, successful external effects, or audit behavior.
- Capability persona tags are analytical source labels, not role-access proof.
- Per-step capability matches require exact normalized route-candidate equality; no semantic route-to-capability inference is made.
- The pilot case lifecycle and executive/procurement/demo walkthroughs are documented targets, not evidence that the target flows occurred.
- The five source-supported and four potential-only false-success binding sets are retained separately.
- LIUNA continuity and WorkAid operating-model journeys remain deferred to Phase 1A.4b.

## Validation

| Check | Result |
| --- | --- |
| acceptedPhase1A3bInput | true |
| acceptedBindingDenominators | true |
| sourceCeilingObligationDenominatorRetained | true |
| residualEffectChainDenominatorRetained | true |
| knownDefectBindingDenominatorRetained | true |
| allRequiredPersonasRepresented | true |
| everyHistoricalJourneyRecordReconciled | true |
| allStaticJourneyStepsPreserved | true |
| externalSpecialistJourneysDeferred | true |
| canonicalCapabilitiesPrimaryForPersona | true |
| candidatesWithoutHistoricalSequenceHaveNoOrderedSteps | true |
| highestOpenPriorityMatchesRetainedPriorityClasses | true |
| inheritedBindingAndObligationIdsResolve | true |
| falseSuccessDimensionsRemainSeparate | true |
| noJourneyExecutionOrRuntimeClaims | true |
| noLaterPhaseStarted | true |
| applicationSourceInspected | false |
| runtimeActionExecuted | false |
| productCodeChanged | false |

Outputs are deterministic: `generatedAt` is null, and rerunning the generator from the same accepted inputs produces byte-identical JSON and Markdown.
