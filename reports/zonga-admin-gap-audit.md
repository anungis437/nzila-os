# Zonga Admin Gap Audit

> **Report type:** Launch readiness — admin tooling coverage  
> **Generated:** 2025-Q2  
> **Scope:** Platform admin screens, moderation tooling, and operator workflows

---

## Executive Summary

The Zonga admin surface was audited against pilot operational requirements. Core admin screens are in place. Several moderation and reporting screens are slated for the GA milestone and are tracked as known gaps.

---

## Admin Screens Inventory

| Screen / Feature | Path | Status |
|-----------------|------|--------|
| Partner onboarding queue | `/admin/partners` | ✅ Exists |
| Label catalogue review | `/admin/catalogue` | ✅ Exists |
| Payout approval workflow | `/admin/payouts` | ✅ Exists |
| Analytics aggregation view | `/admin/analytics` | ✅ Exists |
| Playback health operations | `/dashboard/operations/playback-health` | ✅ Exists |
| Rights dispute queue | `/admin/rights/disputes` | 🟡 Stub — read-only |
| Content moderation flags | `/admin/moderation` | 🔴 Not yet built |
| User ban / suspend workflow | `/admin/users/actions` | 🔴 Not yet built |
| Platform-level audit log viewer | `/admin/audit` | 🟡 Stub — partial |
| Broadcast notifications | `/admin/notifications` | 🔴 Not yet built |

---

## Gaps by Priority

| Gap | Impact | Pilot Workaround | GA Target |
|-----|--------|-----------------|-----------|
| Content moderation flags UI | Medium | Manual DB query + Slack alert | Q3 2025 |
| User ban / suspend workflow | High | Admin runs migration script | Q3 2025 |
| Broadcast notifications | Low | Email via SendGrid API directly | Q4 2025 |
| Rights dispute UI (full) | Medium | Read-only view + Jira ticket | Q3 2025 |
| Audit log viewer (full) | Low | Direct DB query | Q4 2025 |

---

## Pilot Risk Assessment

The gaps identified do not block pilot operations:
- Pilot partner count is small enough for manual moderation workflows
- No content from non-vetted users is accepted during pilot
- Admin team has direct DB access as fallback for all missing screens

---

*Reviewed by: Nzila product and platform team. Status: Gaps accepted for pilot; GA blockers tracked.*
