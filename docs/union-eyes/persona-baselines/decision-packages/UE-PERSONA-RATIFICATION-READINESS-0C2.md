# Persona Canonical Ratification Readiness — Gate 0C.2

**Status: all three baselines are PROPOSED_FOR_RATIFICATION.** Gate 0C.2 prepares decision packages. It ratifies none, adopts no institutional decision and issues no mandate.

| Persona | Package | Version | Requirements | Decision record | State | Package sha256 |
| --- | --- | --- | --- | --- | --- | --- |
| Steward | `UE-STEWARD-PROPOSED-CANONICAL-R1` | 1.0-R1 | 55 | `PDR-0C2-STEWARD-V1` | `PROPOSED_FOR_RATIFICATION` | `a01076343d199a98554756e577edabb8150fec6353baddab749d6efe00fa9cea` |
| Representative 2.2 | `UE-REPRESENTATIVE-PROPOSED-CANONICAL-2.2-R1` | 2.2-R1 | 67 | `PDR-0C2-REPRESENTATIVE-V1` | `PROPOSED_FOR_RATIFICATION` | `e4dcbf3635b8807c9e923f2f12b5a1dc9b53196fadf864664393ff19f3af6861` |
| Financial Officer 2.1 | `UE-FINANCIAL-OFFICER-PROPOSED-CANONICAL-2.1-R1` | 2.1-R1 | 55 | `PDR-0C2-FINANCIAL-OFFICER-V1` | `PROPOSED_FOR_RATIFICATION` | `5ec3e9a10eb6c4458f467f5b8e659d746f6631924664d9f7ca062c6e435c3889` |

## Steward structural recommendation (recommendation only)

Recommended: `OPT-C-SCOPED-PROFILE`. Not selected. Not ratified. Decision `DEC-PD-01` belongs to the AUTHORIZED_PRODUCT_OWNER.

Every one of the 55 steward contracts names a Representative 2.2 counterpart, the recovered evidence places the steward at level 1 of the Representative 2.2 policy layer, and the proposed identity model already states that the workspace is a presentation choice that implies no office. The profile keeps what is useful about a distinct Steward experience and removes the duplicate authority statements.

### OPT-A-DISTINCT-PERSONA: Distinct persona with an independent action universe

Steward has its own canonical, its own identifiers, its own workspace and its own authority statements, ratified separately from Representative 2.2.

- workflows: Two parallel workflow definitions for the same case, assignment, evidence and correspondence steps. A change to a shared step must be made twice.
- navigation: Seven steward destinations that duplicate seven representative destinations with narrower content.
- authority: Risk that a second authority statement implies a second source of authority. Every steward action would still need to defer to the Representative 2.2 mandate.
- continuity: A case moving between a steward and a representative changes persona definitions mid-flight and needs an explicit bridge.
- delegatedAccess: Two delegation vocabularies to keep aligned.
- testing: Duplicate acceptance suites and negative suites. Most steward tests restate representative tests.
- Trade-off: Clear product identity for a front-line user.
- Trade-off: Highest chance of drift and duplicate ownership.
- Trade-off: Implies, to a reader, a distinct office that no source names.

### OPT-B-LEVEL-WITHIN-REPRESENTATIVE: Scoped level within Representative 2.2 only

Steward is the level-1 capacity of Representative 2.2. No separate canonical, no separate workspace and no separate identifiers.

- workflows: One workflow definition. Level 1 differences are filters.
- navigation: One navigation set, narrowed by capability.
- authority: One authority statement. The steward limit is expressed as what a level-1 capacity lacks.
- continuity: No persona change when a case moves between levels.
- delegatedAccess: One delegation vocabulary.
- testing: One acceptance suite with a level-1 profile. The steward-specific denials need a place to live.
- Trade-off: Least duplication and no implied office.
- Trade-off: The front-line experience (queue, narrowed destinations, denials) has no named home.
- Trade-off: Throws away the 55 steward contracts as a separate review unit and removes the only place that states the steward denials.

### OPT-C-SCOPED-PROFILE: Scoped profile of Representative 2.2 with its own presentation profile and acceptance profile

Representative 2.2 is the single authority universe. Steward is a named profile of it: a workspace, a queue and a set of narrowing and denial contracts. Every steward contract names the Representative 2.2 parent it narrows and adds no power. The profile has its own acceptance and negative-test profile.

- workflows: One workflow definition owned by Representative 2.2. The steward profile lists only the steps a steward takes and the steps a steward is denied.
- navigation: Navigation is one capability-conditional set. The steward workspace is a presentation filter of it.
- authority: Authority has one source. A steward contract can only restate or narrow a parent. A contract that adds a power is invalid.
- continuity: A case moving between a steward and a supervising representative keeps one definition. The handoff is a normal Representative 2.2 handoff.
- delegatedAccess: One delegation vocabulary, with the steward limits stated once in the profile.
- testing: Shared acceptance suite plus a steward profile suite that proves the narrowing and the denials. Tenant and relationship tests run once for both.
- Trade-off: Keeps the front-line experience reviewable and the denials explicit.
- Trade-off: Needs the shared-obligation mapping to stay accurate. The product owner must accept that Steward is not a separate institutional office.
- Trade-off: The Steward package becomes dependent on the Representative 2.2 package, so the order of decision matters (DEC-PD-0C2-10).

## Preservation

182 historical identifiers are preserved (financial-officer 38, governance-officer 30, member 10, officer-executive 26, representative 56, senior-representative 22). The three proposed baseline artifacts are unchanged.

## Shared obligations

- `SHR-0C2-CASE-ASSIGNMENT` Case assignment and self-assignment: owner representative (REP-ACT-04), 5 members.
- `SHR-0C2-EVIDENCE-DOCUMENTS` Case documents, evidence and sealed export: owner representative (R13), 10 members.
- `SHR-0C2-CORRESPONDENCE` Formal correspondence drafting and approval: owner representative (R12), 6 members.
- `SHR-0C2-MEMBER-DIRECTORY` Member directory and relationship-scoped lookup: owner representative (R09), 5 members.
- `SHR-0C2-DEADLINES` Tasks, deadlines and reminders: owner representative (R14), 6 members.
- `SHR-0C2-ESCALATION` Escalation to a formal grievance and senior review: owner representative (R06), 5 members.
- `SHR-0C2-WORKAID-REFERRAL` WorkAid referral with the member consent: owner representative (R18), 4 members.
- `SHR-0C2-LANGUAGE-ACCESSIBILITY` English and French copy, mobile use and accessibility: owner representative (R24), 4 members.
- `SHR-0C2-NAVIGATION` Capability-conditional navigation: owner representative (REP-NAV-7), 14 members.

## New product decisions raised by Gate 0C.2

- `DEC-PD-0C2-01` (steward) Steward access when a relationship or the platform role ends
- `DEC-PD-0C2-02` (steward) Steward scope across federations, locals and territories
- `DEC-PD-0C2-03` (steward) Steward absence cover and substitution
- `DEC-PD-0C2-04` (representative) Representative scope across federations and affiliated organizations
- `DEC-PD-0C2-05` (representative) Explicit denial of financial authority for the representative
- `DEC-PD-0C2-06` (representative) Former representative access and mandate termination
- `DEC-PD-0C2-07` (financial-officer) Finance scope across affiliates and multiple organizations
- `DEC-PD-0C2-08` (financial-officer) Absent mandate holder without delegation
- `DEC-PD-0C2-09` (financial-officer) Financial notifications and workflow transitions
- `DEC-PD-0C2-10` (all) Order of product acceptance and the Steward structure

