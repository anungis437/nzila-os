# Console Business OS — Next 90 Days

**Owner**: Aubert Nungisa  
**Baseline**: Post-transformation (7.6/10)  
**Target**: 9/10 Business OS by August 2026

---

## Phase 1 — Done ✅ (May 2026)

| Deliverable                     | Status     |
|----------------------------------|------------|
| Navigation rebuilt (7-zone IA)  | ✅ Complete |
| `/today` CEO Daily Pulse        | ✅ Complete |
| `/portfolio` Venture Table      | ✅ Complete |
| `/revenue` Sales Cockpit        | ✅ Complete |
| `/capital` Burn Tracker         | ✅ Complete |
| `/execution` Initiative Tracker | ✅ Complete |
| `/risk` Risk Center             | ✅ Complete |
| Final scorecard + 90-day plan   | ✅ Complete |

---

## Phase 2 — Next 30 Days (June 2026): Wire Static → Dynamic

### P2.1 — Execution Initiatives Table

**Goal**: Replace hardcoded `WEEKLY_INITIATIVES` with a real DB table.

```sql
CREATE TABLE execution_initiatives (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  venture     VARCHAR(64),
  zone        VARCHAR(32),           -- REVENUE, CAPITAL, GOVERNANCE, etc.
  owner       VARCHAR(128),
  due_date    DATE,
  status      VARCHAR(32) DEFAULT 'not-started', -- not-started, in-progress, done
  urgent      BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

- **Console UI**: Inline edit for status toggle on `/execution`
- **Effort**: 2 days (schema + CRUD API + page update)

---

### P2.2 — True Runway Calculation

**Goal**: Capital page shows actual months of runway, not just infra burn.

**Approach**:

```
MONTHLY_TOTAL_BURN = INFRA_BURN + STAFF_BURN + CONTRACTOR_BURN
RUNWAY_MONTHS = CASH_BALANCE / MONTHLY_TOTAL_BURN
```

- Add 3 env vars to Console container: `MONTHLY_STAFF_BURN_USD`, `MONTHLY_CONTRACTOR_BURN_USD`, `CASH_BALANCE_USD`
- Capital page calculates and displays runway in months
- Red if < 6mo, amber if < 12mo, green if ≥ 12mo
- **Effort**: 1 day

---

### P2.3 — Today Page: Top 5 Actions from DB

**Goal**: Replace hardcoded weekly actions with live query from `execution_initiatives` table.

- Filter: `status != 'done' AND (urgent = true OR due_date <= now() + 7 days)` ORDER BY urgent DESC, due_date ASC LIMIT 5
- **Effort**: 0.5 days (after P2.1)

---

### P2.4 — Product Catalog Version Tracking

**Goal**: Prevent stale catalog from silently driving wrong directives.

- Add `catalog_version` to `governance/portfolio/product-catalog.json` (already there as `schema_version`)
- Console reads version and shows a banner if it's older than 14 days (compare against `last_updated` field if added)
- **Effort**: 0.5 days

---

## Phase 3 — 30–60 Days (July 2026): Intelligence Layer

### P3.1 — Weekly Digest Notification

**Goal**: Monday morning email/Slack with the week's key metrics.

**Content**:

- OPS score vs last week
- Revenue pipeline change (new pilots, closed pilots, new quotes)
- 30d burn vs previous 30d
- Top 3 pending approvals
- 1 critical risk if any

**Implementation**:

- `packages/platform-notifications` — new digest worker
- Cron: Monday 6am (Azure Container Job or GitHub Actions schedule)
- Email via Azure Communication Services (already provisioned: `nzila-canada-staging-rg`)
- **Effort**: 3 days

---

### P3.2 — Revenue Forecast

**Goal**: Revenue page shows close-probability-weighted pipeline value.

```
WEIGHTED_PIPELINE = Σ (quote.totalValue * probabilityByStatus)
  where probabilityByStatus = { draft: 0.1, sent: 0.35, accepted: 0.8 }
```

- Add to revenue metric strip as "Weighted Pipeline ($)"
- **Effort**: 1 day

---

### P3.3 — Risk Email Alert

**Goal**: When critical risk is detected, send email to founder immediately.

- Trigger: `/risk` page re-runs every 15min via background job; if new `critical` risk appears → email
- Use Azure Communication Services email
- **Effort**: 2 days

---

## Phase 4 — 60–90 Days (August 2026): Founder UX Polish

### P4.1 — Mobile Today View

**Goal**: `/today` on mobile renders as 5 bullet points, no tables.

- Responsive breakpoint: `md:hidden` mobile strip with top 3 alerts + top 3 actions
- **Effort**: 1 day

---

### P4.2 — Board-Ready Snapshot Export

**Goal**: One-click PDF of all 6 zones with date stamp.

- `/api/console/snapshot` endpoint — renders all 6 pages headlessly via Puppeteer or @react-pdf/renderer
- Output: `console-snapshot-YYYY-MM-DD.pdf`
- **Effort**: 3 days

---

### P4.3 — Decision Audit Trail

**Goal**: Every approval/rejection is linked to a venture and visible in both `/execution` and `/portfolio`.

- Add `ventureId` FK to `approvals` table
- Console shows approved decisions per venture in portfolio table
- **Effort**: 2 days

---

## 90-Day Target State

| Zone       | Current (7.6/10) | Target (9/10) | Key Upgrade                        |
|------------|:----------------:|:-------------:|-------------------------------------|
| Today      | 8                | 9             | Top 5 from DB, runway banner       |
| Portfolio  | 8                | 9             | Decision history per venture        |
| Revenue    | 7                | 9             | Weighted forecast, close probability|
| Capital    | 7                | 9             | True runway (staff + infra)        |
| Execution  | 6                | 9             | DB initiatives, inline status toggle|
| Risk       | 8                | 9             | Email alerts, threshold config      |
| Navigation | 9                | 9             | Stable                              |

### Success Criteria

- [ ] Console answers "What should I focus on?" every morning — **TODAY**
- [ ] Weekly digest in email by Monday 7am — **PHASE 3**
- [ ] Revenue tracked from prospect to signed pilot — **PHASE 2/3**
- [ ] Every venture has an owner + directive + 90-day milestone — **PHASE 2**
- [ ] Critical risks trigger email notification — **PHASE 3**
- [ ] True runway visible (staff + infra burn) — **PHASE 2**

---

## Effort Summary

| Phase      | Effort     | Target Date   |
|------------|------------|---------------|
| Phase 1    | Complete   | May 2026      |
| Phase 2    | ~5 days    | June 2026     |
| Phase 3    | ~6 days    | July 2026     |
| Phase 4    | ~7 days    | August 2026   |
| **Total**  | **~18 dev-days** | **Aug 2026** |
