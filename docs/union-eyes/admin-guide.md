# Admin Guide — Union Eyes

> Day-to-day administration for pilot administrators.

## Getting Started

1. **Log in** with your admin credentials
2. **Configure worksites** — Admin → Employers/Worksites → add workplace names and employers
3. **Invite stewards** — Admin → Users → enter email → select "Steward" role → Send
4. **Verify** — Ask the steward to log in and confirm they see the Dashboard

For the detailed setup checklist, see [CUPE Quick Start](../pilot/cupe/CUPE_PILOTING_QUICK_START.md).

## Daily Checks

1. Review the **Workbench** for new and unassigned cases
2. Check the **Overdue** queue — follow up on cases past SLA threshold
3. Monitor **Urgent** queue — prioritize critical/high-priority cases

## Weekly Checks

1. Review the **Leadership Dashboard** KPI cards (open, new, overdue counts)
2. Check **aging buckets** — are cases piling up in 15–30 or 30+ day ranges?
3. Review **by-assignee table** — is workload distributed evenly?
4. Export a report (Dashboard → Export → CSV) and share with leadership

## Pilot Monitoring

As a pilot admin, you have access to the **Pilot Admin Dashboard** at
`/admin/pilot`. This shows:

- Active user counts and adoption trends
- Case creation velocity and friction signals
- Conversion readiness score
- Champion users (high-engagement advocates)

## User Roles

| Role | Permissions |
|---|---|
| **Member** | Create cases, view own cases, add notes, upload attachments |
| **Steward** | All member + transition status, internal notes, view assigned cases |
| **Chief Steward** | All steward + assign cases, close resolved cases |
| **Officer** | All above + reopen cases, export evidence packs |
| **Admin** | Full access including user management and attachment deletion |

For the full RBAC matrix, see [CUPE RBAC Matrix](../pilot/cupe/CUPE_RBAC_MATRIX.md).

## Common Issues

| Issue | Likely Cause | Fix |
|---|---|---|
| Cases not appearing | User in wrong org | Verify org membership in Azure AD |
| Can't assign case | Insufficient role | Only chief_steward+ can assign |
| Attachment upload fails | File blocked or too large | Check allowed types, max 10 MB |
| Dashboard shows wrong counts | Stale cache | Refresh page; cache refreshes every 5 min |
| User can't log in | Invitation expired | Re-send invitation from Admin → Users |

## Escalation Path

1. Steward → Chief Steward (local issues)
2. Chief Steward → Officer (policy or priority disputes)
3. Officer → Admin (system access, configuration)
4. Admin → Platform Support (technical issues, bugs)

## Emergency: Pause the Pilot

If a critical issue requires pausing:

1. Notify all users via email
2. Follow the [Rollback Runbook](../pilot/cupe/CUPE_PILOT_ROLLBACK_RUNBOOK.md) to freeze new cases
3. Export all case data
4. Contact the platform support team

## Related Documents

- [Pilot Overview](./pilot-overview.md) — What the pilot includes
- [CUPE Admin Runbook](../pilot/cupe/CUPE_PILOT_ADMIN_RUNBOOK.md) — Detailed procedures
- [Support SOP](../pilot/cupe/CUPE_PILOT_SUPPORT_SOP.md) — Issue triage and escalation
