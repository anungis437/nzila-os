# Command Center — Architecture & Operating Guide

## Purpose

The Command Center is the CEO/COO executive home screen for the Nzila OS console. It answers one question every time it is opened:

> **What requires my attention right now, and what does it mean for revenue, retention, and product quality?**

Not vanity analytics. Not random charts. Every metric is tied to a decision.

---

## Architecture Overview

**Route**: `/command-center`  
**File**: `apps/console/app/(dashboard)/command-center/page.tsx`  
**Type**: Next.js Server Component  
**Auth**: `@nzila/platform-auth/entra/server` — redirects to `/sign-in` if unauthenticated  
**Cache**: `export const dynamic = 'force-dynamic'` — fresh on every request  
**Styling**: Tailwind CSS dark-first (slate-900/800/700), no external chart libraries

---

## Six Sections

### Section A — Revenue Pulse

Six KPI cards covering the full commercial picture:

| Metric | Formula | Decision It Drives |
|--------|---------|---------------------|
| Active Clients | `COUNT(opsClients WHERE onboardingStage = 'live')` | Is the client base growing? |
| ARR Proxy | `SUM(contractValue)` | What is the annual revenue base? |
| MRR Proxy | `ARR / 12` | Monthly cash planning |
| Renewals (90d) | `COUNT(opsClients WHERE renewalDate BETWEEN now AND +90d)` | Which renewal calls to book now? |
| Churn Risk | `COUNT(opsClients WHERE health IN (at_risk, churned))` | Retention intervention priority |
| Open Tickets | `COUNT(itsmTickets WHERE resolvedAt IS NULL)` | Team load signal |

### Section B — Smart Alerts

AI-derived or rule-based alerts from the `commandAlerts` table. Four alert types:

- `renewal_risk`: Renewal approaching without confirmed call booked
- `onboarding_stall`: Client stuck at same onboarding stage for N+ days
- `product_spike`: Unusual ticket volume for a specific product this week
- `churn_signal`: Client health decline + missed engagement threshold

Severity: `critical` (red) > `high` (orange) > `medium` (amber)

Each alert links directly to the relevant client account page.

### Section C — Client Health Grid

One card per client, color-coded by health status:

- 🟢 `healthy` (emerald) — health score ≥ 80
- 🟡 `needs_attention` (amber) — health score 60–79
- 🟠 `at_risk` (orange) — health score < 60
- 🔴 `churned` (red)

Cards show: company name, product, health label, health score out of 100, open ticket count, onboarding stage.

### Section D — Product Health

Per-product row showing four monthly signals:

- **Incidents**: Production incidents this month (red if ≥ 3)
- **Support Load**: Open tickets attributed to this product (amber if ≥ 4)
- **Deployments Shipped**: Features/fixes deployed this month (positive signal)
- **Open Bugs**: Active bugs in backlog (red if ≥ 5)

Color signal: 🔴 red (incidents ≥ 3 OR bugs ≥ 5), 🟡 amber (any incident or support load ≥ 4), 🟢 green (clean).

### Section E — Founder Priorities Today

The 5–7 most important open actions for the CEO/COO. Pulled from `founderPriorities` table. Five priority types:

- 🔄 `renewal` — Client renewal action required
- 🔥 `incident` — Active product incident needs founder attention
- 📋 `proposal` — Proposal or contract awaiting approval
- ⚠️ `risk` — Risk flag requiring decision
- ⚙️ `ops` — Operational unblock (e.g., kickoff stalled)

### Section F — Team Load

Per team member view of open and overdue tickets. Visual load bar. Badges for:

- **Overloaded**: ≥ 10 open tickets → red card
- **Idle**: ≤ 1 open ticket → slate card
- **Normal**: 2–9 open tickets → default card

---

## Data Sources

| Section | Primary Table | Secondary |
|---------|---------------|-----------|
| Revenue Pulse | `opsClients` | `itsmTickets` |
| Smart Alerts | `commandAlerts` | `opsClients` |
| Client Health Grid | `opsClients` | — |
| Product Health | `productHealthSnapshots` | — |
| Founder Priorities | `founderPriorities` | — |
| Team Load | `itsmTickets` (grouped by assignedTo) | — |

All tables are in `packages/db/src/schema/itsm.ts`. All queries must be org-scoped (`WHERE orgId = :orgId`).

---

## DB Schema — New Tables (added this session)

```sql
-- commandAlerts: smart alert engine output
commandAlerts(id, orgId, type, severity, title, body, clientId, productKey, ownerId, resolvedAt, createdAt)

-- revenueEvents: contract lifecycle events
revenueEvents(id, orgId, clientId, type, amountZar, notes, occurredAt, createdAt)

-- renewalTasks: renewal pipeline tasks
renewalTasks(id, orgId, clientId, dueDate, status, assignedTo, notes, createdAt)

-- productHealthSnapshots: monthly product health data
productHealthSnapshots(id, orgId, product, incidentsThisMonth, supportLoad, deploymentsShipped, openBugs, snapshotDate, createdAt)

-- founderPriorities: exec to-do list
founderPriorities(id, orgId, title, type, linkedEntityId, linkedEntityType, done, dueDate, createdAt)
```

---

## Placeholder Data Pattern

Until DB queries are wired, all data uses the null-cast pattern to prevent TypeScript `never` narrowing:

```typescript
const clients = null as ClientRow[] | null
const clientList: ClientRow[] = clients ?? [...fallbackDemo]
```

This allows the page to render with realistic demo data while keeping TypeScript happy.

---

## Related Routes

| Route | Purpose |
|-------|---------|
| `/command-center` | Executive home (this page) |
| `/weekly-review` | Daily / weekly / monthly cadence view |
| `/portfolio` | Venture catalog + product allocation engine |
| `/itsm/clients/:id` | Account 360 per-client view |
| `/itsm/queue` | Support desk queue |

---

## Metrics Philosophy

> "Every metric on this screen must be tied to a decision. If a number doesn't change what we do, remove it."

- **Revenue Pulse** → triggers renewal calls, investor updates
- **Smart Alerts** → triggers client interventions within 24 hours
- **Client Health** → drives weekly CSM agenda
- **Product Health** → gates feature releases, informs team resourcing
- **Priorities** → CEO morning agenda
- **Team Load** → resourcing rebalance trigger
