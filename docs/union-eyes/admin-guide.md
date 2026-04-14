# Admin Guide — UnionEyes

> Day-to-day administration for pilot administrators and operational leads.

## Getting Started

1. **Log in** with your admin credentials
2. **Configure structure** — add or verify employers, worksites, and related org data
3. **Invite representatives** — add stewards, chief stewards, officers, and admins
4. **Verify role routing**
   - Members should land in **Inbox**
   - Stewards and officers should land in **Priorities**
   - Pilot officers can access **Pilot Program** at `/dashboard/pilot`

For the detailed setup checklist, see [CUPE Quick Start](../pilot/cupe/CUPE_PILOTING_QUICK_START.md).

## Daily Checks

1. Review **Work** for new, converted, assigned, or aging casework
2. Review **Priorities** for urgent items and pending actions
3. Check whether member intakes are moving through review without backlog

## Weekly Checks

1. Review leadership and pilot metrics for workload, throughput, and follow-through
2. Check aging buckets and overdue items
3. Review assignment balance across stewards or LROs
4. Export reports when leadership needs a summary

## Pilot Monitoring

Pilot monitoring lives in the **Pilot Program** surface at `/dashboard/pilot`
for officer-level users and above.

This includes:

- Active-user and adoption trends
- Core workflow metrics tied to actual product usage
- Friction signals and milestone progress
- Setup and readiness visibility for pilot operations

## User Roles

| Role | Permissions |
|---|---|
| **Member** | Submit intakes, view their own updates, add notes where allowed, upload supporting material |
| **Steward** | Review intake activity, manage assigned work, add notes, advance casework |
| **Chief Steward** | All steward permissions plus assignment and broader operational oversight |
| **Officer** | All above plus pilot monitoring, reopen or oversee work, export evidence packs where supported |
| **Admin** | Full access including user management, configuration, and attachment governance |

For the full RBAC matrix, see [CUPE RBAC Matrix](../pilot/cupe/CUPE_RBAC_MATRIX.md).

## Common Issues

| Issue | Likely Cause | Fix |
|---|---|---|
| Intake or casework not appearing | User is in the wrong organization or role scope | Verify org membership and role assignment |
| User lands on the wrong screen | Role routing does not match the assigned role | Re-check the user's role and org context |
| Can't assign or convert work | Insufficient authority | Confirm the user has steward-level access or above |
| Attachment upload fails | File blocked or too large | Check allowed file types and size limits |
| Pilot metrics look wrong | Data is stale or pilot access is missing | Refresh and verify access to `/dashboard/pilot` |
| User can't log in | Invitation expired or auth problem | Re-send invite or verify auth configuration |

## Escalation Path

1. Steward to Chief Steward for local workflow issues
2. Chief Steward to Officer for policy or priority disputes
3. Officer to Admin for system access, configuration, or pilot-health issues
4. Admin to Platform Support for technical defects or platform incidents

## Emergency: Pause the Pilot

If a critical issue requires pausing:

1. Notify users through the union's normal communications channel
2. Follow the [Rollback Runbook](../pilot/cupe/CUPE_PILOT_ROLLBACK_RUNBOOK.md)
3. Export required operational data
4. Contact the platform support team

## Related Documents

- [Pilot Overview](./pilot-overview.md) — What the pilot includes
- [CUPE Admin Runbook](../pilot/cupe/CUPE_PILOT_ADMIN_RUNBOOK.md) — Detailed procedures
- [Support SOP](../pilot/cupe/CUPE_PILOT_SUPPORT_SOP.md) — Issue triage and escalation
