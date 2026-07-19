# Union Eyes — Founder Revenue Cockpit

> **Operating manual for the founder-led revenue motion.**
> Version 1.0 — live data drawn from `@nzila/platform-growth-os` and `@nzila/deal-engine`.
> Null state rule: unknown metric with no recorded activity shows **"Awaiting activity data"** — never zero, never estimated.

---

## 1. Dashboard Route

**URL:** `/ue-revenue-cockpit`
**File:** `apps/console/app/(dashboard)/ue-revenue-cockpit/page.tsx`
**Auth:** Entra SSO — redirects to `/sign-in` if no session.
**Render mode:** `force-dynamic` — every load fetches live data, no caching.

---

## 2. KPI Definitions

### 2A — Pipeline Health

| KPI | Definition | Data source | Null state |
|-----|-----------|-------------|-----------|
| **Total target accounts** | Count of all `TargetOrganisation` records with `status !== 'disqualified'` | `icp.listTargetOrgs()` | Awaiting activity data |
| **Top-15 active** | Count of deal records in Top 15 pursuit list with `status !== 'dormant'` | `seedDeals` filtered by `product === 'union-eyes'` | Awaiting activity data |
| **Untouched high-priority** | Tier-1 or Tier-2 ICP targets with zero associated deal records and no outreach logged | `icp.rankedTargetOrgs()` cross-referenced against `seedDeals` | Awaiting activity data |
| **Missing next step** | Active deals where `nextAction` field is null or `daysInStage > 14` with no follow-up scheduled | `seedDeals` + stage staleness logic | Awaiting activity data |

**Stage staleness threshold:** 14 days without a recorded touch = flagged as "no next step."

---

### 2B — Activity Metrics

| KPI | Definition | Data source |
|-----|-----------|-------------|
| **Emails sent** | Count of `SequenceInstance` events with `type === 'email_sent'` | `sequences.listSequenceInstances()` event log |
| **Replies received** | Count of events with `type === 'reply_received'` | Sequence event log |
| **Introductions made** | Count of events with `type === 'intro_requested'` or `'intro_completed'` | Sequence event log |
| **Calls completed** | Count of events with `type === 'call_completed'` | Sequence event log |
| **Demos delivered** | Count of deals that have ever reached `demo_completed` stage | `seedDeals` stage history |
| **Proposals sent** | Count of deals where `stage === 'pilot_proposed'` or a proposal event is logged | `seedDeals` + event log |

> **Null state for all activity metrics:** If no sequence instances exist, display "Awaiting activity data" rather than 0. A zero implies activity happened but nothing converted — misleading before outreach begins.

---

### 2C — Conversion Rates

| KPI | Formula | Interpretation |
|-----|---------|----------------|
| **Response rate** | `replies / emailsSent × 100` | Cold outreach benchmark: 8–15% is good for union sector |
| **Meeting rate** | `callsCompleted / replies × 100` | Target: ≥ 30% of replies should convert to a call |
| **Demo-to-proposal %** | `proposalsSent / demosDelivered × 100` | Target: ≥ 60% — if lower, demo script needs tightening |
| **Proposal-to-pilot %** | `pilotsActive / proposalsSent × 100` | Target: ≥ 40% — if lower, pricing or T&Cs are the blocker |
| **Average cycle days** | `mean(daysBetween(firstTouch, pilotStart))` across all converted deals | Baseline: 60–90 days for union sector |

> **Null state:** Display "—" when denominator is zero. Never divide by zero; never impute a rate.

---

### 2D — Value Metrics

| KPI | Formula | Notes |
|-----|---------|-------|
| **Weighted pipeline $** | `Σ (deal.estimatedValue × stageProbability)` across all open UE deals | See probability table below |
| **Pilots likely this quarter** | Count of deals in `pilot_proposed` or `pilot_active` stage with `conversionRisk !== 'high'` | Conservative filter |
| **Projected ARR** | `pilotsLikelyThisQuarter × avgContractValue × 4` | Annualization proxy only — not a guarantee |

#### Stage Probability Weights

| Stage | Probability |
|-------|-------------|
| `lead` | 5% |
| `qualified` | 20% |
| `demo_scheduled` | 35% |
| `demo_completed` | 50% |
| `pilot_proposed` | 65% |
| `pilot_active` | 80% |
| `ingestion_running` | 90% |
| `converted` | 100% |
| `dormant` | 0% |

#### Current Live Calculation (as of data seed)

| Deal | Account | Stage | Value | Weight | Weighted $ |
|------|---------|-------|-------|--------|-----------|
| deal-001 | CUPE Local 123 | `pilot_active` | $85,000 | 80% | $68,000 |
| deal-002 | CAPE-ACEP | `demo_completed` | $120,000 | 50% | $60,000 |
| deal-003 | Teamsters 938 | `qualified` | $65,000 | 20% | $13,000 |
| deal-004 | CLC National | `ingestion_running` | $250,000 | 90% | $225,000 |
| deal-007 | OPSEU Local 546 | `lead` | $55,000 | 5% | $2,750 |
| deal-008 | PSAC Atlantic | `dormant` | $70,000 | 0% | $0 |
| | | | **Total open** | | **$368,750** |

> **deal-002 (CAPE-ACEP, $120K) is at `demo_completed` — proposal must go out immediately. This is the single highest-conversion-probability action available today.**

---

### 2E — Focus Panel Logic

#### Next 5 Must-Contact

Ranked by combined urgency score:

1. Deals in `demo_completed` stage (proposal overdue if > 5 days since demo)
2. Deals in `pilot_proposed` with no reply in > 7 days
3. Top-15 Tier-1 targets with no deal record (completely untouched)
4. Deals with `conversionRisk === 'high'` and `stage !== 'dormant'`
5. Deals where `daysInStage > 21` (stalled — need a re-engagement touch)

#### Deals at Risk

A deal is **at risk** if it meets any of:

- `conversionRisk === 'high'` (explicit flag in seed data)
- `stage === 'dormant'`
- `daysInStage > 21` with no logged touch in that period
- No `nextAction` defined

#### Overdue Follow-Ups

Any deal where a follow-up was scheduled (via sequence event `follow_up_scheduled`) and the target date has passed without a `call_completed` or `email_sent` event.

#### Warm Intros Available

Cross-reference `TargetOrganisation.introPaths` (from ICP data) against founder's network nodes in `unionMap`. Surface the shortest-path intro that hasn't been activated yet.

---

### 2F — Execution Panel

#### Today's 3 Revenue Actions

Computed dynamically from deal stage states in priority order:

| Priority | Condition | Action |
|----------|-----------|--------|
| #1 | Any deal in `demo_completed` for > 5 days | **Send pilot proposal to [Account]** |
| #2 | Any deal in `pilot_proposed` with no reply > 7 days | **Follow up with [Contact] on proposal** |
| #3 | Any deal in `ingestion_running` | **Check ingestion health + send usage update to [Account]** |
| #4 (fallback) | Top untouched Tier-1 target | **Send first-touch email to [Account]** |
| #5 (fallback) | Top stalled deal | **Re-engagement call for [Account]** |

The page surfaces the top 3 from this ranked list.

#### Weekly Win Condition

Defined as: **at least one deal advances one stage this week.**

Stage advancement examples:

- `lead` → `qualified` (qualification call completed)
- `demo_completed` → `pilot_proposed` (proposal sent)
- `pilot_proposed` → `pilot_active` (agreement signed)

Win condition resets each Monday. The cockpit page renders the current week's win condition status.

---

## 3. Data Sources

| Module | Package | What it provides |
|--------|---------|-----------------|
| ICP segments | `@nzila/platform-growth-os` → `icp` | Target org list, tier rankings, ICP scoring |
| Union map | `@nzila/platform-growth-os` → `unionMap` | Network nodes, intro paths, coverage map |
| Sequences | `@nzila/platform-growth-os` → `sequences` | Outreach sequence instances, event log |
| Deal pipeline | `@nzila/deal-engine` → `seedDeals` | Deal records with stage, value, risk flags |
| Auth | `@nzila/platform-auth/entra/server` | Session validation, `userId` |

**Bootstrapping:** Before first render, call:

```typescript
await Promise.all([
  icp.bootstrapIcpSegments(),
  sequences.bootstrapSequences(),
  unionMap.bootstrapUnionMap(),
])
```

These are idempotent — safe to call on every cold start.

---

## 4. Daily Founder Operating Routine (15 minutes)

### Morning Revenue Ritual

**Open** `/ue-revenue-cockpit` before checking email.

**Step 1 — Pipeline Health (2 min)**
Scan the top KPI row. If "Untouched high-priority" is > 3, that's your primary focus today.

**Step 2 — Deals at Risk (3 min)**
Any red/amber deal in the Focus Panel? These decay. Attend to them before new outreach.

**Step 3 — Today's 3 Actions (5 min)**
Execute the top action immediately — don't queue it. For proposals and follow-ups, the email draft is in `docs/commercial/outreach/TOP_15_FIRST_TOUCH_EMAILS.md`. For calls, the script is in `docs/commercial/outreach/MEETING_BOOKER.md`.

**Step 4 — Activity log (2 min)**
After each touch, update the deal stage or log the sequence event. The cockpit metrics are only accurate if this data is current.

**Step 5 — Win condition check (1 min)**
Did a deal advance this week? If yes, the week is a win regardless of what else happened. If no, today's actions should target the deal closest to a stage advance.

**Step 6 — One new intro (2 min)**
Check the Warm Intros panel. Activate one intro per day through the network (LinkedIn message, email CC, or direct ask). Introductions compound.

---

## 5. Outreach Resources

| Resource | Path | When to use |
|----------|------|-------------|
| Top 15 pursuit accounts | `docs/commercial/TOP_15_PURSUIT_LIST.md` | Account prioritization, scoring logic, wedge offers |
| First-touch emails (all 15) | `docs/commercial/outreach/TOP_15_FIRST_TOUCH_EMAILS.md` | Ready-to-send outreach for each account |
| Call scripts + objection replies | `docs/commercial/outreach/MEETING_BOOKER.md` | Live call openers, objection handling, demo close |

---

## 6. Pilot Terms (Reference)

All proposals and outreach reference these standard pilot terms:

| Term | Value |
|------|-------|
| Pilot price | **$12,000 CAD** |
| Duration | **90 days** |
| Member seats | **500** |
| Steward accounts | **20** |
| Go-live | **14 business days from confirmation** |
| Data residency | **Canada — federal infrastructure** |
| Credit toward Year 1 | **Full pilot fee credited** |

---

## 7. Escalation Flags

These conditions should trigger founder action within 24 hours — not weekly:

- `demo_completed` deal with no proposal sent after **5 days** → proposal is overdue
- `pilot_proposed` deal with no reply after **10 days** → call the contact directly
- Any deal with `conversionRisk === 'high'` that has been stagnant > **7 days** → rescue or close
- Weighted pipeline drops below **$200,000** → accelerate new outreach immediately
- No new deal stage advance in **10 days** → review Top 15 list and add 2 net-new contacts

---

*Last updated: auto-generated from live deal seed data. To update deal records, edit `packages/deal-engine/src/seed.ts` and redeploy.*
