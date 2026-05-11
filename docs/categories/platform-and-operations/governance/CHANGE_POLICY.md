# Change Management Policy

> Defines the rules, roles, and processes for managing changes in Nzila OS.

## Scope

This policy applies to all deployments targeting **STAGING** and **PROD**
environments across all Nzila OS services.

## Change Types

### STANDARD

Pre-approved, low-risk changes that follow a well-known pattern (e.g.,
dependency bumps, config tweaks). No mandatory approvals. No PIR required.

### NORMAL

The default change type. Requires approval from `service_owner` and
`change_manager`. HIGH and CRITICAL risk levels additionally require
`security_approver` and a Change Advisory Board (CAB) review.

### EMERGENCY

Used for urgent production fixes. Reduced approval path — only
`service_owner` required. Must be followed by a **mandatory** Post
Implementation Review (PIR) within 5 business days.

## Approval Roles

| Role | Responsibility |
|---|---|
| `service_owner` | Technical owner of the affected service |
| `change_manager` | Change management process owner |
| `security_approver` | Security review for HIGH/CRITICAL changes |
| `platform_owner` | Platform-level override (optional) |

## Risk Levels

| Level | Criteria |
|---|---|
| LOW | No user-facing impact, easily reversible |
| MEDIUM | Limited user impact, standard rollback |
| HIGH | Significant user impact, complex rollback |
| CRITICAL | Service-wide impact, data risk, extended outage potential |

## Change Record Requirements

Every change record must include:

- Unique `change_id` (format: `CHG-YYYY-NNNN`)
- Description and impact summary
- Implementation window (start/end timestamps)
- Rollback plan
- Test evidence references
- Linked PRs and commit SHAs

## Freeze Periods

Calendar freeze periods are defined in `ops/change-management/calendar-policy.yml`.
No deployments to frozen environments are permitted during these windows unless
the change type is EMERGENCY.

## Post Implementation Review (PIR)

NORMAL and EMERGENCY changes **must** record a PIR before the change can be
moved to CLOSED status. The PIR captures:

- Outcome (SUCCESS / PARTIAL_SUCCESS / FAILED / ROLLED_BACK)
- Whether incidents were triggered
- Incident references (if any)
- Observations and lessons learned

## Enforcement

Change policy is enforced at two levels:

1. **CI/CD gating** — deploy workflows call `validateChangeWindow()` before
   any deployment to staging or production
2. **Governance audit** — all change lifecycle events are recorded in the
   platform governance timeline
