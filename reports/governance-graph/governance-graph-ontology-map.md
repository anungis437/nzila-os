# Governance Graph — Ontology Map (Phase 1)

> The implicit institutional ontology already encoded in the repo, expressed as nodes, edges, and events — using the names the institutions themselves use, not graph-theory labels.

This map is descriptive, not prescriptive. Every entry below is grounded in an existing schema, type, or package. Phase 2 will decide which of these become first-class projections in `@nzila/platform-entity-graph` and `@nzila/platform-decision-graph`.

## 1. Node kinds (institutional bodies, persons, instruments)

### 1.1 Organizational bodies

| Node kind | Source | Notes |
|---|---|---|
| Platform | `organizationTypeEnum = 'platform'` | The root tenant; effectively the operator of the substrate. |
| Congress | `organizationTypeEnum = 'congress'` | E.g. CLC. Top-tier umbrella body. |
| Federation | `organizationTypeEnum = 'federation'` | Provincial / sectoral federations. |
| Union | `organizationTypeEnum = 'union'` | A national/international union (CUPE, CAPE, etc.). |
| Local | `organizationTypeEnum = 'local'` | A union local. |
| Region | `organizationTypeEnum = 'region'` | Internal regional division. |
| District | `organizationTypeEnum = 'district'` | Internal district division. |

These are linked by self-FK `parentId` plus `hierarchyPath text[]` and `hierarchyLevel int` on the `organizations` table — the parent/child tree is already materialized.

### 1.2 Workplace structure

| Node kind | Source |
|---|---|
| Employer | `union-structure-schema.ts → employers`, `employerTypeEnum`, `employerStatusEnum` |
| Worksite | `union-structure-schema.ts → worksites`, `worksiteStatusEnum` |
| Bargaining unit | `union-structure-schema.ts → bargainingUnits`, `unitTypeEnum`, `unitStatusEnum` |
| Committee | `union-structure-schema.ts → committees`, `committeeTypeEnum` |

### 1.3 Persons and roles

| Node kind | Source |
|---|---|
| Member | implicit via `voter_eligibility`, `committeeMemberships`, `stewardAssignments` |
| Steward | `stewardAssignments`, `stewardTypeEnum`; representative type `'steward'` in `RepresentationProtocol` |
| Labour Relations Officer (LRO) | representative type `'lro'` (CAPE preset) |
| National Representative | representative type `'national_rep'` (CUPE preset) |
| Officer | representative type `'officer'` |
| Committee member | `committeeMemberships`, `committeeMemberRoleEnum` |
| Negotiator (chief / member / researcher / note-taker / subject expert / observer / legal counsel / financial advisor) | `bargaining-negotiations-schema.ts → teamRoleEnum` |
| Union Member Representative Council (UMRC) | `golden_shares.holderType = 'council'`; the holder of Class B Special Voting Shares |

### 1.4 Constitutional & financial instruments

| Node kind | Source |
|---|---|
| Class B Special Voting Share (Golden Share) | `governance-schema.ts → golden_shares` |
| Reserved Matter | `reserved_matter_votes.matterType ∈ {mission_change, sale_control, data_governance, major_contract}` |
| Bylaw | implicit via voting session type `bylaw_amendment` |
| Collective Bargaining Agreement (CBA) | `bargaining-negotiations-schema.ts` (FKs `expiringCbaId`, `resultingCbaId`) |
| Motion | `committee-workspace-schema.ts` (committee meetings with motion outcomes) |
| Proposal | `proposalTypeEnum ∈ {union_demand, management_offer, joint_proposal, mediator_proposal}` |

### 1.5 Decision / evidence artifacts (already first-class in platform packages)

| Node kind | Source |
|---|---|
| Decision | `@nzila/platform-decision-graph → DecisionNode` |
| Policy reference | `DecisionNode.policyRefs[]` |
| Evidence reference | `DecisionNode.evidenceRefs[]` |
| Knowledge reference | `DecisionNode.knowledgeRefs[]` |

## 2. Edge kinds (institutional relationships)

| Edge kind | Source | Direction |
|---|---|---|
| `parent_of` (organizational hierarchy) | `organizations.parentId` self-FK | parent → child |
| `affiliated_with` (federation membership) | `congress_memberships` | union/local → congress/federation |
| `represents` | `stewardAssignments`, representation-protocol routing | steward/LRO/rep → member or worksite |
| `member_of` (committee) | `committeeMemberships` | person → committee |
| `bargains_for` | `bargainingUnits → employers` + negotiation team | unit/team → employer |
| `negotiates` | `negotiations` (sessions, proposals) | parties → CBA |
| `supersedes` (CBA lineage) | `negotiations.expiringCbaId → resultingCbaId` | new CBA → old CBA |
| `eligible_to_vote_in` | `voter_eligibility` | member → voting session |
| `delegates_to` (voting power) | `voter_eligibility.canDelegate`, `delegatedTo`, `votingWeight` | delegator → delegate |
| `casts` (vote) | `votes` (anonymized via `voterHash`) | (anonymous) member → option |
| `holds` (Class B share) | `golden_shares.holderType = 'council'` | UMRC → Class B share |
| `vetoes` / `approves` (Reserved Matter) | `reserved_matter_votes.classBVote ∈ {approve, veto}` | UMRC → Reserved Matter decision |
| `tabled` / `carried` / `defeated` / `withdrawn` (motion) | committee meetings | motion → outcome |
| `tenured_as` (role history) | `roleTenureHistory` | person → role over time |
| `governed_by` | `org_configurations` (key=`representation_protocol`) | union → RepresentationProtocol |

The decision-graph package already carries its own edge vocabulary that the IGG can reuse without reinvention: `depends_on`, `overrides`, `escalated_to`, `triggered_by`, `informed_by`.

## 3. Event kinds (institutional acts that change the graph)

| Event | Source | What it does to the graph |
|---|---|---|
| Affiliation granted / suspended / expired | `congress_memberships.status` transitions | adds / disables `affiliated_with` edge |
| Steward assigned / rotated / ended | `stewardAssignments`, `roleTenureHistory` | adds `represents` edge, closes prior tenure |
| Voting session opened / closed | `voting_sessions` lifecycle | gates `eligible_to_vote_in` and `casts` |
| Delegation declared | `voter_eligibility.canDelegate / delegatedTo` set | adds `delegates_to` edge |
| Vote cast | `votes` insert (with `voterHash`, `auditHash`) | adds anonymized `casts` edge |
| Motion carried / defeated / tabled / withdrawn | committee meeting outcome | closes motion node with terminal status |
| Negotiation session held (opening / caucus / conciliation / closing / ratification) | `negotiationSessionTypeEnum` | timeline event on negotiation node |
| Proposal exchanged | `proposalTypeEnum` | edge between party and CBA-in-progress |
| CBA ratified | `negotiations.resultingCbaId` set | creates `supersedes` edge to expiring CBA |
| Reserved Matter raised | `reserved_matter_votes` insert | opens decision under Class B scope |
| Class B veto exercised | `reserved_matter_votes.finalDecision = 'vetoed_class_b'` | terminal `vetoes` edge from UMRC |
| Golden Share sunset progressed | `golden_shares.consecutiveComplianceYears` increment | counter advance, possible status flip to `converted` |
| Representation protocol amended | new version row in `org_configurations` | versioned `governed_by` edge update |

## 4. Cross-cutting properties every IGG node/edge already wants

These are present in the platform packages and should not be re-invented in `apps/union-eyes`:

- **Tenant scope** — `EntityNode.tenantId` (already enforced).
- **Canonical name** — `EntityNode.canonicalName` (already present).
- **Status / lifecycle** — already enforced per subsystem (`active / suspended / expired / pending`, `scheduled / active / impasse / ratified`, `active / sunset_triggered / converted / dormant`).
- **Temporal validity** — `roleTenureHistory`, `congress_memberships`, `voting_sessions`, `negotiations`, `golden_shares.consecutiveComplianceYears`.
- **Evidence & policy refs** — `DecisionNode.policyRefs / evidenceRefs / knowledgeRefs`.
- **Reasoning & confidence** — `DecisionNode.reasoning`, `DecisionNode.confidence`.

## 5. What is *not* an ontology kind (and should not become one)

To keep the IGG from drifting into a kitchen-sink "everything is a node" model, the audit excludes the following from the institutional ontology, even though they exist in the schema:

- Payment plumbing (`stripeConnectAccounts`, `paymentClassificationPolicy`, `paymentRoutingRules`, `separatedPaymentTransactions`, `whiplashViolations`, `strikeFundPaymentAudit`, `accountBalanceReconciliation`, `whiplashPreventionAudit`) — these are financial controls, not institutional bodies or constitutional acts. They may *reference* IGG nodes (e.g. a strike-fund payment is `triggered_by` a strike-authorization vote), but they are not themselves nodes in the governance graph.
- External benchmark data (`wageBenchmarks`, `unionDensity`, `costOfLivingData`, `contributionRates`, `externalDataSyncLog`) — analytic inputs, not governance acts.
- Identity remapping (`userUuidMapping`) — infrastructure.
- Social-media / signature-workflow / report schemas — surface-area subsystems.

These remain valuable, but they live *next to* the IGG, not *inside* it.

## 6. One-line summary of the ontology

> **Bodies** (org tree + UMRC) are connected by **affiliations and representations**, exercise authority through **votes, motions, negotiations, and Reserved Matters**, and produce **decisions** that carry **evidence, policy, and reasoning** — all on a tenant-scoped substrate that already exists.
