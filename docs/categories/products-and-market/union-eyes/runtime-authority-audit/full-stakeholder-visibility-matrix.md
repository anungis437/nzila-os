# Full Stakeholder Visibility Matrix

Maps every dashboard surface to the stakeholder roles that may legitimately
access it. Built from the project-standard role hierarchy in
`apps/union-eyes/lib/api-auth-guard.ts` and the runtime gates implemented in
Wave 2 (see `full-feature-gating-hardening.md`).

## Stakeholder bands

| Band | Roles (level) | Typical surfaces |
| ---- | ------------- | ---------------- |
| Membership | `member` (20) | Self-service: profile, dues, my cases, messages |
| Front-line | `steward` (50), `bargaining_committee` (40), `health_safety_rep` (30) | Inbox, work, priorities, members (read), grievances |
| Senior reps | `chief_steward` (90), `officer` (80) | + admin/* (per existing layout), bargaining, health-safety mgmt |
| Local exec | `secretary_treasurer` (110), `vice_president` (120), `president` (130), `admin` (140) | + finance, dues admin, executive intelligence, strike fund, pension trustee |
| National / federation | `national_officer` (150), `fed_staff` (160), `fed_executive` (170) | + cross-union/sector analytics |
| CLC | `clc_staff` (180), `clc_executive` (190) | + clc/* affiliates, compliance, intelligence, staff |
| Platform staff | `system_admin` (200), `compliance_manager` (225), `security_manager` (220), `data_analytics_manager` (240), etc. | + debug, compliance-admin, analytics-admin, billing-admin |
| Strategic | `cto` (290), `coo` (295), `app_owner` (300) | All surfaces |

## Wave 2 surface → minimum role matrix

Each row is a real layout file shipped in this revision.

| Surface | Layout file | Minimum role | Level |
| ------- | ----------- | ------------ | ----- |
| `/dashboard/admin/*` | (pre-existing) | `officer` | 80 |
| `/dashboard/analytics-admin/*` | new | `secretary_treasurer` | 110 |
| `/dashboard/billing-admin/*` | new | `secretary_treasurer` | 110 |
| `/dashboard/compliance-admin/*` | new | `admin` | 140 |
| `/dashboard/debug/*` | new | `system_admin` | 200 |
| `/dashboard/cross-union-analytics/*` | new | `fed_staff` | 160 |
| `/dashboard/sector-analytics/*` | new | `fed_staff` | 160 |
| `/dashboard/executive-operating-intelligence/*` | new | `president` | 130 |
| `/dashboard/clc/*` | new | `clc_staff` | 180 |
| `/dashboard/pension/admin/*` | new | `admin` | 140 |
| `/dashboard/pension/trustee/*` | new | `secretary_treasurer` | 110 |
| `/dashboard/strike-fund/*` | new | `secretary_treasurer` | 110 |
| `/dashboard/employer-execution/*` | new | `admin` | 140 |

## Visibility per existing E2E fixture

Test fixtures defined in `apps/union-eyes/e2e/helpers/role-fixtures.ts`:

| Fixture | Underlying role | Level | Reaches new gates? |
| ------- | --------------- | ----- | ------------------ |
| `member` | `member` | 20 | denies all 12 new gates |
| `steward` | `steward` | 50 | denies all 12 new gates |
| `staff` | `support_agent` | 218 | passes platform-staff gates (intentional) |
| `executive` | `president` | 130 | passes treasury / president gates; denies admin / fed / clc / debug |
| `governance` | `compliance_manager` | 225 | passes platform gates (intentional) |
| `admin` | `admin` | 140 | passes local-exec gates; denies fed / clc / debug |

Deny coverage for the new gates is encoded in
`apps/union-eyes/e2e/authenticated-role-navigation.spec.ts` (`leakageAttempts`).

## Mandatory sections checklist

- [x] Stakeholder bands
- [x] Surface → minimum role matrix
- [x] Visibility per existing E2E fixture
