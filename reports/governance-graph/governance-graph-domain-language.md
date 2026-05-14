# Governance Graph — Domain Language (Phase 1)

> A canonical lexicon for the institutional governance graph. The vocabulary here is institutional and constitutional, not technical. It is what the IGG should *call things* before any code is written to project them.

This deliverable is intentionally narrow: it fixes names. Once names are fixed, the projection layer in Phase 2, the ontology registry in `@nzila/platform-ontology`, the locale labels in the vocabulary packages, and the consumer surfaces in CLC and union intelligence can all use the same words for the same things.

Every term below is grounded in something already present in the repo. Source files are linked.

---

## 1. Entities (the things the institution is *made of*)

### 1.1 Organizational bodies

| Term | Meaning | Source |
|---|---|---|
| **Platform** | The Nzila operating tenant. Peer to unions in the org table today; treated as an environment in the IGG. | [db/schema-organizations.ts](../../apps/union-eyes/db/schema-organizations.ts) |
| **Congress** | A national labour congress (e.g. CLC). Houses federations and affiliated unions. | `organizationTypeEnum.congress` |
| **Federation** | A federation of unions, typically provincial or sectoral. | `organizationTypeEnum.federation` |
| **Union** | A national or pan-jurisdictional union. The principal institutional actor. | `organizationTypeEnum.union` |
| **Local** | A local of a union, scoped to a geography or workplace cluster. | `organizationTypeEnum.local` |
| **Region** | A regional sub-division of a union or local. | `organizationTypeEnum.region` |
| **District** | A district sub-division. | `organizationTypeEnum.district` |

### 1.2 Workplace structure

| Term | Meaning | Source |
|---|---|---|
| **Employer** | An entity that employs members. | [db/schema/union-structure-schema.ts](../../apps/union-eyes/db/schema/union-structure-schema.ts) |
| **Worksite** | A physical or organizational site of an employer. | same |
| **Bargaining Unit** | The certified group of employees the union bargains for. | same |
| **Committee** | A standing or ad-hoc committee within a body. | same |

### 1.3 Persons and roles

| Term | Meaning | Source |
|---|---|---|
| **Member** | A union member. | implied across `voter_eligibility`, `committee_memberships` |
| **Steward** | Workplace-level representative. Default representational role in `PROTOCOL_STEWARD_LED`. | [lib/representation/protocol-types.ts](../../apps/union-eyes/lib/representation/protocol-types.ts) |
| **LRO** | Labour Relations Officer. Default representational role in `PROTOCOL_LRO_LED` (e.g. CAPE). | same |
| **National Rep** | National representative; often paired with locals. | same |
| **Officer** | Elected officer of a body. | same |
| **Negotiator** | A member of a negotiating team. | [db/schema/bargaining-negotiations-schema.ts](../../apps/union-eyes/db/schema/bargaining-negotiations-schema.ts) |
| **UMRC** | Union Mission Representative Council. Holder of the Class B Special Voting Share. | [db/schema/governance-schema.ts](../../apps/union-eyes/db/schema/governance-schema.ts) |

### 1.4 Constitutional and financial instruments

| Term | Meaning | Source |
|---|---|---|
| **Class B Special Voting Share** | Mission-protection instrument. 51% on Reserved Matters, 1% otherwise. Held by UMRC. Sunsets at 5 years. | `governance-schema.ts → goldenShares` |
| **Reserved Matter** | A category of decision the Class B Share has authority over: `mission_change`, `sale_control`, `data_governance`, `major_contract`. | `governance-schema.ts → reservedMatterVotes.matterType` |
| **Bylaw** | A constitutional rule of a body. Amendable by `bylaw_amendment` voting session. | [db/schema/voting-schema.ts](../../apps/union-eyes/db/schema/voting-schema.ts) |
| **CBA** | Collective Bargaining Agreement. Has expiry, has lineage (one CBA supersedes another). | [db/schema/bargaining-negotiations-schema.ts](../../apps/union-eyes/db/schema/bargaining-negotiations-schema.ts) |
| **Motion** | A parliamentary act inside a meeting. Outcomes: `carried`, `defeated`, `tabled`, `withdrawn`. | [db/schema/committee-workspace-schema.ts](../../apps/union-eyes/db/schema/committee-workspace-schema.ts) |
| **Proposal** | A bargaining position exchanged between parties during negotiations. | `bargaining-negotiations-schema.ts` |

### 1.5 Decision and evidence artifacts

| Term | Meaning | Source |
|---|---|---|
| **Decision** | A recorded institutional act with policy refs, evidence refs, knowledge refs, reasoning, and confidence. | `@nzila/platform-decision-graph → DecisionNode` |
| **Decision Trail** | An ordered chain of decisions linked by typed edges. | `@nzila/platform-decision-graph → DecisionTrail` |
| **Evidence** | A persisted artifact a decision rests on. | `@nzila/evidence` |
| **Audit Entry** | A tamper-evident log entry. | `@nzila/audit` |

---

## 2. Relationships (how the things connect)

These are the edge kinds the IGG should canonicalize. Each maps to either an existing FK or an existing JSON/lifecycle column.

| Edge kind | Meaning | Where it lives today |
|---|---|---|
| `parent_of` | Org tree containment. | `organizations.parentId` |
| `affiliated_with` | Union/local affiliated with a congress or federation. | `congress_memberships` |
| `represents` | A role represents a member, unit, or local. Materialization is *protocol-driven* (steward-led vs LRO-led). | `stewardAssignments`, `roleTenureHistory`, `RepresentationProtocol` |
| `member_of` | Person belongs to a body, committee, or unit. | `committeeMemberships`, FK joins |
| `bargains_for` | A bargaining unit is bargained for by a union/local. | `bargainingUnits` |
| `negotiates` | A negotiation team negotiates an agreement on behalf of a bargaining unit. | `negotiations` |
| `supersedes` | A new CBA/bylaw/motion replaces a previous one. | `negotiations.expiringCbaId → resultingCbaId` |
| `eligible_to_vote_in` | A member is eligible to vote in a session. | `voter_eligibility` |
| `delegates_to` | A member delegates their vote to another member. **Today latent in `canDelegate`/`delegatedTo`/`votingWeight`.** | `voter_eligibility` |
| `casts` | A vote is cast in a session by an eligible voter. | `votes` |
| `holds` | A holder holds an instrument (e.g. UMRC holds the Class B Share). | `goldenShares` |
| `vetoes` | A Class B vote vetoes a Reserved Matter. | `reservedMatterVotes.finalDecision = vetoed_class_b` |
| `approves` | A vote approves a matter. | various |
| `tenured_as` | A person held a role for a tenure window. | `roleTenureHistory` |
| `governed_by` | A body or instrument is governed by a bylaw, protocol, or doctrine. | `org_configurations`, `RepresentationProtocol` |
| `depends_on`, `overrides`, `escalated_to`, `triggered_by`, `informed_by` | Decision-graph edges between decisions. | `@nzila/platform-decision-graph → DecisionEdge` |

---

## 3. Acts and events (what the institution *does*)

Events are first-class. They are how the graph evolves over time.

| Event | Trigger | Resulting graph mutation |
|---|---|---|
| **Affiliation transition** | `congress_memberships.status` changes (`active` ⇄ `suspended` ⇄ `expired` ⇄ `pending`). | `affiliated_with` edge status updated. |
| **Steward assignment** | New `stewardAssignments` row. | New temporal `represents` edge. |
| **Role tenure event** | New `roleTenureHistory` row. | `tenured_as` edge with start/end. |
| **Voting session opened / closed** | `voting_sessions` lifecycle. | Voting-session node lifecycle. |
| **Eligibility set** | `voter_eligibility` rows materialized for a session. | Bulk `eligible_to_vote_in` edges. |
| **Delegation** | `voter_eligibility.delegatedTo` set. | `delegates_to` edge. Transitive closure must be computed at projection time. |
| **Vote cast** | `votes` row inserted. | `casts` edge with anonymized voter hash. |
| **Motion outcome** | `committeeMotions.outcome` set (`carried`/`defeated`/`tabled`/`withdrawn`). | Terminal `DecisionNode` for the motion. |
| **Negotiation session** | `negotiationSessions` row. | Negotiation-session node; `informed_by` edges to proposals. |
| **Proposal exchanged** | `proposals` row. | Proposal node; `informed_by` edge to session. |
| **CBA ratified** | `negotiations` resolves to `resultingCbaId`. | New CBA node + `supersedes` edge to prior CBA + `DecisionNode` for ratification. |
| **Reserved Matter raised** | `reservedMatterVotes` row created. | Reserved-Matter decision node opened. |
| **Class B veto** | `reservedMatterVotes.finalDecision = vetoed_class_b`. | Terminal `DecisionNode` + `vetoes` edge. |
| **Golden Share sunset progression** | `goldenShares.status` transitions toward `sunset_triggered`/`converted`/`dormant`. | Lifecycle update on the golden-share node. |
| **Protocol amendment** | New `RepresentationProtocol` version stored in `org_configurations`. | `governed_by` edge points at new version. |

---

## 4. Chronology (how time is treated)

Time is a first-class concern in this institution. The IGG must respect at least three temporal dimensions:

| Dimension | Examples | Notes |
|---|---|---|
| **Term** | An officer's elected term; a steward's assignment window; a CBA validity window. | Stored in `roleTenureHistory`, `stewardAssignments`, CBA fields. |
| **Lifecycle status** | `active`, `suspended`, `expired`, `pending`, `dormant`, `sunset_triggered`, `converted`. | Different enums today; the IGG should expose a *uniform* lifecycle vocabulary in the projection. |
| **Sunset** | The Class B Share sunsets at 5 years. CBAs expire. Some affiliations expire. | Sunset is **not** the same as deletion. The node persists; its status changes. |

> **Naming rule:** Prefer **status transitions** ("became suspended", "sunset triggered", "ratified", "vetoed") over destructive verbs ("deleted", "removed"). Institutional history must remain visible.

---

## 5. Procedural vocabulary (parliamentary)

| Term | Meaning | Source |
|---|---|---|
| **Quorum** | The minimum attendance for a meeting's acts to be valid. | `committeeMeetings.quorumMet` |
| **Motion** | A proposed act inside a meeting. | `committeeMotions` |
| **Carried / Defeated / Tabled / Withdrawn** | The four canonical motion outcomes. | `committeeMotions.outcome` |
| **Caucus** | A closed session within a negotiation. | `negotiationSessionTypeEnum` |
| **Conciliation** | A specific session type within a negotiation. | same |
| **Ratification** | A specific voting-session type that approves a CBA. | `votingSessions.sessionType` |
| **Strike Authorization** | A specific voting-session type. | same |

---

## 6. Constitutional vocabulary (mission-protection)

| Term | Meaning |
|---|---|
| **Reserved Matter** | A category of decision over which the Class B Share has elevated voting power (51%). The four current matters: `mission_change`, `sale_control`, `data_governance`, `major_contract`. |
| **Class B Special Voting Share** | The constitutional instrument. Mission-protective. |
| **UMRC** (Union Mission Representative Council) | The body that holds the Class B Share. |
| **Veto** | The authoritative refusal of a Reserved Matter by the Class B Share. Recorded as `finalDecision = vetoed_class_b`. |
| **Sunset** | The 5-year horizon at which the Class B Share's authority transitions; the share is not deleted, its status changes. |
| **Reserved Matter Vote** | The recorded vote on a Reserved Matter; the canonical artifact of constitutional decision-making. |

---

## 7. What this lexicon deliberately avoids

To keep the language institutional, the IGG should not adopt:

- Graph-theory jargon (`vertex`, `edge label`, `DAG`, `multi-edge`, `hypergraph`).
- Database jargon (`row`, `FK`, `enum value`, `pgEnum`) in user-facing surfaces.
- Speculative future terms not grounded in the repo today.
- Synonyms invented for variety. One concept, one name. (`vote` is a *vote*; not also a *ballot*, *poll*, or *tally*, unless those terms refer to distinct things.)

---

## 8. One-line summary

> **The institution already has a vocabulary. The IGG's job is to use it correctly and consistently — affiliation, delegation, ratification, motion, veto, sunset, tenure — and to stop reinventing names for things the constitution and the bylaws have already named.**

---

## 9. Cross-references

- Ontology surfaces: [governance-graph-ontology-map.md](governance-graph-ontology-map.md)
- Containment risks if these names diverge: [governance-graph-collision-risks.md](governance-graph-collision-risks.md)
- Where these names get registered: [governance-graph-recommended-boundaries.md](governance-graph-recommended-boundaries.md)
- Readiness against this lexicon: [governance-graph-phase2-readiness.md](governance-graph-phase2-readiness.md)
