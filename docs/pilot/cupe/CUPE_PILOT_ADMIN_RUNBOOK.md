# CUPE Pilot Admin Runbook

> Operational guide for pilot administrators running Union-Eyes.
>
> **See also:** [Admin Guide](../../union-eyes/admin-guide.md) · [Pilot Overview](../../union-eyes/pilot-overview.md)

## Daily Checks

1. **Log in** and review **Work** and **Priorities**
2. **New intake / unassigned work**: Review newly submitted intakes and assign official casework where needed
3. **Overdue queue**: Follow up on cases past SLA threshold
4. **Urgent queue**: Prioritise critical and high-priority matters

## Weekly Checks

1. **Leadership Dashboard**: Review KPI cards (open, new, overdue counts)
2. **Aging buckets**: Are cases piling up in 15–30 or 30+ day buckets?
3. **By assignee table**: Is workload distributed evenly?
4. **Export report**: Dashboard → Export → CSV — share with leadership

## Common Troubleshooting

| Issue | Likely Cause | Fix |
|-------|-------------|-----|
| Intake or casework not appearing | User in wrong org or RLS filtering | Verify org membership and role assignment |
| Can't assign case | User role too low | Only chief_steward+ can assign |
| Attachment upload fails | File type blocked or size exceeded | Check allowed types (PDF, DOCX, etc.), max 10 MB |
| Dashboard shows wrong counts | Stale cache | Refresh page; metrics cache refreshes every 5 minutes |
| User can't log in | Invitation expired or auth misconfiguration | Re-send invitation from Admin → Users and verify platform auth setup |

## Escalation Path

1. Steward → Chief Steward (local issues)
2. Chief Steward → Officer (policy or priority disputes)
3. Officer → Admin (system access, configuration)
4. Admin → Platform Support (technical issues, bugs)

## Emergency: Pause Pilot

If a critical issue requires pausing the pilot:

1. Notify all users via email
2. See CUPE_PILOT_ROLLBACK_RUNBOOK.md for steps to freeze new intake and casework creation
3. Export all case data for safe keeping
4. Contact platform support team
