# Outbound Pipeline Engine — Architecture

## Overview

The Union Eyes outbound pipeline is a structured revenue system built into the Nzila OS monorepo.
It connects ICP targeting → outreach sequences → CRM deal tracking → pilot conversion → land-and-expand.

This is not a marketing automation tool. It is a sales execution system grounded in real deal data.

---

## Six Components

### 1. ICP List Builder (`packages/platform-growth-os/src/icp/`)

**Purpose:** Score and rank Canadian union prospects against an explainable 6-dimension model.

**Dimensions and weights:**

| Dimension | Weight | Rationale |
|---|---|---|
| Sector fit | 30% | Municipal/healthcare/federal score highest — most grievance complexity |
| Member scale | 20% | ≥500 members = Tier A threshold |
| Governance complexity | 20% | Multi-union, exec disputes, arbitration history |
| Tech modernisation need | 15% | Low-tech organisations have highest pain and lowest switching cost |
| Warm path | 10% | CLC affiliate or partner referral boosts score |
| Contract expiry soon | 5% | ≤12 months to expiry increases urgency |

**Tier thresholds:** A ≥ 0.70 · B ≥ 0.40 · C < 0.40

**Storage:** File-backed via `platform-growth-os` store. Entity: `icp-target-org`, `icp-segment`.

---

### 2. Union Target Map (`packages/platform-growth-os/src/union-map/`)

**Purpose:** Canadian union landscape graph. Powers land-and-expand logic.

**Seed data:** 14 canonical union nodes (CLC, CUPE National, 4 CUPE locals, CAPE-ACEP, PSAC, ONA, OPSEU, Teamsters 938, ATU 113, Unifor, UFCW). Cross-referenced to deal-engine seed data via `dealEngineId`.

**Expansion relationships:** Typed adjacency edges (same_parent, same_sector, cupe_council, clc_affiliate, warm_connection, conference_cohort). Each edge has an `adjacencyScore` 0.0–1.0.

**API:** `getExpansionTargets(convertedNodeId, topN)` returns adjacent non-pipeline nodes ranked by adjacency score.

---

### 3. Outreach Sequences (`packages/platform-growth-os/src/sequences/`)

**Purpose:** 6 canonical UE outreach sequences. Each sequence is a structured cadence of steps (email, LinkedIn, phone) with delay, personalisation fields, and stop conditions.

**Sequences:**

| Name | Kind | Touches | Trigger Stage | Benchmark Reply Rate |
|---|---|---|---|---|
| Cold Outbound | cold | 4 / 14 days | lead | 8% |
| Warm Introduction | warm_intro | 3 / 10 days | lead | 28% |
| Post-Conference | post_event | 4 / 6 days | lead | 22% |
| Demo Follow-Up Day 0→10 | demo_followup | 5 / 10 days | demo_completed | 45% |
| Procurement Track | procurement | 2 steps | pilot_proposed | — |
| Re-Engagement | re_engagement | 2 / 7 days | dormant | 6% |

**Demo Follow-Up** directly implements `docs/commercial/close-package/ENTERPRISE_CLOSE_SEQUENCE.md`.

---

### 4. Conference/Event Playbook (`packages/platform-growth-os/src/events/`)

**Purpose:** Structured lead capture at CUPE Congress, CLC conventions, HRPA, and sector summits.

**Flow:** `ConferenceEvent` created → leads captured via `captureEventLead()` → qualified → enrolled into Post-Conference Sequence → resolve to `TargetOrganisation` via `resolvedTargetOrgId` → deal created in deal-engine.

**Playbook phases:** pre_event → at_event → day0 → day2 → day5 → day10 → post_event. Phase computed in real-time from event start date.

**Metrics tracked per event:** leads captured, demos booked, pilots proposed, pilots signed.

---

### 5. GrowthOS Integration (`packages/platform-growth-os/src/index.ts`)

All four modules are exported via the GrowthOS barrel:

```typescript
import { icp, unionMap, sequences, events } from '@nzila/platform-growth-os'
```

Modules follow the Phase-1 file-backed pattern. Data is stored in `ops/growth-{entity}/` via `writeRecord/readRecord/listRecords`.

---

### 6. Pilot Funnel Dashboard (`apps/console/app/(dashboard)/ue-pipeline/page.tsx`)

**Purpose:** Real-time operator view of the full UE pipeline.

**Data sources:**

- `@nzila/deal-engine` seed data (union-eyes product filter)
- `@nzila/platform-growth-os` icp, unionMap, sequences modules

**Sections (all null-hidden):**

1. Top-of-funnel: ICP targets, active sequences, contact rate
2. Mid-funnel: demos scheduled/completed, proposals sent
3. Bottom-of-funnel: active pilots, conversions, dormant
4. Pipeline value (CAD)
5. Deal stage breakdown table
6. Land-and-expand targets (only if converted deals exist)
7. Union landscape stats

---

## Data Flow

```
Conference/LinkedIn/Partner referral
        ↓
   Event Lead captured
        ↓
   ICP Score computed (scoreIcp)
        ↓
   TargetOrganisation created
        ↓
   Sequence enrolled (enrollInSequence)
        ↓
   Reply → demo booked → deal created in deal-engine
        ↓
   Deal tracks through 13-stage FSM:
   lead → qualified → demo_scheduled → demo_completed
     → pilot_proposed → pilot_active → data_received
     → ingestion_running → pilot_review → converted
        ↓
   Converted → getExpansionTargets → enroll adjacent locals
```

---

## Non-Negotiables

- All pipeline stages use `@nzila/deal-engine` canonical 13-stage FSM — no local enum
- ICP scoring is fully explainable — no ML black boxes, every contribution has a rationale
- No duplicate CRM — deal-engine is the canonical deal record
- No fake data — `websiteUrl` in union-map only set for confirmed public URLs
- Turbopack rule: all package imports are extensionless
- All modules are idempotent (bootstrap functions safe to call on every cold start)
