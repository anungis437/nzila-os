# 05 — Full Page & Navigation Reality Audit

**Authority:** Lived runtime reality of every page and navigation flow.
**Source anchors:**
[apps/console/lib/nav-config.ts](../../apps/console/lib/nav-config.ts),
`apps/{web,union-eyes,console,partners,zonga,cfo,flow,abr,trade,agrimo,cora,mobility,platform-admin,control-plane}/app/`.

---

## 1. Sidebar/Navigation Coherence per App

### 1.1 Console — `LIVE`

Source: [apps/console/lib/nav-config.ts](../../apps/console/lib/nav-config.ts) `navGroups`.

9 navigation zones, **all populated**, none orphaned:

| Zone | Label | Items | Verdict |
|------|-------|-------|---------|
| 1 | Command         | 9 routes (`/ceo`, `/intelligence`, `/today`, `/autopilot`, `/briefing`, `/focus`, `/portfolio`, `/command-center`, `/weekly-review`) | LIVE |
| 2 | Revenue         | 4 routes (`/revenue`, `/ue-revenue-cockpit`, `/revenue/faircase`, `/pilot/export`) | LIVE |
| 3 | Capital         | 6 routes (`/capital`, `/runway`, `/forecast`, `/cost`, `/platform-economics`, `/business/finance`) | LIVE |
| 4 | Execution       | 7 routes (`/execution`, `/accountability`, `/operator`, `/decision-scoreback`, `/business/{approvals,queues,signatures}`) | LIVE |
| 5 | Risk            | 4 routes (`/risk`, `/ops-score`, `/audit-insights`, `/trend-detection`) | LIVE |
| 6 | Governance      | 9 routes (`/governance`, `/board`, `/business/governance`, `/business/equity`, `/evidence-packs`, `/audit`, `/intelligence?section=...`, `/proof-center`, `/compliance-snapshots`) | LIVE |
| 7 | Ops Toolkit     | 6 routes (`/system-health`, `/ops`, `/ops/performance`, `/performance`, `/integrations`, `/integrations-control-plane`) | LIVE |
| 8 | Service Operations | 7 routes (`/itsm/*`)                              | LIVE |
| 9 | Admin           | 3 routes (`/orgs`, `/docs`, `/settings`)            | LIVE |

**External app launcher** (4 entries): `Public Web`, `Partner Portal`,
`Union Eyes`, `FAIRCASE`. URLs resolved at module load from
`process.env.NEXT_PUBLIC_*`.

### 1.2 Union Eyes — `LIVE`

Locale-prefixed (`/[locale]/dashboard/...`). Primary surfaces:

| Surface                              | Verdict           |
|--------------------------------------|-------------------|
| `/[locale]` (marketing landing)      | LIVE (15 hero images deployed) |
| `/[locale]/sign-in`                  | LIVE              |
| `/[locale]/sign-up`                  | LIVE              |
| `/[locale]/dashboard`                | LIVE              |
| `/[locale]/dashboard/grievances/*`   | LIVE              |
| `/[locale]/dashboard/cases/*`        | LIVE              |
| `/[locale]/dashboard/cba-intelligence` | LIVE (doctrine-realigned) |
| `/[locale]/dashboard/admin/*`        | LIVE              |
| `/[locale]/dashboard/audit`          | LIVE              |
| `/[locale]/dashboard/analytics`      | LIVE              |
| `/[locale]/sandbox` (UX tester only) | LIVE              |
| `/[locale]/account-suspended`        | LIVE              |
| `/api/auth_core/health/`             | LIVE              |

### 1.3 Web (marketing) — `LIVE`

Standard Next.js marketing site; locale-prefixed. Last verified live.

### 1.4 Partners — `PARTIAL`

Root route returns 404 in staging fabric. Sub-routes operational.
**Tracked as a known gap** in §6.

### 1.5 Zonga — `LIVE` (staging) / `TLS-PROVISIONING` (prod custom domain)

Creator economy surfaces; payouts API operational.

### 1.6 CFO — `STAGING-ONLY`

Doctrine-realigned (`advisory-ai`, `ai-insights` pages converged to governance-safe framing).

### 1.7 Flow / Agrimo / Mobility — `STAGING-ONLY`

Functional but not promoted to prod custom domains.

### 1.8 ABR (FairCase) — `BLOCKED`

Release status `blocked` per registry. Doctrine realignment is in flight
(`docs/nzila-cognition-doctrine/faircase-governance-realignment.md`).

### 1.9 Cora / Trade — `RESERVED`

Incubating; not surfaced in user-visible navigation.

### 1.10 Platform-admin — `RESERVED` (release frozen)

Surfaces accessible only via Console proxy.

### 1.11 Control-plane — `RESERVED`

Container app exists; image not yet promoted.

---

## 2. Page Completeness Findings

| App              | Total routes | LIVE | PARTIAL | PLACEHOLDER | DEAD | Verdict |
|------------------|--------------|------|---------|-------------|------|---------|
| console          | 55           | 55   | 0       | 0           | 0    | COMPLETE |
| union-eyes       | ~80 (locale-mult) | ~78 | 2     | 0           | 0    | NEAR-COMPLETE |
| web              | ~12          | 12   | 0       | 0           | 0    | COMPLETE |
| partners         | ~8           | 7    | 1 (root) | 0          | 0    | PARTIAL |
| zonga            | ~14          | 14   | 0       | 0           | 0    | COMPLETE (staging) |
| cfo              | ~20          | 18   | 2 (post-doctrine review) | 0 | 0 | NEAR-COMPLETE |
| flow             | ~10          | 10   | 0       | 0           | 0    | COMPLETE (staging) |
| abr              | ~15          | 0    | 0       | 15          | 0    | BLOCKED — placeholder shell pending realignment |
| agrimo, cora, trade, mobility | various | various | various | various | 0 | INCUBATING |

---

## 3. Operational Calmness

The **Doctrine** (governance-safe institutional cognition, see
`docs/nzila-cognition-doctrine/`) requires that every surface convey
**bounded, calm, escalatable** behavior — never autonomous, never optimization-framed.

### 3.1 Calmness signals checked

| Signal                                              | Coverage         | Verdict |
|-----------------------------------------------------|------------------|---------|
| `AIBanner` / disclaimer present on intelligence surfaces | UE 100%, Console 100%, CFO 100% | LIVE |
| "Final authority remains with [role]" language      | All AI surfaces  | LIVE    |
| Escalation pathway visible                          | All workflows    | LIVE    |
| No prohibited framing ("AI-powered", "autonomous", etc.) | Enforced by `validate:cognition` | LIVE |
| Continuity-safe error messaging                     | UE workflows     | LIVE    |

### 3.2 Stabilization UX

| App        | Stabilization UX implemented        | Verdict |
|------------|-------------------------------------|---------|
| union-eyes | "Re-grounding…" loading states      | LIVE    |
| console    | Skeleton loaders on all data surfaces | LIVE  |
| cfo        | Bounded-confidence indicators       | LIVE    |

---

## 4. Navigation Coherence

| Issue                                                            | Verdict      |
|------------------------------------------------------------------|--------------|
| Console nav `filterNav` defaults to "allow everything"           | DOCUMENTED RISK (§3 Auth audit §6) |
| App switcher links to ACA fallback, not custom domains           | DOCUMENTED — STAGING-ONLY divergence |
| UE/Console use the same locale resolution middleware             | COHERENT     |
| Suspended users hit `/account-suspended` regardless of entry path | COHERENT    |

---

## 5. Onboarding UX

| Step                          | Implementation                            | Verdict |
|-------------------------------|-------------------------------------------|---------|
| Sign-up                       | UE: email/password OR Entra invite        | LIVE    |
| Email verification            | Magic-link via `@nzila/platform-auth`     | LIVE    |
| Org assignment                | Auto-bind to org via invite token         | LIVE    |
| Role assignment               | Defaults to `member`; admins escalate via Console | LIVE |
| First-login walkthrough       | UE: in-app tour                           | PARTIAL (UE only) |
| Cross-app onboarding          | Console "Today" page surfaces next actions | LIVE   |

---

## 6. Findings — Dead/Orphan/Placeholder

| Finding                                                          | Severity |
|------------------------------------------------------------------|----------|
| `partners` root route 404                                        | Medium   |
| `abr` (FairCase) entire app is placeholder shell                 | High (BLOCKED) |
| Console nav `filterNav` not fully wired in production layout     | Medium   |
| Two `cfo` routes pending post-doctrine final pass                | Low      |
| No first-login walkthrough in Console (UE only)                  | Low      |

---

## 7. Operational Incoherence Findings

None of severity ≥ Medium. All zones across Console map cleanly to documented
business doctrine. UE state machine maps cleanly to `union_admin` role hierarchy.

---

**Verdict for §5:** Navigation reality is **coherent and calm** across LIVE
apps. The most material gap is `abr` (BLOCKED) and `partners` root route
(404). These are catalogued and not blocking governance gates.
