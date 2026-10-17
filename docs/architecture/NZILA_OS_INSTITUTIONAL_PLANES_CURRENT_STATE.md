# NzilaOS Institutional Planes: Current State

## Checkpoint 1 - repository reconciliation

- Inspection date: 2026-10-12.
- HEAD: `1c337567635bb86ea0df7831557d8d2d22df1e6f`.
- Worktree: `C:\APPS\nzila-os.worktrees\pasted-text-processing-4a973147`.
- Branch: `agents/pasted-text-processing-4a973147`.
- Initial worktree status: clean.
- Scope: repository reconciliation only. No target contracts, runtime changes,
  migrations, production records, merge, publication, or deployment.
- Disposition: **BLOCKED_BY_ARCHITECTURE_AMBIGUITY** for selecting new
  authoritative records and implementing them. Investigation and this map are
  complete; the architecture decisions in [Design holds](#design-holds) remain.

This worktree was already isolated when the mission started. It was retained
rather than creating a second worktree or changing the main checkout.

## Evidence and interpretation

The evidence basis is static source inspection: public types, concrete stores,
routes, host composition, registry readers, migration SQL, CI workflows, and
test configuration. This is not runtime certification, a production inventory,
or proof that migrations, GitHub Environment protections, or deployments are
currently effective in a live environment.

Classification vocabulary:

| Classification | Meaning |
| --- | --- |
| `EXISTING` | A concrete representation or implementation was traced. This does not mean it satisfies every mission invariant. |
| `EXISTING_BUT_FRAGMENTED` | Multiple representations exist with different scope or semantics; no automatic unification is justified. |
| `EXTEND` | Reuse an existing boundary, with explicit new semantics and guards. |
| `NEW` | The requested institutional record was not found in the inspected source scope; nearby analogues are identified. |
| `DO_NOT_CREATE` | A competing subsystem, authority, audit ledger, or product-domain duplicate would violate existing boundaries. |

"Not found" is bounded evidence, not a claim that the concept is absent from
every historical document. Searches covered shared packages, services, platform
registries, governance foundations, architecture documentation, and relevant
management apps. Exact searches for `NORTHSTAR`, `MissionRecord`, `MissionSchema`,
`FleetState`, and `SpecialistEngagement` found no matching contracts in those
scopes. General mission references resolved to agent mission statements and
venture descriptions, not an institutional execution aggregate.

Registry flags and commercial classifications are declarations, not operational
proof. For example, an app's `PRODUCTION` tier does not demonstrate deployment,
service health, or a product-specific readiness ruling.

## Ownership and authoritative package boundaries

The normative [package authority map](../../governance/platform-package-authority.json)
assigns existing concerns, including:

| Concern | Authoritative boundary | Supporting boundary |
| --- | --- | --- |
| Identity and authorization | [platform-auth](../../packages/platform-auth/src/authorization.ts) | Domain-specific role and permission guards |
| Organization context | [org](../../packages/org/src/context/types.ts) | Host-side authenticated scope resolution |
| Cross-app contracts | [platform-contracts](../../packages/platform-contracts/package.json) | Domain contract helpers, not a second platform contract source |
| Evidence lifecycle/export | [platform-evidence-pack](../../packages/platform-evidence-pack/src/orchestrator.ts) | Cryptographic primitives in [evidence](../../packages/evidence/package.json) |
| Eventing | [platform-events](../../packages/platform-events/src/types.ts), platform-event-fabric | Domain event adapters |
| Observability | os-core, platform-observability | OTEL adapters |
| Integrations | platform-integrations, platform-integrations-control-plane | integrations-core/runtime/db |
| Deployment | [platform-deploy](../../packages/platform-deploy/src/index.ts) | CI environment and artifact gates |

Ownership is not synonymous with authorization. The
[package ownership registry](../../governance/platform-package-owners.yaml)
declares teams, but the relevant entries have `steward: null`; it does not identify
named owners or deputies who may approve institutional work.

| Boundary | Declared owner | Qualification |
| --- | --- | --- |
| platform-auth, platform-contracts, platform-ontology, platform-entity-graph | Team @nzila/platform in ownership registry | Entity graph metadata instead says `ai-platform`; reconcile, do not pick silently. |
| platform-policy-engine, platform-evidence-pack, platform-change-management, platform-isolation, platform-validation | Team @nzila/governance in ownership registry | Policy and change package metadata instead say `platform`. |
| platform-decision-graph | Team @nzila/ai in ownership registry | Package metadata says `ai-platform`; this is graph stewardship, not management decision authority. |
| platform-ops, platform-observability, platform-deploy, platform-environment, platform-cost | Team @nzila/ops in ownership registry | Named stewards and institutional lane coverage remain undeclared. |
| executive-os | `platform` in [package metadata](../../packages/executive-os/package.meta.json) | Experimental; hosts may consume it without granting agents institutional authority. |
| hq-domain | `founders` in [package metadata](../../packages/hq-domain/package.meta.json) | DOMAIN_SHARED, experimental, allowed dependent is only nzila-hq. Not a cross-platform estate source. |
| itsm-core | `platform` in [package metadata](../../packages/itsm-core/package.meta.json) | Existing service-operations contract; not authority to introduce a ticketing product. |
| decision-core, decision-intelligence-engine, governance-rationale, institutional-intelligence | No package.meta ownership declaration found | Source contracts exist. Do not invent an accountable human or assume a team assignment. |
| SAGE | Existing SAGE workspace roles and named reviewers | These are domain-specific accountability and permissions, not a global institutional owner registry. |

App ownership in [apps.json](../../platform/registry/apps.json) includes
`platform` for Console, Control Plane, Platform Admin and Orchestrator, and
`founders` for Nzila HQ. Product envelopes use commercial owner labels such as
Nzila Ventures; those labels must not be turned into executable authority.

## Six-plane map

### Authority Plane

| Capability / current state | Current module and persistence | Owner / authority boundary | Traced consumers and gaps | Disposition |
| --- | --- | --- | --- | --- |
| Identity and scoped actor: `EXISTING` | [OrgContext / DbContext](../../packages/org/src/context/types.ts), [platform-auth checks](../../packages/platform-auth/src/authorization.ts); membership/session storage through the auth stack | Platform; authenticated host context carries organization, actor, role, permissions, request correlation | Platform Admin's [scope guard](../../apps/platform-admin/lib/org-scope-guard.ts) verifies session and membership. There is also an explicit configured platform-admin override. No universal human/agent/specialist classification in OrgContext. | `EXTEND` trusted actor classification at existing host boundaries; do not trust request-body ownership or authority. |
| Workflow permission and entitlement: `EXISTING` | [workflow authorizer](../../apps/control-plane/server/authority/workflow-authorizer.ts), governed policies and [decision_events](../../packages/db/src/schema/decision-events.ts) | Control Plane owns workflow authorization; policy lookup, entitlement and durable decision are prerequisites | Approval-required returns unauthorized. Persistence failures deny authorization. This is authorization for a workflow request, not a management decision or permission to deploy. | `EXTEND` typed institutional actions through the same authority boundary. |
| Shared policy evaluation: `EXISTING_BUT_FRAGMENTED` | [platform-policy-engine evaluator](../../packages/platform-policy-engine/src/evaluator.ts), Control Plane policy registry, policies package | Governance / Control Plane; caller must choose the applicable registered policy and enforce its result | Evaluation alone does not authorize: an out-of-scope shared evaluation returns pass. [Orchestrator execute route](../../apps/orchestrator-api/src/routes/execute.ts) also evaluates domain policies despite its policy-deaf header comment. | `EXTEND` explicit deny-by-default composition; preserve distinct domain and workflow evaluations. |
| Named human gates / temporary access: `EXISTING_BUT_FRAGMENTED` | [SAGE roles and expiring assignments](../../packages/sage-core/src/types.ts), [SAGE service](../../packages/sage-core/src/services.ts), ExecutiveOS approval states, CI environment gates | SAGE workspace authority is separate from org-admin entry; internal reviewer is a trusted human, not a browser field | [SAGE runtime](../../apps/platform-admin/lib/sage/runtime.ts) rejects missing/conflicting actor classification. External review is not export, acceptance, or risk authority. No estate-wide exception or specialist acceptance contract traced. | `EXTEND` shared actor/policy contracts; retain SAGE-specific authority. |
| Merge / deploy gates: `EXISTING` | [merge-authority workflow](../../.github/workflows/merge-authority.yml), [staging workflow](../../.github/workflows/deploy-staging.yml), [production workflow](../../.github/workflows/deploy-production.yml), deployment artifacts and governance snapshots | Human maintainers and protected-environment authority; CI consumes evidence for the exact revision | Merge aggregator does not execute checks or equate absence to pass. Deploy workflows run change-window, migration and SLO checks; production job names the production Environment. Live branch protection and reviewer settings were not queried. | `DO_NOT_CREATE` an alternative merge/deploy authorization route. A Change remains a prerequisite, not sufficient authority. |

### Estate Plane

| Capability / current state | Current module and persistence | Owner / authority boundary | Traced consumers and gaps | Disposition |
| --- | --- | --- | --- | --- |
| Product/app/portfolio inventory: `EXISTING_BUT_FRAGMENTED` | [app registry](../../platform/registry/apps.json), [platform registry](../../platform/registry/platform-registry.json), [portfolio catalog](../../governance/portfolio/product-catalog.json), generated [product envelopes](../../platform/products/); Git JSON | App registry owner labels and commercial catalog ownership; changes are repository-governed, not tenant business CRUD | [product generator](../../scripts/generate-platform-products.ts) derives envelopes from catalog + envelope config. Console portfolio reads catalog; [Control Plane registry summary](../../apps/control-plane/app/api/control-plane/registry/summary/route.ts) reads registry files. Different identifiers, tiers and meanings remain. | `EXTEND` source-preserving institutional projections; generated envelopes are not a new editable truth. |
| Typed entity/dependency graph: `EXISTING` | [ontology](../../packages/platform-ontology/src/types.ts), [graph contracts](../../packages/platform-entity-graph/src/types.ts), [graph tables](../../packages/db/src/schema/platform-entity-graph.ts); Postgres adapter and in-memory store | Platform graph stewardship; mutations exposed through Platform Admin org guards | [graph explorer](../../apps/platform-admin/app/entity-graph/page.tsx) calls [Drizzle store](../../apps/platform-admin/lib/entity-graph-store.ts); route writes emit existing ITSM/NAR audit. BFS handles visited nodes, but does not enforce dependency direction, lifecycle eligibility or a canonical ordering. | `EXTEND` typed institutional references and directed dependency queries; no second graph engine. |
| Institutional capability/service lifecycle: `NEW` as a governed record | Existing app tiers, ontology status, platform-service lifecycle, HQ venture stage, asset lifecycle have different scopes | No accountable institutional capability owner/deputy contract traced | App tiers include PRODUCTION/PILOT/INCUBATING; ontology uses active/inactive/archived/pending/suspended; HQ uses incubating/pilot/go-to-market/scaling/mature/sunset. None is the requested capability lifecycle. | `EXTEND` existing estate contracts with a separately reconciled capability lifecycle. Do not reuse app tier as health or capability state. |
| Infrastructure/environment dependency: `EXISTING_BUT_FRAGMENTED` | [environment registry](../../platform/registry/environments.json), [environment types](../../packages/platform-environment/src/types.ts), artifact manifests and snapshots; Git/files | Ops; protected environments and artifact identity remain explicit | Deploy workflows consume artifact and environment state. Registry declares staging and a not-yet-provisioned production entry; this is not evidence of current live topology. No service-to-infrastructure impact graph is wired. | `EXTEND` references to existing environment/artifact sources, not copied secrets or IaC resource ownership. |
| Ownership concentration / deputy coverage: `EXISTING_BUT_FRAGMENTED` | HQ Venture owner/secondOwner, [institutional dependency ownership](../../packages/institutional-intelligence/src/schema.ts), [on-call doctrine](../../ops/oncall/README.md); seed data, store ports and Markdown | Founders for HQ, Platform Engineering for on-call; named institutional lane authority not established | HQ [repository](../../apps/nzila-hq/server/repository.ts) is seeded/in-memory. Institutional intelligence models bus factor and knowledge coverage, not an execution-permission grant. On-call primary/secondary is role doctrine, not a live rotation feed. | `EXTEND` coverage metadata; `NEW` scoped lane assignments/availability. Do not invent current fleet owners. |

### Execution Plane

| Capability / current state | Current module and persistence | Owner / authority boundary | Traced consumers and gaps | Disposition |
| --- | --- | --- | --- | --- |
| Mission / work commitments: `EXISTING_BUT_FRAGMENTED` analogues; institutional Mission is `NEW` | [execution_initiatives](../../packages/db/src/schema/executive.ts), HQ tasks/blockers, agent workflows and automation commands | Initiative owner is descriptive; workflows need Control Plane authority | Console execution reads initiatives/catalog; HQ mission is a venture description. No Mission aggregate with estate targets, decisions, Change and blocking dependencies traced. | `EXTEND` work references; approve the Mission source of truth before creating an aggregate. Do not rename all initiatives or product missions. |
| Execution runs / leases: `EXISTING` | [execution engine](../../apps/orchestrator-api/src/execution-engine.ts), [store](../../apps/orchestrator-api/src/store.ts), automation_commands; Postgres, versioned transitions and leases | Orchestrator executes; workflow permission is distinct from leases and idempotency | Execute route checks org/actor headers against body and requires authorization decision reference for live runs. Engine claims/renews/releases leases and recovers expired ones. Presence of an authorization ID is not proof it is bound to the correct policy/request; that binding requires integration proof. Development-only memory store is not durable authority. | `EXTEND` Mission/Change correlation; never treat a lease or run status as permission. |
| Agent profiles and recommendations: `EXISTING` | [ExecutiveOS contract](../../packages/executive-os/src/contract.ts), registry and action queue; [executive tables](../../packages/db/src/schema/executive.ts) | Platform host owns persistence and execution; pure agents emit insights/recommendations/drafts | [Console host](../../apps/console/lib/executive-os.ts) enforces approval defaults before persisting material actions. [agent workflow runner](../../packages/platform-agent-workflows/src/workflowRunner.ts) blocks deny/requires_approval but accepts caller-provided check/output and is not a complete authority boundary. | `EXTEND` evidence/recommendation linkage. `DO_NOT_CREATE` agent self-authorization or a competing fleet authority. |
| Native Change: `EXISTING_BUT_FRAGMENTED` | [ChangeRecord](../../packages/platform-change-management/src/types.ts), [file service](../../packages/platform-change-management/src/service.ts), ops/change-records JSON; separate [itsmChanges](../../packages/db/src/schema/itsm.ts) in Postgres | Change package ownership declarations conflict; Git deploy approvals and tenant service approvals are different trust boundaries | [window checker](../../packages/platform-change-management/src/checks.ts) is consumed by CI; [Control Plane reader](../../apps/control-plane/server/change-data.ts) reads files; Console ITSM calendar reads DB. DB has platformChangeId bridge field, not evidence of bidirectional synchronization. | `EXTEND` existing Change contract and explicitly reconcile DB/file authority. No platform-change replacement package. |
| Change approval / PIR: `EXISTING` partial semantics | [approval evaluator](../../packages/platform-change-management/src/approvals.ts), itsmApprovals, Change PIR | Existing evaluator checks role-name strings in approved_by, not authenticated approving actor identity | STANDARD has no mandatory role in evaluator; NORMAL requires service_owner/change_manager (+ security for high/critical); EMERGENCY service_owner and PIR. Save validates schema but is not an authorized state machine. Checker warns, rather than denies, on mismatched listed commit/PR. | `EXTEND` pattern approval, actor attribution, transition guards, estate impact, evidence and separate blocker reasons. |
| Execution capacity: `NEW` at lane/window level | Founder time logs, weekly focus targets, HQ allocation engines and Command Center ticket-load summaries | Founders / Platform; planning estimates do not grant capacity or authority | Existing hours, recommendation scores and overloaded ticket counts are not run reserve, committed capacity, or change-capacity commitments. | `EXTEND` planning references; `NEW` coarse lane/window commitments. Do not derive fake precision from ticket counts. |
| Specialist engagement: `NEW` | SAGE external reviewer / expiry / revocation is a domain analogue; no engagement aggregate traced | Acceptance and institutional risk must remain with explicitly authorized internal actors | Current SAGE access does not model permitted products/services/data/actions, expected outputs, technical counterpart, knowledge transfer or internal closeout acceptance. | `NEW` engagement contract after authority/owner approval; reuse identity and evidence, not SAGE roles as generic execution permissions. |

### Evidence Plane

| Capability / current state | Current module and persistence | Owner / authority boundary | Traced consumers and gaps | Disposition |
| --- | --- | --- | --- | --- |
| Authorization decision: `EXISTING` | [decision-core records](../../packages/decision-core/src/types.ts), [Control Plane recorder](../../apps/control-plane/server/authority/decision.ts), decision_events and NAR audit_records | Platform/domain policy authority; machine outcome is approved/rejected/pending/escalated or allowed/denied/approval_required, depending on contract | Orchestrator and SAGE audit adapters use decision-core/NAR. [decision-events migration](../../migrations/platform/20260520_decision_events.sql) declares no-update/no-delete triggers. Applied DB enforcement is unverified. | `EXISTING`; `DO_NOT_CREATE` a competing authority ledger or mislabel a policy result as a management decision. |
| Management decision / rationale: `EXISTING_BUT_FRAGMENTED` | [DecisionAnalysis](../../packages/decision-intelligence-engine/src/schema/decision.ts), [GovernanceRationale](../../packages/governance-rationale/src/schema.ts), executiveDecisions, [SAGE decision records](../../packages/sage-core/src/services.ts); ports, Postgres records, host fixtures | Named owners in analysis/rationale, executive owner text, SAGE named-human DECISION_RECORD role; no universal authoritative aggregate declared | Analysis has options, risk/mitigations, owner, evidence and supersession fields. [rationale engine](../../packages/governance-rationale/src/engine.ts) links supersession, but mutation helpers do not enforce frozen superseded state. SAGE decisions are immutable human governance records with evidence-derived access and uncertainty; not investment/deploy approvals. | `EXTEND` existing analysis/rationale semantics and preserve SAGE; select accountable management source explicitly. No new competing decision lineage. |
| Decision graph / institutional lineage: `EXISTING_BUT_FRAGMENTED` | [decision graph](../../packages/platform-decision-graph/src/types.ts), decision_nodes/edges schema + memory store; [institutional lineage](../../packages/institutional-intelligence/src/lineage.ts) and store ports | AI graph stewardship versus undeclared institutional-intelligence stewardship; neither grants execution | Platform Admin [decision page](../../apps/platform-admin/app/decisions/page.tsx) renders enums/input without a Load Trail handler. Control Plane KT data builds fixed sample records stamped with current time, not a durable live lineage query. | `EXTEND` reference adapters around the selected authoritative records; no graph consolidation by dropping provenance. |
| Evidence sealing / retention / provenance: `EXISTING_BUT_FRAGMENTED` | [platform orchestrator](../../packages/platform-evidence-pack/src/orchestrator.ts), [decision evidence schema](../../packages/decision-evidence/src/schema.ts), SAGE evidence/export/records services; ports, evidence tables, immutable exports | Governance for platform evidence; SAGE workspace authorization and human export/records gates remain distinct | Platform packs seal digest/Merkle root; decision packs carry previous-pack hash. SAGE [records service](../../packages/sage-core/src/records-services.ts) gates destruction and verifies absence. Shared [retention manager](../../packages/platform-evidence-pack/src/retention.ts) has automatic deletion for standard class: do not apply to new institutional records without retention/hold policy. | `EXTEND` links, verified dispositions and lineage. `DO_NOT_CREATE` another evidence store or authorize access through a copied reference. |
| Mutation audit: `EXISTING_BUT_FRAGMENTED` | [audited DAL](../../packages/db/src/audit.ts), audit_events, NAR audit_records, [governance timeline](../../packages/platform-governance/src/auditTimeline.ts), itsmTicketEvents | Platform/Governance; host actor context and policy evidence should accompany mutation | Entity graph routes use existing ITSM/NAR writer. [SAGE audit adapter](../../apps/platform-admin/lib/sage/audit-adapter.ts) feeds the same NAR pipeline; sensitive export flows also have durable outbox intent. Change emitter uses process-memory timeline with orgId 'platform'; file save does not itself emit audit. Default audited-DAL emitter logs failure after mutation, so not atomic fail-closed audit proof. | `EXTEND` existing durable audit composition and transactional/outbox patterns. `DO_NOT_CREATE` an independent institutional audit ledger. |
| RAID: `EXISTING_BUT_FRAGMENTED` analogues; linked register is `NEW` | Analysis risk acceptances/assumptions, rationale assumptions/accepted risks, PPOA risks, securityFindings, HQ blockers, lineage risk nodes | Domain decision/risk actors; no reusable authorized owner/change/closure lifecycle across estate | Free-text blockers and lineage nodes are not blocking dependency records. Security findings are not all institutional risks; a boundary flag is not automatically an Issue. | `EXTEND` shared linked Risk/Assumption/Issue/Dependency contracts, preserve origin and closure history. Do not duplicate mission blockers or repurpose domain records wholesale. |

### Operations Plane

| Capability / current state | Current module and persistence | Owner / authority boundary | Traced consumers and gaps | Disposition |
| --- | --- | --- | --- | --- |
| Incident memory: `EXISTING` | itsmTickets type incident, events, assignee, changeId/problemId/assetId, attachments, resolvedAt; [ITSM schema](../../packages/db/src/schema/itsm.ts) | Platform/service operations; org-bound records | Console incidents queries incident tickets and derives product from metadata. No typed affected service/external dependency link or restoration evidence requirement traced. Missing source errors become empty rows on this page. | `EXTEND` minimal institutional incident view and links, not a new ticketing system. |
| Problem / root cause: `EXISTING_BUT_FRAGMENTED` | itsmProblems has rootCause/linkedIncidentIds/remediationTaskIds; [problem analysis port](../../packages/decision-intelligence-engine/src/store.ts) has hypotheses and analysis | Platform service-operations ownership versus analytical recommendation ownership | Console problems reads operational records; Control Plane KT samples analysis. A hypothesis is not confirmed root cause, and remediation task is not an authorized corrective Change. | `EXTEND` linked analytical evidence and corrective Change references; retain both meanings. |
| Health and degradation: `EXISTING_BUT_FRAGMENTED` | [health digest](../../packages/platform-ops/src/health-digest.ts), environment reports, integration connection health, productHealthSnapshots; computed values/ports, DB snapshots and artifacts | Ops; observed source, environment, timestamp and controls determine interpretation | Command Center reads snapshots; platform ops computes SLO violations from supplied measurements. Health must not be inferred from app tier, a successful empty query, or a generated sample timestamp. | `EXTEND` provenance-backed OperationalHealthState and dependency impact projection; no new telemetry engine. |
| Supplier / external dependency: `EXISTING_BUT_FRAGMENTED` analogues; stewardship record is `NEW` | [integration connection](../../packages/platform-integrations-types/src/connectors.ts), credentials, platform service integrations, commerce suppliers and [Flow vendor links](../../packages/db/src/schema/flow/vendors.ts) | Platform integrations own transport; commerce vendors belong to product commercial domain | Connections have org/app/connector/actor/health; no complete supplier contract/renewal/cost/exit/replacement institutional model traced. Asset manufacturer is not a Supplier authority record. | `NEW` scoped dependency stewardship metadata referencing integrations and terms; `DO_NOT_CREATE` procurement or duplicate commerce vendors. |

### Value Plane and management read surfaces

| Capability / current state | Current module and persistence | Owner / authority boundary | Traced consumers and gaps | Disposition |
| --- | --- | --- | --- | --- |
| Outcome / benefits: `EXISTING_BUT_FRAGMENTED` | decisionScorebacks, budgetLines, HQ reports, finance snapshots; DB plus seeded calculations | Executive decision/financial source owners, not agents claiming benefits | Console scoreback records expected/actual ROI and result, but status set is pending/on-track/exceeded/missed/cancelled, without evidence-backed realization disposition. No mission/capability-level verified benefit ledger. | `EXTEND` outcome evidence/dispositions with explicit source and acceptance, not a duplicate financial ledger. |
| Portfolio / CAPITAL: `EXISTING` partial substrate | Catalog, [capital signals](../../scripts/lib/capital-live-signals.ts), [allocation generator](../../scripts/generate-capital-allocation.ts), capital foundations JSON/CSV | Founders/portfolio governance; generated recommendations and estimates are not accepted investments or realized savings | Signals distinguish live/manual/estimate/unavailable, nullable values and observation times. Generator models an illustrative capital/engineering allocation. NORTHSTAR linkage contract not found in inspected scope. | `EXTEND` source-preserving benefit references; defer NORTHSTAR adapter until its actual contract is supplied/reconciled. |
| COMMAND / TODAY / portfolio / estate reads: `EXISTING_BUT_FRAGMENTED` | Console Command Center, workspace routes, Control Plane architecture/registry/change readers, HQ seeded repository | Console is institutional operating front door; Control Plane owns authority; Platform Admin is org-scoped, not global ops | Console combines clients, alerts, health snapshots, priorities and ticket-load pressure; no joined Mission/Change/Decision/RAID/engagement/capacity read contract. HQ is seeded; KT snapshot is illustrative; Platform Admin decision lookup is unwired. | `EXTEND` typed, provenance-backed read contracts before UI. Do not introduce a seventh workspace or a separate COMMAND app. |
| Explainability: `EXISTING_BUT_FRAGMENTED` | Rationale, policy reason codes, analysis confidence, lineage, graph neighbors, CAPITAL observation labels | Each source owns its meaning and visibility | No universal source-derived "what/why/owner/dependencies/failure/health proof" projection. Text from an inaccessible evidence source cannot be exposed through a derived explanation. | `EXTEND` authorized metadata projections with unknown/error/stale dispositions; no invented prose status. |

## Actual call paths and semantic seams

Route source anchors below are relative to the linked app route roots. Keeping
the route-group segments in code preserves their exact names without ambiguity
in the repository's documentation link checker:

| Route source root | Inspected source relative to root | Consumer traced |
| --- | --- | --- |
| [Console app routes](../../apps/console/app/) | `(dashboard)/portfolio/page.tsx` | Catalog-backed portfolio |
| [Console app routes](../../apps/console/app/) | `(dashboard)/execution/page.tsx` | Initiatives and catalog delivery status |
| [Console app routes](../../apps/console/app/) | `(dashboard)/itsm/changes/page.tsx` | DB operational Change calendar |
| [Console app routes](../../apps/console/app/) | `(dashboard)/itsm/incidents/page.tsx` | Incident ticket read projection |
| [Console app routes](../../apps/console/app/) | `(dashboard)/decision-scoreback/page.tsx` | Expected/actual decision outcomes |
| [Console app routes](../../apps/console/app/) | `(dashboard)/command-center/page.tsx` | Clients, alerts, health, priorities and workload |
| [Control Plane app routes](../../apps/control-plane/app/) | `(dashboard)/governance/_kt-data.ts` | Fixed KT sample snapshot, not authoritative state |

### Estate graph

The existing reachable path is:

1. Platform Admin page obtains verified page org context.
2. Page loads org-filtered graph nodes and edges through the app Drizzle adapter.
3. Client explorer uses shared graph traversal over that snapshot.
4. Node/edge API writes pass withOrgWrite, schema validation, existing storage,
   then recordItsmAudit.

The generic graph API is not yet a sufficient institutional graph guard:

- EntityNode reads carry tenantId, but EntityEdge writes and removal do not
  carry tenant context in the shared interface.
- The generic adapter's addEdge infers tenant from a source-node lookup that
  is not tenant-qualified; removeEdge accepts only edge ID.
- Route helper insertEdge receives tenant scope, but its conflict identity is
  the global edge ID and does not validate both scoped endpoint records.
- Existing edges lack foreign keys to scoped endpoints. Ontology Product also
  represents business-domain products; it must not silently become the
  institutional app/product type.
- Traversal follows both incoming and outgoing relationships. It answers
  connectivity, not directed service blast radius. Cycles are bounded through
  visited sets; order depends on store iteration, not a sorting contract.

These are design constraints for extending the graph, not verified exploit
findings or permission to change existing runtime code during Checkpoint 1.

### Change

The repository has two deliberate-looking but incompletely connected shapes:

| Shape | Meaning | Consumer | Reconciliation requirement |
| --- | --- | --- | --- |
| File ChangeRecord | Git-native deployment window, environment/service, role-label approvals, test refs, rollback and PIR | CI validation and Control Plane file reader | Preserve approved revision, provenance, environment-specific gates and immutable historical proof. |
| itsmChanges + itsmApprovals | Org-scoped operational change request with named user IDs and platformChangeId | Console ITSM calendar / Platform Admin approval configuration | Determine whether it is a request facade, projection, or independent bounded operational change. Do not make both editable authorities. |

The existing status vocabulary is PROPOSED, UNDER_REVIEW, APPROVED, SCHEDULED,
IMPLEMENTING, COMPLETED, FAILED, ROLLED_BACK, CLOSED (lowercase/underscore in
ITSM enums). Existing STANDARD/NORMAL/EMERGENCY must be retained or versioned,
not silently renamed. Approval status is already separate from change status.

Affected estate arrays, requester/implementer/reviewer/authorizer separation,
mission/decision/risk dependencies, required evidence/test plan, result and
rollback result need extension. Policy, human, dependency and capacity blockers
must stay separate from lifecycle. Existing helpers do not prove an immutable
change type or external-specialist authorization exclusion.

### Decision

These records must not be collapsed into one table because their names overlap:

| Record | Existing meaning | Candidate institutional use |
| --- | --- | --- |
| decision-core DecisionRecord / decision_events | Policy evaluation and authorization evidence | Preserve as proof of permission, linked from management work. |
| DecisionAnalysis | Options, criteria, recommendation/selection, approvers, risks and uncertainty | Candidate management analysis, not automatic institutional approval. |
| GovernanceRationale | Owner, outcome, rationale, evidence, accepted risks, approval and supersession | Candidate authoritative rationale lineage, requiring durable guarded mutation composition. |
| executiveDecisions | Lightweight founder/executive decision with initiative linkage | Existing management consumer; reconcile rather than silently discard. |
| SAGE decision record | Immutable named-human workspace governance record with evidence-derived visibility | Preserve domain record; link only when authorized, never convert to general deploy/risk acceptance. |
| DecisionNode / LineageNode | Graph/projection of decisions and supporting relationships | Reference index, not a competing mutable decision authority. |

DecisionAnalysis lifecycle is drafting/under-review/decided/implemented/superseded.
GovernanceRationale uses draft/active/superseded/archived. Graph nodes instead use
pending/executed/overridden/revoked/expired. They are not interchangeable.

Management completeness, explicit evidence disposition, effective/review dates,
immutable superseded content and atomic supersession need target-contract proof.
The existing store ports often accept only an ID on lookup/update; their future
host adapters must bind org scope explicitly rather than trust an ID alone.

## Primitive-by-primitive disposition

This is a reconciliation inventory, not an approved schema or package creation list.

| Requested primitive | Classification / disposition |
| --- | --- |
| Institution | `EXTEND` explicit identity over existing org/institution references; do not equate every tenant with the operating institution. |
| Portfolio | `EXISTING_BUT_FRAGMENTED`; extend catalog projections, not a replacement portfolio store. |
| Product | `EXISTING_BUT_FRAGMENTED`; retain app/catalog provenance and distinguish commerce Product. |
| Capability, Service, SharedPlatformPrimitive | `EXTEND` platform registry/ontology contracts with institutional IDs and lifecycle. Governed runtime records are not yet present. |
| Integration | `EXISTING`; reference current integration connections and connector contracts. |
| InfrastructureDependency, ExternalDependency | `EXTEND` typed dependency references; new stewardship fields, no duplicate IaC/credential records. |
| Owner | `EXISTING_BUT_FRAGMENTED`; extend named scoped assignments and deputy coverage, not auth roles inferred from owner text. |
| Control | `EXISTING_BUT_FRAGMENTED`; reference policy/control/evidence sources, no parallel policy engine. |
| Risk, Assumption, Issue, blocking Dependency | `EXTEND` existing analysis/blocker semantics into shared linked records; new lifecycle guards required. |
| Mission | `NEW` governed execution aggregate; source-of-truth selection held. |
| Change | `EXTEND` existing package with a clear ITSM bridge; no replacement Change subsystem. |
| Decision | `EXTEND` existing management/rationale model after authority selection; preserve policy decisions and SAGE. |
| Evidence | `EXISTING`; extend links/disposition/retention, no second evidence system. |
| SpecialistEngagement | `NEW` scope/expiry/output/internal-acceptance contract; no specialist self-authority. |
| LaneOwnership, capacity-window commitments | `NEW` scoped contracts; reuse on-call, dependency concentration and planning references. |
| Incident, Problem | `EXTEND` existing service operations and analysis references, no ticketing product. |
| OperationalHealthState | `EXTEND` measured health contracts with source/time/estate linkage. |
| Supplier, ExternalService | `NEW` institutional stewardship records referencing existing integrations; no procurement or domain-vendor migration. |
| Value / Benefits record | `EXTEND` outcome/scoreback semantics with verified evidence and realization disposition. |
| COMMAND read model | `EXTEND` management projections hosted in existing Console workspaces. |
| New institutional audit, authority engine, deploy bypass, product-domain copies | `DO_NOT_CREATE`. |

## Recommended package topology before implementation

No new top-level subsystem or package is authorized by this checkpoint.

1. Use platform-contracts for cross-app reference and read contracts. Extend
   platform-ontology and platform-entity-graph for estate types/relationships
   where the distinction from domain Product is explicit.
2. Keep org/platform-auth as context and identity sources. Use existing policy
   and Control Plane services for permission; ownership is metadata until an
   authorized mutation confirms it.
3. Extend platform-change-management. Keep ITSM operational requests within
   their current domain boundary with a documented bridge to deployment records.
4. Extend decision-intelligence-engine/governance-rationale/decision-evidence
   for analysis and lineage once a management aggregate is selected.
   decision-core and decision_events remain authorization proof, not a
   replacement management workflow. Preserve SAGE without broadening it.
5. Use institutional-intelligence for reusable lineage/dependency projections
   where appropriate, and existing graph stores for traversal. Establish
   explicit stewardship and durable adapter contracts before broadening exports.
6. Reuse itsm-core and platform-ops for incidents/problems/health. Extend existing
   integration boundaries for supplier dependency references; keep product
   commerce suppliers in product logic.
7. Keep executive-os as recommendation/action contract and host read adapters
   in existing apps. Do not import hq-domain across the platform: its declared
   allowed dependent is nzila-hq only.
8. Put management presentation in existing Console Overview/Portfolio/Ventures/
   Operations workspaces. The [workspace doctrine](../doctrine/NZILA_CONSOLE_WORKSPACE_DOCTRINE.md)
   and [actual navigation](../../apps/console/lib/nav-config.ts) require six
   workspaces plus Settings. Control Plane remains authority, and Platform Admin
   remains org-scoped administration.
9. If Mission, engagement, capacity or benefits need a new cohesive package,
   propose its owner, permitted dependents, persistence, authority and proof
   obligations at Checkpoint 2. Do not instantiate the mission's illustrative
   platform-estate/change/decisions/operations/value/engagements package names.

## Persistence, tenancy, audit and migration risk

### Established patterns

- OrgContext is the canonical request scope. Actor, membership, permissions and
  role must be resolved server-side.
- [Scoped DAL](../../packages/db/src/scoped.ts) object form is read-only and
  expects an orgId/org_id column. Writes use audited scoped composition.
  String-form legacy CRUD is not the recommended extension pattern.
- Graph tables instead use text tenant_id; decision graph uses UUID tenant_id;
  operational/executive records use org_id referencing orgs. The
  [exec-data schema](../../packages/db/src/schema/exec-data.ts) uses
  organization_id for a distinct organizations domain. Column-name similarity
  is not evidence that those identities are interchangeable.
- [System client](../../packages/db/src/system-client.ts) requires an explicit
  SYSTEM_DATABASE_URL and is intended for authorized cross-user auth operations.
  It is not permission for global institutional reads or writes.
- Reuse existing audit_events/NAR proof and durable outbox composition. The
  [SAGE Postgres repository](../../packages/sage-core/src/postgres-repository.ts)
  is an existing source for scoped repository and records-lifecycle patterns,
  not a reason to absorb SAGE domain semantics.
- Timestamps, actor attribution and hashes already exist, but before/after
  state, authority, reason, source and Mission/Change/Decision references are
  not consistently required at every existing mutation.

### Migration risk register for this mission

| Risk | Source evidence | Required handling before any migration |
| --- | --- | --- |
| Two Change authorities / unsynchronized approvals | File service versus itsmChanges/platformChangeId | Specify writable source, projection direction, role-to-actor approval mapping, revision proof and rollback. |
| Decision lineage loss | Analysis/rationale/graph/executive/SAGE semantics differ | Preserve IDs, origin, visibility, supersession and historical payloads; select one management authority explicitly. |
| Cross-scope joins | tenant_id, org_id and organization_id are distinct existing contracts | Bind institution/tenant/system scope, validate both relationship endpoints, and prove scoped uniqueness/read/write behavior. |
| Domain duplication | Ontology Product, commerce vendors, SAGE decisions, HQ Venture | Use typed references and adapters; do not mass-migrate domain records into institutional tables. |
| Audit advertised as durable when it is not | Memory governance timeline; best-effort DAL/audit adapters | Require durable mutation+audit outcome or outbox intent and replay proof; preserve existing audit infrastructure. |
| Unsupported retention/deletion | Shared evidence standard retention permits auto-delete; SAGE has hold/destruction controls | Define retention class, legal holds, supersession and archival before applying shared retention to institutional records. |
| False management status | KT fixed sample, HQ seeded repository, silent empty query paths | Read contracts must distinguish observed, illustrative, unavailable, stale and error; no invented healthy/complete state. |
| Migration delivery drift | SQL exists in packages/db/drizzle, migrations/platform and root migrations | Choose canonical migration runner, ordering and registry updates; do not assume the next numeric filename or execute SQL. |
| Ownership declaration drift | Registry teams conflict with package metadata; null stewards | Assign accountable stewardship and authority separately before new shared mutation surfaces. |

The graph's [0029 migration](../../packages/db/drizzle/0029_itsm_automation_ticket_fields_entity_graph.sql),
the platform decision-events migration, and additive SAGE migrations demonstrate
different existing delivery streams. Only map and reconcile at this checkpoint.
No backfill, enum rewrite, destructive migration or live schema operation occurred.

## Test architecture and proof obligations

The [root Vitest configuration](../../vitest.config.ts) registers package, app,
and contract-test projects. Existing coverage includes:

- [graph tests](../../packages/platform-entity-graph/src/entity-graph.test.ts):
  graph operations and traversal; not proof of durable directed estate impact.
- [Change tests](../../packages/platform-change-management/src/change-management.test.ts):
  current approvals/windows/PIR; not authenticated specialist exclusions.
- [workflow authorizer tests](../../apps/control-plane/server/authority/workflow-authorizer.test.ts):
  policy/entitlement/decision failure paths.
- [scoped DAL tests](../../packages/db/src/__tests__/scoped.test.ts) and
  [audit tests](../../packages/db/src/__tests__/audit.test.ts).
- [rationale tests](../../packages/governance-rationale/src/engine.test.ts):
  replay and supersession links; not a frozen superseded management record.
- [SAGE services tests](../../packages/sage-core/src/services.test.ts),
  [records tests](../../packages/sage-core/src/records-services.test.ts):
  named-human workspace governance and domain records controls.
- [contract tests](../../tooling/contract-tests/): org isolation, server-action
  scoping, audit immutability, registry authority and migration safety.

The later implementation must provide separate schema, authorization, mutation,
audit, tenant isolation, integration and regression proof. Specifically:

1. Deterministic directed product impact, intentional cycle handling, scoped
   owner lookup and retired-capability exclusion.
2. Immutable change type; independently verified approvals; policy/human/
   dependency/capacity blockers; retained evidence and post-change review.
3. Authorized decision owner, evidence disposition and immutable historical
   supersession; atomic lineage updates with source visibility preserved.
4. Expired/revoked/closed engagement cannot execute, self-accept or accept risk.
5. Audited RAID owner/closure transitions, retained history and blocking work
   dependencies linked to the same source rather than duplicated.
6. Cross-org reads/writes/edges fail; global/system actors have explicit
   institutional scope; failure to resolve scope is not an empty success.
7. COMMAND reports source/error/staleness accurately. Unit tests alone do not
   certify runtime adoption, tenancy, deployment or readiness.

Checkpoint 1 changes only this documentation. Runtime tests, full lint/typecheck,
test:fast and governance:audit are not acceptance proof for an unimplemented
model and are not claimed as run here. Documentation validation results are
reported with the checkpoint response; no PR review is requested.

## Design holds

Historical Checkpoint 1 ruling below is preserved. The user accepted Checkpoint 1
as PASS and resolved these four decisions for Checkpoint 2: explicit institution/
organization/system scopes, GovernanceRationale management-decision authority,
independent operational/deployment Changes with a durable bridge, and governed
internal-human stewardship assignments. See the
[target operating model](./NZILA_OS_INSTITUTIONAL_OPERATING_MODEL.md) and its six
companion contracts for those accepted decisions and the design-only disposition.
This does not upgrade any current-state capability or certify runtime readiness.

The repository supports safe reuse recommendations, but does not dictate these
material architecture choices:

| Hold | Decision needed | Recommended starting point, not authorization |
| --- | --- | --- |
| Institutional scope | Is the institutional estate owned by one explicit platform org, by each tenant, or by a separately scoped institution with allowed portfolio projections? | Canonical org-bound records with an explicit institutional/system scope and adapters for legacy identities; no implicit "first org" fallback. |
| Management decision authority | Which existing aggregate owns a material management decision and its immutable supersession? How do executive decisions, analyses and rationale refer to it? | Reconcile management analysis/rationale and executive records; retain policy decisions, SAGE and graph projections as distinct sources. |
| Change authority / bridge | Is org operational change a request facade over Git deployment approval, or independently bounded work linked to a deployment Change? | Preserve Git-native deployment gates; specify one writable authority for each meaning and an evidence-backed bridge. |
| New work stewardship | Who owns governed Mission, engagement, lane/capacity and benefits contracts, and who may accept/close them? | Assign named internal accountability and deputy scope before new authority-bearing records; use existing packages where boundaries permit. |

These holds are not invitations to broaden scope. They explain why an
implementation or final enum/package topology would currently depend on
assumptions. Checkpoint 2 should resolve them, then define the entity graph,
authority matrix, lifecycles, tenant/audit model and COMMAND read contract.
The remaining seven requested model documents belong to that later checkpoint,
not this current-state-only change.
