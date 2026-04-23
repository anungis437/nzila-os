# Union Eyes — ICP Definition

## What Is the Union Eyes ICP?

The ideal Union Eyes customer is a **Canadian union or federation** that experiences:
1. High grievance volume relative to administrative capacity
2. Manual, paper-based, or spreadsheet-driven case management
3. Regulatory or contractual pressure for accurate record-keeping
4. A leadership team open to technology adoption

The ICP is expressed as a **scored model** (`packages/platform-growth-os/src/icp/icp-scoring.ts`), not a persona document. Every prospect gets a computed score and tier.

---

## Scoring Dimensions

The `scoreIcp(attrs: OrganisationAttributes)` function computes a weighted total across 6 dimensions.

### 1. Sector Fit — Weight: 30%

Sector determines inherent governance complexity and grievance rate.

| Sector | Score | Rationale |
|---|---|---|
| municipal | 1.0 | Largest case volume, multi-union structures |
| healthcare | 0.9 | High turnover, discipline heavy, privacy-sensitive |
| federal | 0.85 | Regulatory complexity, PSLRA compliance |
| provincial | 0.8 | Multi-unit, arbitration-heavy |
| education | 0.75 | Term contracts, seniority disputes |
| transit | 0.75 | Safety incidents, scheduling grievances |
| utilities | 0.7 | Long-tenured, seniority-driven |
| legal_professional | 0.7 | Small, high-value, data-sensitive |
| trades | 0.6 | Project-based, jurisdictional disputes |
| hospitality | 0.5 | High turnover, low admin capacity |
| other | 0.3 | Default — score once sector is confirmed |

### 2. Member Scale — Weight: 20%

Larger locals produce proportionally more grievances and have budget for tooling.

| Range | Score |
|---|---|
| ≥ 2,000 members | 1.0 |
| ≥ 500 members | 0.8 |
| ≥ 200 members | 0.55 |
| ≥ 50 members | 0.3 |
| < 50 members | 0.1 |

### 3. Governance Complexity — Weight: 20%

A 0.0–1.0 float set by the sales rep based on observed signals:
multi-union bargaining, active arbitrations, contested elections, multiple CBA units.

High complexity (> 0.6) = higher pain = higher urgency.

### 4. Tech Modernisation Need — Weight: 15%

Based on `techMaturityProxy` signal:

| Signal | Score |
|---|---|
| spreadsheet_only | 1.0 — No digital records → maximum pain |
| paper_only | 1.0 |
| legacy_system | 0.7 — Old ERP/HRIS → switching window |
| modern_crm | 0.3 — Already has tooling → harder sell |
| unknown | 0.5 — Assume average until confirmed |

### 5. Warm Path — Weight: 10%

Bonus for inbound signals that reduce cold outreach friction:

| Signal | Bonus |
|---|---|
| CLC affiliate relationship | +0.3 |
| Partner referral | +0.3 |
| Conference introduction | +0.2 |
| Inbound / website lead | +0.1 |
| None | 0 |

Note: capped at 1.0.

### 6. Contract Expiry Soon — Weight: 5%

| Signal | Score |
|---|---|
| Expiry ≤ 3 months | 1.0 |
| Expiry ≤ 12 months | 0.6 |
| No expiry known | 0.3 |
| > 12 months | 0.1 |

---

## Tier Definitions

| Tier | Total Score | Meaning |
|---|---|---|
| A | ≥ 0.70 | High probability, assign immediately. Active outreach priority. |
| B | ≥ 0.40 | Good fit, may need 2–3 additional data points to qualify. Sequence eligible. |
| C | < 0.40 | Weak signal. Enrich before outreach. Conference / event leads only. |

---

## Minimum Data for Scoring

Before scoring, at least one of the following must be known:
- `sector` (any non-other)
- `memberCount` (non-null, non-zero)
- `governanceComplexity` (> 0)

Use `hasMinDataForScoring(attrs)` to gate before calling `scoreIcp`.

---

## ICP Segments (Bootstrap)

Six canonical segments bootstrapped on first startup (`bootstrapIcpSegments`):

| Name | Tier | Criteria |
|---|---|---|
| Large Municipal | A | ≥ 500 members, complexity ≥ 0.6 |
| Healthcare | A | ≥ 300 members, complexity ≥ 0.55 |
| Federal/Provincial | A | ≥ 200 members, complexity ≥ 0.6 |
| Education | B | ≥ 150 members, complexity ≥ 0.4 |
| Transit/Utilities | B | ≥ 200 members, complexity ≥ 0.45 |
| Small Local | C | 0–499 members, any complexity |

---

## How to Enrich a Target

When new information arrives (sales call, LinkedIn, event):

```typescript
import { icp } from '@nzila/platform-growth-os'

await icp.enrichTargetOrg(orgId, {
  sector: 'healthcare',
  memberCount: 650,
  governanceComplexity: 0.7,
  techMaturityProxy: 'spreadsheet_only',
})
// → re-scores automatically, returns updated IcpScore
```

Every change to `OrganisationAttributes` triggers a re-score. Score history is not retained in Phase 1.
