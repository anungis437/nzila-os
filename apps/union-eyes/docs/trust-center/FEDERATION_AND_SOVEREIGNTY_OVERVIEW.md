# UnionEyes — Federation and Sovereignty Overview

> **Audience:** Multi-tier union buyers, federation officers, procurement reviewers.
> **Scope:** Public-safe summary of UnionEyes federation governance architecture and
> institutional sovereignty modeling.
> **Caveats:** Claims use language such as "is designed to," "supports," and "provides evidence of."

---

## 1. Federation Architecture Philosophy

UnionEyes is designed to support labour organisations that operate across multiple
governance tiers. The federation sovereignty layer models how:

- National, regional, local, affiliate, and coalition units coexist.
- Governance authority is delegated, inherited, and bounded by explicit contracts.
- Institutional autonomy is preserved while federation-wide policies are respected.

This is a **modeling and governance layer** — it does not replace existing organisational
structures or create new legal relationships.

---

## 2. Sovereignty Tiers

UnionEyes recognises five sovereignty tiers:

| Tier | Description |
|------|-------------|
| `national` | National-level federation authority |
| `regional` | Regional affiliate or district |
| `local` | Local chapter or bargaining unit |
| `affiliate` | Affiliated but partially autonomous unit |
| `coalition` | Multi-organisation coordination body |

Each tier can operate in one of four sovereignty modes:

| Mode | Description |
|------|-------------|
| `fully-autonomous` | All authorities delegated; no escalation requirements |
| `federation-aligned` | Operating within federation policy with some delegation |
| `restricted` | Limited by override restrictions; federation review required |
| `oversight-required` | Parent or national oversight mandatory for governed operations |

---

## 3. Delegated Authority

UnionEyes supports explicit delegation of the following authorities between tiers:

- `publication` — Authority to publish content to federation surfaces
- `policy-enforcement` — Authority to enforce federation policies locally
- `member-governance` — Authority over local member governance decisions
- `ai-operations` — Authority to operate AI features at full capability
- `audit-visibility` — Scope of audit data visibility
- `continuity-management` — Authority over continuity and succession planning

Delegation chains are evaluated deterministically and ledgered for governance evidence.

*Supporting evidence:*
- `lib/federation-sovereignty/delegation.ts` — delegation chain evaluation
- `lib/federation-sovereignty/inheritance.ts` — policy inheritance resolution

---

## 4. Sovereignty Conflict Resolution

When governance conflicts arise between tiers, UnionEyes:

1. **Classifies** the conflict type (policy divergence, authority override, publication
   dispute, AI autonomy conflict, audit visibility disagreement, escalation deadlock)
2. **Suggests** a resolution path (federation mediation, executive escalation, arbitration,
   local withdrawal, national override)
3. **Records** the conflict in the sovereignty ledger for audit evidence
4. **Does not auto-resolve** — human governance actors retain decision authority

*Supporting evidence:*
- `lib/federation-sovereignty/conflicts.ts` — conflict detection and classification

---

## 5. Continuity Sharing

UnionEyes supports governance-aware continuity sharing between federation tiers:

- National can observe continuity health trends without accessing private local operational details.
- Continuity jurisdiction gaps (e.g., steward turnover) are detected and classified.
- Continuity-sharing agreements are modeled through coordination contracts.

*Supporting evidence:*
- `lib/federation-sovereignty/coordination.ts` — continuity sharing model
- `lib/governance-simulation/continuity.ts` — continuity stress simulation

---

## 6. Cross-Federation Simulation

Five canonical federation simulation scenarios are built in:

1. **National policy tightening** — regional resistance, publication escalation chain
2. **Steward turnover / continuity loss** — jurisdiction gap detection
3. **AI governance federation conflict** — AI autonomy boundary divergence
4. **Coalition publication governance** — multi-party publication dispute
5. **Audit visibility escalation deadlock** — dual-national oversight conflict

These simulations run in shadow mode and produce evidence without affecting production.

*Supporting evidence:*
- `lib/federation-sovereignty/simulation.ts` — cross-federation simulation engine
- `reports/federation-sovereignty-summary.json` — generated summary report

---

## 7. Federation Governance Posture Summary

| Capability | Status |
|------------|--------|
| Five sovereignty tiers | ✅ Present |
| Four sovereignty modes | ✅ Present |
| Delegated authority chains | ✅ Present |
| Conflict detection (6 types) | ✅ Present |
| Continuity sharing model | ✅ Present |
| AI autonomy per federation tier | ✅ Present |
| Cross-federation simulation | ✅ Present (5 built-in scenarios) |
| Sovereignty replay engine | ✅ Present |
| Shadow-mode only | ✅ No production mutation |

---

*See also: [AI_GOVERNANCE_AND_HUMAN_OVERSIGHT.md](./AI_GOVERNANCE_AND_HUMAN_OVERSIGHT.md)*
