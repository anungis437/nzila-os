# Tenant Offboarding Runbook

| Field   | Value                |
|---------|----------------------|
| Status  | `DRAFT`              |
| Created | 2026-04-20           |
| Owner   | _TBD_                |

## Overview

Procedure for offboarding an organization (tenant) from the Nzila platform, including data export, access revocation, and resource cleanup.

## Pre-Offboarding Checklist

- [ ] Written offboarding request received from authorized org contact
- [ ] Confirm contract/billing end date
- [ ] Notify internal stakeholders (support, finance, legal)
- [ ] Schedule offboarding window with tenant
- [ ] Identify all users belonging to the organization

## Data Export

1. Generate data export for the organization:
   - All org-owned records (members, contributions, cases, documents)
   - Evidence/compliance artifacts from blob storage
   - Audit logs for the retention period
2. Package export as encrypted archive
3. Deliver to authorized org contact via secure channel
4. Obtain written confirmation of receipt

## Access Revocation

1. Disable all user accounts for the organization in `auth_users`
2. Invalidate active sessions in `auth_user_sessions`
3. Remove Entra AD group membership (if SSO was configured)
4. Revoke any API keys or service credentials
5. Remove org from any shared resources or integrations

## Resource Cleanup

1. Soft-delete organization record (retain for audit period)
2. Remove org-specific blob storage containers after retention period
3. Archive org data in cold storage if required by policy
4. Remove org-specific configuration or feature flags
5. Update tenant count in monitoring dashboards

## Audit Trail

- Log every offboarding action with timestamp, actor, and org_id
- Retain audit records per data retention policy (minimum _TBD_ months)
- Store offboarding confirmation document in `evidence/offboarding/`

## Related Docs

- [Incident Response Runbook](./incident-response.md)
- [Compliance Evidence Map](../../compliance/Required-Evidence-Map.md)
- [Security Operations](../../security-operations/README.md)
