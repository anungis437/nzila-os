# G2 Stage 1 Retry Deployment Failure

Mission: `NZ-20261008-INFRA-001`  
Gate: `G2_PRIVATE_CONTROL_PLANE`  
Deployment: `g2-stage1-retry-20261010-1627`  
Disposition: `STAGE1_DISCOVERY_FAILED`  

## Result

The single previously authorized Stage 1 retry was submitted after provider
validation, final structured what-if, exact Create-set comparison, retained-state
review, and source/template hash checks passed. ARM returned `Failed` with
correlation ID `091c3906-e372-4a10-8f8d-974f63551cf4`.

Two resource creates failed:

1. **Builder VM** — `InvalidParameter`, target `linuxConfiguration`:
   “Authentication using either SSH or by user name and password must be enabled
   in Linux profile.” The reviewed Bicep disables password authentication while
   providing an empty SSH public-key list.
2. **Azure Firewall Basic** — `BasicSkuFirewallMissingManagementIpConfiguration`:
   “Firewall with Basic SKU must have Management Ip configuration.” The source
   declares a data-plane IP configuration but no management IP configuration.

These runtime constraints were not caught by Bicep build, Bicep lint, provider
validation, or the successful what-if.

## Partial Azure state

Azure reports 17 nested deployment operations succeeded and 2 failed. The
current proof resource group contains 12 resources: the six retained baseline
resources plus the Stage 1 NSG, VNet, builder NIC, private endpoint, its managed
NIC, and the private DNS VNet link. The VM and firewall do not exist. The
Stage 1 NSG is not a throwaway diagnostic canary.

Post-failure reads confirmed the retained ACR security settings, Public IP
properties, and both repository-conditioned role assignments still have their
intended effective values. No resource was deleted or modified after the failure.

## Gate and actions

- Stage 1: `STAGE1_DISCOVERY_FAILED`.
- No VM/cloud-init ran; no boot/serial or runtime discovery evidence exists.
- No ACR token exchange or image push was attempted.
- The one authorized retry is consumed. No second deployment or cleanup was
  performed or is authorized by this record.
- Preserve the partial estate. A corrected VM authentication contract and
  Azure Firewall Basic management-IP configuration require a new reviewed
  source/template authority and fresh deployment authorization.

Machine-readable operation IDs, tracking IDs, exact provider messages,
partial-resource IDs, and post-failure retained-state checks are in
[G2_STAGE1_RETRY_DEPLOYMENT_FAILURE_20261010.json](./G2_STAGE1_RETRY_DEPLOYMENT_FAILURE_20261010.json).
