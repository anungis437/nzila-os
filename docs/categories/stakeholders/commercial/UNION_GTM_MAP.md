# Union Eyes — Canadian Union GTM Map

## Purpose

This document describes the Canadian union landscape data seeded into `@nzila/platform-growth-os/src/union-map/` and how it drives the land-and-expand GTM strategy.

---

## Seeded Union Nodes (14)

| ID | Name | Scope | Sector | Province | Members | In Pipeline | Deal Engine ID |
|---|---|---|---|---|---|---|---|
| seed-clc | Canadian Labour Congress | national | multiple | — | 3,000,000 | No | — |
| seed-cupe-national | CUPE National | national | multiple | — | 715,000 | No | — |
| seed-cupe-416 | CUPE Local 416 | local | municipal | ON | 6,000 | No | — |
| seed-cupe-79 | CUPE Local 79 | local | municipal | ON | 20,000 | No | — |
| seed-cupe-4400 | CUPE Local 4400 | local | education | ON | 12,000 | No | — |
| seed-cupe-3902 | CUPE Local 3902 | local | education | ON | 8,000 | No | — |
| seed-cape | CAPE-ACEP | national | federal | — | 22,000 | **Yes** | deal-002 |
| seed-psac | PSAC | national | federal | — | 230,000 | No | — |
| seed-ona | ONA | provincial | healthcare | ON | 68,000 | No | — |
| seed-opseu | OPSEU | provincial | multiple | ON | 180,000 | No | — |
| seed-teamsters-938 | Teamsters Local 938 | local | trades | BC | 3,500 | **Yes** | deal-003 |
| seed-atu-113 | ATU Local 113 | local | transit | ON | 12,000 | No | — |
| seed-unifor | Unifor | national | multiple | — | 315,000 | No | — |
| seed-ufcw | UFCW Canada | national | hospitality | — | 250,000 | No | — |

*Members are approximate as of public sources. Updated only when confirmed.*

---

## Expansion Relationships (5 Seeded)

| Source | Target | Type | Adjacency Score | Rationale |
|---|---|---|---|---|
| CUPE Local 416 | CUPE Local 79 | same_parent | 0.90 | Sibling locals under CUPE National. Toronto municipal. |
| CUPE Local 416 | CUPE Local 4400 | same_parent | 0.70 | CUPE sibling. Different sector (education). |
| CAPE-ACEP | PSAC | clc_affiliate | 0.65 | Both CLC affiliates in the federal sector. |
| CUPE Local 416 | ATU Local 113 | same_sector | 0.60 | Both City of Toronto municipal operations. |
| ONA | OPSEU | clc_affiliate | 0.55 | Both Ontario CLC affiliates with overlapping healthcare. |

---

## Land-and-Expand Logic

When a deal converts to `converted` in deal-engine, the pipeline automatically surfaces adjacent expansion targets:

1. Find the `UnionNode` whose `dealEngineId` matches the converted deal
2. Call `getExpansionTargets(nodeId, topN=3)`
3. Exclude nodes already `inPipeline = true`
4. Rank by `adjacencyScore` descending
5. Surface in console UE pipeline dashboard under "Land-and-Expand Targets"

The expansion surfaces same-parent siblings (e.g., after CUPE 416 converts → surface CUPE 79 and CUPE 4400) plus cross-sector affiliates.

---

## Relationship Types

| Type | Description |
|---|---|
| same_parent | Same national/provincial parent union |
| same_sector | Different parent, same sector |
| cupe_council | Members of the same CUPE regional council |
| clc_affiliate | CLC affiliates in same or adjacent sector |
| warm_connection | Personal/professional relationship with existing contact |
| conference_cohort | Met at the same conference / convention |

---

## Adding New Nodes

```typescript
import { unionMap } from '@nzila/platform-growth-os'

await unionMap.createUnionNode({
  scope: { tenantId: 'nzila-os', orgId: 'platform', product: 'union-eyes' },
  name: 'CUPE Local 1000',
  scope_type: 'local',
  sector: 'municipal',
  province: 'ON',
  memberCount: 800,
  parentId: 'seed-cupe-national',
  inPipeline: false,
  websiteUrl: null, // only set if confirmed
})
```

**websiteUrl rule:** Only set to a confirmed public URL. Do not fabricate or guess URLs. Set to `null` until verified.

---

## Adding Expansion Relationships

```typescript
await unionMap.createExpansion({
  scope: { tenantId: 'nzila-os', orgId: 'platform', product: 'union-eyes' },
  sourceId: 'seed-cupe-416',
  targetId: 'new-node-id',
  relationType: 'same_parent',
  adjacencyScore: 0.85,
  notes: 'Same regional council, same bargaining unit structure',
})
```

---

## Priority Order (GTM)

1. **CUPE National network** — largest pool of locals, warm path via CUPE 416 relationship
2. **Federal sector** — PSAC, CAPE-ACEP already in pipeline; Treasury Board cycle drives urgency
3. **Ontario healthcare** — ONA (68k members), OPSEU healthcare units
4. **Municipal** — CUPE 79 (20k members, Toronto), ATU 113 (transit)
5. **National federations** — Unifor, UFCW for scale, but longer sales cycles
