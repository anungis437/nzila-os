# Union Eyes — Pilot Scope Freeze
## CLC Convention 2026 · Definitive Pilot Truth Document

**Frozen:** May 2026  
**Authority:** Platform Lead + Executive Director, CUPE Local 4279  
**Status:** FROZEN — no changes without dual authorization

---

## What This Document Is

This is the definitive record of what is **enabled** and what is **hidden** in the Union Eyes platform during the CLC 2026 pilot phase. It is the single source of truth for:

- Demo configuration
- Stakeholder communication
- Governance committee review
- Any future scope discussion

When there is conflict between this document and any other source, this document governs.

---

## Pilot Philosophy

The CLC pilot scope is deliberately constrained. We enable the surfaces that:
1. Deliver direct value to the five identified stakeholder roles
2. Are operationally stable and demo-ready
3. Can be defended to a governance committee as appropriate for institutional use

We hide the surfaces that:
1. Require further maturity or validation
2. Would create misimpressions about the platform's scope
3. Are experimental features not yet appropriate for institutional demonstration

**The pilot is not a limited product.** It is a governed institutional evaluation.

---

## Role Experience Map

Each authenticated user sees a role-determined experience. Route access is enforced server-side — not just UI-hidden.

| Role in DB               | Experience   | Landing Path                              |
|--------------------------|--------------|-------------------------------------------|
| `member`                 | Member       | `/dashboard/inbox`                        |
| `steward`, `chief_steward`, `support_agent`, `clerk`, etc. | Staff | `/dashboard/workbench` |
| `president`, `vice_president`, `coo`, `national_officer`, etc. | Executive | `/dashboard/intelligence` |
| `governance`, `compliance_manager`, `officer`, `security_manager` | Governance | `/dashboard/governance` |
| `admin`, `system_admin`, `platform_lead` | Admin | `/dashboard/admin/organizations` |

---

## Enabled Routes by Experience

All routes below are accessible in pilot mode. Routes not listed here are blocked, even if the URL technically exists.

### Member Experience
| Route                          | Label                  |
|--------------------------------|------------------------|
| `/dashboard`                   | Dashboard root         |
| `/dashboard/inbox`             | Home / My Cases        |
| `/dashboard/claims/new`        | Submit Request         |
| `/dashboard/messages`          | Messages               |
| `/dashboard/documents`         | Documents              |
| `/dashboard/settings`          | Profile & Settings     |
| `/dashboard/profile`           | Profile                |
| `/dashboard/support`           | Help & Support         |

### Staff Experience (Stewards, Staff Coordinators)
| Route                          | Label                  |
|--------------------------------|------------------------|
| `/dashboard`                   | Dashboard root         |
| `/dashboard/workbench`         | Workbench              |
| `/dashboard/claims`            | Cases                  |
| `/dashboard/priorities`        | Assignments            |
| `/dashboard/members`           | Members                |
| `/dashboard/documents`         | Documents              |
| `/dashboard/correspondence`    | Communications         |
| `/dashboard/reports`           | Reports                |
| `/dashboard/notifications`     | Notifications          |
| `/dashboard/settings`          | Profile & Settings     |
| `/dashboard/profile`           | Profile                |

### Executive Experience
| Route                                          | Label                  |
|------------------------------------------------|------------------------|
| `/dashboard`                                   | Dashboard root         |
| `/dashboard/intelligence`                      | Executive Overview     |
| `/dashboard/continuity-intelligence`           | Continuity Insights    |
| `/dashboard/executive-operating-intelligence`  | Operational Health     |
| `/dashboard/operations`                        | Operations             |
| `/dashboard/governance-center`                 | Governance Visibility  |
| `/dashboard/outcomes`                          | Outcomes               |
| `/dashboard/leadership`                        | Leadership Continuity  |
| `/dashboard/reports`                           | Reports                |
| `/dashboard/trust`                             | Trust & Oversight      |
| `/dashboard/settings`                          | Profile & Settings     |
| `/dashboard/profile`                           | Profile                |

### Governance Experience
| Route                                | Label                  |
|--------------------------------------|------------------------|
| `/dashboard`                         | Dashboard root         |
| `/dashboard/governance`              | Governance Overview    |
| `/dashboard/trust`                   | Trust & Explainability |
| `/dashboard/workbench`               | Operational Review     |
| `/dashboard/continuity-intelligence` | Continuity Signals     |
| `/dashboard/audits`                  | Audit & Evidence       |
| `/dashboard/reports`                 | Reports                |
| `/dashboard/settings`                | Profile & Settings     |
| `/dashboard/profile`                 | Profile                |

### Admin Experience
| Route                                    | Label                  |
|------------------------------------------|------------------------|
| `/dashboard`                             | Dashboard root         |
| `/dashboard/admin/organizations`         | Organization           |
| `/dashboard/admin/members`               | Users & Roles          |
| `/dashboard/admin/onboarding`            | Pilot Configuration    |
| `/dashboard/governance`                  | Policies               |
| `/dashboard/audits`                      | Audit                  |
| `/dashboard/security`                    | Security               |
| `/dashboard/movement-insights/export`    | Exports                |
| `/dashboard/integrations`                | Integrations           |
| `/dashboard/operations`                  | System Status          |
| `/dashboard/settings`                    | Profile & Settings     |
| `/dashboard/profile`                     | Profile                |

---

## Marketing Routes (Public — No Auth Required)

| Route                          | Purpose                             |
|--------------------------------|-------------------------------------|
| `/en-CA`                       | Homepage                            |
| `/en-CA/proof`                 | Institutional proof architecture    |
| `/en-CA/trust`                 | Trust & governance layer            |
| `/en-CA/for-clc`               | CLC convention landing              |
| `/en-CA/pilot-request`         | Pilot request / CTA                 |
| `/en-CA/contact`               | Contact                             |

---

## Pilot-Excluded Routes (Hidden in Pilot Mode)

These routes are **hard-blocked** in pilot mode even if a role would otherwise have access. Enforced by `canAccessDashboardPath()` in `lib/dashboard/role-experience.ts`.

| Route Prefix                                         | Why Excluded                                              |
|------------------------------------------------------|-----------------------------------------------------------|
| `/dashboard/ai-assistant`                            | Experimental — not appropriate for institutional pilot    |
| `/dashboard/analytics`                               | Requires further validation and data maturity             |
| `/dashboard/analytics-admin`                         | Backend admin tooling — never demo-facing                 |
| `/dashboard/cognition`                               | Experimental intelligence layer — not in scope            |
| `/dashboard/executive-intelligence`                  | Superseded by executive-operating-intelligence            |
| `/dashboard/institutional-intelligence`              | Experimental — excluded pending governance review         |
| `/dashboard/institutional-operating-intelligence`    | Experimental — excluded pending governance review         |
| `/dashboard/longitudinal-cognition`                  | Multi-session intelligence — not in pilot scope           |
| `/dashboard/continuity-simulation`                   | Simulation features — experimental                        |
| `/dashboard/movement-insights`                       | Cross-org analytics — not appropriate for local pilot     |
| `/dashboard/sector-analytics`                        | Sector-level view — requires federation scope             |
| `/dashboard/cross-union-analytics`                   | Cross-union features — federation scope only              |
| `/dashboard/data-source`                             | Data integration management — not in pilot scope          |
| `/dashboard/admin/ai-usage`                          | AI usage monitoring — not in pilot scope                  |

**Enforcement mechanism:** `canAccessDashboardPath()` returns `false` for any path matching `PILOT_EXCLUDED_PREFIXES` when `isPilotMode === true`. This is enforced in middleware, not just UI.

---

## Routes That Do Not Exist and Should Never Be Navigated To

Separate from pilot gating — these routes do not exist in the application and will 404:

| Route                             | Notes                                              |
|-----------------------------------|----------------------------------------------------|
| `/dashboard/workflow-builder`     | Not built; never mention in demos                  |
| `/dashboard/fsm`                  | Internal FSM tooling; never expose                 |
| `/dashboard/orchestration`        | Orchestration layer — internal only                |
| `/dashboard/federation-controls`  | Federation features — future scope                 |
| `/dashboard/integrations/advanced`| Advanced integrations — not built                  |
| `/dashboard/deep-analytics`       | Not built                                          |
| `/dashboard/advanced-intelligence`| Not built under this path                          |

---

## Scope Change Process

Any addition to the enabled scope during the CLC pilot period requires:

1. Written request from platform lead or local executive
2. Governance officer review (David Okafor or equivalent)
3. Both signatures (digital or in-person) before any route ungating
4. This document updated with new freeze date and change record

**No scope changes during the CLC convention week (May 25–30, 2026) without emergency authorization.**

---

## Change Record

| Date       | Change                          | Authorized by           |
|------------|---------------------------------|-------------------------|
| 2026-05-09 | Initial pilot scope freeze      | Platform Lead           |
