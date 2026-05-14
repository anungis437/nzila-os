# Console → Business OS — Phase 1 Audit

**Date:** 2026-05-06  
**Auditor:** GitHub Copilot (automated full-codebase read)  
**Scope:** `apps/console/` — all routes, components, lib, and data surfaces

---

## 1. What Console Is Today

A **GRC/ops monitoring tool** masquerading as a business operating system. It has 40+ navigation items, 35+ routes, and 8 nav groups — all oriented toward internal technical and compliance operations. It is NOT a CEO tool. It is NOT a business tool.

**Current homepage** (`/console`): A 6-tile launcher grid pointing to `/docs`, `/analytics`, `/automation`, `/standards`, and two "coming soon" tiles (Deployments, Security) that both href to `/console` itself — dead links. Below the tiles: an "App Launcher" grid that opens other platform apps in new tabs.

**The Console's identity crisis:** A platform operator's view dressed as a business command center.

---

## 2. Current Module Inventory

### Route Classification

| Route | Current Purpose | Business Value | Action |
|---|---|---|---|
| `/console` | Homepage — tile grid + app launcher | LOW — internal links only | → **Redirect to /today** |
| `/platform` | Platform health surface | Medium — technical | DEMOTE → /ops-toolkit |
| `/system-health` | Server health | Low — DevOps | DEMOTE → /ops-toolkit |
| `/analytics` | Org-level analytics (API-driven) | Medium | FOLD into /portfolio |
| `/governance` | Contract tests, CI, secret scan | **HIGH** | PROMOTE to Zone 7 anchor |
| `/compliance-snapshots` | Compliance evidence | Medium — GRC | KEEP in Zone 7 |
| `/assurance` | Assurance page | Low | DOWNGRADE |
| `/standards` | CI/CD standards | Low | MOVE to /ops-toolkit |
| `/audit-insights` | Audit insights | Medium | FOLD into /risk |
| `/audit-graph` | Audit graph viz | Low — niche | KEEP low-priority |
| `/nacp-integrity` | NACP integrity | Low | KEEP low-priority |
| `/evidence-packs` | Evidence packs | Medium — commercial | FOLD into /governance |
| `/proof-center` | Proof center | Medium | FOLD into /governance |
| `/proof-pack` | Proof pack gen | Medium | FOLD into /governance |
| `/isolation-certification` | Isolation certs | Low | FOLD into /governance |
| `/pilot/export` | Pilot data export | Medium | FOLD into /revenue |
| `/ops` | Ops confidence score | **HIGH** | FOLD into /risk |
| `/ops-score` | Ops score detail | Medium | FOLD into /risk |
| `/performance` | Performance metrics | Medium | DEMOTE |
| `/trend-detection` | Trend warnings | Medium | FOLD into /risk |
| `/failure-simulation` | Failure sim | Low | MOVE to /ops-toolkit |
| `/scale-simulation` | Scale sim | Low | MOVE to /ops-toolkit |
| `/deployment-profile` | Deploy profile | Low | MOVE to /ops-toolkit |
| `/cost` | **Cost dashboard** | **HIGH** | PROMOTE to Zone 6 (CAPITAL) |
| `/platform-economics` | Platform economics | **HIGH** | PROMOTE to Zone 6 (CAPITAL) |
| `/integrations` | Integration list | Low | DEMOTE |
| `/integrations-control-plane` | Integration health | Medium | MOVE to /ops-toolkit |
| `/marketplace` | Provider marketplace | Low | DEMOTE |
| `/console/ai/*` | AI overview/models/actions/knowledge/usage | Low — operator view | DEMOTE |
| `/console/ml/*` | ML overview/models/runs | Low | DEMOTE |
| `/business` | Business OS launcher (EquityOS, Governance, Finance, Year-End) | **HIGH** | PROMOTE to Zone 7 |
| `/business/finance` | Finance ops (expense/tax/close) | **HIGH** | PROMOTE to Zone 6 (CAPITAL) |
| `/business/equity` | Cap table, share register | **HIGH** | PROMOTE to Zone 7 |
| `/business/governance` | Resolutions, approvals, corp gov | **HIGH** | PROMOTE to Zone 7 |
| `/business/approvals` | Approval queue | **HIGH** | SURFACE in /today |
| `/business/signatures` | DocuSign-style signatures | Medium | SURFACE in /today alerts |
| `/business/queues` | Work queues | Medium | SURFACE in /today |
| `/business/yearend` | Year-end close | High (seasonal) | PROMOTE to Zone 6 |
| `/orgs` | Org management | Low | Admin-only |
| `/automation` | Automation pipeline | Low | Admin-only |
| `/docs` | Internal docs | Low | Admin-only |
| `/settings` | Settings | Low | Admin-only |
| `/console/admin/retention` | Data retention | Low | Admin-only |
| `/console/finance/stripe` | Stripe admin | Low | Admin-only |

### Dead / Broken Surfaces

- `/console` homepage: "Deployments" and "Security" tiles href to `/console` itself — circular dead links
- `/platform` — page content unknown but nav label is vague
- Multiple nav groups duplicate icon assignments (5× ShieldCheckIcon, 4× CpuChipIcon)

### Tech Inventory (lib/)

| Module | Purpose | Reuse in BO |
|---|---|---|
| `server-data.ts` | Marketplace/integration data loaders | Keep |
| `rbac.ts` | Role enforcement | Keep — use in all zones |
| `audit-db.ts` | Audit DB queries | Fold into Risk |
| `analytics/` | Analytics queries | Fold into Portfolio |
| `equity/` | Cap table queries | Keep in Governance |
| `governance/` | Gov queries | Keep in Governance |
| `finance-audit.ts` | Finance audit | Keep in Capital |
| `policy-enforcement.ts` | Policy engine | Keep |
| `evidence.ts` | Evidence pack ops | Keep in Governance |

---

## 3. Critical Missing Business Surfaces

| Surface | Why It Matters | Priority |
|---|---|---|
| **CEO Daily Pulse** — TODAY page | Aubert's first view every morning: cash, pilots, top 3 priorities, alerts | **P0** |
| **Portfolio Venture Table** | One-page view of all 17 products: stage, priority, directive (SELL/BUILD/HOLD/CUT) | **P0** |
| **Revenue Pipeline** | Active pilot orgs, commerceQuotes pipeline, close probability | **P0** |
| **Burn / Runway** | Monthly spend by venture/category, projected runway | **P0** |
| **Execution Tracker** | Weekly initiative list, owner, ETA, status — replaces mental overhead | **P1** |
| **Risk Register** | Venture + platform + financial threats in one view | **P1** |
| **Founder Focus** | Where are Aubert's hours going? Sales vs Build vs Admin | **P2** |
| **Decision Log** | Record of GO/HOLD/CUT decisions by venture | **P2** |

---

## 4. Navigation Diagnosis

Current nav has **8 groups, 40+ items**. Result: cognitive overload, zero business signal, everything looks equally important. A GRC engineer designed this navigation, not a founder.

### Proposed 7-Zone IA

```
Zone 1: TODAY          → /today         (daily CEO pulse — anchor page)
Zone 2: PORTFOLIO      → /portfolio     (all ventures — status, stage, directive)
Zone 3: REVENUE        → /revenue       (pipeline, active pilots, close risk)
Zone 4: CAPITAL        → /capital       (burn, runway, cost by venture)
Zone 5: EXECUTION      → /execution     (initiatives, owners, blockers, ROI)
Zone 6: RISK           → /risk          (venture + platform + financial threats)
Zone 7: GOVERNANCE     → /governance    (enhanced: GRC + evidence + corp gov + GA gates)
────────────────────────────────────────
Internal Tools:        → /ops-toolkit   (collapsed: ops/perf/deploy/AI/ML/integrations)
Admin:                 → /settings      (minimal: orgs, retention, settings)
```

This is 9 nav items (7 zones + ops-toolkit + admin). Not 40.

---

## 5. What to Preserve

- `lib/rbac.ts` — intact, well-designed
- `lib/server-data.ts` — intact, conservative fallbacks
- `lib/server-data.ts#getCostDashboardData` — reuse in CAPITAL
- `lib/analytics/` — reuse in PORTFOLIO
- `lib/governance/` — reuse in GOVERNANCE
- `lib/equity/` — reuse in GOVERNANCE
- `lib/finance-audit.ts` — reuse in CAPITAL
- `components/sidebar-nav.tsx` — intact, reuse as-is
- `app/(dashboard)/business/*` — keep all routes, re-link in Zones 4+7
- `app/(dashboard)/governance/page.tsx` — enhance for Zone 7 anchor
- `app/(dashboard)/cost/page.tsx` — promote to Zone 4 (CAPITAL)
- `app/(dashboard)/analytics/page.tsx` — demote to sub-route in PORTFOLIO

---

## 6. Verdict

**Console's current state: 2/10 as a Business OS. 6/10 as a GRC/Ops monitor.**

The architecture is sound — auth works, DB is accessible, pages render, server components follow correct patterns. The problem is entirely in *what* is built and *how* it is organized.

The transformation is a navigation + new-page problem. All existing infrastructure works. No new packages needed. No DB migrations needed. Pure UI/UX/product work.

**After transformation target: 8/10 Business OS.**
