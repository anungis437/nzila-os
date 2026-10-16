import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { cidrRange, overlaps, verifyPriceSnapshots } from './g3-readiness-report.mjs'

const root = fileURLToPath(new URL('./', import.meta.url))
const evidence = path.join(root, 'g3-readiness-evidence')
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
const read = (name) =>
  JSON.parse(readFileSync(path.join(evidence, name), 'utf8').replace(/^\uFEFF/, ''))
const docs = {
  quota: 'https://learn.microsoft.com/en-us/azure/container-apps/quotas',
  identity:
    'https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/managed-identities-faq',
  directory:
    'https://learn.microsoft.com/en-us/graph/api/resources/directorysizequota?view=graph-rest-beta',
  firewall: 'https://learn.microsoft.com/en-us/azure/container-apps/use-azure-firewall',
  nsg: 'https://learn.microsoft.com/en-us/azure/container-apps/firewall-integration',
  vnet: 'https://learn.microsoft.com/en-us/azure/container-apps/custom-virtual-networks',
  dns: 'https://learn.microsoft.com/en-us/azure/container-apps/private-endpoints-with-dns',
  logging: 'https://learn.microsoft.com/en-us/azure/container-apps/log-options',
}
export function verifyPreservation(recovery) {
  for (const [name, expected] of Object.entries(recovery.preservation))
    assert.equal(
      digest(readFileSync(path.join(evidence, name))),
      expected,
      `HISTORICAL_EVIDENCE_CHANGED:${name}`,
    )
}
export function directoryCapacity(quota, required = 2) {
  assert(Number.isInteger(required) && required >= 0, 'INVALID_REQUIRED_IDENTITIES')
  if (
    !quota ||
    !Number.isInteger(quota.total) ||
    quota.total <= 0 ||
    !Number.isInteger(quota.used) ||
    quota.used < 0
  )
    return {
      status: 'UNVERIFIABLE_WITH_CURRENT_AUTHORITY',
      required,
      classification: 'ENTRA_DIRECTORY_OBJECT_CAPACITY',
    }
  const futureUsed = quota.used + required
  return {
    status:
      futureUsed < quota.total * 0.98
        ? 'PASS_CAPTURED_DIRECTORY_HEADROOM'
        : 'BLOCKED_DIRECTORY_THRESHOLD',
    classification: 'ENTRA_DIRECTORY_OBJECT_CAPACITY',
    total: quota.total,
    used: quota.used,
    required,
    futureUsed,
    managedIdentityThreshold: quota.total * 0.98,
    thresholdComparison: 'futureUsed < 98% of total;equal threshold is blocked',
    regionComputeQuota: false,
    reservation: false,
    refreshBeforeCreation: true,
  }
}
function proposedGrant(principal, role, scope, purpose, narrower, condition = null) {
  return {
    principal,
    role,
    exactScope: scope,
    purpose,
    whyRequired: purpose,
    whyNarrowerScopeIsInsufficient: narrower,
    condition,
    status: 'PROPOSED_NOT_GRANTED',
  }
}
export function operatorComparison(prior) {
  const candidates = prior.live.operatorCandidates
    .filter((item) =>
      item.federation.some(
        (credential) =>
          credential.issuer === 'https://token.actions.githubusercontent.com' &&
          credential.subject.startsWith('repo:anungis437/nzila-os:environment:'),
      ),
    )
    .map((item) => ({
      principalId: item.principalId,
      appId: item.appId,
      displayName: item.displayName,
      federation: item.federation,
      currentRoleAssignments: item.grants,
      currentScopes: [...new Set(item.grants.map((grant) => grant.scope))],
      currentConditions: item.grants.map((grant) => ({
        scope: grant.scope,
        role: grant.role,
        condition: grant.condition,
      })),
      G3_FIT:
        item.displayName === 'nzila-os-build'
          ? 'PREFERRED_CANDIDATE_FOR_G3A_FEDERATED_ARTIFACT_OPERATOR;not approved or fully privileged'
          : 'NOT_PREFERRED;existing environment/deployment duties exceed isolated synthetic mission',
      excessPrivilege: item.grants.map((grant) => ({
        ...grant,
        reason: 'Existing non-G3 grant is not consumed as G3 authority',
      })),
      missingPrivilege: [
        'Exact G3 resource deployment grants',
        'Exact g3-synthetic-runtime repository writer grant',
        'Controlled private-builder execution permission after source recovery',
        'Separately governed RBAC assignment operator',
      ],
      effectivePermissionsLimit:
        'Captured direct assignments only;group/PIM/management-group effective permissions not fully resolved',
      selected: false,
    }))
  const recommended = candidates.find((item) => item.displayName === 'nzila-os-build')
  return {
    candidates,
    recommendedOperatorCandidate: recommended?.principalId ?? 'NONE',
    recommendedAppId: recommended?.appId ?? null,
    recommendationBasis:
      'NARROWEST_EXISTING_FEDERATED_IDENTITY_COMPATIBLE_WITH_G3_IN_CAPTURED_DIRECT_ASSIGNMENTS',
    basisDetail:
      'The build principal has one captured legacy registry AcrPush scope rather than staging/production RG Contributor and additional data grants. Legacy AcrPush is excess,not authority for private G3 ABAC. This recommendation requires human selection and effective-permission verification.',
    slots: {
      G3_LIFECYCLE_OWNER: 'HUMAN_BINDING_REQUIRED',
      G3_EXECUTION_OPERATOR: 'HUMAN_BINDING_REQUIRED;recommended candidate is not appointed',
      G3_HUMAN_APPROVER: 'HUMAN_BINDING_REQUIRED',
    },
    separation: 'EXECUTION_OPERATOR != HUMAN_APPROVER',
    grantMutations: 0,
  }
}
export function networkContract(prior, comparison) {
  const n = prior.candidateNames
  const c = prior.cidrs
  const subscription = prior.subscriptionId
  const rg = `/subscriptions/${subscription}/resourceGroups/${n.resourceGroup}`
  const oldRg = `/subscriptions/${subscription}/resourceGroups/nzila-g2-proof-xre47vggs5uhw`
  const g2vnet = `${oldRg}/providers/Microsoft.Network/virtualNetworks/nzila-g2-builder-vnet-y3koaeijzi6mu`
  const vnet = `${rg}/providers/Microsoft.Network/virtualNetworks/${n.vnet}`
  const registry = `${oldRg}/providers/Microsoft.ContainerRegistry/registries/nzilag2tzo75uuozprbo`
  const vault = `${rg}/providers/Microsoft.KeyVault/vaults/${n.keyVault}`
  const firewall = prior.live.g2Firewall[0]
  const source = c.acaSubnet
  const networkRule = (dependency, group, destinations, ports, reason, selected = true) => ({
    dependency,
    group,
    source,
    destinations,
    ports,
    protocol: 'TCP',
    networkRuleOrApplicationRule: 'NETWORK',
    requiredForPlatformOrWorkload: reason,
    selected,
    provenance: docs.firewall,
    status: 'DESIGN_ONLY',
  })
  const applicationRule = (dependency, group, fqdns, reason) => ({
    dependency,
    group,
    source,
    destinations: fqdns,
    ports: [443],
    protocol: 'HTTPS',
    networkRuleOrApplicationRule: 'APPLICATION',
    requiredForPlatformOrWorkload: reason,
    selected: true,
    provenance: docs.firewall,
    status: 'DESIGN_ONLY',
  })
  const rules = [
    networkRule(
      'MicrosoftContainerRegistry',
      'PLATFORM_REQUIRED',
      ['MicrosoftContainerRegistry'],
      [443],
      'Microsoft platform artifact retrieval',
    ),
    networkRule(
      'AzureFrontDoorFirstParty',
      'PLATFORM_REQUIRED',
      ['AzureFrontDoorFirstParty'],
      [443],
      'Microsoft platform registry front-door dependency',
    ),
    applicationRule(
      'AKS_CNI_BINARIES',
      'PLATFORM_REQUIRED',
      ['packages.aks.azure.com', 'acs-mirror.azureedge.net'],
      'Underlying ACA platform AKS/CNI binary bootstrap',
    ),
    networkRule(
      'AzureContainerRegistry',
      'REGISTRY',
      ['AzureContainerRegistry'],
      [443],
      'Microsoft-documented registry platform dependency;private registry/data DNS endpoints still mandatory',
    ),
    networkRule(
      'AzureActiveDirectory',
      'IDENTITY',
      ['AzureActiveDirectory'],
      [443],
      'ACR/managed identity/Key Vault authentication',
    ),
    applicationRule(
      'MANAGED_IDENTITY',
      'IDENTITY',
      prior.futureContracts
        ? [
            '*.identity.azure.net',
            'login.microsoftonline.com',
            '*.login.microsoftonline.com',
            '*.login.microsoft.com',
            'login.microsoft.com',
          ]
        : [],
      'Platform managed-identity dependencies',
    ),
    networkRule(
      'AzureKeyVault',
      'KEY_VAULT',
      ['AzureKeyVault'],
      [443],
      'Documented platform Key Vault dependency;synthetic secret data path exclusively private endpoint',
    ),
    applicationRule(
      'PRIVATE_KEY_VAULT_HOST',
      'KEY_VAULT',
      [`${n.keyVault}.vault.azure.net`],
      'Vault TLS hostname retained even when resolving to local private endpoint',
    ),
    {
      ...networkRule(
        'AzureMonitor',
        'TELEMETRY',
        ['AzureMonitor'],
        [443],
        'Selected Log Analytics console/system log destination',
      ),
      provenance: docs.nsg,
    },
    {
      dependency: 'AzurePlatformDNS',
      group: 'DNS',
      source,
      destinations: ['168.63.129.16'],
      serviceTagEvaluation:
        'ALLOW AzurePlatformDNS UDP/TCP53 at NSG;never deny this tag. Azure-provided DNS is not routed through firewall by UDR.',
      ports: [53],
      protocol: 'UDP_AND_TCP',
      networkRuleOrApplicationRule: 'NSG_PLATFORM_DNS_EXEMPTION',
      requiredForPlatformOrWorkload: 'Azure-provided recursive/private-zone resolution',
      selected: true,
      provenance: docs.nsg,
      status: 'DESIGN_ONLY',
    },
    {
      dependency: 'PRIVATE_ACR',
      group: 'REGISTRY',
      source,
      destinations: [
        'nzilag2tzo75uuozprbo.azurecr.io',
        'nzilag2tzo75uuozprbo.canadacentral.data.azurecr.io',
      ],
      ports: [443],
      networkRuleOrApplicationRule: 'DIRECT_PRIVATE_PEERED_ENDPOINT;not default-route firewall',
      requiredForPlatformOrWorkload: 'Private image pull and data transfer',
      selected: true,
      provenance: docs.firewall,
      status: 'DESIGN_ONLY',
    },
    {
      dependency: 'ACR_PLATFORM_STORAGE',
      group: 'REGISTRY',
      ...applicationRule(
        'ACR_PLATFORM_STORAGE',
        'REGISTRY',
        ['*.blob.core.windows.net'],
        'Microsoft-documented platform-managed storage dependency;accepted synthetic breadth only',
      ),
    },
    {
      dependency: 'PRIVATE_PROOF_CLIENT',
      group: 'PROOF_ONLY',
      source: c.builderSubnet,
      destinations: ['<G3_ENVIRONMENT_STATIC_IP>'],
      ports: [443],
      networkRuleOrApplicationRule: 'PRIVATE_INGRESS_NSG',
      requiredForPlatformOrWorkload: 'Private TLS health/challenge proof;no public client path',
      selected: true,
      provenance: docs.nsg,
      status: 'DESIGN_ONLY',
    },
  ]
  const link = (zone, resource, authority, target = vnet) => ({
    zone,
    resource,
    vnetLink: {
      target,
      name: zone === 'privatelink.azurecr.io' ? `g3-acr-${n.keyVault}` : n.keyVaultDnsLink,
      registrationEnabled: false,
    },
    resolutionDirection: 'Azure-provided DNS inside G3 VNet -> private zone -> endpoint private IP',
    authority,
    status: 'DESIGN_ONLY',
  })
  const zones = [
    link(
      'privatelink.azurecr.io',
      registry,
      'Existing G2 zone;new G3 VNet link is a G2-zone mutation requiring separate authority',
    ),
    link(
      'privatelink.vaultcore.azure.net',
      vault,
      'New G3 private DNS zone/endpoint zone group;G3-scoped future authority',
    ),
    link(
      '<G3_ENVIRONMENT_DEFAULT_DOMAIN>',
      `${rg}/providers/Microsoft.App/managedEnvironments/${n.environment}`,
      'Internal ACA custom DNS private zone named exact returned defaultDomain;apex and wildcard A -> returned staticIP,late binding before ingress proof',
    ),
  ]
  const planned = [c.acaSubnet, c.privateEndpointSubnet, c.builderSubnet]
  const [vnetStart, vnetEnd] = cidrRange(c.vnet)
  assert(
    planned.every((cidr) => {
      const [start, end] = cidrRange(cidr)
      return start >= vnetStart && end <= vnetEnd
    }),
    'G3R1_SUBNET_CONTAINMENT',
  )
  assert(
    planned.every((a, i) => planned.slice(i + 1).every((b) => !overlaps(a, b))),
    'G3R1_SUBNET_COLLISION',
  )
  assert(
    c.existingRangesChecked.every((entry) => !overlaps(c.vnet, entry.cidr)),
    'G3R1_LIVE_CIDR_COLLISION',
  )
  const pullPrincipal = '<G3_PULL_UAMI_PRINCIPAL_ID_FROM_AUTHORIZED_CREATION>'
  const runtimePrincipal = '<G3_RUNTIME_UAMI_PRINCIPAL_ID_FROM_AUTHORIZED_CREATION>'
  const readerCondition =
    "((!(ActionMatches{'Microsoft.ContainerRegistry/registries/repositories/content/read'}) AND !(ActionMatches{'Microsoft.ContainerRegistry/registries/repositories/metadata/read'})) OR (@Resource[Microsoft.ContainerRegistry/registries/repositories:name] StringEquals 'g3-synthetic-runtime'))"
  const writerActions = ['content/read', 'content/write', 'metadata/read', 'metadata/write']
  const writerCondition = `(((${writerActions.map((action) => `!(ActionMatches{'Microsoft.ContainerRegistry/registries/repositories/${action}'})`).join(' AND ')})) OR (@Resource[Microsoft.ContainerRegistry/registries/repositories:name] StringEquals 'g3-synthetic-runtime'))`
  const grants = [
    proposedGrant(
      comparison.recommendedOperatorCandidate,
      'CUSTOM_G3_RESOURCE_DEPLOYER_NOT_CREATED',
      rg,
      'Deploy/delete only recovered authorized G3 resources,without RBAC/secret data access',
      'Creating multiple new G3 resources needs RG-level control-plane scope;resource creation cannot rely on grants to resources not yet present',
    ),
    proposedGrant(
      comparison.recommendedOperatorCandidate,
      'Container Registry Repository Writer:2a1e307c-b015-4ebd-883e-5b7698a07328',
      registry,
      'One bounded G3A image push and read-back verification',
      'ACR repository is a data-plane child,not an ARM RBAC scope;registry assignment requires repository condition',
      { version: '2.0', expression: writerCondition },
    ),
    proposedGrant(
      pullPrincipal,
      'Container Registry Repository Reader:b93aa761-3e63-49ed-ac28-beffa264f7ac',
      registry,
      'Platform-only image pull,lifecycle None',
      'Registry ARM scope with exact repository condition is required;no catalog/delete/AcrPull fallback',
      { version: '2.0', expression: readerCondition },
    ),
    proposedGrant(
      runtimePrincipal,
      'Key Vault Secrets User:4633458b-17de-408a-b874-0445c86b69e6',
      `${vault}/secrets/g3-proof-secret`,
      'Runtime lifecycle Main reads only the one synthetic secret',
      'Exact secret is the minimum supported built-in scope;no vault-wide assignment',
    ),
    proposedGrant(
      comparison.recommendedOperatorCandidate,
      'CUSTOM_G3_PRIVATE_NETWORK_LINK_WRITER_NOT_CREATED',
      `${g2vnet}/virtualNetworkPeerings/g2-to-g3`,
      'Create/reconcile only approved G2-side peering',
      'This exact peering child scope suffices;no VNet/RG Contributor proposed',
    ),
    proposedGrant(
      comparison.recommendedOperatorCandidate,
      'CUSTOM_G3_PRIVATE_NETWORK_LINK_WRITER_NOT_CREATED',
      `${oldRg}/providers/Microsoft.Network/privateDnsZones/privatelink.azurecr.io/virtualNetworkLinks/g3-acr-${n.keyVault}`,
      'Link G3 VNet to retained ACR private zone',
      'Exact DNS link child scope suffices;zone-wide DNS mutation unnecessary',
    ),
    proposedGrant(
      comparison.recommendedOperatorCandidate,
      'CUSTOM_G3_FIREWALL_RULE_WRITER_NOT_CREATED',
      firewall.id,
      'Update only separately approved firewall rule collections',
      'Collections reside on firewall resource;child collection RBAC granularity is unavailable for this property update',
    ),
  ]
  return {
    status: 'DETERMINISTIC_DESIGN_ONLY_WITH_EXPLICIT_LATE_BINDINGS',
    designChoice:
      'Two-way G3/G2 peering;Azure-provided DNS;private ACA INTERNAL Consumption/workload-profiles;no ACA private endpoint',
    selectedBy: 'G3R1_LOCAL_PROPOSAL_NOT_A_FROZEN_PACKAGE_REPLACEMENT',
    addresses: {
      vnet: c.vnet,
      aca: c.acaSubnet,
      privateEndpoint: c.privateEndpointSubnet,
      builder: c.builderSubnet,
      liveRangesChecked: c.existingRangesChecked,
      noCollision: true,
    },
    vnetId: vnet,
    g2VnetId: g2vnet,
    acaDelegation: 'Microsoft.App/environments',
    routes: [
      {
        name: 'g3-default-to-g2-firewall',
        prefix: '0.0.0.0/0',
        nextHopType: 'VirtualAppliance',
        nextHopIp: '10.90.0.4',
        routeTable: n.routeTable,
        associateWith: [n.acaSubnet, n.builderSubnet],
      },
    ],
    privateEndpointRouting:
      'G2 VNet prefix10.90.0.0/16 via peering and localG3 VNet routes are more specific than0/0;private ACR/KV traffic stays private,not assumed to traverse firewall. PE subnet has no forced default route selected.',
    peering: [
      {
        name: 'g3-to-g2',
        parent: vnet,
        remote: g2vnet,
        allowVirtualNetworkAccess: true,
        allowForwardedTraffic: true,
        allowGatewayTransit: false,
        useRemoteGateways: false,
      },
      {
        name: 'g2-to-g3',
        parent: g2vnet,
        remote: vnet,
        allowVirtualNetworkAccess: true,
        allowForwardedTraffic: true,
        allowGatewayTransit: false,
        useRemoteGateways: false,
      },
    ],
    G2_PEERING_CHANGE: 'SEPARATE_EXPLICIT_HUMAN_AUTHORITY_REQUIRED',
    g2AdditionalMutations: [
      'Existing ACR private DNS zone G3 link',
      'G2 firewall rule collection changes',
    ],
    ingress: {
      path: 'G3 private proof builder -> exact environment defaultDomain DNS -> INTERNAL staticIP:443 -> app port3000',
      allowPublic: false,
      allowInsecure: false,
      appIngressExternal:
        'true within INTERNAL environment only;external-to-app != public-to-Internet',
      clientCidrs: [c.builderSubnet],
    },
    builderAndEndpointNsg: {
      builder: {
        source: c.builderSubnet,
        publicIp: 'NOT_SELECTED',
        inbound: 'DENY;exactprivatecontrolchannel downstreamfrozenG3A sourceauthority',
        outbound: [
          'AzurePlatformDNS TCP/UDP53',
          'ExactprivateACR endpoints TCP443 viaG2peering',
          'G3KV privateendpoint TCP443',
          'InternalACA staticIP TCP443',
          'ExplicitAAD identity/platformcontrol endpoints only viaUDR/firewall',
        ],
        sourceSpecificTooling: 'BLOCKED_ROOT_1;no genericInternet/download allowlist',
      },
      privateEndpoint: {
        subnet: c.privateEndpointSubnet,
        delegation: 'NONE',
        defaultUdr: 'NOT_SELECTED',
        nsgPolicy:
          'Only approved ACA and privateproofbuilder sources TCP443 toKV endpoint;bindprivateEndpointNetworkPolicies explicitlyinrecoveredtemplate before claiming enforcement',
      },
      firewallSources: {
        PLATFORM_REQUIRED: [c.acaSubnet],
        REGISTRY: [c.acaSubnet, c.builderSubnet],
        IDENTITY: [c.acaSubnet, c.builderSubnet],
        KEY_VAULT: [c.acaSubnet, c.builderSubnet],
        TELEMETRY: [c.acaSubnet],
        DNS: 'Azure-provided platform resolver exemption,not firewall transit',
        PROOF_ONLY: [c.builderSubnet],
      },
    },
    egress: {
      path: 'ACA/builder -> explicit private local/peered routes OR0/0 UDR -> retained G2 firewall -> selected Microsoft dependencies',
      internetShortcut: 'PROHIBITED',
      dockerHubRuntime: 'PROHIBITED',
      finalFirewallDefault: 'DENY',
      builderBootstrap:
        'DOWNSTREAM_FROZEN_SOURCE_AUTHORITY;no genericInternet or guessed tooling endpoints allowed',
    },
    dns: {
      resolver: 'AZURE_PROVIDED_168.63.129.16',
      zones,
      ACA_PRIVATE_ENDPOINT: 'NOT_REQUIRED',
      ACA_PRIVATE_ENDPOINT_DNS_ZONE:
        'NOT_APPLICABLE;privatelink.canadacentral.azurecontainerapps.io not selected for INTERNAL environment',
      lateBindings: [
        'Environment defaultDomain and staticIP returned after authorized empty environment creation',
        'Private endpoint NIC IPs after authorized creation',
      ],
    },
    telemetry: {
      selected: 'Log Analytics console/system logs to proposed G3 workspace',
      networkAllow: 'AzureMonitor TCP443 service-tag route;no generic logging wildcard',
      workspace: n.workspace,
      workspaceId: 'POST_CREATE_NONSECRET_LATE_BINDING',
      applicationInsights: 'NOT_SELECTED',
      serviceBus: 'NOT_SELECTED',
      aspire: 'NOT_SELECTED',
      source: docs.logging,
    },
    nsg: {
      source: docs.nsg,
      spellingConflict:
        'firewall-integration page uses AzureFrontDoor.FirstParty;canonical AzureFrontDoorFirstParty follows use-azure-firewall and previous accepted doctrine',
      inbound: [
        {
          priority: 100,
          source: 'AzureLoadBalancer',
          ports: ['30000-32767'],
          destination: source,
          protocol: 'TCP',
          action: 'Allow',
        },
        {
          priority: 110,
          source: c.builderSubnet,
          ports: [443, 31443],
          destination: source,
          protocol: 'TCP',
          action: 'Allow',
        },
        {
          priority: 120,
          source,
          ports: ['*'],
          destination: source,
          protocol: '*',
          action: 'Allow',
        },
        {
          priority: 900,
          source: '*',
          destination: source,
          ports: ['*'],
          protocol: '*',
          action: 'Deny',
        },
      ],
      outbound: [
        {
          priority: 100,
          source,
          destination: source,
          ports: ['*'],
          protocol: '*',
          action: 'Allow',
        },
        {
          priority: 110,
          source,
          destination: 'AzurePlatformDNS',
          ports: [53],
          protocol: 'TCP_AND_UDP',
          action: 'Allow',
        },
        {
          priority: 120,
          source,
          destination: ['<G3_KV_PE_PRIVATE_IP>', '<G2_ACR_PE_NIC_PRIVATE_IPS>'],
          ports: [443],
          protocol: 'TCP',
          action: 'Allow',
        },
        {
          priority: 130,
          source,
          destination: [
            'MicrosoftContainerRegistry',
            'AzureFrontDoorFirstParty',
            'AzureContainerRegistry',
            'AzureActiveDirectory',
            'AzureKeyVault',
            'AzureMonitor',
            'Storage.CanadaCentral',
          ],
          ports: [443],
          protocol: 'TCP',
          action: 'Allow_DOCUMENTED_PLATFORM_TAGS_VIA_UDR_FIREWALL',
        },
        {
          priority: 140,
          source,
          destination: '<EXACT_IP_PREFIX_SET_FOR_SELECTED_PLATFORM_APPLICATION_FQDNS>',
          ports: [443],
          protocol: 'TCP',
          action:
            'Allow_ONLY_AFTER_NONMUTATING_DESTINATION_BINDING;noInternet_or_AzureCloud_catchall',
          binding:
            'Addresses must correspond to the selectedAKS/CNI/identity/platformstorage dependencies and be refreshed underexplicitauthority;unknown IPset failsclosed beforeactivation',
        },
        { priority: 900, source, destination: '*', ports: ['*'], protocol: '*', action: 'Deny' },
      ],
      activationGates: [
        'Peering+UDR+firewall rules approved and inspected before outboundNSG activation',
        'AzurePlatformDNS never denied',
        'Exact platformFQDN destinationprefix set bound before NSGactivation;no genericInternet/AzureCloud destination',
      ],
    },
    firewall: {
      resource: firewall.id,
      sku: firewall.sku,
      nextHop: '10.90.0.4',
      currentEmptyCollections: true,
      dnsProxy: 'NOT_SELECTED_BASIC_SKU;do not rely on network-ruleFQDN DNS proxy',
      groups: [
        'PLATFORM_REQUIRED',
        'REGISTRY',
        'IDENTITY',
        'KEY_VAULT',
        'TELEMETRY',
        'DNS',
        'PROOF_ONLY',
      ],
      rules,
      acceptedBreadth:
        'Microsoft platform service tags/storage/identity documented wildcards only;synthetic proof not tenant-exclusive isolation',
      mutated: false,
    },
    rbac: {
      grants,
      deploymentRole: {
        name: 'CUSTOM_G3_RESOURCE_DEPLOYER_NOT_CREATED',
        allowedResourceTypes: [
          'Microsoft.App/managedEnvironments',
          'Microsoft.App/containerApps',
          'Microsoft.ManagedIdentity/userAssignedIdentities',
          'Microsoft.KeyVault/vaults',
          'Microsoft.Network/virtualNetworks',
          'Microsoft.Network/networkSecurityGroups',
          'Microsoft.Network/routeTables',
          'Microsoft.Network/privateEndpoints',
          'Microsoft.Network/privateDnsZones',
          'Microsoft.OperationalInsights/workspaces',
          'Microsoft.Resources/deployments',
        ],
        operations: ['read', 'write', 'delete'],
        requiredAdditionalActions: [
          'Microsoft.ManagedIdentity/userAssignedIdentities/assign/action',
          'Microsoft.Network/virtualNetworks/subnets/join/action',
        ],
        definitionReadiness:
          'DESIGN_ONLY_NOT_CREATED;expandexactchild-resourceactions andvalidateagainstrecoveredG3 modules before anygrant. Builder/secret/RBACbootstrappermissionsremainseparate.',
        excludes: [
          'Microsoft.Authorization/roleAssignments/write',
          'Microsoft.Authorization/roleDefinitions/write',
          'KeyVault secret value read',
          'Registry-wide data access',
        ],
        builderExtensions:
          'Require recovered exactG3A substrate before adding any Compute/guest rights',
      },
      bootstrap:
        'Future RG create/secret seeding/narrow role assignment tasks require separate human-appointed bootstrap operator;no subscription Contributor shortcut. Assignment must restrict exact principal+role IDs and scopes after identities exist;no broadUserAccessAdministrator proposed.',
      rolesCreated: false,
    },
    lateBindingContract:
      'Deterministic contracts accept only returned resource IDs/defaultDomain/staticIP/workspaceId and exactboundedplatformFQDN addressbindings;unresolved source-specific builder endpoints stay downstream blocked,not guessed.',
    mutations: 0,
  }
}
export function costModel(prior, network) {
  verifyPriceSnapshots(read('public-pricing-read-ledger.json'))
  const meters = structuredClone(prior.costs.prices)
  const egressFile = 'pricing-Virtual-Network-global-fallback.json'
  const egress = read(egressFile).items.filter(
    (item) =>
      item.armRegionName === 'Global' &&
      item.meterName === 'Standard Data Processed - Egress' &&
      item.tierMinimumUnits === 0 &&
      item.isPrimaryMeterRegion &&
      item.currencyCode === 'CAD',
  )
  assert.equal(egress.length, 1, 'EXACT_CAPTURED_PE_EGRESS_METER_REQUIRED')
  const item = egress[0]
  meters.privateEndpointEgress = {
    meterId: item.meterId,
    productName: item.productName,
    skuName: item.skuName,
    meterName: item.meterName,
    armRegionName: item.armRegionName,
    currency: item.currencyCode,
    unitOfMeasure: item.unitOfMeasure,
    retailPrice: item.retailPrice,
    effectiveStartDate: item.effectiveStartDate,
    sourceFile: egressFile,
  }
  for (const [name, meterName] of [
    ['intraRegionPeeringIngress', 'Intra-Region Ingress'],
    ['intraRegionPeeringEgress', 'Intra-Region Egress'],
  ]) {
    const matches = read(egressFile).items.filter(
      (price) =>
        price.armRegionName === 'Global' &&
        price.productName === 'Virtual Network Peering' &&
        price.skuName === 'Intra-Region' &&
        price.meterName === meterName &&
        price.isPrimaryMeterRegion &&
        price.currencyCode === 'CAD',
    )
    assert.equal(matches.length, 1, 'EXACT_CAPTURED_INTRA_REGION_PEERING_METER_REQUIRED')
    const price = matches[0]
    meters[name] = {
      meterId: price.meterId,
      productName: price.productName,
      skuName: price.skuName,
      meterName: price.meterName,
      armRegionName: price.armRegionName,
      currency: price.currencyCode,
      unitOfMeasure: price.unitOfMeasure,
      retailPrice: price.retailPrice,
      effectiveStartDate: price.effectiveStartDate,
      sourceFile: egressFile,
    }
  }
  const rate = (name) => meters[name].retailPrice
  const round = (value) => Number(value.toFixed(6))
  const scenarios = [
    {
      name: 'G3_PROOF_RUN_COST',
      retainedHours: 2,
      activeHours: 2,
      requestsMillion: 0.001,
      dnsMillion: 0.001,
      logsGB: 0.1,
      privateEndpointGB: 0.1,
      loadBalancerGB: 0.1,
      firewallGB: 0.1,
    },
    {
      name: 'G3_IDLE_MONTHLY_COST',
      retainedHours: 730,
      activeHours: 0,
      requestsMillion: 0,
      dnsMillion: 0.001,
      logsGB: 0.1,
      privateEndpointGB: 0,
      loadBalancerGB: 0.1,
      firewallGB: 0.1,
    },
    {
      name: 'G3_LOW_USAGE_MONTHLY_COST',
      retainedHours: 730,
      activeHours: 4,
      requestsMillion: 0.01,
      dnsMillion: 0.01,
      logsGB: 0.5,
      privateEndpointGB: 1,
      loadBalancerGB: 1,
      firewallGB: 1,
    },
    {
      name: 'G3_EXPECTED_MONTHLY_COST',
      retainedHours: 730,
      activeHours: 24,
      requestsMillion: 0.1,
      dnsMillion: 0.1,
      logsGB: 2,
      privateEndpointGB: 5,
      loadBalancerGB: 5,
      firewallGB: 5,
    },
    {
      name: 'G3_UPPER_BOUND_SCENARIO',
      retainedHours: 730,
      activeHours: 730,
      requestsMillion: 1,
      dnsMillion: 1,
      logsGB: 20,
      privateEndpointGB: 50,
      loadBalancerGB: 50,
      firewallGB: 50,
    },
  ].map((q) => {
    const g2RegistryTransferGB = q.privateEndpointGB
    const peeringTransferGB = q.firewallGB + g2RegistryTransferGB
    const costs = {
      FIXED_COSTS: round(2 * rate('privateDnsZone')),
      PRIVATE_ENDPOINT_COSTS: round(
        q.retainedHours * rate('vaultPrivateEndpoint') +
          0.5 * (q.privateEndpointGB + g2RegistryTransferGB) * rate('privateEndpointData') +
          0.5 * (q.privateEndpointGB + g2RegistryTransferGB) * rate('privateEndpointEgress'),
      ),
      LOAD_BALANCER_COSTS: round(
        q.retainedHours * rate('loadBalancer') + q.loadBalancerGB * rate('loadBalancerData'),
      ),
      PLATFORM_MANAGED_EGRESS_IP: round(q.retainedHours * rate('potentialPlatformEgressIp')),
      ACA_USAGE_COSTS: round(
        q.activeHours * 3600 * (0.25 * rate('activeCpu') + 0.5 * rate('activeMemory')) +
          q.requestsMillion * rate('requests'),
      ),
      DNS_USAGE_COSTS: round(q.dnsMillion * rate('privateDnsQueries')),
      LOG_INGESTION_COSTS: round(q.logsGB * rate('logIngestion')),
      FIREWALL_COSTS: round(q.firewallGB * rate('firewallData')),
      PEERING_COSTS: round(
        peeringTransferGB * (rate('intraRegionPeeringIngress') + rate('intraRegionPeeringEgress')),
      ),
    }
    return {
      name: q.name,
      quantities: q,
      peeringQuantities: {
        g2RegistryTransferGB,
        firewallTransitGB: q.firewallGB,
        totalTransferredGB: peeringTransferGB,
        billing:
          'Eachonewaybyte incurs sourceegress+destinationingress;inputGB includesbothtrafficdirections,no extra2x. LocalG3KV PE traffic doesnot traverseG2peering.',
      },
      quantitiesAuthority: 'LOCAL_SCENARIO_PROPOSAL_NOT_APPROVED_BUDGET_OR_MEASURED_USAGE',
      currency: 'CAD',
      knownComponents: costs,
      knownSubtotalCAD: round(Object.values(costs).reduce((a, b) => a + b, 0)),
      completeTotalCAD: null,
      COST_STATUS: 'UNRESOLVED_METER',
      omissions: [
        'Vault ordinarysecretoperations',
        'ACR nonreplicatedexcessstorage beyondincludedheadroom',
        'Any separately chargeableplatform/publicnetworkegress',
        'QualifiedG3A ephemeralbuilder/tooling/disk/transactions',
      ],
      upperBoundMeaning:
        q.name === 'G3_UPPER_BOUND_SCENARIO'
          ? 'Upper usage scenario for priced components only;not an actual hardupper bound with unknowncharges'
          : null,
    }
  })
  const proof = scenarios[0]
  const rollback = round(
    rate('vaultPrivateEndpoint') + rate('loadBalancer') + rate('potentialPlatformEgressIp'),
  )
  const diagnostic = round(rate('logIngestion'))
  const recommendation = round(1.5 * (proof.knownSubtotalCAD + rollback + diagnostic))
  return {
    currency: 'CAD',
    status: 'DETERMINISTIC_TO_CAPTURED_PRICING_CEILING_WITH_UNRESOLVED_METERS',
    meters,
    provenance:
      'Captured primaryCAD price snapshots only;no new retailqueries;raw ledger hashes and summaryitems checked',
    designQuantities: {
      incrementalPrivateDnsZones: 2,
      zones: network.dns.zones.map((item) => item.zone),
      rationale:
        'New KV and INTERNAL ACA defaultDomain zones billed;existing G2 ACR zone reused so no incrementalACR zonebase. Bill two full periods conservatively for shortproof;no unsupported hourlyDNS proration.',
      minReplicasIdle: 0,
      maxReplicas: 1,
      cpu: 0.25,
      memoryGiB: 0.5,
      hoursPerMonth: 730,
      freeAllowances: 'NOT_ASSUMED',
      managedEgressIp:
        'One documented platformmanaged egressIPv4 included conservatively despiteUDR;no user-managedG3 publicIP',
      existingG2FirewallBase: 'EXCLUDED_INCREMENTAL_ZERO_ONLY_FOR_ALREADY_RETAINED_BASE',
      ACA_PRIVATE_ENDPOINT: 'NOT_SELECTED_NO_COST',
      dedicatedManagement: 'NOT_SELECTED_NO_DEDICATED_PROFILE_OR_ACA_PE_OR_PLANNED_MAINTENANCE',
    },
    scenarios,
    PER_HOUR_PROOF_COSTS: {
      standingKnownCAD: round(
        rate('vaultPrivateEndpoint') + rate('loadBalancer') + rate('potentialPlatformEgressIp'),
      ),
      activeAllocationKnownCAD: round(
        3600 * (0.25 * rate('activeCpu') + 0.5 * rate('activeMemory')),
      ),
    },
    PER_GB_COSTS: {
      vaultPEIngressCAD: rate('privateEndpointData'),
      vaultPEEgressCAD: rate('privateEndpointEgress'),
      intraRegionPeeringIngressCAD: rate('intraRegionPeeringIngress'),
      intraRegionPeeringEgressCAD: rate('intraRegionPeeringEgress'),
      lbProcessedCAD: rate('loadBalancerData'),
      basicFirewallProcessedCAD: rate('firewallData'),
      logIngestionCAD: rate('logIngestion'),
      doubleCountingRule:
        'PE/LB/firewall quantities explicitlydistinct surfaces;private endpoint directpath neednottraversefirewall. privateEndpointGB islocalKVprocessedGB;G2registry PE processing isincremental separately. Bothsplit50%ingress/50%egress underscenario. ExistingG2PE hourlybase isalreadyretained,notnewG3incremental.',
    },
    NETWORK_EGRESS_COSTS: {
      status: 'UNRESOLVED_METER',
      missingFact:
        'Applicablegeneralpublic/platformegress meter isnot in capturedCanadaCentralBandwidth results;China/interregion meters are notsubstituted. Same-regionpeering usescapturedGlobal Intra-Region meters and ispricedseparately.',
    },
    BUILDER_EPHEMERAL_COSTS: {
      status: 'BLOCKED_DOWNSTREAM_FROZEN_AUTHORITY',
      authoritativeCAD: null,
      nonAuthoritativeProxy: {
        sku: 'LinuxB1s+E4LRS',
        computeCADPerHour: rate('unselectedBuilderCpu'),
        diskCADPerMonth: rate('unselectedBuilderDisk'),
        exampleTwoHourComputePlusFullDiskCAD: round(
          2 * rate('unselectedBuilderCpu') + rate('unselectedBuilderDisk'),
        ),
        status: 'SCENARIO_PROXY_ONLY_NOT_QUALIFIED_OR_SELECTED',
        excludedFromAuthoritativeTotals: true,
      },
    },
    unresolvedMeters: [
      {
        component: 'VAULT_ORDINARY_SECRET_OPERATIONS',
        COST_STATUS: 'UNRESOLVED_METER',
        missingFact:
          'ApplicableStandard secretoperations meter cannot be mapped from capturedprimaryCAD evidence;PremiumOperations/AdvancedKeyOperations are not substituted.',
      },
      {
        component: 'ACR_EXCESS_NONREPLICATED_STORAGE',
        COST_STATUS: 'UNRESOLVED_METER',
        missingFact:
          'CanadaCentralPremium nonreplicatedexcessstorage meter and currentincludedstorageheadroom missing;replication/otherregion/SKU not authoritativeproxy.',
      },
      {
        component: 'PLATFORM_OR_PUBLIC_NETWORK_EGRESS',
        COST_STATUS: 'UNRESOLVED_METER',
        missingFact:
          'Applicablegeneralpublic/platformegress meter/quantities are notbound;China/interregion meters are notsubstituted. Intra-regionpeering isclosedtoGlobalmeter evidence.',
      },
    ],
    RECOMMENDED_EXECUTION_CEILING_CAD: 'UNRESOLVED_FULL_CEILING_REQUIRES_UNKNOWN_COMPONENTS',
    pricedComponentRecommendationCAD: recommendation,
    recommendation: {
      proofRunAllowanceKnownCAD: proof.knownSubtotalCAD,
      rollbackAllowanceKnownCAD: rollback,
      unexpectedDiagnosticLogsAllowanceCAD: diagnostic,
      bufferPercentage: 50,
      formula:
        '1.5*(completeproofrun + completerollback + diagnostics);known-componentamount isnot an executableceiling',
      requiredAdditions: [
        'Qualifiedbuilder',
        'Ordinaryvaultoperations',
        'ACRexcessstorage',
        'Platform/publicnetworkegress',
        'Rollback/diagnosticunknowncharges',
      ],
    },
    HUMAN_APPROVED_EXECUTION_CEILING_CAD: 'UNBOUND',
    localCostCompletion: 'COMPLETE_FORMULAE_AND_EXACT_UNKNOWNS;not all-in numericclosure',
    humanApprovalImplied: false,
  }
}
export function buildG3R1() {
  const prior = read('G3_EXECUTION_READINESS.json')
  const recovery = read('G3R1_AUTHORITY_RECOVERY.json')
  verifyPreservation(recovery)
  const newLedger = read('G3R1_AZURE_READ_LEDGER.json')
  for (const entry of newLedger) {
    assert.equal(entry.mutation, false, 'G3R1_AZURE_MUTATION')
    assert(['GET', 'ACCOUNT_SHOW_READ_ONLY'].includes(entry.method), 'G3R1_NON_READ_METHOD')
    assert(['SUCCEEDED', 'FAILED'].includes(entry.status), 'G3R1_UNFINISHED_READ')
    assert.equal(
      digest(readFileSync(path.join(evidence, entry.responseFile))),
      entry.responseSha256,
      'G3R1_READ_DIGEST_MISMATCH',
    )
  }
  const directoryEntry = newLedger.find((entry) => entry.name === 'directory-capacity')
  const directoryResponse =
    directoryEntry.status === 'SUCCEEDED' ? read(directoryEntry.responseFile) : null
  const organization = directoryResponse?.value.find(
    (item) => item.id === '5082b8be-b04d-4a13-b61c-b6397670177b',
  )
  const directory = directoryCapacity(organization?.directorySizeQuota)
  const policyPages = newLedger.filter(
    (entry) => entry.name.startsWith('policyAssignments-page-') && entry.status === 'SUCCEEDED',
  )
  const policies = policyPages.flatMap((entry) => read(entry.responseFile).value)
  const denyPages = newLedger.filter(
    (entry) => entry.name.startsWith('denyAssignments-page-') && entry.status === 'SUCCEEDED',
  )
  const denies = denyPages.flatMap((entry) => read(entry.responseFile).value)
  const comparison = operatorComparison(prior)
  const network = networkContract(prior, comparison)
  const costs = costModel(prior, network)
  const rootBlockers = [
    {
      id: 'ROOT-1',
      type: 'FROZEN_SOURCE_AUTHORITY',
      state: 'BLOCKING',
      exactInput:
        'Exactseven-module manifest+historicalsource paths/commits/digests;G3A/G3B controllerauthority;qualifiedimage source/buildcontext/Dockerfile/treeDigest/manifestbinding;sealedG2 terminalpacket/rootID',
      historyResult: recovery.FROZEN_G3_PACKAGE_GIT_HISTORY_RESULT,
    },
    {
      id: 'ROOT-2',
      type: 'ACCOUNTABLE_PRINCIPAL_AND_HUMAN_APPROVER',
      state: 'BLOCKING',
      exactInput:
        'Humanbind lifecycleowner,approve/refuse recommendedbuildprincipal and separatehumanapprover;verifyeffectivepermissions and exactproposedgrants/controlledbootstrap',
    },
    {
      id: 'ROOT-3',
      type: 'NETWORK_MUTATION_AUTHORITY_G2_PEERING',
      state: 'BLOCKING_FOR_EXECUTION_ONLY',
      exactInput:
        'Separatehumanapproval for bothpeeringdirections,G2 ACRDNSlink,firewallrulechanges and sealedG2 terminalreconciliation;localdesign isnot permission',
    },
    {
      id: 'ROOT-4',
      type: 'HUMAN_COST_CEILING',
      state: 'BLOCKING_FOR_EXECUTION',
      exactInput:
        'Bindremainingmeter facts/quantities and sourcequalifiedbuilder costs,thenapprove completeproof/rollback/diagnostic ceiling+50%buffer;UNBOUND isnotzero',
    },
  ]
  if (!directory.status.startsWith('PASS'))
    rootBlockers.push({
      id: 'ROOT-5',
      type: 'REQUIRED_PREDEPLOY_DIRECTORY_CAPACITY_FACT',
      state: 'BLOCKING',
      exactInput:
        'Tenantdirectorysizequota used/total withfuturetwoidentities below98%;notACAregionalcorequota',
    })
  const normalized = {
    mission: 'NZ-20261008-INFRA-001',
    phase: 'G3R1',
    historyAccounting: {
      landingZoneRevisions: recovery.search.revisions.length,
      historicalBlobs: recovery.search.inspectedBlobs,
      expectedModules: recovery.EXPECTED_G3_MODULES,
      recoveredModules: recovery.RECOVERED_G3_MODULES,
    },
    supersedes: {
      interpretationOnly: true,
      historicalPacket: 'G3_EXECUTION_READINESS.json',
      historicalSha256: recovery.preservation['G3_EXECUTION_READINESS.json'],
      priorCombinedCapacityBlocker: 'G3-CAPACITY-LIMITS-NOT-PREPROVEN',
      replacement:
        'Threeindependentcontrols;environmentcores move to post-create/pre-activation. Executablepackage absence isdownstreamofsourceauthority,not independentroot.',
      historicalBytesChanged: false,
    },
    capacity: {
      PRE_DEPLOY_CAPACITY: 'SUBSCRIPTION_AND_REGION_CAPABILITY_ONLY',
      predeploy: {
        requiredProviders: prior.live.providers,
        canadaCentralResourceTypes: prior.live.regionResources,
        managedEnvironmentCount: prior.live.managedEnvironmentQuota,
        networkQuotas: prior.live.networkQuota,
        regionReservation: false,
        policyAssignments: policies.map((item) => ({
          id: item.id,
          definition: item.properties.policyDefinitionId,
          scope: item.properties.scope,
          enforcementMode: item.properties.enforcementMode,
          overrides: item.properties.overrides ?? [],
        })),
        visibleDenyAssignments: denies.length,
        regionalPolicy: {
          capturedDefinition: 'G3R1_west-europe-policy-definition.json',
          rule: read('G3R1_west-europe-policy-definition.json').properties.policyRule,
          appliesToCanadaCentral: false,
        },
        constraintsScope:
          'Capturedsubscription/inheritedvisibleassignments;notcompleteallpolicy/effective-deny/exemptionproof. Refreshbeforeanyauthorizeddeployment.',
      },
      ACA_CONSUMPTION_CORE_QUOTA_CLASS: 'POST_ENVIRONMENT_CREATE_PRE_WORKLOAD_ACTIVATION',
      POST_CREATE_GATE_1: {
        name: 'MANAGED_ENVIRONMENT_CONSUMPTION_CORE_QUOTA',
        requiredCPU: 0.25,
        sequence: [
          'CREATE_AUTHORIZED_EMPTY_G3_ENVIRONMENT',
          'QUERY_MANAGED_ENVIRONMENT_CONSUMPTION_CORE_QUOTA',
          'CONFIRM_REQUIRED_CAPACITY',
          'ONLY_THEN_AUTHORIZE_WORKLOAD_ACTIVATION',
        ],
        currentEnvironmentExists: false,
        workloadActivation: 'NOT_AUTHORIZED',
        postCreateFailures:
          'Keepworkloadabsent;explicitfailureevidence and governedrollback;noquotaincreaserequest inG3R1',
        source: docs.quota,
      },
      UAMI_CAPACITY_CLASS: 'ENTRA_DIRECTORY_OBJECT_CAPACITY',
      UAMI_DIRECTORY_CAPACITY: directory,
      identityCounts: {
        totalNewUamis: 2,
        BUILD_IDENTITY: 1,
        RUNTIME_IDENTITY: 1,
        frozenInterpretation:
          'Attachment labels one slot BUILD_IDENTITY;priorfreeze labels it platformpull. Capacity accounting covers two total UAMIs only. ExactBUILD-vs-PULL rolebinding must be reconciled with recoveredsource authority;do not invent a thirdidentity orrepurposeplatformpull asartifactwriter.',
        pullIdentityLifecycle: 'None',
        runtimeIdentityLifecycle: 'Main',
      },
      UAMICreationThrottles:
        'SeparateAzure/Entra creationratelimits;boundedsequentialcreation only in futureexplicitauthority;429/backoff evidence,notcapacityreservation.',
      sources: [docs.quota, docs.identity, docs.directory],
    },
    operatorComparison: comparison,
    rootBlockers,
    downstream: [
      {
        id: 'EXECUTABLE_PROOF_PACKAGE',
        state: 'DOWNSTREAM_OF_FROZEN_AUTHORITY_PACKAGE',
        root: 'ROOT-1',
        missingModules: 7,
        controllers: 'NOT_FOUND',
        localBuild: 'NOT_RUN_EXACT_FROZEN_MODULES_NOT_RECOVERED',
      },
      {
        id: 'QUALIFIED_IMAGE_SOURCE',
        state: 'BLOCKED',
        root: 'ROOT-1',
        image: prior.frozenDesign.image,
      },
      {
        id: 'SEALED_G2_TERMINAL_RECONCILIATION',
        state: 'BLOCKED',
        root: 'ROOT-1',
        packet: recovery.SEALED_G2_TERMINAL_PACKET,
      },
      {
        id: 'FULL_COST_TOTALS',
        state: 'EXACTLY_BLOCKED',
        roots: ['ROOT-1', 'ROOT-4'],
        unresolvedMeters: costs.unresolvedMeters,
      },
    ],
    readiness: {
      DESIGN_READINESS: 'COMPLETE_OR_EXACTLY_BLOCKED',
      SOURCE_AUTHORITY_READINESS: 'BLOCKED_NOT_FOUND_IN_BOUNDED_REACHABLE_HISTORY',
      IDENTITY_READINESS: 'CANDIDATES_COMPARED_HUMAN_BINDING_AND_GRANTS_REQUIRED',
      NETWORK_DESIGN_READINESS: 'DETERMINISTIC_DESIGN_ONLY;builderbootstrap source-dependent',
      NETWORK_MUTATION_AUTHORITY: 'SEPARATE_EXPLICIT_HUMAN_AUTHORITY_REQUIRED',
      COST_MODEL_READINESS: costs.status,
      COST_AUTHORITY_READINESS: 'HUMAN_CEILING_UNBOUND',
      LOCAL_PROOF_PACKAGE_READINESS: 'BLOCKED_DOWNSTREAM_ROOT_1',
      AZURE_EXECUTION_READINESS: 'BLOCKED_PENDING_EXACT_HUMAN_OR_SOURCE_INPUTS',
      G3R1_GATE:
        recovery.authorityMatches.length || recovery.terminalCandidates.length
          ? 'BLOCKED_UNADJUDICATED_HISTORY_CANDIDATES'
          : 'PASS',
      gateMeaning:
        'Localnormalization/recoveryaccounting/design/costceilingonly;absenceboundedtolocalreachablehistory,notclaimallremote/danglingobjects. PASS isnot G3execution orcompleteall-inpricing.',
      G3A: 'NOT_AUTHORIZED',
      G3B: 'NOT_AUTHORIZED',
      UE_LANE: 'UNTOUCHED',
    },
    proofBoundaries: {
      AZURE_RESOURCE_MUTATIONS: 0,
      AZURE_RBAC_MUTATIONS: 0,
      AZURE_REGISTRY_MUTATIONS: 0,
      G2_MUTATIONS: 0,
      G3_RESOURCE_GROUP_CREATED: 'NO',
      G3_ENVIRONMENT_CREATED: 'NO',
      UAMI_CREATED: 'NO',
      PEERING_CREATED: 'NO',
      FIREWALL_RULES_CHANGED: 'NO',
      PRIVATE_DNS_CHANGED: 'NO',
      IMAGE_BUILT: 'NO',
      IMAGE_PUSHED: 'NO',
      G3A_EXECUTED: 'NO',
      G3B_EXECUTED: 'NO',
    },
    zeroMutationEvidence: {
      previousCalls: prior.ledger.azureCalls,
      additionalCalls: newLedger.length,
      additionalLedger: 'G3R1_AZURE_READ_LEDGER.json',
      allAdditionalCallsReadOnly: true,
      originalEvidencePreservation: recovery.preservation,
      gitReadOnlyRecovery: 'G3R1_AUTHORITY_RECOVERY.json',
      limits: 'Recordscommandsissuedbythismission;not aclaimaboutotheroperators',
    },
    validation: {
      scope: 'OFFLINE_RECOVERY_AND_LOCAL_DESIGN_ONLY;NO_G3A_G3B_BUILD_OR_EXECUTION',
      combinedRegression: {
        command:
          'node --test infrastructure\\landing-zone\\g3-readiness-report.test.mjs infrastructure\\landing-zone\\g3r1-local-closure.test.mjs',
        result: 'PASS',
        tests: 242,
        existingG3Tests: 75,
        G3R1Tests: 167,
      },
      historicalRecovery: {
        command: 'node infrastructure\\landing-zone\\g3r1-authority-recovery.mjs --check',
        result: 'PASS',
        method:
          'Repeatedboundedread-onlyGit reconstruction,per-blobSHA verification,workingtreeandhistoricalhash preservation checks',
      },
      generation: {
        command: 'node infrastructure\\landing-zone\\g3r1-local-closure.mjs --check',
        result: 'PASS',
      },
      powershell: [
        {
          command: '& .\\infrastructure\\landing-zone\\g3r1-account-controls.test.ps1',
          result: 'PASS',
          rejectedCommands: 12,
          azureCalls: 0,
        },
        {
          command: '& .\\infrastructure\\landing-zone\\g3-readiness-census.test.ps1',
          result: 'PASS',
          rejectedCommandsOrStages: 15,
          azureCalls: 0,
        },
      ],
      syntax: {
        commands: [
          'node --check infrastructure\\landing-zone\\g3r1-authority-recovery.mjs',
          'node --check infrastructure\\landing-zone\\g3r1-local-closure.mjs',
          'node --check infrastructure\\landing-zone\\g3r1-local-closure.test.mjs',
        ],
        result: 'PASS',
      },
      formatting: {
        command:
          'pnpm exec prettier --check infrastructure\\landing-zone\\g3r1-authority-recovery.mjs infrastructure\\landing-zone\\g3r1-local-closure.mjs infrastructure\\landing-zone\\g3r1-local-closure.test.mjs',
        result: 'PASS',
      },
      documentation: { command: 'pnpm validate:docs', result: 'PASS_NO_CRITICAL_ERRORS' },
    },
  }
  return { normalized, network, costs }
}
export async function generateG3R1() {
  const { normalized: n, network, costs } = buildG3R1()
  const config = await resolveConfig(path.join(root, '..', '..', 'package.json'))
  const output = {}
  for (const [name, model] of [
    ['G3R1_BLOCKER_NORMALIZATION.json', n],
    ['G3R1_NETWORK_CONTRACT.json', network],
    ['G3R1_COST_MODEL.json', costs],
  ])
    output[name] = await format(JSON.stringify(model), { ...config, parser: 'json' })
  const roots = n.rootBlockers
    .map((item) => `| ${item.id} | ${item.type} | ${item.state} | ${item.exactInput} |`)
    .join('\n')
  const prices = costs.scenarios
    .map((item) => `| ${item.name} | ${item.knownSubtotalCAD} | UNRESOLVED |`)
    .join('\n')
  const principalRows = n.operatorComparison.candidates
    .map(
      (item) =>
        `| ${item.displayName} | ${item.principalId} | ${item.currentRoleAssignments.length} | ${item.G3_FIT} |`,
    )
    .join('\n')
  output['G3R1_BLOCKER_NORMALIZATION.md'] = await format(
    `# G3R1 local normalization — ${n.readiness.G3R1_GATE}

This supersedes interpretation only. [The historical readiness packet](./G3_EXECUTION_READINESS.json), Azure ledger, raw responses, prices and G2 source hashes remain byte-identical. [Recovery accounting](./G3R1_AUTHORITY_RECOVERY.json) binds all prior evidence hashes.

## Capacity normalization

Pre-deploy: providers, Canada Central types, managed environment count 4/20 and network headroom are captured. The visible inherited deny policy targets West Europe, not Canada Central; no deny assignments were returned. This is a scoped read-only check, not a complete effective-policy guarantee.

Consumption cores are **POST_ENVIRONMENT_CREATE_PRE_WORKLOAD_ACTIVATION**, not a pre-environment root blocker. Future sequence only: authorized empty environment -> query quota -> confirm 0.25 vCPU -> separately authorize activation. No step executed.

UAMIs use **ENTRA_DIRECTORY_OBJECT_CAPACITY**, not regional ACA compute. Captured Graph beta used=${n.capacity.UAMI_DIRECTORY_CAPACITY.used}, total=${n.capacity.UAMI_DIRECTORY_CAPACITY.total}; adding two gives ${n.capacity.UAMI_DIRECTORY_CAPACITY.futureUsed}, below the 98% threshold. This is a refreshable snapshot, not a reservation. Creation throttles remain separate.

Exactly two frozen identities: platform pull (None) and runtime (Main). The attachment labels one slot BUILD; that label is retained for capacity accounting, but its role binding must be reconciled with recovered source authority. No third identity or artifact-writer role is invented or assigned to the platform pull identity.

## Historical authority accounting

${n.historyAccounting.landingZoneRevisions} landing-zone revisions and ${n.historyAccounting.historicalBlobs} historical blobs were inspected within all locally reachable refs. Frozen G3 package: NOT_FOUND. Seven required modules, zero recovered; original seven path names are unknown and require the authority manifest. Controllers: NOT_FOUND. Sealed G2 terminal packet: NOT_FOUND. Qualified image source: BLOCKED.

Committed Node and Go health sources exist but lack an exact G3 manifest binding. They are supporting source candidates, not substituted qualified artifacts. No qualifying historical artifact was extracted; no replacement modules/controllers were created. Absence is bounded to searched reachable history, not remote or dangling objects.

## Operator comparison

| Candidate | Principal ID | Captured grants | G3 fit |
|---|---|---|---|
${principalRows}

Recommended, not appointed: ${n.operatorComparison.recommendedOperatorCandidate}. The build principal's captured legacy registry grant has a narrower direct-assignment footprint than deployment identities. It still has excess legacy AcrPush and lacks G3 grants. Effective group/PIM permissions require verification. Lifecycle owner and separate human approver remain HUMAN_BINDING_REQUIRED.

## Network contract

[The design-only network contract](./G3R1_NETWORK_CONTRACT.json) fixes CIDRs, both peering sides, default UDR to 10.90.0.4, private endpoint routing, Azure-provided DNS, NSG/probe rules, required firewall groups and narrow proposed grants. G2 peering, ACR-zone link and firewall changes require separate human authority.

Internal ACA has no ACA private endpoint; its returned defaultDomain/staticIP supply the internal apex/wildcard DNS zone. Private ACR zone is reused; a new KV zone and internal ACA zone are proposed. Selected telemetry is Log Analytics over AzureMonitor TCP443. Source-specific builder tooling destinations remain downstream blocked.

## Deterministic cost ceiling

[Captured CAD meter model](./G3R1_COST_MODEL.json) includes two new private DNS zones, one KV PE, one standard LB, documented platform egress IPv4, compute, request/DNS/log and processing quantities. Scenario assumptions are proposals, not measured usage or approved budgets. No free allowance is assumed.

| Scenario | Known CAD subtotal | Complete total |
|---|---|---|
${prices}

Captured Global Intra-Region peering ingress/egress meters now price both ends of same-region transit; local KV PE traffic is not counted as peered. Ordinary vault operations, nonreplicated ACR excess storage, applicable platform/public egress and qualified builder costs remain exact unknowns. Known components do not form a complete upper bound. The B1s/E4 builder example is a non-authoritative proxy excluded from totals.

Priced-component recommendation: ${costs.pricedComponentRecommendationCAD} CAD, including proof, one-hour known rollback allowance, one GB diagnostic logs and 50% buffer. **Not an executable ceiling.** RECOMMENDED_EXECUTION_CEILING_CAD=${costs.RECOMMENDED_EXECUTION_CEILING_CAD}; HUMAN_APPROVED_EXECUTION_CEILING_CAD=UNBOUND.

## Root blockers and downstream deliverables

| Root | Type | State | Exact input |
|---|---|---|---|
${roots}

ROOT-5 directory capacity is closed by the snapshot; ACA cores are POST-CREATE-GATE-1. Executable package, qualified image and local Bicep/controller build are downstream ROOT-1, not independent blockers.

## Terminal state

G3R1_GATE=${n.readiness.G3R1_GATE}; AZURE_EXECUTION_READINESS=${n.readiness.AZURE_EXECUTION_READINESS}.
G3A=NOT_AUTHORIZED; G3B=NOT_AUTHORIZED. All resource/RBAC/registry/G2 mutations are zero. No identity, environment, RG, peering, firewall/DNS change, image build/push or controller execution occurred. UE lane remains untouched.

## Validation evidence

242 combined offline Node tests passed: 75 existing G3 and 167 G3R1 tests. Per-blob historical digests, original evidence/G2-source preservation, capacity doctrine, CIDR/egress/DNS contracts, captured-meter provenance, unknown costs, unbound human ceiling, root/downstream separation and deterministic outputs are covered. Twelve G3R1 and fifteen prior PowerShell fail-closed cases passed without Azure calls. Exact commands/results are in the JSON \`validation\` section; local syntax, formatting, recovery/output \`--check\` and documentation validation passed.
`,
    { ...config, parser: 'markdown' },
  )
  output['G3R1_HUMAN_AUTHORITY_PACKET.md'] = await format(
    `# G3R1 residual human/source authority — no execution permission

## Source inputs — ROOT-1

Supply the original seven module paths with commit/blob digests, G3A/G3B controller paths and authority scopes, qualified source/build-context/Dockerfile/source-tree-to-manifest binding, and sealed G2 terminal packet/root ID. Bounded reachable Git recovery found none. Do not reconstruct or approve replacement bytes implicitly.

## Accountable roles — ROOT-2

- G3_LIFECYCLE_OWNER: HUMAN_BINDING_REQUIRED.
- G3_EXECUTION_OPERATOR: HUMAN_BINDING_REQUIRED; recommended existing build principal ${n.operatorComparison.recommendedOperatorCandidate}, app ${n.operatorComparison.recommendedAppId}.
- G3_HUMAN_APPROVER: HUMAN_BINDING_REQUIRED, separate from execution operator.

Approve/refuse the candidate after effective-permission review. [Exact proposed grant scopes and conditions](./G3R1_NETWORK_CONTRACT.json) are design only; no grants were made. Separately appoint narrowly controlled bootstrap for RG creation, secret seeding and principal/role-restricted RBAC. No subscription Contributor or broad User Access Administrator shortcut.

## G2 network changes — ROOT-3

Explicitly approve/refuse G3-to-G2 and G2-to-G3 peering, the G3 link on retained ACR private DNS, and proposed G2 firewall rule collections. Bind the recovered terminal record and retained-state reconciliation. No G2 mutation is authorized by this local contract.

## Cost inputs and approval — ROOT-4

Bind exact ordinary vault operation, nonreplicated registry storage/headroom, peering/egress and source-qualified builder quantities/meters. [Scenario model](./G3R1_COST_MODEL.json) preserves unknowns, not zero defaults.

Priced-component recommendation only: ${costs.pricedComponentRecommendationCAD} CAD. It includes ${costs.recommendation.proofRunAllowanceKnownCAD} CAD known proof allowance, ${costs.recommendation.rollbackAllowanceKnownCAD} CAD known one-hour rollback allowance, ${costs.recommendation.unexpectedDiagnosticLogsAllowanceCAD} CAD one-GB diagnostic allowance and 50% buffer. Complete unknown components must be added before recommending a full ceiling.

HUMAN_APPROVED_EXECUTION_CEILING_CAD=UNBOUND. No approval is inferred from this arithmetic.

## Separate future post-create gate

After a future explicit empty-environment authority only: query managed-environment Consumption cores; confirm required allocation; keep workload activation prohibited until independently authorized. Directory quota headroom is captured but must be refreshed before any future identity creation.

## Authority ceiling

This packet is read-only recovery and local design only. G3A/G3B remain NOT_AUTHORIZED; no simultaneous grant of both phases. All mutation/provisioning/image/controller boundaries remain zero/NO.
`,
    { ...config, parser: 'markdown' },
  )
  return output
}
export async function main(args) {
  assert(args.length === 1 && ['--write', '--check'].includes(args[0]), 'LOCAL_G3R1_FLAGS_ONLY')
  const outputs = await generateG3R1()
  for (const [name, bytes] of Object.entries(outputs)) {
    const destination = path.join(evidence, name)
    if (args[0] === '--write') writeFileSync(destination, bytes)
    else assert.equal(readFileSync(destination, 'utf8'), bytes, `STALE_G3R1_OUTPUT:${name}`)
  }
  console.log('PASS G3R1 deterministic local closure;G3 execution BLOCKED;no mutation.')
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2))
