# Specification: NzilaOS Institutional Operating Model

> Spec type: API contract, with process/workflow contracts on paper.
> Load-bearing: acceptance criteria, executor context, failure conditions.
> Supporting: outcome, scope boundaries, ambiguity resolution.
> Date: 2026-10-12. Author: Copilot-assisted architecture reconciliation.
> Decision owner: institutional architecture authority, assigned through governed
> human records; no person or agent name is encoded in a contract.
> Checkpoint: 2, design only. Disposition: **READY_TO_IMPLEMENT**.
> This is design completeness, not runtime readiness or permission to implement.

## How to Read This Spec

| Reader | Required reading | Supporting contracts |
| --- | --- | --- |
| Implementer | Scope, context, scope adapters, mutation/audit composition, package topology | All six companion contracts below |
| QA / reviewer | Acceptance criteria, failure conditions, synthetic walkthrough, ambiguity audit | Invariants in each companion |
| Management / decision owner | Outcome, accepted decisions, authority matrix, assumptions | Mission, engagement and value semantics |
| Console designer | COMMAND contract in the operations document | Scope and explicit non-goals; no UI at this checkpoint |

The contract set is one specification partitioned by concern:

- [Estate model](./NZILA_OS_ESTATE_MODEL.md): references, entity catalog, graph.
- [Change governance](./NZILA_OS_CHANGE_GOVERNANCE.md): operational/deployment
  separation, linkage, gates, results and PIR.
- [Decision and RAID](./NZILA_OS_DECISION_AND_RAID_MODEL.md): durable rationale,
  supersession, compatibility and blocking state.
- [Specialist contract](./NZILA_OS_EXTERNAL_SPECIALIST_CONTRACT.md): engagement
  scope, expiry, outputs and independent acceptance.
- [Operations model](./NZILA_OS_OPERATIONS_MODEL.md): incidents, problems,
  dependencies, lanes, capacity and COMMAND.
- [Value model](./NZILA_OS_VALUE_MODEL.md): benefit observation and acceptance.
- [Current-state map](./NZILA_OS_INSTITUTIONAL_PLANES_CURRENT_STATE.md):
  evidence of what exists; target storage and APIs below are not existing APIs.

## Notation Key

- `[Validated: source]` means an accepted user decision or inspected repository
  fact; it is not runtime certification.
- `[Design]` means a normative target selected within this design authorization,
  not a statement that it is implemented or separately accepted by maintainers.
- `[Assumed: verify]` means an environment prerequisite; its validator and
  pre-activation deadline appear in the assumption registry.
- AC score 3 means a binary-testable criterion. The zero-question count measures
  unresolved contract decisions, not an invented confidence or readiness score.
- References below denote source records, never copied authority. UTC instants
  use ISO 8601. Every expiry interval is half-open: effectiveAt <= now < expiresAt.
- Names of future storage families are paper contracts, not migration filenames.

## 1. Outcome Statement

An executor can trace the specified synthetic institutional scenario and determine
the owner, permitted mutation, authority, persistence, audit, failure response and
scope at every transition without inventing authority or replacing an existing
bounded system.

Verification: the walkthrough and companion contracts answer all seven questions
for every transition. Outcome rubric score: 3, binary against that checklist.

## 2. Scope

### IN scope

| Capability | Boundary | AC |
| --- | --- | --- |
| Scope, reference, authority and mutation contracts | Paper definitions and compatibility adapters | 1, 2, 3 |
| Mission, estate, Change, decision, RAID and engagement lifecycles | Governed work, not product business logic | 3, 4, 5, 6 |
| Operations, stewardship, capacity, benefits and management reads | Source-preserving metadata and projections | 7, 8, 9 |
| Migration/proof planning and scenario walkthrough | No SQL execution or runtime fixture creation | 10, 11 |

### OUT of scope

| Excluded adjacent capability | Why / destination |
| --- | --- |
| Package creation, runtime types/services, endpoints and UI | Requires a later implementation authorization |
| SQL migrations, backfills, production records, identity bootstrap | Future reviewed delivery; no live operations here |
| New authority engine, audit ledger, evidence store or graph implementation | Existing boundaries remain authoritative |
| Ticketing, procurement, timesheets, investment execution, finance-ledger replacement | Institutional metadata is not a product expansion |
| Product-domain model changes, SAGE generalization, HQ boundary widening | References must preserve original semantics |
| Merge, deploy, publication, agent authority grants | Independent human/governance gates remain binding |

Dependencies on runtime adapters and identity assignments are activation
preconditions for later implementation, not unresolved architecture choices.
The apparent tension between explicit institution and org-backed audit is resolved
by the verified binding described below, not by selecting the first org.

## 3. Acceptance Criteria

All criteria inherit the accepted Checkpoint 2 decisions `[Validated: user]`.
Specific target mechanics are `[Design]`.

| ID | Type | Binary criterion | Score |
| --- | --- | --- | --- |
| AC-1 | Behavioral | A record/reference carries one explicit scope; missing/unknown scope fails rather than defaulting to institution/org/system. | 3 |
| AC-2 | Negative | Org consumption and SYSTEM classification confer zero additional permissions; cross-scope projection requires a verified grant and preserves source scope. | 3 |
| AC-3 | Behavioral | Each material mutation has scoped actor/action/resource authorization and durable audit intent in the same commit as its state mutation. | 3 |
| AC-4 | Behavioral | A decided rationale's original content/evidence/owner cannot change; concurrent supersessions create at most one successor per head. | 3 |
| AC-5 | Negative | Operational approval neither approves a Deployment Change nor authorizes deployment; Mission/run/lane state also cannot do so. | 3 |
| AC-6 | Edge case | At engagement expiry or revocation, a new step is denied even if an earlier authorization/lease still exists; specialist self-acceptance is denied. | 3 |
| AC-7 | Behavioral | Dependency traversal is directed, scoped, deterministic, cycle-bounded and explicit about retired nodes and truncation. | 3 |
| AC-8 | Edge case | Failed/stale/unwired/sample read sources are represented as ERROR/STALE/UNAVAILABLE/ILLUSTRATIVE, never an observed zero or healthy state. | 3 |
| AC-9 | Behavioral | FORECAST cannot become REALIZED without immutable observation evidence and an authorized internal human acceptance. | 3 |
| AC-10 | Dependency | The future synthetic test binds explicit institution, audit org, actors/policies and source refs before exercising every walkthrough step. No inferred identity is allowed. | 3 |
| AC-11 | Non-behavioral | Checkpoint 2 changes are documentation only: zero runtime, package, migration or production-record changes. | 3 |

Complexity: 11 criteria; subordinate contracts partition their detailed tests.
Definition of done for design: seven target documents, answered walkthrough,
source references verified and documentation checks reported. Runtime ACs above
remain future test obligations, not claims of passed tests.

## 4. Context and Decisions

### Executor, glossary and stakeholders

Executor: software engineering/QA team or an authorized implementation agent,
requiring explicit repository contracts. Questions about implementation technique
may remain; no action may be inferred from a role label.

| Term | Meaning |
| --- | --- |
| Institution | Explicit Nzila operating identity, distinct from tenants |
| Source record | Writable authority for one meaning; includes revision |
| Reference | Scoped identifier resolving to a source, not a data/permission copy |
| Projection | Read-only indexed view retaining source revision and visibility |
| Derived state | Computed from complete authorized sources with declared rules |
| Management decision | Human choice recorded by GovernanceRationale |
| Authorization decision | Policy result/permission evidence, not a management choice |
| Acceptance | Named authorized internal human validates a particular output/evidence/benefit revision |
| Steward | Accountable maintenance role; does not automatically approve actions |

Architecture authority owns contract changes. Platform contract steward owns shared
schemas/adapters; governance steward owns rationale/audit policy; service operations
steward owns operational Changes/incidents; institutional work steward owns Missions,
engagements and planning; outcome steward owns benefit semantics. All are roles to
which authenticated internal humans are assigned. None is a person embedded in code.
Named assignments are required before activation; unassigned roles deny mutations.

### Accepted decisions and dependencies

| Decision / constraint | Evidence and consequence |
| --- | --- |
| Explicit PLATFORM_INSTITUTION, ORGANIZATION, SYSTEM | `[Validated: user Decision 1]`; no inferred institution |
| Analysis informs; GovernanceRationale records material management choice | `[Validated: user Decision 2]`; other decision models retain their meaning |
| Operational and Deployment Changes remain separate authorities | `[Validated: user Decision 3]`; links do not synchronize approvals |
| Governed accountability roles, no hardcoded individuals | `[Validated: user Decision 4]`; assignment does not mint permission |
| Reuse existing graph, evidence/audit, policy and Console | `[Validated: user additional decisions]`; no new conceptual-plane packages |
| Existing org-only stores and rationale/graph mutation gaps | `[Validated: current-state map and inspected ports]`; explicit new adapters required |

Repository baseline remains HEAD `1c337567635bb86ea0df7831557d8d2d22df1e6f`.
Source paths were inspected on 2026-10-12. Live schema, credentials, branch
protections and named assignments are unverified; design never calls them active.

### Concrete scope composition

`[Design]` Extend cross-app contracts with a discriminated scope:

```text
Scope = { type: PLATFORM_INSTITUTION | ORGANIZATION | SYSTEM, id: nonempty-id }
Reference = { scope, kind, namespace, sourceId, revision }
MutationContext = {
  trustedActorId, actorClassification, internalAffiliation,
  actingScope, targetScope, requestId, correlationId,
  authorityDecisionRef, policyVersion, reason, source
}
```

Actor classification is resolved by the trusted identity adapter:
INTERNAL_HUMAN, AGENT, EXTERNAL_HUMAN, EXTERNAL_AI, SYSTEM.
Existing user/service/system/break_glass transport values remain compatible but
cannot prove internal affiliation. A service identity is not a human because it
has a human-looking UUID. Break-glass is a time-bound authority mode, not identity.

`[Design]` A governed scope-binding registry in the existing DB/platform boundary
holds an explicit institutional identity and mappings to legacy storage:

```text
InstitutionBinding {
  institutionId, governanceOrgId, status, version,
  approvedBy, approvedAuthorityRef, effectiveAt, revokedAt, auditRef
}
SourceScopeBinding {
  namespace, legacyIdentityKind, legacyIdentityValue,
  canonicalScope, mappingVersion, authorityRef, effectiveAt, revokedAt
}
```

- Institution ID is opaque and explicitly enrolled. governanceOrgId names a
  dedicated registered platform org for legacy org-scoped audit/records only.
  Assignment to that org is not institutional access.
- Institution records use scope_type/id and a bound org_id for existing org DAL/
  audit compatibility. Constraints/service guards enforce that the org matches
  the active versioned binding, not a client field.
- ORGANIZATION records retain existing org_id. Canonical scope.id equals the
  verified org UUID; tenant access uses existing OrgContext/membership.
- Graph adapters map text tenant_id or UUID tenant_id through a namespace-specific
  binding. Scope type must not collide: the adapter validates a stable storage
  tenant binding, not raw equality between arbitrary institution/org IDs.
- organization_id in executive/business schemas is mapped explicitly per
  namespace. It is not automatically the orgs UUID with the same string.
- SYSTEM scope records are limited to binding/maintenance metadata. A system
  principal performing work on an institution/org uses that *target* scope and
  an action-specific policy. A SYSTEM scope is not a wildcard.
- Missing, revoked, conflicting or multiple active mappings fail with a scoped
  error. No mass column rename. Historical refs retain mapping version; revoked
  mapping prevents new work but permits separately authorized historical reads.
- Bootstrap is a maintainer-authorized enrollment path using existing privileged
  identity/policy controls and durable audit, not a public auto-create endpoint.
  No real institution ID or org assignment is created by this spec.

Cross-scope reads require a policy-approved projection grant naming source scope,
consumer scope, kinds/fields, purpose, expiry and source visibility constraints.
Cross-scope relationships require scoped endpoint validation and the same grant.
Sensitive raw evidence is never exposed by a summary. Tenant consumption alone
does not imply a grant. Restricted items produce no identifiers, counts or paths
unless that specific aggregate disclosure is permitted.

### Authority matrix

`[Design]` Every cell is explicit. "Conditional" is never a role grant: it means
the action-specific registered policy, target scope, live identity/assignment,
required independent approvals and durable authorization must all allow it.

- H: conditional internal-human action; must hold the named action permission.
- D: H plus an effective deputy assignment covering that action; no inherited
  authority beyond the assignment.
- W: narrow authorized work on permitted fields, no owner/scope/policy mutation.
- R: recommend/draft only, attributed evidence; not authority.
- P: Control Plane evaluates registered policy and records authorization; no
  human acceptance/decision is made by the service.
- C: authenticated CI operation under approved revision/environment/human gates.
- N: prohibited in this role.

| Actor / boundary | Create | Recommend | Modify | Approve | Authorize execution | Accept risk | Accept evidence | Close | Supersede | Deploy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Internal human owner | H | H | H (draft/allowed fields) | H (independent where required) | H (request/consent; CP still required) | H (risk mandate) | H (independent of producer) | H (closure permission) | H (new immutable rationale) | H (release consent, not direct bypass) |
| Internal human deputy | D | D | D | D (independent) | D (request/consent) | D (explicit risk mandate) | D (independent) | D | D | D (release consent) |
| Agent | R (proposal, not source Mission) | R | W (execution/evidence only) | N | N | N | N | N | N | N |
| External specialist, human or AI | R (submission only) | R | W (engagement outputs only) | N | N | N | N | N | N | N |
| System actor | W (authorized run/observation records) | R | W (deterministic event application) | N | N (requests CP) | N | N | N (no discretionary closure) | N | N (use CI boundary) |
| Control Plane | P (authorization/approval-request records) | N | P (policy-governed authority lifecycle) | N (records verified human vote only) | P | N | N | N | N | N |
| CI / deployment authority | C (build/run/attestation records) | N | C (execution/results) | N | N (consumes grants) | N | N (may verify bytes, not accept adequacy) | N | N | C |

Scope/membership and authority checks are cumulative. Human owner cannot self-
approve their implementation/output. Deputy cannot be the same principal as
primary when independence is required. Agent/external actor cannot become internal
owner, modify assignments, accept residual risk, extend engagement, or change policy.
Machine expiry/status application is a recorded deterministic event, not human
closure/acceptance. CI status can record a successful run, never a realized benefit.

### Mission: source contract and lifecycle

`[Design]` Mission is a new aggregate within institutional-intelligence, not a new
package and not a renamed initiative. It records:

```text
id, scope, title, reason, desiredOutcome, acceptanceCriteria,
accountableOwnerAssignmentRef, executionOwnerAssignmentRef, deputyAssignmentRef?,
affectedEstateRefs[], changeRefs[], decisionRefs[], raidRefs[], evidenceRefs[],
engagementRefs[], benefitRefs[], initiativeCompatibilityRefs[],
status, version, proposedAt, authorizedAt?, startedAt?, completedAt?, closedAt?,
cancellationReason?, authorityRefs[], createdBy, updatedBy, source, timestamps
```

Accountable owner must be a currently assigned internal human. Execution owner may
be internal human or explicitly governed agent/service; this does not broaden its
permissions. Owner replacement uses an audited assignment transition, retaining
original owner/history. Required refs must resolve in scope or have an explicit
projection/relationship grant.

| Transition | Actor and preconditions | Meaning |
| --- | --- | --- |
| none -> proposed | Internal human with mission.create; owner, scope and outcome required | Agent proposals remain recommendations until human creation |
| proposed -> authorized | Internal human with mission.authorize, CP proof and approved criteria | Permission to undertake Mission, not to deploy or accept risk |
| authorized -> active | Execution owner under fresh execution grant, all required gates clear | Actual start; run lifecycle remains separate |
| authorized/active -> blocked | Deterministic authorized gate monitor or responsible internal human | Required blocker recorded; no new work starts |
| blocked -> authorized/active | Prior phase recorded; fresh gates clear and resume authorized | Never bypasses a revoked/expired grant |
| active -> completed | Execution owner submits completion evidence; monitor records all required runs ended | Work ended, acceptance pending; not "delivered" |
| completed -> closed | Independent internal human with mission.close verifies criteria/evidence/dispositions | Closure is accountable acceptance |
| proposed/authorized/active/blocked/completed -> cancelled | Internal human with mission.cancel, reason and safe-stop evidence if started | Non-success terminal state; history retained |

Cancelled/closed are terminal. Material scope/outcome expansion returns unstarted
Mission to proposed for new authorization; active Mission needs suspension and a
versioned amendment with new gates, not silent mutation. No automatic reopening.
Missing owner coverage is an authority blocker, not permission to choose an agent.
Mission, Change and execution-run lifecycle transitions do not propagate approvals.

### Package and persistence topology

`[Design]` No new package is necessary: institutional-intelligence already owns
cross-object lineage/dependency/continuity contracts and store ports. Extend it
with bounded Mission, RAID linkage, engagement, lane/capacity and benefit modules;
it must remain framework-free and must not acquire policy evaluation or product
business logic. Proposed stewardship role: institutional work contract steward,
with governance steward reviewing authority/evidence invariants. Future metadata
must register these roles; absent assignment denies activation.

| Existing boundary | Target responsibility / consumers |
| --- | --- |
| platform-contracts | Scope/reference/command/query transport contracts, explicit control-system versioning |
| org, platform-auth | Existing org/actor identity and trusted classification adapters |
| Control Plane / platform-policy-engine | Existing policy, entitlement, human approval and authorization composition |
| platform-ontology, platform-entity-graph | Typed institutional references and scoped directed graph/index contracts |
| platform-change-management | Deployment Change guards/approved-pattern/revision evidence; retain Git record source |
| itsm-core | Operational Change/incident/problem contracts and existing lifecycles |
| decision-intelligence-engine, governance-rationale | Analysis and canonical management decision payload respectively |
| decision-evidence, platform-evidence-pack, NAR | Existing evidence lineage/sealing, authorized disposition, audit proof |
| institutional-intelligence | Mission/RAID/engagement/planning/benefit sources and lineage projections |
| packages/db, existing server hosts | Durable adapters, same-DB transaction/outbox composition |
| platform-ops, platform-integrations* | Health and external dependency source adapters |
| executive-os | Recommendations/actions, not a new management write authority |
| Console | Read-only management projections in existing six workspaces |

Permitted new dependents of institutional contract modules: existing Control Plane,
Console, Platform Admin (only authorized org administration), Orchestrator (execution
correlation only), DB/graph/adaptor modules and tests. Forbidden new dependents:
client direct writers, product-domain authority engines, hq-domain cross-platform
reuse, and any module treating lineage/assignment as an authorization grant.
Existing domain dependencies remain unchanged. Shared export/metadata changes
need contract-maintainer review during implementation; none are performed here.

Package-owner reconciliation is not actor authorization: the normative package
authority registry remains the baseline over conflicting package metadata. Graph
registry Team @nzila/platform vs metadata ai-platform, and policy/change registry
Team @nzila/governance vs metadata platform, require additive metadata reconciliation
under existing package governance before new exports activate. The institutional
work contract steward is a proposed accountable role, not a fabricated current
package.meta owner. No package changes or ownership appointments occur here.

Persistence families, on paper: scope bindings, institutional work records,
reference links/assignments, benefit observations/acceptances, rationale revisions/
supersession. Existing graph tables remain indexes; existing ITSM, deployment files,
decision_events, audit_events and audit_records remain their own sources.
All new durable families use versioned schemas, scoped keys, actor/timestamps,
optimistic concurrency and reference validation. Existing source schemas need
only additive adapters/fields with defined compatibility; no mass migration.

### Mutation and durable audit composition

`[Design]` Future write commands use:

```text
Command { idempotencyKey, targetRef, expectedVersion, reason, proposedMutation }
Result { committedRef, version, authorityDecisionRef, auditIntentRef,
         auditDelivery: RECORDED | PENDING }
Error { code, safeMessage, requestId }  // never success-shaped default data
```

Actor/scope/authority are host-resolved, not accepted from command fields.
Idempotency is keyed by scope + actor + action + key + canonical payload hash.
Same key/hash returns original outcome; different payload returns conflict.
CAS failure returns conflict, no lost update. Mutations are not retried under a
new key after ambiguous timeout; resolve the original receipt first.

1. Authenticate, resolve trusted affiliation/assignments, validate scope mapping
   and visibility. Reject invalid refs before dereferencing hidden evidence.
2. Resolve applicable policy and independent approvals; obtain durable CP
   authorization bound to actor, target scope/kind/id/revision, action, request
   digest, expiry and constraints. Missing policy/decision persistence denies.
3. At mutation/start, check current revocation/expiry and mutable policy/gates;
   verify the persisted authorization against the actual request. A UUID-shaped
   decision reference, stale allow, human owner, lease or client role is insufficient.
4. In one DB transaction: lock/CAS source, revalidate mutable gates, append state/
   history and durable audit intent. Use the existing audit/NAR pipeline. If it
   cannot join the transaction, use the existing outbox pattern extended for
   these intents. An outbox is a delivery queue, not an independent audit ledger.
5. Audit intent records actor ID/classification/affiliation, acting and target
   scope/mapping version, authority/policy/approval refs, action/reason/source,
   occurredAt, before/after snapshots or immutable refs with hashes, previous/new
   version, correlation/request ID, Mission/Change/Decision refs when applicable.
   Before/after evidence obey access and retention policy; secrets are excluded.
6. Existing sink appends hash-chained/sealed audit proof with a stable event ID;
   serialize each chain's appends under a scoped lock, enforce event deduplication
   and versioned canonical JSON, persist the exact hashed timestamp. A status-
   changing projection cannot alter a historical audit payload.
7. Failure before commit leaves no source mutation. Sink failure after committed
   intent is explicit PENDING, retries with the same event ID, operator alert and
   evidence-gated authority actions remain blocked until durable proof delivery.
   Logging alone is not acceptance evidence. No acknowledgement of accepted
   risk, evidence, benefits, decision activation or deploy permission is final
   until its required proof is RECORDED.

Source-state visibility and authority eligibility are separate: a committed
pending activation/acceptance event may be visible to permitted reviewers, but
effective authority requires a RECORDED receipt and valid current conditions.
Readers/gates must apply that predicate, not infer permission from an `active`,
`accepted` or `approved` storage label. A failed delivery cannot silently preserve
an apparently final acceptance.

The existing [audited DAL](../../packages/db/src/audit.ts) and
[Control Plane audit writer](../../apps/control-plane/lib/audit-db.ts) are not
already this atomic composition. The former logs failures; the latter currently
uses independent writes and clock values. The
[SAGE audit adapter](../../apps/platform-admin/lib/sage/audit-adapter.ts) is
best-effort for some actions; SAGE's durable outbox flows are useful prior art.
Reuse the sinks and strengthen composition for new institutional commands.
Do not describe any pre-existing mutation as retroactively fixed.

Git Deployment Changes cannot atomically commit with a DB transaction. The bridge
therefore captures repository/ref/path/blob hash/source record revision and a
verified Git approval/CI attestation; DB link commit plus audit intent is atomic,
Git remains the source. A missing/unverifiable approved revision blocks deployment.
Never write a DB approval and pretend it changed a protected Git record.

### Retention and deletion

`[Design]` Default for new institutional sources, amendments, assignment history,
decision payloads, links, receipts and proof is RETAIN with no automatic deletion.
Archive affects active reads, not historical content/access. Legal holds and
versioned retention assignments use existing evidence/records mechanisms.
Destruction needs reviewed retention eligibility, internal authority, independent
approval and verified deletion evidence; preserve a non-content tombstone and
lineage refs where policy permits. No duration is invented, and standard evidence
auto-delete must not apply by default. Adoption of a later retention policy is
governed work, not a missing Checkpoint 2 architectural decision.

## 5. Failure Conditions

| Type | Deviation signal | Action / accountable role |
| --- | --- | --- |
| Data model | Ambiguous/revoked scope mapping or unscoped endpoint lookup | Deny; record safe failure; platform contract steward repairs binding, never default |
| Authorization | Specialist/agent used as accountable human, approving producer or risk acceptor | Deny; governance steward investigates identity/assignment; no privilege workaround |
| Integration | Sink unavailable, outbox cannot commit, or Git revision cannot be verified | Roll back uncommitted work; explicit PENDING for committed intent; block evidence-gated continuation |
| Process | A projection changes source state, automatic cross-Change approval, or hash fails replay | Stop that adapter; preserve source, require corrected contract/tests before activation |

Worst misinterpretation test: owner/deputy and SYSTEM are not permission; "completed"
is not accepted; retained references do not expose evidence; documentation readiness
is not deployed readiness. AC-2/5/6/8/9 and the matrix explicitly exclude these.

## 6. Ambiguity Audit

| Question | Resolution | Status |
| --- | --- | --- |
| Which scope owns shared estate? | Explicit institution with governed audit-org binding; tenant consumption grants nothing | Resolved |
| Which decision is writable management truth? | Immutable GovernanceRationale decided revision; analysis/legacy/graphs retain distinct roles | Resolved |
| Which Change authorizes deploy? | Git Deployment Change plus independent CP/CI/human/environment gates; operational record only links | Resolved |
| Where does Mission belong? | Bounded institutional-intelligence module and scoped DB adapter, no new package | Resolved |
| Who accepts or closes new work? | Governed internal-human assignments plus per-action policy, independence and proof | Resolved |
| What if a source/sink is absent? | Explicit failure/unknown/PENDING, never guessed status or permissive fallback | Resolved |

Zero-question count: **0 unresolved architectural/authority decisions** in this
contract. Named production assignments, actual policy registrations and runtime
tests are required implementation/activation work, not fabricated design holds.

## 7. Implementation Guidance

No implementation in Checkpoint 2. Later authorized sequence:

1. Add versioned contracts/metadata and scoped fixture-only identity bindings.
   Use the existing DB migration conventions after inspecting the selected runner,
   update org-scoped registry for org_id families and scoped guards for graph
   tenant fields. Generate no migrations at this checkpoint.
2. Implement estate reference/graph adapters, guarded rationale and operational/
   deployment bridge with audit intent composition. Preserve old exports behind
   explicit version adapters; old ports are not accepted for new material writes.
3. Add Mission/RAID/engagement, then lanes/capacity and COMMAND reads, then incident/
   supplier/value extensions. No dashboard before stable source contracts.
4. Shadow read projections and compare IDs/counts/provenance to sources. Disable
   new writes if comparison fails; keep original systems authoritative.
5. Migrate only explicit matches, recording migration provenance and evidence
   disposition. No initiative -> Mission or executive -> rationale mass backfill.
6. Rollback: disable new mutation routes/consumers and restore old read adapters;
   retain append-only new records and proof. No down-migration destroying history.
   Reconcile partially processed Git/DB bridges by original receipts.

Proof plan: schema/type checks; authority/mutation denial tests; transactional CAS/
outbox failure injection; cross-org/institution/edge tests; independent Git/CI
integration fixtures; regression suites for existing boundaries; synthetic scenario
tests. Relevant existing commands are pnpm lint, pnpm typecheck, pnpm test:fast,
pnpm validate:docs and pnpm governance:audit before a later PR review. Runtime/
staging evidence is separately required; passing unit tests alone is insufficient.

## Open Tensions

No unresolved design tension remains. Legacy org-only APIs, best-effort sinks and
unscoped graph writes cannot satisfy the new contract unchanged; the explicit
scoped/transactional adapters are required implementation, not a reason to invent
a second system. Existing legacy callers are preserved, not silently promoted.

## Assumption Registry

| Assumption / evidence | Confidence | Validator and deadline | Invalidation response |
| --- | --- | --- | --- |
| Same database can commit source + existing audit intent; scoped PostgreSQL and SAGE outbox patterns exist | H, `[Assumed: verify]` environment prerequisite | DB/platform steward, before enabling new writes | If host lacks transactions, deny new writes there; compose at a transactional server host, not best-effort sink |
| Protected Git revision and CI/human proofs are retrievable; workflow definitions exist | H, `[Assumed: verify]` environment prerequisite | Release authority, before any deploy bridge activation | Missing proof blocks deployment; retain operational work/history |
| Internal human assignments and identity binding can be enrolled through existing privileged governance | H, `[Assumed: verify]` environment prerequisite | Identity/governance steward, before activation | No assignment or affiliation means denied actions, not default admin |

These are testable preconditions with fail-closed behavior, not unverified grants.
No production identity, credential, capacity number or policy permission is assumed.

## Adversarial Self-Critique

1. **Audit-org alias could leak institutional data.** Binding is a storage adapter,
   not org membership authorization. Watch: ordinary member of the audit org can
   read institutional content without an institutional policy; deny and fix adapter.
2. **Projection could rewrite history.** Graph status and legacy executive edits
   must not flow backward. Watch: a decided payload hash changes when a projection
   refreshes; stop the adapter and fail supersession tests.
3. **Outbox could become success-shaped audit.** PENDING is durable intent, not
   accepted proof. Watch: deployment/acceptance continues before RECORDED receipt;
   gate the action and alert rather than weakening audit.

## Revision Triggers

| Trigger | Affected contract |
| --- | --- |
| Canonical auth/org/Control Plane contract changes or new trusted actor type | Scope adapters and authority matrix |
| GovernanceRationale canonical hash/storage semantics change | Decision immutability, replay and audit composition |
| Git deployment source or required human/environment gate changes | Change bridge and scenario |
| Console workspace doctrine changes | COMMAND host boundary, not source authority |

## Appendix: Synthetic Paper/Contract Walkthrough

All IDs below are symbolic synthetic data, not real institutional/tenant records.
I is explicitly enrolled institution; GI is its bound audit/operations org. T is
an unrelated tenant with no projection grant. H1 is internal accountable owner,
H2 is independent internal approver/acceptor, H3 is service operations owner;
S1 is the external specialist; CI1 is deployment service; SYS1 is a narrowly
scoped monitor. Roles/permissions are hypothetical fixture assignments, not grants.

Common failure/isolation rules: transaction failure => unchanged source; ambiguous
timeout => resolve idempotent receipt; audit sink failure => PENDING and gated
continuation. All refs retain scope/revision and all reads require permission;
T cannot see I/GI identifiers or counts without an explicit grant.

| Step / transition | Owner / permitted mutator | Authorization | Persistence / evidence | Failure behavior | Scope |
| --- | --- | --- | --- | --- | --- |
| 1. Enroll I and binding to GI | Identity steward / authorized internal bootstrap human | Existing privileged enrollment policy and independent human approval | Existing identity registry + versioned scope binding; audit/NAR intent and enrollment proof | No mapping/no audit => no institution use | SYSTEM maintenance action targets explicit I binding; no T membership implication |
| 2. I owns Product A; A consumes B; B depends on C; C depends on D | Estate/service stewards / H1 with estate mutation permission | CP estate.create/link and verified scoped endpoints | Registry product ref plus institutional metadata, existing graph indexes and scoped relationships; audit and source revisions | Invalid endpoint/lifecycle => reject link; incomplete graph flagged | A/B/C/D in I; org consumption needs separate grant |
| 3. Propose Mission M improving B | H1 accountable, execution owner explicitly assigned / H1 | mission.create, no agent ownership | Mission source with outcome, criteria and affected B; audit intent | Missing human owner or outcome => reject | I with GI bound storage |
| 4. Approve/activate E for S1 | Internal sponsor H1, counterpart H3 / H2 approver | engagement.approve/activate, defined limits, expiry and independent assignment | Engagement + versioned grant references; approval/CP proof, audit | Grant issuance failure => approved but not active; no S1 rights | I, named product/service/data/action scope |
| 5. E supplies recommendation R | H1 owns engagement / S1 submits attributed output | Active unexpired E and narrow submission policy | Immutable output bytes in existing evidence storage; digest, producer, E ref, no acceptance | Expired/suspended or sink/storage failure => deny/quarantine, no accepted R | I visibility envelope; S1 sees only permitted E data |
| 6. DecisionAnalysis evaluates R | H1 analysis owner / assigned analyst or narrow agent drafter | analysis.write; cannot accept risk/decide by analysis state | Existing analysis schema extension/adapter with R and options/uncertainty; revision/audit | Unresolved refs => unknown analysis, no guessed recommendation authority | I; source evidence access retained |
| 7. Record GovernanceRationale X | H1 decision owner / H1 with decision.record; H2 required if risk/independence applies | CP decision.record + required human approvals/risk mandate; full evidence or explicit disposition | Immutable decided rationale revision, analysis link, rationale/options/conditions; existing audit/NAR receipt | CAS/audit pending => not effective; no partial successor | I with verified GI ledger binding, R access floor inherited |
| 8. Authorize/start M; M requires O | H1 accountable / H2 authorizes M, H3 creates O | mission.authorize and operational-change.create separately | M references org-bound itsmChanges O and decision X via explicit scope link; audit approvals | Either failed permission => no linked work execution | M/X in I; O in GI ORGANIZATION via explicit reviewed cross-scope link |
| 9. O requires Deployment Change P | H3 operational owner / internal release requester creates Git P; H3 links | O link authority, verified Git P revision and approved cross-scope purpose | O authoritative DB; P authoritative Git; durable bridge records linkedBy/time/evidence/revisions | Missing Git record/ref => O deployment dependency unresolved; neither copies approval | O ORGANIZATION GI; P PLATFORM_INSTITUTION I; link preserves both scopes |
| 10. Approve O independently | H3 / H2 operational approver, not implementer | operational policy, impact/risk/test/rollback criteria and own human approvals | itsmApprovals + O revision; durable approval proof | O can be APPROVED but EVIDENCE/DEPENDENCY blocked waiting for P | GI membership plus action authority; P unaffected |
| 11. P passes independent deploy gates | Release owner / named deployment approvers; CP evaluates; CI1 verifies | Pattern/NORMAL/EMERGENCY policy, Git approval, exact commit/artifact, window, protected environment and independent human gate | P approved revision + CI attestations/CP decision; existing proof stores | Any denial/unknown/revocation => no deployment even if O approved | I bound to GI authorization ledger; CI1 explicit target environment, not global |
| 12. Execute P and authorized O steps | Execution owners / CI1, or narrow permitted executor for O | Fresh request-bound grants + live gates + leases; S1 only permitted non-authority tasks | Existing run store and leases, P/O results, artifact/evidence refs; each material step audit intent | Failure => FAILED/rollback path; expired E stops S1 next step; no rollback-success assumption | Exact I/GI targets and bridge refs; T cannot list runs |
| 13. Retain evidence, PIR and close work | Owners H1/H3 / executors submit, H2 accepts/closes | Evidence acceptance/PIR/mission.close permissions independently checked | Existing sealed evidence, O/P review and results, M completion then closure; NAR receipts | Missing proof/PIR/unknown rollback => completion unaccepted, closure blocked | Source floors/holds retained; no copied public evidence |
| 14. Incident J affects C | H3 service owner / authorized SYS1 detection, H3 manages restoration | incident.record scoped sensor; independent human closure policy | Existing incident ticket J in GI, scoped AFFECTS C reference, detected/restored evidence and Change correlation | Sensor outage => health UNKNOWN; no incident-free/healthy fallback | GI record with permitted C-in-I ref, not tenant incident visibility |
| 15. Trace J/C/B/A/D and P/O/X/M | Accountable read steward / permitted reader, system query adapter | CP read policy for each source and cross-scope link | Read-only reverse C dependency impact to B/A, outgoing C dependency to D, recent AFFECTS links to P/O and decision/Mission refs; source revisions/time | Inaccessible/truncated/stale branch => explicit incomplete view; not proof P caused J | No unauthorized path/count disclosure to T or S1 |
| 16. Benefit V stays FORECAST, then observation and acceptance | H1 outcome owner / sensor records observation; H2 accepts | benefit.observe then independent benefit.accept with evidence and measurement criteria | Benefit source + immutable observation/acceptance refs, FORECAST -> OBSERVED -> REALIZED only after proof; NAR | Missing baseline/source/acceptance => UNPROVEN or remains FORECAST; incident may trigger reassessment | I with GI bound storage; finance originals stay domain-scoped |
| 17. Later X is superseded by X2 | Decision owner H1 / authorized internal human | Fresh decision.supersede policy, independent approval if required | One transaction appends X2 + unique X->X2 supersession + audit intent; original X immutable | Concurrent second supersession conflicts; no lost history | Same I; cross-scope supersession prohibited |

The conceptual walkthrough passes: every transition has all seven answers. No
runtime scenario was executed and no production data was used.

## Checkpoint 2 Verification Record

Verified 2026-10-12 against the baseline above; this is documentation/design proof,
not fulfillment of future runtime ACs.

| Check | Result |
| --- | --- |
| `pnpm validate:docs` | Could not run auditor: missing tsx and node_modules; dependency manifest unchanged, no installation performed |
| `node --experimental-strip-types --input-type=module -`, importing the existing auditor and calling `runDocConsistency(process.cwd())` | Passed: 2,455 files scanned, zero global errors, zero warnings in the eight checkpoint documents; four informational naming notices retain exact source identifiers |
| Local-reference/ASCII check | Passed: seven target documents plus historical map, 137 existing local references, ASCII content |
| Exact structural coverage check | Passed: seven actors x ten explicit action cells; 17 walkthrough rows covering owner/mutator, authority, persistence/evidence, failure and scope; eight engagement permission rows; all 22 COMMAND item contracts |
| Worktree scope check | Passed: only the seven requested target documents and historical-map cross-reference are present as changes; no executable/schema/package/migration/production records |

The existing auditor reported 1,205 warnings outside the checkpoint documents.
They are not fixed or included in design acceptance. The programmatic invocation
uses the same repository rules but avoids the CLI's generated report writes.
Runtime lint/typecheck/tests, governance audit, migrations, live/staging scenario
and deployment checks were not run: this checkpoint authorizes documentation only
and requests no PR review. No commit, publication, merge or deployment occurred.
