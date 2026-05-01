# Azure Monitoring Baseline — May 2026

Generated: 2026-05-01
Period: 2026-05
Scope: Production operations baseline for active staging/production runtime dependencies

## Resource Groups in Scope

- nzila-canada-staging-rg (Container Apps workload plane)
- nzila-staging-rg (data + observability dependencies)

## Container Apps Inventory

Source command: az containerapp list --resource-group nzila-canada-staging-rg --output table

Total apps discovered: 15

- nzila-os-web
- nzila-os-console
- nzila-os-partners
- nzila-os-union-eyes
- nzila-os-zonga
- nzila-os-control-plane
- nzila-os-platform-admin
- nzila-os-flow
- nzila-os-cfo
- nzila-os-agrimo
- nzila-os-cora
- nzila-os-trade
- nzila-os-mobility
- nzila-os-orchestrator-api
- nzila-os-abr

Default ingress domain for all apps: jollydune-88c1e97f.canadacentral.azurecontainerapps.io

## PostgreSQL Baseline

Source command: az postgres flexible-server show --name nzila-staging-db --resource-group nzila-staging-rg --query ...

- Name: nzila-staging-db
- State: Ready
- Location: Canada Central
- Engine Version: PostgreSQL 15
- SKU: Standard_B2s (Burstable)
- Availability Zone: 3
- Storage: 32 GB
- Backup Retention: 35 days
- Geo-redundant backup: Disabled

Assessment:
- Availability posture is acceptable for controlled operations with clear retention policy.
- Geo-redundant backup remains disabled; this is acceptable only if documented DR scope keeps recovery intra-region.

## Log Analytics Baseline

Source command: az monitor log-analytics workspace list --resource-group nzila-staging-rg --query ...

- Workspace: nzila-staging-logs
- Location: eastus
- SKU: PerGB2018
- Retention: 30 days
- Customer ID: 2e76802c-0e94-4241-8bf0-b50a0dcbc3ff

Assessment:
- Central workspace exists and is discoverable for monitoring integrations.
- Workspace region differs from primary app/data region (Canada Central); this is not a blocker but should be tracked for residency/cost governance.

## Baseline Conclusion

Monitoring baseline is operationally present:
- Runtime services deployed and reachable in ACA
- Primary database healthy and backup policy defined
- Log Analytics workspace present for centralized telemetry

No immediate blockers to gate integrity identified from monitoring baseline checks.
