# Union Eyes — Pilot Scope Definition

> Defines the boundaries of the CUPE pilot deployment.
> This document is the canonical reference for what is included and excluded.

## Pilot Objective

Validate that CUPE stewards and members can:
1. Create and track workplace cases with minimal friction
2. Add updates and monitor case progress
3. Complete the full cycle from submission to resolution

## Included Features (Pilot Scope)

| Feature | Description | UI Location |
|---------|-------------|-------------|
| **Pilot Dashboard** | Simplified view: My Cases, Create Case, Recent Activity | `/dashboard` |
| **Create Case** | Submit a new workplace issue with type, priority, description | `/dashboard/claims/new` |
| **My Cases** | View and filter your active and resolved cases | `/dashboard/claims` |
| **Case Timeline** | Add updates, view history, track status changes | `/cases/[id]` |
| **Onboarding Wizard** | 4-step first-login experience | Auto-shown on first login |

## Excluded Features (Not in Pilot)

| Feature | Reason |
|---------|--------|
| Grievance Intake Wizard (6-step) | Full CBA workflow not needed for pilot |
| CBA Intelligence | Advanced analytics deferred |
| Bargaining Module | Out of pilot scope |
| Strike Fund | Out of pilot scope |
| Pension Admin | Out of pilot scope |
| Financial Management | Out of pilot scope |
| Voting / Elections | Out of pilot scope |
| AI Assistant | Not validated for pilot |
| Health & Safety Module | Deferred |
| Organizing Campaigns | Deferred |

## Pilot Boundaries

- **Users:** CUPE local members and stewards only
- **Duration:** Time-limited (defined per agreement)
- **Data:** Pilot data in isolated org scope
- **Support:** Via pilot admin runbook and SOP
- **Monitoring:** Lightweight event tracking (no heavy analytics)

## Feature Flags

Pilot mode is controlled by the `pilot-mode` feature flag.
When enabled for an organization:
- Dashboard renders `PilotDashboard` (simplified)
- Onboarding wizard shows on first login
- Sidebar shows reduced nav (pilot scope only)
- Feedback widget activates after first case

## Observability (Pilot Phase)

Events tracked:
- `user_login`, `session_started`, `session_ended`
- `case_created`, `first_case_created`
- `update_added`, `first_update_added`
- `case_viewed`

Derived metrics:
- Time to first case, time to first update
- Cases per user, updates per case
- Daily active users

Friction detection:
- Login without case creation
- Case without updates
- Inactive users (>3 days)

## Conversion Readiness Criteria

An org is "ready" when:
- ≥ 3 unique active users in last 14 days
- ≥ 10 total cases created
- ≥ 5 total updates added
- Activity on ≥ 5 of last 14 days

## Champion Detection

Users are flagged as potential champions when:
- ≥ 3 cases created
- ≥ 5 updates added
- ≥ 5 active days

Score = (cases × 3) + (updates × 2) + active days
