# NzilaOS Operations Model - Target Contract

Checkpoint 2, 2026-10-12, design only. Inherits source references, scope adapters,
human authority, material audit/retention and command failures from the
[operating model](./NZILA_OS_INSTITUTIONAL_OPERATING_MODEL.md).
Reuse of ITSM/integrations/Console and truthful planning are `[Validated: user]`;
target adapters/read contracts below are `[Design]`.

## Outcome and boundaries

Observe service state, incidents, underlying problems, external dependencies,
ownership coverage and capacity; connect remediation to governed work. Do not
replace ITSM, build procurement, create COMMAND app or turn planning into authority.

## Incident, problem and service health

| Meaning | Authoritative source / scope | Target extension / owner |
| --- | --- | --- |
| Incident | [itsmTickets and events](../../packages/db/src/schema/itsm.ts), ORGANIZATION; institutional service incidents use bound governance org | Internal operations owner; explicit typed affected service/product/capability refs; narrow sensor can record detection, not closure/acceptance |
| Problem | Existing itsmProblems / ORGANIZATION | Internal problem owner; confirmed root cause distinct from hypothesis; verification/evidence and remediation Mission/Change refs |
| Service health | Existing platform-ops, integration health, observed runtime/CI/SLO sources / explicit I/O | Measurement steward; source revision, observedAt, coverage, ruleVersion; no live claims from topology/catalog |
| OperationalHealthState | Derived snapshot in existing operations adapter, graph/index optional / requested I/O | Read-only source-preserving composition; no new health authority engine |

Incident fields on paper, additive metadata/adapter not a schema replacement:

```text
affectedEstateRefs[], detectedAt, detectedBy, detectionEvidenceRefs[],
restorationAt?, restorationEvidenceRefs[], accountableOwnerAssignmentRef,
severitySource, responseSlaRef?, recentChangeBridgeRefs[],
rootCauseState: UNKNOWN | HYPOTHESIS | CONFIRMED,
problemRef?, missionRefs[], remediationChangeRefs[], closureAcceptanceRef?
```

Reuse existing [ticket FSM](../../packages/itsm-core/src/ticket-fsm.ts): new ->
triage/assigned -> in_progress -> waiting_user/waiting_vendor -> resolved ->
closed; reopened remains source-native. Reopen preserves previous closure event.
Detected/resolved/closed are different: restoration proof is needed for resolved;
independent authorized internal closure verifies result/disposition. Existing
looser FSM roles must be composed with institutional guards for institutional
incidents; do not claim unrelated tenant flows were changed by this design.

Problem states retain open/under_investigation/known_error/remediation_in_progress/
resolved/closed. RootCause text alone is HYPOTHESIS unless named internal verifier
and evidence confirm it. Workaround is temporary, not remedy acceptance. Existing
remediationTaskIds remains a reference; a task does not authorize operational or
deployment Change. Remediation requiring controlled work creates/references
Mission/OperationalChange and its deployment bridge, with independent gates.

Changes near an incident are CORRELATED, not causedBy, unless confirmed evidence/
review supports causal attribution. Trace uses affected service -> incoming
dependency consumers and separate outgoing dependencies, then scoped AFFECTS and
Mission/decision links, per [estate traversal](./NZILA_OS_ESTATE_MODEL.md).
Source stale/missing/denied => incomplete impact, no complete blast-radius claim.

Health "healthy" requires complete policy-required timely observations and passing
checks. Declared production tier/topology is registry state, not health or deployed
readiness. Sensor outage means UNKNOWN/unavailable; known old passing sample means
STALE, not healthy now. Agent explanations must reference observations/uncertainty.
Every detection, severity/owner change, restoration, root-cause confirmation,
remediation linkage and closure emits source event plus durable audit intent.
R/A retention from operating model applies; measurement caches expire but retained
incident/decision evidence does not.

## External dependency and supplier stewardship

Source: future bounded stewardship adapter within existing platform-integrations
boundary, referencing connection IDs, supplier terms and service/IaC refs. This
does not make integrations the authority for contracts/credentials. No copying
credentials, connector configs or domain commerce vendor rows.

```text
Supplier { id, scope, name, relationshipOwnerAssignmentRef, termsRefs[],
           renewalAt?, noticeBy?, reviewAt?, status, evidenceRefs[], version }
ExternalService { id, scope, supplierRef, offeringRef, integrationRefs[],
                  serviceRefs[], status, source }
ExternalDependency {
  id, scope, supplierRef?, externalServiceRef?, connectionRefs[], infraRefs[],
  internalRelationshipOwnerRef, consumedByRefs[], criticality, sourceScale,
  dataFlows: [{ classification, purpose, direction, sourceScope, destinationRef,
               jurisdiction?, authorityRef, retentionRef? }],
  materialRenewalAt?, decisionDueAt?, termsRefs[], contractEvidenceRefs[],
  disappearanceImpact, exitPlanRef, alternativeRefs[], concentrationRiskRefs[],
  status, version, evidenceRefs[], source
}
```

Internal human owner manages relationship; contract/risk/material term acceptance
requires its own mandate/decision, not metadata update. Required criticality/data/
exit unknowns are recorded UNKNOWN and linked RAID, never invented. Assignment
cannot convey secret access. Renewal date is sourced manual/observed with origin;
unknown date stays null. Owner/review/terms/dataflow/exit/status changes audited.

External dependency lifecycle proposed -> active -> at_risk/deprecated -> retired;
return at_risk -> active requires evidence/review. Supplier active/inactive and
service discontinued are separate meanings. Retirement needs consumer/exit
evidence; interruption creates issue/incident, does not retire dependency silently.
Cross-scope consumer summaries require grants; raw org connection secrets and
term/evidence access remain original source-owned. Consumers: graph, Mission,
RAID, Changes and COMMAND estate. Contracts/grants/history retained by default.

## Lane, assignment, coverage and capacity

Sources: bounded institutional-intelligence planning/coverage module + scoped DB
adapter. Existing owner/identity/focus records are references, not automatically
institutional assignments. The institutional work steward owns contract semantics.

```text
Lane { id, scope, purpose, serviceRefs[], status: ACTIVE | ARCHIVED }
Assignment {
  id, scope, laneRef, primaryPrincipalRef, backupPrincipalRef?,
  authorityScope: { actions[], resourceRefs[] }, authorityGrantRefs[],
  effectiveAt, expiresAt?, status: PROPOSED | EFFECTIVE | EXPIRED | REVOKED,
  appointedBy, authorityRef, source, version
}
Coverage = COVERED | BACKUP_ONLY | GAP | UNKNOWN
CapacityWindow {
  id, scope, laneRef, windowStart, windowEnd,
  unit, knowledge: KNOWN | UNKNOWN,
  runReserve?, availableChangeCapacity?, committedCapacity?,
  confidence: OBSERVED | DECLARED | ESTIMATED | UNKNOWN,
  sourceRefs[], observedAt?, measurementRuleVersion,
  ownerAssignmentRef, commitments[], status: OPEN | COMMITTED | CLOSED, version
}
```

Accountable assignments require internal human primary; backup when configured
must be governed and separately effective. A technical execution assignment may
identify a permitted service/agent, but never occupies internal human accountability
or grants permissions. authorityScope describes a ceiling; actual CP grant/role/
membership still governs. Appointment/revocation/expiry/coverage changes audited.

Coverage rules: COVERED requires effective available primary with necessary action
grant; BACKUP_ONLY requires separately effective backup with those grants; neither
available => GAP if source complete, UNKNOWN if availability/grants unavailable.
Coverage gap can create HUMAN_GATE blocker when action requires an owner. No
automatic reassignment to whichever agent is online.

Capacity is coarse planning, not timesheets or action authority. Unit is declared
per window (e.g. hours or coarse work slots), never mixed. Numeric fields are
nullable when UNKNOWN; do not coerce to zero. If KNOWN, nonnegative validated
inputs and window/source/confidence are mandatory. Define availableChangeCapacity
as capacity after run reserve, before listed change commitments; free capacity =
availableChangeCapacity - committedCapacity under that same rule/version.
Negative free capacity signals OVERCOMMITTED, not a clipped false zero.

Each commitment binds work/source revision, quantity/unit, authority/actor, interval
and status RESERVED/COMMITTED/RELEASED/EXPIRED; CAS/transaction avoids double booking.
Source uncertainty/overlap is exposed. Changes can require validated capacity
commitment under their policy; otherwise UNKNOWN planning is informative, never
automatic permission. Execution grant still required even with abundant capacity.
Only authorized internal planners create/change commitments; narrow monitors apply
recorded releases after verified runs. Retain windows/assignment/commitment history;
closed windows do not retroactively change old plans. Consumers: Mission planning,
Change blockers and Console, not autonomous policy grants.

## COMMAND read contract

Existing Console only. Respect the
[workspace doctrine](../doctrine/NZILA_CONSOLE_WORKSPACE_DOCTRINE.md):
Overview, Portfolio, Observatory, Sales, Ventures, Operations, plus Settings.
TODAY is a conceptual Overview/Operations query; PORTFOLIO remains Portfolio;
ESTATE uses existing Observatory/Operations surfaces, not a seventh workspace.
No navigation, route, component, dashboard or app changes in Checkpoint 2.

COMMAND, FleetState and NORTHSTAR (if labels are later used) denote read-only
projections/recommendations; none becomes a source, grant, readiness score or
automatic management decision.

### Query, provenance, freshness and errors

```text
ReadRequest { requestedScope, view, at?, filters, cursor?, pageSize }
ReadEnvelope {
  requestedScope, generatedAt, projectionVersion, status,
  items[], complete, cursor?, counts: { value: number | null, coverage },
  sourceWatermarks[], errors[], visibilityDisposition
}
ReadItem {
  kind, value: typed-data | null, sourceRefs[], sourceScopes[], sourceRevisions[],
  sourceObservedAt?, fetchedAt, freshnessPolicyRef, freshnessDeadline?,
  status: OBSERVED | STALE | UNAVAILABLE | ERROR | ILLUSTRATIVE | UNKNOWN,
  complete, uncertainty[], authorityMeaning: SOURCE | PROJECTION | DERIVED,
  policyDecisionRef?
}
```

No generic number/string fallback and no health score calculated from absent data.
Row identity/scopes are included only when allowed. Query checks reader's requested
scope *and each source's field/evidence permissions* before joins/counts. A denied
whole query returns safe 403; hidden items in an authorized query are redacted with
policy-permitted coverage disclaimer, never hidden IDs/counts.

Source service assigns versioned freshness policy: DB current revision/watermark,
Git exact ref plus verified-current-head/attestation, OBS measurement observedAt/
valid-until/sample window, PLAN planner-observedAt/window, EVID purpose/review/hold.
maxAge or validity interval comes from approved source/control policy, never
invented globally. No configured policy => UNKNOWN, not OBSERVED. fetching now
cannot reset sourceObservedAt; static source revision is not a live observation.

| Status | Predicate / value handling |
| --- | --- |
| OBSERVED | Authorized complete source proves value/count at stated watermark and within configured freshness; zero only if a complete successful query proves zero |
| STALE | Prior authorized value exists beyond validity; include age/last source time and stale marker, never present as current |
| UNAVAILABLE | Source is not implemented/configured/reachable; null value + source disposition; no "none"/healthy |
| ERROR | Attempted source/query/validation/integrity operation failed; safe code/request ID, nullable value; never empty success |
| ILLUSTRATIVE | Explicit fixture/demo data, separately opted-in nonoperational view; never mixed into totals or restamped as observed |
| UNKNOWN | Source worked but completeness/meaning/measurement/grant coverage insufficient; uncertainty and nullable unknown values |

Parent status for purely observed complete inputs is OBSERVED. Otherwise ERROR
for any required failed input, then UNAVAILABLE for any required missing input,
then STALE for required stale input, then UNKNOWN for incomplete/unknown input.
Optional missing source preserves item-specific state plus complete=false where
the declared metric requires it. ILLUSTRATIVE only in explicitly illustrative
view; reject mixing with operational data. A reader can still inspect authorized
partial items without claiming parent completeness. Paginated first-page totals
are unknown unless source supplies a full authorized count/watermark.

### Every TODAY item

Freshness abbreviations DB/GIT/OBS/PLAN/EVID use the exact policy rules above.
Failure codes distinguish source outages from meaning gaps; safe request IDs are
provided and source errors logged/notified through existing host logging.
"Read only" below additionally requires each source's scoped/field permissions.

| Item | Source / freshness | Error behavior | Unknown behavior | Authority |
| --- | --- | --- | --- | --- |
| Active missions | Mission source, authorized/active/blocked/completed-not-closed separated; DB | MISSION_READ_FAILED => ERROR; unwired => UNAVAILABLE | Missing scope/status/watermark => UNKNOWN, no zero | Read only, institutional work source |
| Pending decisions | Rationale drafts/conditions/review markers + analysis refs, not policy ledger; DB/EVID | DECISION_READ_FAILED => ERROR | Unreconciled executive rows flagged; no canonical pending inference | Read only, rationale source; no decision action |
| Blocked changes | O/P source state + current gate/RAID evaluations and bridge; DB/GIT/OBS | CHANGE_GATE_READ_FAILED => ERROR per source | Missing required gate/source => UNKNOWN blocker, not executable | Read only, separate authorities, no unblock |
| High risks | RAID and explicitly granted source risk refs with normalized rule; DB/EVID | RISK_READ_FAILED => ERROR | Unknown scale/assessment displayed separately, not low-risk | Read only, risk source; no acceptance |
| Open incidents | Existing ITSM tickets/events, source-native statuses; DB/OBS | INCIDENT_READ_FAILED => ERROR, never [] | Incomplete source/unknown state => UNKNOWN, no incident-free claim | Read only, ITSM source |
| Human approvals | Registered CP requests/verified human votes + ITSM/Git refs; DB/GIT | APPROVAL_READ_FAILED => ERROR | Missing identity/revision/coverage => UNKNOWN, not approved | Read only; owner assignment not a vote |
| Failed controls | Existing control/policy checks and run/evidence refs; OBS/EVID | CONTROL_READ_FAILED => ERROR | Unrun/expired/partial coverage => UNKNOWN or STALE, not pass | Read only; no permission by displayed pass |
| Active specialist engagements | Engagement source ACTIVE + live grant/expiry evaluation; DB/OBS | ENGAGEMENT_READ_FAILED => ERROR | Unverified grant/state => UNKNOWN; no assumed ACTIVE | Read only; no extend/accept |
| Capacity constraints | Planning windows/commitments/run reserve/coverage; PLAN/DB | CAPACITY_READ_FAILED => ERROR | UNKNOWN capacity/availability remains null, not free | Derived planning only; no execution authority |

### Every PORTFOLIO item

| Item | Source / freshness | Error behavior | Unknown behavior | Authority |
| --- | --- | --- | --- | --- |
| Products | Registry technical identity + catalog commercial classification; GIT | PRODUCT_REGISTRY_FAILED => ERROR; catalog divergence explicit | Missing/disputed registration UNKNOWN; no production proof from tier | Read only, field-specific registry/catalog source |
| Capabilities | Capability source + scoped Product refs; DB | CAPABILITY_READ_FAILED => ERROR; unwired UNAVAILABLE | Partial estate coverage => UNKNOWN | Read only, capability source lifecycle |
| Health | Service health snapshots mapped to scoped product dependencies; OBS | HEALTH_READ_FAILED => ERROR | Missing timely observations => UNKNOWN; old healthy => STALE | Derived operations state, no readiness certification |
| Active changes | O/P independent current lifecycle/disposition + bridge; DB/GIT | CHANGE_READ_FAILED => ERROR | Missing required source UNKNOWN; no "none" | Read only; no lifecycle mutation |
| Risk | RAID plus source-domain refs/normalization/dispositions; DB/EVID | RISK_READ_FAILED => ERROR | Unknown scale/accepted expiry explicit, not assumed safe | Read only; human risk acceptance remains separate |
| Dependencies | Scoped directed graph with source watermarks; DB/GIT | GRAPH_READ_FAILED => ERROR; stale indexes STALE | Truncation/restricted/missing endpoints => UNKNOWN/incomplete | Derived, no complete blast radius unless proven |
| Value status | Benefit/observation/acceptance + scoreback/CAPITAL refs; DB/OBS/EVID | VALUE_READ_FAILED => ERROR | FORECAST/UNPROVEN/null distinct; no zero/realized default | Read only, evidence-backed benefit source |

### Every ESTATE item

| Item | Source / freshness | Error behavior | Unknown behavior | Authority |
| --- | --- | --- | --- | --- |
| Shared primitives | Platform/package registry and governed owner metadata; GIT | PRIMITIVE_REGISTRY_FAILED => ERROR | Owner disagreement/null => gap/UNKNOWN, no guessed team | Read only; package owner label not permission |
| External dependencies | Stewardship source + integration/IaC/terms refs; DB/OBS/EVID | EXTERNAL_DEPENDENCY_READ_FAILED => ERROR | Missing dataflow/renewal/exit => UNKNOWN, never absent risk | Read only, no credential/config disclosure |
| Ownership gaps | Governed required-role assignments + trusted identity/availability; DB/PLAN | ASSIGNMENT_READ_FAILED => ERROR | GAP only from complete source; unavailable => UNKNOWN | Derived coverage; no self-assignment |
| Platform health | Existing SLO/runtime/integration/control observations, explicit environment; OBS | PLATFORM_HEALTH_READ_FAILED => ERROR | Declared/unprovisioned/stale source => UNKNOWN/STALE, no green | Derived ops measurement, not deploy authorization |
| Technical debt | Evidence-backed ISSUE/RISK tagged technical debt, source-domain finding refs; DB/EVID | DEBT_READ_FAILED => ERROR | Untested/unmeasured estate coverage UNKNOWN, not zero debt | Read only; no invented comprehensive debt register |
| Evidence status | Existing evidence pack/decision evidence integrity, purpose acceptance, retention/hold refs; EVID | EVIDENCE_READ_FAILED => ERROR; hash failure explicit | Unknown acceptance/missing purpose/denied content => UNKNOWN, not complete | Read only; seal is not adequacy or authority |

## Compatibility and failures

Existing Console incident readers and Control Plane Change loaders swallow source
errors into empty/null; sample knowledge records stamp current time. These are
not compliant with new COMMAND metrics. New adapters must emit the envelope,
never reuse success-shaped fallback behavior. Existing pages outside the newly
scoped contract are not declared fixed by documentation. Partial-source views
keep independent errors and must not grant operational actions.

No additional audit ledger for reads; existing access logging/audit is reused for
sensitive evidence/exports. Cached views preserve source timestamp/revision/scope,
are invalidated on revocation/visibility changes and never survive under a new
reader's permissions without reauthorization. Cache entries are dispensable;
source records/audit/proofs remain retained.

## Binary acceptance and future proof

| Failure/edge case | Required result |
| --- | --- |
| Incident query fails or no DB source installed | ERROR/UNAVAILABLE, no healthy/none badge or observed count=0 |
| Sensor was healthy yesterday, fetched now | Original timestamp retained; STALE according to source policy |
| No capacity measurement / expired assignment | UNKNOWN null planning / explicit gap only with complete coverage; no authority |
| Two tenant services share external supplier | No ungranted cross-tenant consumers/data/terms/graph counts |
| RootCause hypothesis or recent successful Change | No confirmed cause or accepted remediation inferred |
| Any of 22 COMMAND items gets missing required source | Explicit per-item error/unknown and parent completeness=false |
| Demo record mixed with operational item | Rejected mix; ILLUSTRATIVE excluded from operational counts |
| Capacity concurrent reservations | CAS/transaction prevents overbooking known window; no false precision for unknown window |

All criteria score 3, `[Design]`; adapter/source integration and failure-injection
tests plus Console read regression tests are required before a later runtime claim.
