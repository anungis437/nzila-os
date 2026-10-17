# NzilaOS Estate Model - Target Contract

Checkpoint 2, 2026-10-12, design only. Inherits notation, scope adapters, authority,
audit, retention and failure contracts from the
[operating model](./NZILA_OS_INSTITUTIONAL_OPERATING_MODEL.md). `[Design]` marks all
target definitions below; existing source anchors are validated repository facts.
No source, table or graph type described as future has been implemented here.

## Outcome and boundary

An authorized reader can identify estate ownership and directed dependency impact
without turning product-domain entities, owner labels or graph connectivity into
institutional authority. No generic CMDB and no second graph.

## Reference envelope

```text
InstitutionalRef {
  scope: { type, id }, kind, namespace, sourceId, revision,
  mappingVersion, visibilityEnvelopeRef, sourceObservedAt
}
RecordMetadata {
  createdAt, updatedAt, createdBy, updatedBy, version, source,
  explanationPurpose, ownerAssignmentRef, evidenceRefs[], retentionAssignmentRef?
}
```

The source is authoritative; graph nodes are indexes. SourceId is opaque within
namespace + scope + kind. Revision is required for material evidence and mutations;
an unresolved "latest" reference may be used for a read request but must resolve
to a particular revision in its response. Institution is a distinct ontology kind.
InstitutionalProduct is distinct from existing commerce/ontology Product.

No graph metadata may grant permissions. References to Evidence/Control/Decision
inherit source visibility. Explanations derive identity/purpose/owner, reverse
consumers, active risks and health proof; absent metadata yields UNKNOWN, not prose
invented by a model.

## Entity catalog

Abbreviations: I = PLATFORM_INSTITUTION; O = ORGANIZATION; S = SYSTEM maintenance
only. R = immutable revision/history retained; A = archived, not deleted; default
retention is RETAIN until a governed retention assignment permits destruction.
Every entity inherits material-mutation audit intent, actor attribution and scoped
reference validation from the operating model. No entity bypasses policy.

| Entity / form | Authoritative source and persistence | Scope | Owner / authority | Lifecycle | Audit / retention | Consumers |
| --- | --- | --- | --- | --- | --- | --- |
| Institution / source | Explicit identity + future binding in existing DB/platform boundary | I; S enrolls binding | Internal institutional identity steward; privileged enrollment only | enrolled, suspended, archived | Enrollment/identity/binding change proof; R/A | All institutional services and adapters |
| Portfolio / source reference | Existing portfolio catalog, Git revision; institutional metadata references it | I | Portfolio steward; governed catalog review, not investment authority | Catalog classification preserved; active/archived metadata | Git/projection provenance + mutation audit; R/A | Console portfolio, CAPITAL, Missions |
| InstitutionalProduct / reference + metadata source | App registry and catalog have field-level precedence: app slug/path/technical tier from registry; commercial classification from catalog; generated envelopes read-only | I; O consumer refs only | Estate steward + governed owner assignment; conflicting source fields are explicit divergence | Existing technical/commercial classifications retained separately | Source hash/revision, mapping/assignment changes; R/A | Portfolio, graph, Changes, health |
| Capability / source | Future bounded estate metadata adapter using existing DB; graph is index | I or O | Internal accountable capability owner; lifecycle/ownership permission | PROPOSED, DESIGNED, PILOT, ACTIVE, LIMITED, DEGRADED, DEPRECATED, RETIRED | Transition reason, validation/evidence, owner history; R/A | Mission, Change, operations, value |
| Service / source | Future estate service metadata, reference to operational service IDs | I or O | Internal service owner; service action policy | proposed, active, limited, deprecated, retired; health is separate | Scope/consumer/lifecycle changes; R/A | Graph, incidents, integrations |
| SharedPlatformPrimitive / reference + metadata | Existing platform/package registry + owner metadata, immutable Git revision | I | Platform primitive steward; package governance, no consumer-authority grant | Existing registry lifecycle preserved; explicit retirement metadata if reconciled | Registry revision and adaptation history; R/A | Services, product capability consumption |
| Integration / reference | Existing integration connection/connector stores | O; I only via explicit binding to platform-owned connection | Internal integration owner; existing connection policy | Existing connection status and health preserved | Existing audit + institutional link intent; R/A | Service dependencies, operations |
| InfrastructureDependency / source reference | Environment/IaC/artifact sources; future stewardship metadata holds references, not secret configuration | I or O | Ops relationship owner; no infrastructure mutation via graph | proposed, active, deprecated, retired; observed health separate | Reference/config-source revision and ownership/exit evidence; R/A | Estate impact and CI proof |
| ExternalDependency / source | Future institutional dependency metadata in existing integration adapter boundary | I or O | Internal relationship owner; metadata does not grant vendor/system access | proposed, active, at_risk, deprecated, retired | Material terms/data/exit changes, source evidence; R/A | Operations, RAID, Changes |
| Supplier / source | Future stewardship metadata + external terms refs; no commerce supplier copy | I or O | Internal relationship owner, term-review authority | proposed, active, inactive, archived | Contract/renewal/ownership history; R/A | ExternalDependency, engagements |
| ExternalService / source reference | Supplier offering + existing integration/service reference where one exists | I or O | Relationship/service steward; not credential authority | proposed, active, discontinued, archived | Offering/source/consumer changes; R/A | ExternalDependency and service impact |
| Owner / assignment source | Trusted identity ref + governed assignment; no duplicated personal identity table | I or O, S only maintenance assignment | Internal appointing human; no self-appointment by agent/specialist | proposed, effective, expired, revoked | Appointer, authority/effective interval, predecessor; R/A | Estate, lane, Mission, benefit |
| Lane / source, Assignment / source | Future institutional-intelligence planning/coverage module + DB adapter | I or O | Internal lane steward; assignment cannot grant policy permission | Lane active/archived; assignment proposed/effective/expired/revoked | Assignment/deputy/availability changes; R/A | Capacity, COMMAND, execution gates |
| CapacityWindow / source, constraint / derived | Future planning source; existing focus/hour records remain references | I or O | Internal planning owner; estimate/commit permission, not execution authority | open, committed, closed; knowledge KNOWN/UNKNOWN | Commitment/release/source changes; R/A | Mission planning, capacity blockers |
| Control / reference + derived result | Registered policy/control IDs + existing validation/evidence sources | I or O | Governance/control owner; policy engine alone evaluates permission | Versioned policy lifecycle preserved; observed pass/fail/unknown distinct | Policy versions and run evidence; R/A | CP, Changes, COMMAND |
| Risk, Assumption, Issue, Dependency / sources | Future institutional-intelligence RAID contract; source-domain items remain refs | I or O | Internal accountable RAID owner; acceptance/closure permissions distinct | Per [RAID contract](./NZILA_OS_DECISION_AND_RAID_MODEL.md) | Owner/severity/status/resolution history and evidence; R/A | Mission, Change, Decision, supplier |
| Mission / source | Future institutional-intelligence aggregate + DB adapter | I or O | Internal accountable owner; creation/authorization/closure human-governed | Per operating model, proposed through closed/cancelled | Criteria, amendments, actor/authority, closure proof; R/A | Runs, Changes, COMMAND, value |
| OperationalChange / source | itsmChanges + itsmApprovals; existing org DB | O (including explicitly bound governance org) | Internal service change owner; operational policy | Existing ITSM change states | Approvals/results/PIR/bridge mutation proof; R/A | Mission, incident, Console |
| DeploymentChange / source | platform-change-management Git records at approved revision | I, explicit binding; no inferred global file scope | Release owner and independent deployment authority | Existing ChangeRecord states | Git approval, CI/revision/result/PIR proof; R/A | CI, operational bridge, Mission |
| ManagementDecision / source | Extended GovernanceRationale decided payload + immutable lifecycle/supersession refs | I or O | Internal decision owner; management policy, not agent analysis | Existing rationale status + effective/review markers | Content digest, authorization, supersession proof; R/A | Analysis consumers, Change, Mission |
| DecisionAnalysis / source | Existing analysis/store ports with future scoped durable adapter | I or O | Internal analysis owner; analysts/agents may draft narrowly | Existing drafting/under-review/decided/implemented/superseded, analysis meaning only | Analysis revisions/inputs; R/A | Rationale, recommendation review |
| AuthorizationDecision / source reference | Existing decision-core, decision_events | Existing O with explicit binding to I where needed | CP policy; no human management choice | Existing outcomes, expiry/revocation refs | Existing durable authority proof; R/A | All mutation boundaries |
| Evidence / source reference | Existing evidence/decision evidence/SAGE sources in original domains | Original scope; cross-scope link only by grant | Source evidence owner; independent internal acceptor for institutional purpose | Source states preserved, disposition recorded separately | Immutable digest/revision, acceptance/hold; R/A | Every material institutional object |
| SpecialistEngagement / source | Future institutional-intelligence engagement module + DB adapter | I or O | Internal sponsor/counterpart; independent approver/acceptor | Per [engagement contract](./NZILA_OS_EXTERNAL_SPECIALIST_CONTRACT.md) | Scope, expiry, output, acceptance, closeout; R/A | Mission, recommendations, COMMAND |
| Incident / source, Problem / source | Existing ITSM tickets/problems and reference adapters | O; links may target I | Internal service operations owner; narrow sensor may record detection | Existing ticket/problem states, not invented replacement FSM | Detection/restoration/root cause/closure history; R/A | Health, Change correlation, COMMAND |
| OperationalHealthState / derived snapshot | Existing observed telemetry/integration/environment health with source revision and future snapshot adapter | I or O | Ops measurement steward; sensor records, no sensor acceptance | healthy/degraded/unhealthy only when observed; missing health UNKNOWN | Measurements, freshness, rule/version; R/A | Console, impact, controls |
| Benefit / source, Observation / source, Acceptance / source | Future benefit module linking existing scorebacks/finance/CAPITAL | I or O | Internal outcome owner and independent internal acceptor | Per [value contract](./NZILA_OS_VALUE_MODEL.md) | Forecast/observation/acceptance/reassessment proof; R/A | Mission, Portfolio, CAPITAL |
| COMMAND / projection | Existing Console host reads sources; scoped cache optional, never writable truth | Requested I/O scope | Reader policy plus each source permission | OBSERVED/STALE/UNAVAILABLE/ERROR/ILLUSTRATIVE/UNKNOWN | Access/projection provenance and generation receipt; retain source proof, cache expires | Console workspaces only |

Supporting records below are not additional institutional business aggregates.
They inherit explicit actor/authority, scoped CAS, linked before/after audit intent
and RETAIN retention from their parent boundary.

| Supporting record / form | Authoritative persistence | Scope / owner / authority | Lifecycle / audit / retention | Consumers |
| --- | --- | --- | --- | --- |
| InstitutionBinding, SourceScopeBinding / source | Future DB/platform registry adapter | S maintenance action names explicit I/O target; identity steward, privileged enrollment | proposed/effective/revoked; versioned mapping/approval proof retained | Org, audit, graph and source adapters |
| ProjectionGrant / authority reference | Existing CP/identity authorization boundary, future explicit cross-scope grant adapter | Source and consumer scopes both named; source authority governs fields/actions | effective/expired/revoked, no inferred access; durable authority proof retained | Every cross-scope read/edge/link |
| ChangeBridge / link source | Future scoped DB reference-link adapter | Both O/I endpoint scopes; internal authorized linker | current/withdrawn/superseded links, actor/time/reason/revisions retained | Change, Mission, incident, Console |
| RationalePayload, Head, Supersession / source and current index | Future governance-rationale DB adapter | Parent I/O; internal decision mandate; head is CAS index, not historical payload | draft/decided immutable payload, appended lifecycle/head events, unique successor; retained replay/audit | Decision review, graph, executive adapter |
| CompatibilityMapping / source link | Existing DB/source adapter boundary | Exact old/new scope and revision; authorized reconciler | proposed/verified/withdrawn; mapping evidence and predecessor retained | Executive, initiative, scoreback and source adapters |
| EngagementOutput, OutputAcceptance / source | Existing evidence storage + future engagement DB adapter | Parent I/O with source visibility; producer submits, independent internal human accepts | submitted/quarantined/accepted/rejected/unproven and immutable receipts; expiry does not delete | Rationale, Mission, closeout |
| Commitment / source | Future planning DB adapter | Parent I/O/lane; internal planner, narrow verified-run release | reserved/committed/released/expired; quantity/unit/window/version history retained | Capacity and start gates |
| BenefitObservation, BenefitAcceptance / source | Future benefit DB adapter + existing evidence storage | Parent I/O, measurement producer vs independent internal acceptor | immutable observation/acceptance/reassessment receipts retained | Value, Mission, Portfolio |
| Blocker / derived evaluation | Source CP/RAID/Change/capacity/evidence refs; optional scoped evaluation receipt | Target I/O action; source owners govern clearance, evaluator cannot waive | active/cleared/unknown per source revision; material gate receipt retained | Mission/Change start checks, Console |
| ExecutionRun / existing source reference | Existing automation_commands/workflow run adapters, not Mission source | Original org with explicit institutional binding where needed; narrow executor under CP grant | existing pending/queued/running/succeeded/failed/cancelled/timed_out/dead_lettered; lease/result/audit proof retained | Mission, Change, operations and evidence |
| AuditIntent, AuditReceipt / delivery record and proof reference | Existing transaction/outbox pattern -> existing audit_events/NAR audit_records sinks | Bound audit org plus explicit target scope; narrow writer, no management discretion | pending/recorded/delivery-failed, stable event ID/hash; delivery queue not a second ledger, proof retained | Every material mutation and proof gate |

Institutional metadata is intentionally not a duplicate of all source fields.
If registry/catalog fields disagree, return both source revisions and the
field-specific disposition; do not choose by filename order.

## Relationship model

Reuse [ontology relationships](../../packages/platform-ontology/src/relationships.ts)
and [entity graph](../../packages/platform-entity-graph/src/types.ts).
BELONGS_TO/HAS represent containment; DEPENDS_ON remains dependency. REFERENCES
links records without claiming impact. Existing ASSIGNED_TO is work assignment,
not institutional ownership. New precise relations below are target extensions,
not aliases that change existing relations for old consumers.

| Directed relation | Allowed source -> target | Meaning / query behavior |
| --- | --- | --- |
| HAS / BELONGS_TO inverse view | Institution -> Portfolio -> InstitutionalProduct -> Capability | Governed containment, not permission inheritance; explicit edge, not inferred inverse copy |
| CONSUMES (extension) | Product -> Capability; Capability -> Service; Service -> Primitive/Integration | Consumer relies on provider; eligible impact dependency when marked operationally binding |
| DEPENDS_ON (existing) | Capability -> Service; Service -> Integration/InfrastructureDependency/ExternalDependency; work -> blocking Dependency | Direction consumer -> prerequisite; binding/optional nature explicit |
| PROVIDES (extension) | Service -> Capability; Primitive -> Service | Describes offering, not an additional dependency unless linked to canonical consumption edge |
| OPERATES (extension) | Institution -> Product/Service | Operating responsibility distinct from ownership |
| OWNS (extension) | Institution -> Portfolio/Product/Service; Owner assignment -> Product/Capability/Service/Dependency | Institutional estate ownership is distinct from one effective accountable human assignment per required lane; no legal-equity claim or permission inheritance |
| AFFECTS (extension) | Change/Incident/Risk/Issue -> Product/Capability/Service/Dependency | Explicit affected estate; does not prove incident causation |
| IMPLEMENTS (extension) | Mission/Change -> Capability/Decision conditions | Work intended to implement a change/choice, not evidence it succeeded |
| SUPPORTED_BY (extension) | Decision/Change/Mission/Benefit/RAID -> Evidence | Purpose-specific evidence; byte integrity is not acceptance |
| REFERENCES (existing) | Mission -> Portfolio/Product/Capability/Change/Decision/RAID/Engagement/Benefit; operational -> deployment bridge | Non-authority linkage; bridge relationship semantics also retained in source |
| DEPENDS_ON (work binding) | Dependent work -> Dependency record -> prerequisite work/service | Work blocking semantics in RAID source; graph is projection, no second blocker register |

Risk -> Decision/Mission/Change and RAID -> Supplier/Evidence are typed references;
use AFFECTS only for affected estate, not arbitrary relationships. Both directions
may be queried but only one source edge is persisted. PROVIDES does not duplicate
CONSUMES or create an artificial two-edge cycle.

Required shape:

```text
Institution -OWNS-> Product A -CONSUMES-> Capability B -DEPENDS_ON-> Service C
Institution -OPERATES-> Product A / Service C
Service C -CONSUMES-> SharedPlatformPrimitive
Service C -DEPENDS_ON-> Integration / InfrastructureDependency / ExternalDependency D
Owner assignment -OWNS-> Product / Capability / Service
Mission -REFERENCES-> Product / Capability / OperationalChange / Decision
Change -AFFECTS-> Product / Capability / Service
Risk -AFFECTS-> Product / Capability / Service / Change reference
Decision / Change / Mission -SUPPORTED_BY-> Evidence
```

## Scoped edge storage and mutation

`[Design]` All institutional edge operations require *both* typed endpoint refs,
target scope, expected revision, action authorization and visibility. Composite
identity includes source scope/type/id + relation + target scope/type/id + edge
purpose. No globally colliding edge ID upsert by tenant.

The existing generic graph ports allow tenantless writes/removal and the app
adapter can infer a source tenant without qualifying it. Future scoped ports must
require scope on reads/writes/removal and validate both existing endpoint records,
allowed type pair/cardinality/lifecycle and relationship grant. Store uniqueness/
endpoint constraints must match those checks; app guard alone is insufficient.
Old graph readers remain compatible through versioned adapters, not silently
rewritten tenancy. Cross-scope edges are not permitted merely because the source
endpoint belongs to the caller.

Nodes indexed from Git/DB sources include source ref, hash/revision, mapping version
and observedAt. Changed/deleted/missing source produces explicit divergence/
unresolved state. Projection workers may update indexes only from verified
source receipts; they cannot change ownership, lifecycles or evidence.

## Directed, deterministic traversal

```text
impact(scope, providerRef, at, mode, depthLimit, projectionGrantRefs)
  -> { affectedRefs[], paths[], cycles[], unresolvedRefs[], truncated,
       complete, sourceWatermarks[], visibilityDisposition }
```

- Impact walks incoming eligible CONSUMES/DEPENDS_ON edges from a failing provider
  to consumers. Dependency listing walks outgoing edges. Incident trace runs both
  *separate* operations; D is C's outgoing prerequisite, not C's reverse consumer.
- Work blockers use the authoritative RAID record; graphs only project it.
- Sort each frontier/edge/result by canonical scope/type/namespace/id/revision/
  relation key before BFS. Stable sorted shortest path breaks ties; output is
  independent of insertion order.
- Visit keyed scoped nodes/edges, bound depth, report cycles with stable paths.
  Ordinary service cycles are allowed but surfaced; reject containment and
  blocking-work cycles at write because work cannot satisfy itself.
- depthLimit is required positive integer; budget/depth limits return truncated
  and complete=false, never an apparently exhaustive result. Empty impact is
  proven only from a complete authorized source snapshot.
- CURRENT_OPERATING includes ACTIVE/PILOT/LIMITED/DEGRADED capabilities and active/
  limited services; it excludes proposed/designed/retired, while deprecated
  consumers remain until consumption ends. RETIRED must not be silently active.
  HISTORICAL_AT uses revisions effective at the requested time, including retired
  nodes when then operating. ALL_REGISTERED shows lifecycle without active claims.
- Lifecycle transition to RETIRED requires consumer decommission/exception
  evidence. Remaining live consumers surface an unresolved dependency gap; the
  retired node is not relabeled active to make traversal convenient.
- Missing endpoint, access denial, stale projection or incomplete snapshot makes
  the authorized result incomplete. Denied source details are redacted; no hidden
  counts or path IDs. Operator can see incomplete coverage only if permitted.

## Lifecycle and proof gates

Capability lifecycle reconciles a new meaning rather than rewriting app tiers:
PROPOSED -> DESIGNED -> PILOT -> ACTIVE; ACTIVE/PILOT can become LIMITED/DEGRADED;
LIMITED/DEGRADED -> ACTIVE requires evidence/control review; live states ->
DEPRECATED -> RETIRED requires retirement plan/consumer evidence. Return to design
from pilot needs an amendment. RETIRED is terminal; replacement is a new ref.
DEGRADED requires an observed health/control/incident reason, not a label guessed
from sparse measurements. Each transition is an authorized owner command with
audit/history. App registry PRODUCTION tier remains separate.

## Binary acceptance and failure plan

| Criterion | Test / expected outcome |
| --- | --- |
| Same graph inserted in three different orders | Identical sorted results/path/cycle output |
| Same sourceId appears in two orgs and institution | Reads/edge upsert/removal affect only exact scoped endpoints |
| Provider C fails | Incoming traversal finds B/A; outgoing traversal separately finds D |
| Retired capability remains in graph | Not active; stale live consumer gap explicit |
| Cycle or budget boundary | Cycle metadata or rejected work cycle; truncation is never complete=true |
| Generic Product / inaccessible evidence | No implicit institutional type cast, exposure or permission propagation |

All are AC score 3, `[Design]`; negative cases are required. Missing scope/endpoint/
projection proof fails closed. Acceptance requires future durable adapter and
source-integration tests, not only existing memory-graph tests.
