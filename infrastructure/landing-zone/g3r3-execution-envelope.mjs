import assert from 'node:assert/strict'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { evidence, hash, read, root, source } from './g3r2i-preservation.mjs'
import { verifyPreservation } from './g3r3-read-census.mjs'

const sub = '/subscriptions/5d819f33-d16f-429c-a3c0-5b0e94740ba3'
const principal = 'bfa4a851-696a-4d3f-927b-5fb1526f79f2'
const rg = `${sub}/resourceGroups/nzila-shared-test-g3-001-rg`
const network = read(path.join(evidence, 'G3R1_NETWORK_CONTRACT.json'))
const oldCosts = read(path.join(evidence, 'G3R2_COST_CLOSURE.json'))
const sourceManifest = read(path.join(source, 'G3_SOURCE_AUTHORITY_MANIFEST.json'))
const registry = `${sub}/resourceGroups/nzila-g2-proof-xre47vggs5uhw/providers/Microsoft.ContainerRegistry/registries/nzilag2tzo75uuozprbo`
const zone = `${sub}/resourceGroups/nzila-g2-proof-xre47vggs5uhw/providers/Microsoft.Network/privateDnsZones/privatelink.azurecr.io`
const vault = `${rg}/providers/Microsoft.KeyVault/vaults/nzg3kv95086e2f`
const secret = `${vault}/secrets/g3-proof-secret`
const proposed = 'PROPOSED_NOT_GRANTED'
const g2Proposed = 'PROPOSED_NOT_AUTHORIZED'
const azureLedger = read(path.join(evidence, 'G3R3_AZURE_READ_LEDGER.json'))
function captured(name) {
  const entries = azureLedger.filter((entry) => entry.name.startsWith(`${name}-page-`))
  assert(
    entries.length && entries.every((entry) => entry.status === 'SUCCEEDED'),
    `REQUIRED_READ_UNAVAILABLE:${name}`,
  )
  const pages = entries.map((entry) => read(path.join(evidence, entry.responseFile)))
  return pages[0].value ? { value: pages.flatMap((page) => page.value) } : pages[0]
}
const roleDefinitions = captured('role-definitions').value
function definition(name) {
  const role = roleDefinitions.find((entry) => entry.properties.roleName === name)
  assert(role, `ROLE_DEFINITION_MISSING:${name}`)
  return { id: role.name, name, permissions: role.properties.permissions }
}
export function matches(pattern, action) {
  const regex = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*')
  return new RegExp(`^${regex}$`, 'i').test(action)
}
export function covered(operation, assignment, definitions = roleDefinitions) {
  const properties = assignment.properties
  if (
    !(
      operation.TARGET_SCOPE.toLowerCase() === properties.scope.toLowerCase() ||
      operation.TARGET_SCOPE.toLowerCase().startsWith(`${properties.scope.toLowerCase()}/`)
    )
  )
    return false
  if (properties.condition) return false
  const role = definitions.find(
    (entry) => entry.id.toLowerCase() === properties.roleDefinitionId.toLowerCase(),
  )
  assert(role, `ASSIGNMENT_ROLE_DEFINITION_UNAVAILABLE:${properties.roleDefinitionId}`)
  const allow = operation.plane === 'DATA' ? 'dataActions' : 'actions'
  const deny = operation.plane === 'DATA' ? 'notDataActions' : 'notActions'
  return role.properties.permissions.some(
    (permission) =>
      permission[allow].some((action) => matches(action, operation.AZURE_ACTION)) &&
      !permission[deny].some((action) => matches(action, operation.AZURE_ACTION)),
  )
}
function repositoryCondition(actions) {
  return {
    version: '2.0',
    expression: `((${actions.map((action) => `!(ActionMatches{'${action}'})`).join(' AND ')}) OR (@Resource[Microsoft.ContainerRegistry/registries/repositories:name] StringEquals 'g3-synthetic-runtime'))`,
  }
}
const reader = definition('Container Registry Repository Reader')
const writer = definition('Container Registry Repository Writer')
const contributor = definition('Container Registry Repository Contributor')
const secretReader = definition('Key Vault Secrets User')
const assignment = (
  id,
  role,
  scope,
  condition,
  purpose,
  lifetime = 'TEMPORARY;revoke on proof completion or rollback;maximum2h subject to enforced TTL',
  identity = principal,
) => ({
  assignmentId: id,
  PRINCIPAL_ID: identity,
  ROLE: role,
  EXACT_SCOPE: scope,
  CONDITION: condition,
  PURPOSE: purpose,
  LIFETIME: lifetime,
  STATUS: proposed,
})
export function privilegePacket() {
  const groups = captured('operator-groups')
    .value.filter((group) => group.securityEnabled)
    .map((group) => group.id)
  const all = [...captured('assignments').value, ...captured('inherited-assignments').value]
  const unique = [...new Map(all.map((entry) => [entry.id, entry])).values()]
  const assignments = unique.filter((entry) =>
    [principal, ...groups].includes(entry.properties.principalId),
  )
  const bom = read(path.join(source, 'G3_BILL_OF_MATERIALS.json'))
  const operations = []
  function operation(
    id,
    action,
    type,
    scope,
    role,
    owner,
    rationale,
    plane = 'CONTROL',
    persistent = false,
  ) {
    operations.push({
      OPERATION_ID: id,
      AZURE_ACTION: action,
      TARGET_RESOURCE_TYPE: type,
      TARGET_SCOPE: scope,
      REQUIRED_ROLE_OR_CUSTOM_PERMISSION: role,
      PRINCIPAL_CLASS: owner,
      TEMPORARY_OR_PERSISTENT: persistent ? 'PERSISTENT_UNTIL_AUTHORIZED_TEARDOWN' : 'TEMPORARY',
      RATIONALE: rationale,
      plane,
    })
  }
  for (const resource of bom.resources) {
    if (resource.resourceType === 'Microsoft.Authorization/roleAssignments') continue
    const rootResource = resource.resourceType === 'Microsoft.Resources/resourceGroups'
    for (const action of ['read', 'write', 'delete'])
      operation(
        `${resource.logicalResourceId}:${action}`,
        `${resource.resourceType}/${action}`,
        resource.resourceType,
        rootResource ? sub : rg,
        rootResource
          ? 'EXISTING_HUMAN_BOOTSTRAP_AUTHORITY;no new subscription operator grant'
          : 'G3R3_SCOPED_RESOURCE_DEPLOYER',
        rootResource ? 'HUMAN_LIFECYCLE_OWNER' : 'EXECUTION_OPERATOR',
        rootResource
          ? 'Human creates exact empty G3 RG before RG-level role assignment;delete only after owned-resource reconciliation'
          : `Prospective ${resource.owningModule} resource lifecycle`,
      )
  }
  for (const action of ['read', 'write', 'delete', 'validate/action'])
    operation(
      `deployments:${action}`,
      `Microsoft.Resources/deployments/${action}`,
      'Microsoft.Resources/deployments',
      rg,
      'G3R3_SCOPED_RESOURCE_DEPLOYER',
      'EXECUTION_OPERATOR',
      'RG-scope module deployment/readback/cleanup;human runs subscription root,operator receives no subscription deployment role',
    )
  for (const [id, action, type, scope, owner, rationale] of [
    [
      'environment-join',
      'Microsoft.App/managedEnvironments/join/action',
      'Microsoft.App/managedEnvironments',
      rg,
      'EXECUTION_OPERATOR',
      'Linked environment authorization when creating the container app',
    ],
    [
      'vault-private-endpoint-approval',
      'Microsoft.KeyVault/vaults/PrivateEndpointConnectionsApproval/action',
      'Microsoft.KeyVault/vaults',
      rg,
      'EXECUTION_OPERATOR',
      'Automatic approval of the owned vault private endpoint;vault write alone is insufficient',
    ],
    [
      'nsg-join',
      'Microsoft.Network/networkSecurityGroups/join/action',
      'Microsoft.Network/networkSecurityGroups',
      rg,
      'EXECUTION_OPERATOR',
      'Attach owned subnet NSGs',
    ],
    [
      'route-table-join',
      'Microsoft.Network/routeTables/join/action',
      'Microsoft.Network/routeTables',
      rg,
      'EXECUTION_OPERATOR',
      'Attach owned route table to subnet',
    ],
    [
      'vnet-join',
      'Microsoft.Network/virtualNetworks/join/action',
      'Microsoft.Network/virtualNetworks',
      rg,
      'EXECUTION_OPERATOR',
      'Link owned VNet to private DNS zones',
    ],
    [
      'g3-dns-zone-join',
      'Microsoft.Network/privateDnsZones/join/action',
      'Microsoft.Network/privateDnsZones',
      rg,
      'EXECUTION_OPERATOR',
      'Associate private endpoint DNS zone groups with owned private zones',
    ],
    [
      'subnet-join',
      'Microsoft.Network/virtualNetworks/subnets/join/action',
      'Microsoft.Network/virtualNetworks/subnets',
      rg,
      'EXECUTION_OPERATOR',
      'ACA/PE and conditional builder NIC subnet attachment',
    ],
    [
      'subnet-read',
      'Microsoft.Network/virtualNetworks/subnets/read',
      'Microsoft.Network/virtualNetworks/subnets',
      rg,
      'EXECUTION_OPERATOR',
      'Read exact subnet contract',
    ],
    [
      'identity-assign',
      'Microsoft.ManagedIdentity/userAssignedIdentities/assign/action',
      'Microsoft.ManagedIdentity/userAssignedIdentities',
      rg,
      'EXECUTION_OPERATOR',
      'Assign two existing prospective UAMIs without credentials or extra identities',
    ],
    [
      'g2-peer-read',
      'Microsoft.Network/virtualNetworks/read',
      'Microsoft.Network/virtualNetworks',
      network.g2VnetId,
      'EXECUTION_OPERATOR',
      'Read remote peering target',
    ],
    [
      'g2-peer-authorize',
      'Microsoft.Network/virtualNetworks/peer/action',
      'Microsoft.Network/virtualNetworks',
      network.g2VnetId,
      'EXECUTION_OPERATOR',
      'Linked remote VNet authorization;child peering write alone is not sufficient',
    ],
    [
      'g3-peer-authorize',
      'Microsoft.Network/virtualNetworks/peer/action',
      'Microsoft.Network/virtualNetworks',
      network.vnetId,
      'EXECUTION_OPERATOR',
      'Authorize reciprocal peering link',
    ],
    [
      'quota-query',
      'Microsoft.App/managedEnvironments/usages/read',
      'Microsoft.App/managedEnvironments/usages',
      `${rg}/providers/Microsoft.App/managedEnvironments/nzila-g3-env-95086e2f`,
      'EXECUTION_OPERATOR',
      'Post-create quota read;no automatic quota request',
    ],
    [
      'scoped-role-read',
      'Microsoft.Authorization/roleAssignments/read',
      'Microsoft.Authorization/roleAssignments',
      rg,
      'EXECUTION_OPERATOR',
      'Read owned role bindings without granting',
    ],
    [
      'secret-role-grant',
      'Microsoft.Authorization/roleAssignments/write',
      'Microsoft.Authorization/roleAssignments',
      secret,
      'SEPARATE_HUMAN_RBAC_AUTHORITY',
      'Grant exact runtime secret reader after secret exists',
    ],
    [
      'secret-role-revoke',
      'Microsoft.Authorization/roleAssignments/delete',
      'Microsoft.Authorization/roleAssignments',
      secret,
      'SEPARATE_HUMAN_RBAC_AUTHORITY',
      'Revoke owned runtime role on rollback',
    ],
    [
      'seeder-role-grant',
      'Microsoft.Authorization/roleAssignments/write',
      'Microsoft.Authorization/roleAssignments',
      vault,
      'SEPARATE_HUMAN_RBAC_AUTHORITY',
      'Temporary data-only bootstrap authority on the newly created empty proof vault;an exact-secret role cannot bootstrap a nonexistent secret',
    ],
    [
      'seeder-role-revoke',
      'Microsoft.Authorization/roleAssignments/delete',
      'Microsoft.Authorization/roleAssignments',
      vault,
      'SEPARATE_HUMAN_RBAC_AUTHORITY',
      'Revoke bootstrap seeder authority after owned synthetic-secret cleanup',
    ],
  ])
    operation(
      id,
      action,
      type,
      scope,
      owner === 'EXECUTION_OPERATOR'
        ? 'SCOPED_CUSTOM_PERMISSION'
        : 'EXISTING_SEPARATELY_VERIFIED_HUMAN_RBAC_AUTHORITY',
      owner,
      rationale,
    )
  for (const [name, scope, type] of [
    [
      'g2-peering',
      `${network.g2VnetId}/virtualNetworkPeerings/g2-to-g3`,
      'Microsoft.Network/virtualNetworks/virtualNetworkPeerings',
    ],
    [
      'g2-dns-link',
      `${zone}/virtualNetworkLinks/g3-acr-nzg3kv95086e2f`,
      'Microsoft.Network/privateDnsZones/virtualNetworkLinks',
    ],
    ['g2-firewall', network.firewall.resource, 'Microsoft.Network/azureFirewalls'],
  ])
    for (const action of name === 'g2-firewall' ? ['read', 'write'] : ['read', 'write', 'delete'])
      operation(
        `${name}:${action}`,
        `${type}/${action}`,
        type,
        scope,
        `G3R3_${name.toUpperCase()}_WRITER`,
        'EXECUTION_OPERATOR',
        'Only exact separately approved G2 packet;firewall whole-resource PUT cannot be property-isolated by RBAC',
      )
  for (const [role, owner, purpose] of [
    [writer, 'EXECUTION_OPERATOR', 'Private exact-repository push/readback;not deletion'],
    [reader, 'PLATFORM_PULL_UAMI', 'Persistent platform pull,lifecycle None'],
    [
      contributor,
      'SEPARATE_HUMAN_ROLLBACK_OPERATOR',
      'Temporary exact-repository cleanup;writer cannot delete',
    ],
  ])
    for (const action of role.permissions.flatMap((permission) => permission.dataActions))
      operation(
        `${role.name}:${action}`,
        action,
        'Microsoft.ContainerRegistry/registries/repositories',
        registry,
        role.name,
        owner,
        purpose,
        'DATA',
        owner === 'PLATFORM_PULL_UAMI',
      )
  for (const action of secretReader.permissions.flatMap((permission) => permission.dataActions))
    operation(
      `runtime:${action}`,
      action,
      'Microsoft.KeyVault/vaults/secrets',
      secret,
      secretReader.name,
      'RUNTIME_UAMI',
      'Exact secret data read for platform injection;no image writes',
      'DATA',
      true,
    )
  for (const action of ['setSecret/action', 'getSecret/action', 'readMetadata/action', 'delete'])
    operation(
      `seeder:${action}`,
      `Microsoft.KeyVault/vaults/secrets/${action}`,
      'Microsoft.KeyVault/vaults/secrets',
      secret,
      'G3R3_EXACT_SECRET_SEEDER_CUSTOM_DATA_ROLE',
      'SEPARATE_HUMAN_SECRET_SEEDER',
      'Create/read expected proof/delete only synthetic secret;no purge,real secrets or values here',
      'DATA',
    )
  for (const action of ['write', 'delete'])
    operation(
      `registry-grant:${action}`,
      `Microsoft.Authorization/roleAssignments/${action}`,
      'Microsoft.Authorization/roleAssignments',
      registry,
      'EXISTING_SEPARATELY_VERIFIED_HUMAN_RBAC_AUTHORITY',
      'SEPARATE_HUMAN_RBAC_AUTHORITY',
      'Repository ABAC grants for exact writer/reader/rollback principals',
    )
  const applicable = operations.filter((entry) => entry.PRINCIPAL_CLASS === 'EXECUTION_OPERATOR')
  const enough = applicable.filter((entry) =>
    assignments.some((current) => covered(entry, current)),
  )
  const missing = applicable.filter((entry) => !enough.includes(entry))
  const resourceActions = applicable
    .filter(
      (entry) =>
        (entry.TARGET_SCOPE === rg || entry.TARGET_SCOPE.startsWith(`${rg}/`)) &&
        entry.plane === 'CONTROL',
    )
    .map((entry) => entry.AZURE_ACTION)
  const proposedAssignments = [
    assignment(
      'operator-g3-rg',
      {
        customRole: 'G3R3_SCOPED_RESOURCE_DEPLOYER',
        actions: [...new Set(resourceActions)],
        notActions: [],
        dataActions: [],
        assignableScopes: [rg],
        exclusions: [
          'RBAC writes',
          'secret data',
          'quota requests',
          'listKeys',
          'unrelated resource types',
        ],
      },
      rg,
      null,
      'Exact G3 resource/module lifecycle;no Owner/Contributor',
    ),
    assignment(
      'operator-g2-peering',
      {
        customRole: 'G3R3_G2_PEERING_WRITER',
        actions: [
          'Microsoft.Network/virtualNetworks/virtualNetworkPeerings/read',
          'Microsoft.Network/virtualNetworks/virtualNetworkPeerings/write',
          'Microsoft.Network/virtualNetworks/virtualNetworkPeerings/delete',
        ],
      },
      network.g2VnetId,
      null,
      'Existing G2 VNet child-peering lifecycle only;RBAC cannot name-isolate the future child before creation;digest/ownership guards restrict use to g2-to-g3;no VNet write',
    ),
    assignment(
      'operator-g2-remote-peer',
      {
        customRole: 'G3R3_REMOTE_PEER_AUTHORIZER',
        actions: [
          'Microsoft.Network/virtualNetworks/read',
          'Microsoft.Network/virtualNetworks/peer/action',
        ],
      },
      network.g2VnetId,
      null,
      'Linked-resource peering permission;no VNet write',
    ),
    assignment(
      'operator-g2-dns',
      {
        customRole: 'G3R3_DNS_LINK_WRITER',
        actions: [
          'Microsoft.Network/privateDnsZones/virtualNetworkLinks/read',
          'Microsoft.Network/privateDnsZones/virtualNetworkLinks/write',
          'Microsoft.Network/privateDnsZones/virtualNetworkLinks/delete',
        ],
      },
      zone,
      null,
      'Existing exact G2 private zone child-link lifecycle only;RBAC cannot name-isolate the future child before creation;digest/ownership guards restrict use to g3-acr-nzg3kv95086e2f;no record/zone write',
    ),
    assignment(
      'operator-g2-firewall',
      {
        customRole: 'G3R3_FIREWALL_PROPERTY_WRITER',
        actions: [
          'Microsoft.Network/azureFirewalls/read',
          'Microsoft.Network/azureFirewalls/write',
        ],
      },
      network.firewall.resource,
      null,
      'Whole-resource firewall PUT surface;review exact preserved-body patch;no delete',
    ),
    assignment(
      'operator-repository-writer',
      writer,
      registry,
      repositoryCondition(writer.permissions.flatMap((entry) => entry.dataActions)),
      'Exact G3 repository write/read only',
    ),
    assignment(
      'platform-repository-reader',
      reader,
      registry,
      repositoryCondition(reader.permissions.flatMap((entry) => entry.dataActions)),
      'Pull-only platform identity None',
      'PERSISTENT_UNTIL_AUTHORIZED_TEARDOWN',
      '<G3_PULL_UAMI_PRINCIPAL_ID_AFTER_AUTHORIZED_CREATION>',
    ),
    assignment(
      'runtime-secret-reader',
      secretReader,
      secret,
      null,
      'One secret only;runtime Main',
      'PERSISTENT_UNTIL_AUTHORIZED_TEARDOWN',
      '<G3_RUNTIME_UAMI_PRINCIPAL_ID_AFTER_AUTHORIZED_CREATION>',
    ),
    assignment(
      'rollback-repository-cleaner',
      contributor,
      registry,
      repositoryCondition(contributor.permissions.flatMap((entry) => entry.dataActions)),
      'Remove only mission-owned manifest after independent approval and usage reconciliation',
      'TEMPORARY_ROLLBACK_WINDOW',
      '<SEPARATELY_APPOINTED_ROLLBACK_HUMAN_OR_PRINCIPAL>',
    ),
    assignment(
      'synthetic-secret-seeder',
      {
        customRole: 'G3R3_EXACT_SECRET_SEEDER',
        actions: [],
        dataActions: operations
          .filter((entry) => entry.PRINCIPAL_CLASS === 'SEPARATE_HUMAN_SECRET_SEEDER')
          .map((entry) => entry.AZURE_ACTION),
      },
      vault,
      null,
      'Temporary bootstrap on newly created empty proof-only vault;verify empty before grant and only owned synthetic secret afterward;scope permits all vault secrets,not name-isolated;no purge;private channel only',
      'TEMPORARY_PROOF_WINDOW',
      '<SEPARATELY_APPOINTED_HUMAN_SECRET_SEEDER>',
    ),
  ]
  return {
    status: 'COMPLETE_CORE_PRIVILEGE_PACKET;BUILDER_ADJUNCT_PERMISSION_BINDING_PENDING_MODEL',
    recommendedPrincipal: principal,
    recommendationIsAppointment: false,
    servicePrincipal: captured('operator'),
    application: captured('operator-application'),
    federation: captured('operator-federation').value,
    transitiveGroups: groups,
    currentDirectAndVisibleInheritedAssignments: assignments,
    scopeVerification: {
      subscriptionAndDescendantAssignmentsRead: true,
      subscriptionAncestorAtScopeRead: true,
      transitiveSecurityGroupsRead: true,
      inheritedCandidateAssignments: captured('inherited-assignments').value.filter((entry) =>
        [principal, ...groups].includes(entry.properties.principalId),
      ),
      visibleDenyAssignments: captured('deny-assignments').value,
      limitations:
        'Current active visible ARM/Graph assignments only;not future PIM activation,unreadable external tenants or token authorization simulation. No impersonation/token acquisition/execution.',
    },
    requiredOperations: operations,
    linkedAuthorizationCatalogs: azureLedger
      .filter((entry) => /^(keyvault|app|network)-operations-page-/.test(entry.name))
      .map(({ name, responseFile, responseSha256 }) => ({ name, responseFile, responseSha256 })),
    ALREADY_SUFFICIENT: enough.map((entry) => entry.OPERATION_ID),
    MISSING_PRIVILEGES: missing.map((entry) => ({
      id: entry.OPERATION_ID,
      action: entry.AZURE_ACTION,
      scope: entry.TARGET_SCOPE,
    })),
    EXCESS_EXISTING_PRIVILEGES: assignments
      .filter((current) => !applicable.some((entry) => covered(entry, current)))
      .map((entry) => ({
        roleDefinitionId: entry.properties.roleDefinitionId,
        scope: entry.properties.scope,
        condition: entry.properties.condition,
        reason: 'Unrelated staging-registry authority;not used,revoked or widened by G3R3',
      })),
    proposedAssignments,
    subscriptionWideOperatorGrantProposed: false,
    bootstrap:
      'Separate existing human authority creates exact empty RG,defines custom roles/assignments and runs subscription root;operator executes RG modules only after reviewed authorization-specific rendering of currently locked-false flags. No automatic unlocking.',
    humanRoles: {
      G3_LIFECYCLE_OWNER: 'HUMAN_BINDING_REQUIRED',
      G3_EXECUTION_OPERATOR: 'RECOMMENDED_CANDIDATE_NOT_APPOINTED',
      G3_HUMAN_APPROVER: 'HUMAN_BINDING_REQUIRED',
      requirement: 'G3_EXECUTION_OPERATOR != G3_HUMAN_APPROVER',
      seederAndRbacRollbackDelegation: 'Explicit duties within Decision A;no implicit appointment',
    },
    ROOT_2_TECHNICAL_PACKET:
      'CORE_COMPLETE;ADJUNCT_PRIVILEGE_EXTENSION_BLOCKED_BY_ROOT_4_BUILDER_MODEL',
    ROOT_2_HUMAN_BINDING: 'PENDING',
  }
}
export function mutationPacket(operator) {
  const fw = captured('g2-firewall')
  assert.equal(fw.properties.sku.tier, 'Basic')
  assert.equal(fw.properties.firewallPolicy, undefined, 'UNEXPECTED_FIREWALL_POLICY')
  const vnet = captured('g2-vnet')
  const dns = captured('g2-dns-links').value
  const registryState = captured('g2-registry')
  assert.equal(registryState.properties.publicNetworkAccess, 'Disabled')
  assert.equal(registryState.properties.roleAssignmentMode, 'AbacRepositoryPermissions')
  const changes = []
  function change(
    id,
    resourceId,
    type,
    property,
    current,
    desired,
    why,
    effect,
    rollback,
    validate,
    mutation = 'PUT_EXACT_RESOURCE_AFTER_APPROVAL',
  ) {
    changes.push({
      CHANGE_ID: id,
      CURRENT_STATE: current,
      DESIRED_STATE: desired,
      RESOURCE_ID: resourceId,
      RESOURCE_GROUP: 'nzila-g2-proof-xre47vggs5uhw',
      RESOURCE_TYPE: type,
      PROPERTY_PATH: property,
      MUTATION_OPERATION: mutation,
      WHY_REQUIRED: why,
      G3_DEPENDENCY: 'Private G3 platform/pull/runtime proof preparation',
      SECURITY_EFFECT: effect,
      ROLLBACK_OPERATION: rollback,
      VALIDATION_AFTER_CHANGE: validate,
      STATUS: g2Proposed,
      OWNER: 'G2_OWNED',
    })
  }
  const peeringId = `${network.g2VnetId}/virtualNetworkPeerings/g2-to-g3`
  assert(
    !vnet.properties.virtualNetworkPeerings.some(
      (entry) => entry.id.toLowerCase() === peeringId.toLowerCase(),
    ),
    'PROPOSED_PEERING_ALREADY_EXISTS',
  )
  const desiredPeering = network.peering.find((entry) => entry.name === 'g2-to-g3')
  change(
    'G2-PEERING',
    peeringId,
    'Microsoft.Network/virtualNetworks/virtualNetworkPeerings',
    'properties',
    { exists: false, capturedParentEtag: vnet.etag },
    {
      remoteVirtualNetwork: { id: desiredPeering.remote },
      allowVirtualNetworkAccess: desiredPeering.allowVirtualNetworkAccess,
      allowForwardedTraffic: desiredPeering.allowForwardedTraffic,
      allowGatewayTransit: desiredPeering.allowGatewayTransit,
      useRemoteGateways: desiredPeering.useRemoteGateways,
    },
    'Reverse link required;G3 source owns only g3-to-g2',
    'Permits forwarded firewall return traffic;no gateway transit or remote gateways',
    {
      method: 'DELETE',
      resource: peeringId,
      guard:
        'Only if created by this packet;stop workload first;never delete preexisting foreign peer',
    },
    [
      'Both peering states Connected',
      'Effective G3 default route to10.90.0.4',
      'Private10.90/16 routes via peering',
    ],
    'PUT_CHILD_WITH_PARENT_ETAG_RECHECK',
  )
  const dnsId = `${zone}/virtualNetworkLinks/g3-acr-nzg3kv95086e2f`
  assert(
    !dns.some((entry) => entry.id.toLowerCase() === dnsId.toLowerCase()),
    'PROPOSED_DNS_LINK_ALREADY_EXISTS',
  )
  change(
    'G2-ACR-DNS-LINK',
    dnsId,
    'Microsoft.Network/privateDnsZones/virtualNetworkLinks',
    'properties',
    {
      exists: false,
      existingLinks: dns.map((entry) => ({
        id: entry.id,
        virtualNetwork: entry.properties.virtualNetwork,
        registrationEnabled: entry.properties.registrationEnabled,
      })),
    },
    { location: 'global', virtualNetwork: { id: network.vnetId }, registrationEnabled: false },
    'Azure-provided G3 DNS must resolve registry and data private endpoints',
    'Read resolution only;no autoregistration or record changes',
    {
      method: 'DELETE',
      resource: dnsId,
      guard:
        'Remove only owned link after workload/image consumers stop;retain existing G2 link and all records',
    },
    [
      'Both ACR hostnames resolve recorded10.90.2.x IPs in G3',
      'Independent public path remains denied',
    ],
  )
  const rules = network.firewall.rules
    .filter((entry) => ['NETWORK', 'APPLICATION'].includes(entry.networkRuleOrApplicationRule))
    .map((entry, index) => ({
      RULE_ID: `g3-${index}-${entry.dependency.toLowerCase().replaceAll('_', '-')}`,
      RULE_COLLECTION:
        entry.networkRuleOrApplicationRule === 'NETWORK' ? 'g3r3-network' : 'g3r3-applications',
      SOURCE: network.builderAndEndpointNsg.firewallSources[entry.group],
      DESTINATION: entry.destinations,
      PORT: entry.ports,
      PROTOCOL: entry.protocol,
      SERVICE_TAG_OR_FQDN: entry.networkRuleOrApplicationRule,
      PURPOSE: entry.requiredForPlatformOrWorkload,
      PLATFORM_OR_WORKLOAD: 'PLATFORM;workload data uses direct private endpoint routes',
      EVIDENCE_SOURCE: { acceptedContract: 'G3R1_NETWORK_CONTRACT.json', uri: entry.provenance },
    }))
  const networkCollection = {
    name: 'g3r3-network',
    properties: {
      priority: 210,
      action: { type: 'Allow' },
      rules: rules
        .filter((entry) => entry.SERVICE_TAG_OR_FQDN === 'NETWORK')
        .map((entry) => ({
          name: entry.RULE_ID,
          protocols: ['TCP'],
          sourceAddresses: entry.SOURCE,
          destinationAddresses: entry.DESTINATION,
          destinationPorts: entry.PORT.map(String),
        })),
    },
  }
  const applicationCollection = {
    name: 'g3r3-applications',
    properties: {
      priority: 220,
      action: { type: 'Allow' },
      rules: rules
        .filter((entry) => entry.SERVICE_TAG_OR_FQDN === 'APPLICATION')
        .map((entry) => ({
          name: entry.RULE_ID,
          sourceAddresses: entry.SOURCE,
          targetFqdns: entry.DESTINATION,
          protocols: [{ protocolType: 'Https', port: 443 }],
        })),
    },
  }
  for (const [kind, addition] of [
    ['networkRuleCollections', networkCollection],
    ['applicationRuleCollections', applicationCollection],
  ]) {
    assert(
      !fw.properties[kind].some(
        (entry) =>
          entry.name === addition.name ||
          entry.properties.priority === addition.properties.priority,
      ),
      'FIREWALL_NAME_OR_PRIORITY_COLLISION',
    )
    change(
      `G2-FIREWALL-${kind}`,
      fw.id,
      fw.type,
      `properties.${kind}`,
      { etag: fw.etag, value: fw.properties[kind] },
      {
        value: [...fw.properties[kind], addition],
        preservation:
          'Read fresh complete resource;modify only this property;retain sku,IPs,subnets,natRules,all unrelated fields;no replacement with partial body',
      },
      'Accepted ACA platform dependency egress over G2 UDR/firewall',
      'Named G3 source allowlist only;documented platform wildcard FQDNs remain accepted,not tenant-exclusive;default deny unchanged',
      {
        method: 'PUT',
        resource: fw.id,
        restoreProperty: `properties.${kind}`,
        originalValue: fw.properties[kind],
        guard:
          'Compare-and-swap fresh etag;remove only owned named collection;preserve concurrently added foreign collections;stop if foreign edit conflicts;no stale whole-resource restore',
      },
      [
        'Collection diff only',
        'No Internet/AzureCloud destination catchall',
        'Private ACR/KV traffic not misclassified as firewall transit',
        'AzurePlatformDNS NSG exemption retained',
        'G2-only original configuration unchanged outside approved named collections',
      ],
      'CONDITIONAL_FIREWALL_READ_MODIFY_WRITE;two property changes one PUT',
    )
  }
  for (const grant of operator.proposedAssignments.filter((entry) =>
    [
      'operator-repository-writer',
      'platform-repository-reader',
      'rollback-repository-cleaner',
    ].includes(entry.assignmentId),
  )) {
    change(
      `G2-RBAC-${grant.assignmentId}`,
      registry,
      'Microsoft.Authorization/roleAssignments',
      'scope-bound roleAssignment',
      {
        registryMode: registryState.properties.roleAssignmentMode,
        existingAssignments: captured('assignments').value.filter(
          (entry) => entry.properties.scope.toLowerCase() === registry.toLowerCase(),
        ),
      },
      {
        principalId: grant.PRINCIPAL_ID,
        roleDefinitionId: grant.ROLE.id,
        scope: registry,
        condition: grant.CONDITION.expression,
        conditionVersion: '2.0',
        assignmentIdBinding:
          'UUIDv5(mission,registry,principalId,roleId);bind actual UAMI/human IDs before authorization-specific execution manifest',
      },
      grant.PURPOSE,
      'Exact g3-synthetic-runtime repository;no catalog/delete for reader/writer;temporary cleaner explicitly permits deletion',
      {
        method: 'DELETE',
        resource: 'EXACT_CREATED_ROLE_ASSIGNMENT_ID_FROM_OWNERSHIP_LEDGER',
        guard:
          'Revoke only owned mission assignment;never remove preexisting/foreign grants;metadata hash and principal/condition must match',
      },
      [
        'Exact role/principal/condition readback',
        'Repository-scoped positive read/push only after authority',
        'Other repository access denied',
        'Runtime no push;pull identity no secret access',
      ],
      'PUT_NEW_ROLE_ASSIGNMENT_AFTER_EXACT_PRINCIPAL_BINDING',
    )
  }
  const boundary = [
    ...network.peering.map((entry) => ({
      operation: entry.name,
      owner: entry.name === 'g3-to-g2' ? 'G3_OWNED' : 'G2_OWNED',
      resource: `${entry.parent}/virtualNetworkPeerings/${entry.name}`,
    })),
    {
      operation: 'G3-default-UDR/NSG/subnets/KV-DNS/internal-DNS',
      owner: 'G3_OWNED',
      resource: network.vnetId,
    },
    ...changes
      .filter((entry) => entry.CHANGE_ID !== 'G2-PEERING')
      .map((entry) => ({
        operation: entry.CHANGE_ID,
        owner: 'G2_OWNED',
        resource: entry.RESOURCE_ID,
      })),
    {
      operation: 'effective routes/DNS/peer/private endpoint/registry/RBAC reconciliation',
      owner: 'CROSS_BOUNDARY_VALIDATION_ONLY',
      resource: 'G3+G2',
    },
    {
      operation: 'Existing G2 route table/firewall transit settings',
      owner: 'CROSS_BOUNDARY_VALIDATION_ONLY',
      resource: captured('g2-builder-route').id,
    },
  ]
  const packet = {
    status: 'COMPLETE_CORE_G2_CHANGESET;NO_BUILDER_BOOTSTRAP_EXCEPTION_INCLUDED',
    changes,
    firewallRules: rules,
    ownership: boundary,
    HIDDEN_G2_MUTATIONS_IN_G3_SOURCE: 0,
    peeringContract: network.peering.map((entry) => ({
      SOURCE_VNET: entry.parent,
      REMOTE_VNET: entry.remote,
      ALLOW_VNET_ACCESS: entry.allowVirtualNetworkAccess,
      ALLOW_FORWARD_TRAFFIC: entry.allowForwardedTraffic,
      ALLOW_GATEWAY_TRANSIT: entry.allowGatewayTransit,
      USE_REMOTE_GATEWAYS: entry.useRemoteGateways,
      SECURITY_RATIONALE:
        'Accepted two-way peering supports firewall forwarding/return path;gateway transit intentionally absent',
      ROLLBACK: 'Delete only newly owned directional child after consumers stop',
    })),
    routeTransit: {
      existingG2Route: captured('g2-builder-route').properties.routes,
      requiredG2RouteMutation: false,
      reason:
        'G3 peered prefix more specific than G2 builder0/0;firewall system route returns via peering;both forwarding flags true;validate effective routes before workload',
      ACA_PRIVATE_ENDPOINT: 'NOT_REQUIRED',
    },
    privateDns: {
      zone,
      link: dnsId,
      vnet: network.vnetId,
      registrationEnabled: false,
      records: captured('g2-dns-records').value.map((entry) => ({
        name: entry.name,
        type: entry.type,
        properties: entry.properties,
      })),
      resourceDependency: 'Existing G2 ACR PE;new G3 VNet',
      rollback: 'Owned link DELETE;retain zone/records/G2 link',
    },
    baseline: {
      freshReadHashes: azureLedger
        .filter((entry) => entry.name.startsWith('g2-'))
        .map(({ responseFile, responseSha256 }) => ({ responseFile, responseSha256 })),
      historicalSealedG2Packet:
        'NOT_FOUND_PRESERVED;fresh resource snapshots are not reconstructed historical authority;human must accept exact captured baseline in Decision B',
    },
    approval: {
      CHANGE_COUNT: changes.length,
      RESOURCES_AFFECTED: [...new Set(changes.map((entry) => entry.RESOURCE_ID))],
      SECURITY_IMPACT:
        'Peered private path,G3-source platform egress,DNS resolution and repo-only roles;public ACR remains disabled',
      ROLLBACK_COMPLETE:
        'CORE_PACKET_COMPLETE_WITH_OWNERSHIP_AND_ETAG_GUARDS;CONFLICT_STOPS_UNAUTHORIZED_OVERWRITE',
      ESTIMATED_EXECUTION_DURATION:
        '30-minute engineering scheduling cap;not measured SLA;STOP if exceeded',
      VALIDATION_STEPS: changes.flatMap((entry) => entry.VALIDATION_AFTER_CHANGE),
      APPROVAL_STATUS: 'UNBOUND',
    },
  }
  packet.approval.G2_MUTATION_PACKET_DIGEST = hash(JSON.stringify(packet))
  packet.digestMethod =
    'SHA256 UTF-8 JSON packet before adding digestMethod and G2_MUTATION_PACKET_DIGEST;no circular self-hash'
  return packet
}
export function builderModel() {
  const existing = captured('g2-builder')
  const blocker = [
    {
      id: 'BUILDER-BOOTSTRAP',
      root: 'ROOT-4',
      fact: 'Qualified local image exists,but no authority-bound offline OCI courier/toolchain/guest bootstrap artifact and credential delivery contract is in accepted source. Run Command is execution,not a read-only tool-installation proof.',
      required:
        'Bind digest-qualified receiver/tooling,source/OCI transport,payload bounds,non-disclosing operator federation,private endpoint readback and retained artifacts before future builder start',
    },
    {
      id: 'BUILDER-NETWORK',
      root: 'ROOT-3',
      fact: 'Frozen G3 builder NSG denies all ingress/egress until separately approved adjunct rules;source intentionally does not claim production-path readiness.',
      required:
        'Bind adjunct exact ACR private-IP443,AzurePlatformDNS53,identity/control and private proof-IP443 allowances;no root architecture change or Internet catchall;include additional G2 rule changes only if exact bootstrap facts require them',
    },
    {
      id: 'BUILDER-TTL',
      root: 'ROOT-4',
      fact: 'No independent authenticated watchdog/lease/deallocate-delete guarantee is bound. Guest shutdown or RunCommand timeout does not deallocate VM or delete disk/NIC and cannot guarantee billed-lifetime cap.',
      required:
        'Bound controller/watchdog owner,minimum permissions,lease expiry,credential failure behavior and deterministic deletion;abort before creating/starting builder when TTL enforcement cannot be proved',
    },
  ]
  return {
    BUILDER_EXECUTION_MODEL:
      'EPHEMERAL_G3_PRIVATE_LINUX_VM_RECEIVING_QUALIFIED_OFFLINE_OCI;PROPOSED_SINGLE_CANDIDATE_NOT_SELECTED_FOR_EXECUTION',
    BUILDER_MODEL_STATUS: 'BLOCKED_EXACT_REASON',
    selectedExecutableModel: null,
    candidate: {
      resourceGroup: rg,
      subnet: `${network.vnetId}/subnets/G3BuilderSubnet`,
      vmSkuCandidate: 'Standard_B2s',
      diskCandidate: 'E4 StandardSSD_LRS32GiB',
      publicIp: 'NONE',
      credentials:
        'Recommended execution operator GitHub build federation;no long-lived keys;token delivery mechanism UNBOUND;no third G3 UAMI invented',
      production:
        'Receive exact qualified local OCI/source;push privately only after verification;local config digest never future registry manifest',
      invocation: 'Prospective Managed Run Command;no SSH/RDP',
      references: [
        'https://learn.microsoft.com/en-us/azure/virtual-machines/run-command-overview',
        'https://learn.microsoft.com/en-us/azure/container-registry/container-registry-private-endpoints',
      ],
    },
    temporaryResourcesIfBound: [
      {
        type: 'Microsoft.Compute/virtualMachines',
        candidateId: `${rg}/providers/Microsoft.Compute/virtualMachines/nzila-g3-proof-builder-95086e2f`,
        deleteRequired: true,
      },
      {
        type: 'Microsoft.Network/networkInterfaces',
        candidateId: `${rg}/providers/Microsoft.Network/networkInterfaces/nzila-g3-proof-builder-95086e2f-nic`,
        deleteRequired: true,
      },
      {
        type: 'Microsoft.Compute/disks',
        candidateId: `${rg}/providers/Microsoft.Compute/disks/nzila-g3-proof-builder-95086e2f-os`,
        deleteRequired: true,
      },
      {
        type: 'Microsoft.Compute/virtualMachines/runCommands',
        candidateId: `${rg}/providers/Microsoft.Compute/virtualMachines/nzila-g3-proof-builder-95086e2f/runCommands/g3-offline-receiver`,
        deleteRequired: true,
      },
      {
        type: 'INDEPENDENT_TTL_WATCHDOG',
        candidateId: 'UNBOUND;do not fabricate managed resource or role',
        deleteRequired: true,
      },
    ],
    BUILDER_MAX_LIFETIME_MINUTES: 30,
    AUTO_TEARDOWN_EXPECTATION:
      'At lease expiry stop work,deallocate VM,delete owned RunCommand/VM/NIC/disk,revoke temporary roles;retain sanitized proof externally',
    FAIL_CLOSED_IF_TTL_CANNOT_BE_ENFORCED: true,
    startAllowed: false,
    exactResiduals: blocker,
    alternativeEvaluation: [
      {
        model: 'REUSE_EXISTING_G2_VM',
        disposition: 'NOT_SELECTED',
        evidence: {
          id: existing.id,
          sku: existing.properties.hardwareProfile.vmSize,
          osImage: existing.properties.storageProfile.imageReference,
          identity: Object.keys(existing.identity.userAssignedIdentities),
        },
        reason:
          'Retained G2 resource/identity,broad existing NSG and unproven guest tools;would require additional G2 guest/identity/lifecycle authority and risk accepted baseline. No VM command executed.',
      },
      {
        model: 'LOCAL_OR_GITHUB_PUBLIC_RUNNER_PUSH_DIRECTLY',
        disposition: 'REJECTED',
        reason:
          'No observed private network connection to ACR;public network disabled. No public-ACR or public-registry workaround.',
      },
      {
        model: 'ACR_TASK_PRIVATE_AGENT_POOL',
        disposition: 'NOT_SELECTED',
        reason:
          'No accepted pool/network/SKU/bootstrap/identity/lifecycle contract;inventing one does not close evidence. No Azure build.',
      },
    ],
  }
}
function price(file, predicate) {
  const matches = read(path.join(evidence, file)).items.filter(predicate)
  assert.equal(matches.length, 1, `METER_NOT_EXACT:${file}:${matches.length}`)
  return { ...matches[0], sourceFile: file }
}
export function costEnvelope(builder) {
  const caps = {
    MAX_PROOF_HOURS: 2,
    CLEANUP_DEADLINE_HOURS: 2,
    MAX_BUILDER_MINUTES: 30,
    MAX_IMAGE_SIZE_GB: 0.1,
    MAX_ACR_STORED_GB: 0.2,
    MAX_RETAINED_IMAGE_DAYS: 1,
    MAX_VAULT_OPERATIONS: 100,
    MAX_LOG_INGESTION_GB: 0.25,
    MAX_PEERING_GB: 0.6,
    MAX_FIREWALL_PROCESSED_GB: 1,
    MAX_EXTERNAL_EGRESS_GB: 0.25,
    MAX_KV_PE_PROCESSED_GB: 0.02,
    MAX_ACR_PE_PROCESSED_GB: 0.6,
    MAX_CONTAINER_VCPU_SECONDS: 1800,
    MAX_CONTAINER_GIB_SECONDS: 3600,
    MAX_REQUESTS: 1000,
    MAX_DNS_QUERIES: 10000,
    MAX_DISK_TRANSACTIONS: 10000,
    MAX_REPLICAS: 1,
    MAX_REVISIONS: 1,
  }
  const m = oldCosts.meters
  const vm = price(
    'G3R3_PRICE_builder-b2s.json',
    (item) => item.productName === 'Virtual Machines BS Series' && item.meterName === 'B2s',
  )
  const disk = price('G3R3_PRICE_disk-e4.json', (item) => item.meterName === 'E4 LRS Disk')
  const diskMount = price(
    'G3R3_PRICE_disk-e4.json',
    (item) => item.meterName === 'E4 LRS Disk Mount',
  )
  const egress = price(
    'G3R3_PRICE_bandwidth-catalog.json',
    (item) =>
      item.meterId === '9995d93a-7d35-4d3f-9c69-7a7fea447ef4' && item.tierMinimumUnits === 100,
  )
  const registryBase = price(
    'G3R3_PRICE_registry-global-catalog.json',
    (item) => item.meterId === '2f8e1105-47d0-4105-a934-b2175c766a71',
  )
  const registryStorage = price(
    'G3R3_PRICE_registry-global-catalog.json',
    (item) => item.meterId === '6331e61c-1b44-4a10-9fb1-e9c0b470c4d5',
  )
  const usage = captured('g2-registry-usage').value.find((entry) => entry.name === 'Size')
  assert.equal(usage.unit, 'Bytes')
  assert.equal(captured('g2-registry').sku.name, 'Premium')
  assert(usage.currentValue + caps.MAX_ACR_STORED_GB * 1024 ** 3 < usage.limit)
  const ordinary = read(path.join(evidence, 'G3R3_PRICE_vault-global-catalog.json')).items.filter(
    (item) =>
      item.productName === 'Key Vault' &&
      item.skuName === 'Standard' &&
      item.meterName === 'Operations' &&
      ['Global', 'canadacentral'].includes(item.armRegionName),
  )
  const lines = []
  function line(id, meter, quantity, divisor, classification, drivers, limitations = []) {
    const rate = meter.retailPrice
    assert(Number.isFinite(rate) && rate >= 0)
    const raw = (quantity / divisor) * rate
    lines.push({
      id,
      SERVICE: meter.serviceName ?? meter.productName,
      SKU: meter.skuName,
      METER: meter.meterName,
      METER_ID: meter.meterId,
      REGION: meter.armRegionName,
      CURRENCY: 'CAD',
      UNIT: meter.unitOfMeasure,
      RETAIL_RATE: rate,
      EFFECTIVE_DATE: meter.effectiveStartDate,
      SOURCE: meter.sourceFile,
      SOURCE_SHA256: hash(readFileSync(path.join(evidence, meter.sourceFile))),
      QUANTITY_LIMIT: quantity,
      divisor,
      MAX_COST: Number(raw.toFixed(8)),
      classification,
      drivers,
      limitations,
    })
  }
  line(
    'ACA-CPU',
    m.activeCpu,
    caps.MAX_CONTAINER_VCPU_SECONDS,
    1,
    'INCREMENTAL_G3_PROOF_COST',
    '0.25vCPU *2h *3600;max one replica/revision',
  )
  line(
    'ACA-MEMORY',
    m.activeMemory,
    caps.MAX_CONTAINER_GIB_SECONDS,
    1,
    'INCREMENTAL_G3_PROOF_COST',
    '0.5GiB *2h *3600',
  )
  line(
    'ACA-REQUESTS',
    m.requests,
    caps.MAX_REQUESTS,
    1000000,
    'INCREMENTAL_G3_PROOF_COST',
    'All positive/negative/retry proof requests <=1000',
  )
  line(
    'LOGS',
    m.logIngestion,
    caps.MAX_LOG_INGESTION_GB,
    1,
    'INCREMENTAL_G3_PROOF_COST',
    'Sanitized console/system diagnostics0.25GB scenario',
    ['Workspace daily quota is approximate/delayed,not hard cap;watchdog deadline/cutoff unbound'],
  )
  line(
    'KV-PE-HOURS',
    m.vaultPrivateEndpoint,
    caps.MAX_PROOF_HOURS,
    1,
    'INCREMENTAL_G3_PROOF_COST',
    'One new KV PE;includes expected cleanup by2h',
  )
  line(
    'KV-PE-IN',
    m.privateEndpointData,
    caps.MAX_KV_PE_PROCESSED_GB / 2,
    1,
    'INCREMENTAL_G3_PROOF_COST',
    'Half aggregate bidirectional KV PE bytes',
  )
  line(
    'KV-PE-OUT',
    m.privateEndpointEgress,
    caps.MAX_KV_PE_PROCESSED_GB / 2,
    1,
    'INCREMENTAL_G3_PROOF_COST',
    'Other half aggregate KV PE bytes;no doubled full quantity',
  )
  line(
    'ACR-PE-IN',
    m.privateEndpointData,
    caps.MAX_ACR_PE_PROCESSED_GB / 2,
    1,
    'INCREMENTAL_G3_PROOF_COST',
    'Existing ACR PE processing for G3 push/pulls;hourly PE base sunk',
  )
  line(
    'ACR-PE-OUT',
    m.privateEndpointEgress,
    caps.MAX_ACR_PE_PROCESSED_GB / 2,
    1,
    'INCREMENTAL_G3_PROOF_COST',
    'Aggregate push+pull bidirectional bytes split,not duplicated',
  )
  line(
    'PEERING-SOURCE',
    m.intraRegionPeeringEgress,
    caps.MAX_PEERING_GB,
    1,
    'INCREMENTAL_G3_PROOF_COST',
    'Each crossing byte billed once at originating peer',
  )
  line(
    'PEERING-DESTINATION',
    m.intraRegionPeeringIngress,
    caps.MAX_PEERING_GB,
    1,
    'INCREMENTAL_G3_PROOF_COST',
    'Same crossing byte billed once at receiving peer;two charged surfaces,not duplicate transfers',
  )
  line(
    'FIREWALL',
    m.firewallData,
    caps.MAX_FIREWALL_PROCESSED_GB,
    1,
    'INCREMENTAL_G3_PROOF_COST',
    'Platform/control internet path only;exclude direct private ACR/KV transfers',
  )
  line(
    'DNS-ZONES',
    m.privateDnsZone,
    2,
    1,
    'INCREMENTAL_G3_PROOF_COST',
    'Two newly retained private zones billed conservatively full catalog zone unit;existing ACR-zone base sunk',
  )
  line(
    'DNS-QUERIES',
    m.privateDnsQueries,
    caps.MAX_DNS_QUERIES,
    1000000,
    'INCREMENTAL_G3_PROOF_COST',
    'Total all three relevant zones0.01million queries',
  )
  line(
    'LB-HOURS',
    m.loadBalancer,
    caps.MAX_PROOF_HOURS,
    1,
    'INCREMENTAL_G3_PROOF_COST',
    'One platform-managed LB for2h',
  )
  line(
    'LB-PROCESSING',
    m.loadBalancerData,
    0.02,
    1,
    'INCREMENTAL_G3_PROOF_COST',
    'Private health/proof data ingress separate from registry image data',
  )
  line(
    'PLATFORM-IP',
    m.potentialPlatformEgressIp,
    caps.MAX_PROOF_HOURS,
    1,
    'INCREMENTAL_G3_PROOF_COST',
    'One platform-managed egress IPv4 per accepted workload-profiles model',
  )
  line(
    'INTERNET-EGRESS',
    egress,
    caps.MAX_EXTERNAL_EGRESS_GB,
    1,
    'INCREMENTAL_G3_PROOF_COST',
    'Highest paid Global MGN tier captured;no free100GB allowance assumed;explicit Global tariff,not geography substitution',
  )
  line(
    'BUILDER-VM-CANDIDATE',
    vm,
    caps.MAX_BUILDER_MINUTES / 60,
    1,
    'CONDITIONAL_NOT_BOUND_BUILDER',
    'Candidate B2s Linux30min;no Windows substitution',
    ['Model/bootstrap/TTL unbound;not complete builder total'],
  )
  line(
    'BUILDER-DISK-CANDIDATE',
    disk,
    1,
    1,
    'CONDITIONAL_NOT_BOUND_BUILDER',
    'Conservative full-month E4 disk unit rather than unverified hourly proration',
  )
  line(
    'BUILDER-DISK-MOUNT-CANDIDATE',
    diskMount,
    1,
    1,
    'CONDITIONAL_NOT_BOUND_BUILDER',
    'Conservative full-month mount unit;disk transaction meter not yet bound',
  )
  line(
    'ACR-STORAGE-INCREMENTAL',
    registryStorage,
    0,
    1,
    'INCREMENTAL_G3_PROOF_COST',
    'Captured existing Premium included500GiB;4,681,097 bytes used;reserve0.2GiB G3 and recheck before push;zero excess billable quantity not missing-price zero',
  )
  line(
    'ACR-BASE-SHARED',
    registryBase,
    1,
    1,
    'SHARED_EXISTING_PLATFORM_COST_NOT_INCREMENTAL',
    'Existing Premium registry daily base;not charged again to G3 incremental sum',
  )
  const unresolved = [
    ...builder.exactResiduals,
    ...(ordinary.length
      ? []
      : [
          {
            id: 'VAULT-STANDARD-OPERATIONS-METER',
            root: 'ROOT-4',
            fact: 'Current CanadaCentral and complete primary Global CAD catalog has no Standard Key Vault ordinary Operations meter. Premium Global Operations0f824807... and foreign regional Standard Operations exist but are not silently substituted.',
            required:
              'Authoritative applicable Standard secret-operation CAD meter or documented cross-SKU applicability and exact source/rate;renewal/rotation/HSM are not ordinary secret operations',
            quantity: caps.MAX_VAULT_OPERATIONS,
          },
        ]),
    {
      id: 'BUILDER-DISK-TRANSACTIONS-AND-COURIER',
      root: 'ROOT-4',
      fact: 'E4 disk capacity/mount rates captured,but disk-I/O/transport/staging/independent watchdog resources remain model-dependent and not fully priced',
      required:
        'Bind selected model first,then exact meters and bounded operations;no guessed total',
    },
    {
      id: 'CAP-ENFORCEMENT',
      root: 'ROOT-4',
      fact: 'Proof cleanup/diagnostic cutoff and network byte ceilings have no bound independent enforcement mechanism. Current workspace quota is delayed and fixed sourceflags prevent any execution.',
      required:
        'Bound watchdog,lease,circuit-breaker,retention deadlines and conservative overrun accounting before numerical ceiling;cost alerts alone are not a hard cap',
    },
  ]
  const knownMaximum = Number(
    lines
      .filter((entry) => entry.classification !== 'SHARED_EXISTING_PLATFORM_COST_NOT_INCREMENTAL')
      .reduce((sum, entry) => sum + entry.MAX_COST, 0)
      .toFixed(8),
  )
  const traffic = [
    {
      path: 'G3_VM_PUSH_PLUS_ACA_PULLS',
      totalBidirectionalGB: 0.6,
      accrual: ['ACR-PE-IN+ACR-PE-OUT=0.6GB', 'PEERING-SOURCE=0.6GB', 'PEERING-DESTINATION=0.6GB'],
      firewallGB: 0,
      publicEgressGB: 0,
    },
    {
      path: 'ACA_OR_BUILDER_TO_LOCAL_G3_KV',
      totalBidirectionalGB: 0.02,
      accrual: ['KV-PE-IN+KV-PE-OUT=0.02GB'],
      firewallGB: 0,
      peeringGB: 0,
      publicEgressGB: 0,
    },
    {
      path: 'PLATFORM_CONTROL_TO_ALLOWED_PUBLIC_MICROSOFT_DEPENDENCIES',
      totalBidirectionalGB: 1,
      outboundGB: 0.25,
      accrual: ['FIREWALL=1GB', 'INTERNET-EGRESS=outbound0.25GB'],
      overlapExplanation:
        'Firewall processing and public egress are different billable surfaces of the same outbound bytes;not two copies of transfer. Inbound not counted as internet egress.',
    },
  ]
  return {
    status: 'INCOMPLETE_MATERIAL_EXECUTION_MODEL_AND_METER;NOT_AN_APPROVED_CEILING',
    currency: 'CAD',
    sourceBomSha256: sourceManifest.COST_BOM.sha256,
    persistentBom: read(path.join(source, 'G3_BILL_OF_MATERIALS.json')),
    adjunctBom: builder.temporaryResourcesIfBound,
    retainedSharedCosts: [
      'Existing Premium ACR base',
      'Existing ACR PE hourly base',
      'Existing Basic firewall hourly base',
      'Existing G2 DNS-zone base',
      'Existing retained G2 VM/disk;not reused or resized',
    ],
    hardQuantityCaps: caps,
    capEnforcement: {
      definition: 'Proposed engineering execution limits,not hidden average quantities',
      implemented: false,
      builderTtl: 'BLOCKED_UNBOUND_INDEPENDENT_WATCHDOG',
      proofDeadline: 'DENY_START_WITHOUT_ENFORCEABLE_CLEANUP',
      maxReplicaRevision: 'Source min0/max1,activeSingle;operator must prevent extra revisions',
      diagnostics: 'Existing daily quota not hard;bounded scenario only',
      artifactRetention:
        'Delete only owned image within1day;preserve immutable source/proof metadata',
      noAutomaticQuotaRequest: true,
    },
    vaultOperationBudget: {
      set: 1,
      runtimePlatformGetIncludingRetries: 40,
      metadataAndVersionRead: 10,
      controlledNegativeAuthenticatedAttempts: 10,
      cleanupDelete: 1,
      contingencyOperations: 38,
      total: 100,
      HMACRequestsCauseVaultCalls: false,
      secretValueGeneratedOrRetrieved: false,
      controlPlaneRbac:
        'No distinct billable control-plane meter captured;not substituted for secret data ops;ordinary fee unresolved',
      purge: 'NOT_AUTHORIZED;purge protection retains deleted objects per vault policy',
    },
    acrStorage: {
      sku: 'Premium',
      currentBytes: usage.currentValue,
      includedBytes: usage.limit,
      reservedG3Bytes: caps.MAX_ACR_STORED_GB * 1024 ** 3,
      headroomBytesAfterReservation:
        usage.limit - usage.currentValue - caps.MAX_ACR_STORED_GB * 1024 ** 3,
      refreshRequiredBeforePush: true,
      failClosedIfNoHeadroom: true,
      geoReplications: captured('g2-registry-usage').value.find(
        (entry) => entry.name === 'Geo-replications',
      ).currentValue,
      newReplicaNotPlanned: true,
    },
    priceBindings: lines,
    trafficAccounting: traffic,
    unresolvedMaterialItems: unresolved,
    EXPECTED_PROOF_RUN_COST_CAD: null,
    MAX_BOUNDED_PROOF_RUN_COST_CAD: null,
    ROLLBACK_ALLOWANCE_CAD: null,
    DIAGNOSTIC_CONTINGENCY_CAD: null,
    UNCERTAINTY_BUFFER_CAD: null,
    knownComponentConditionalMaximumCAD: knownMaximum,
    expectedVsMaximumExplanation:
      'Known-component arithmetic can be bounded;material gaps preclude defensible expected/all-in max,rollback,contingency or buffered ceiling numbers.',
    allowanceDesign: {
      rollback:
        'Additional1h owned infrastructure plus1 extra replica-free cleanup attempt,10000 operations and0.25GB sanitized diagnostics;priced only after all material model/meter binding',
      diagnosticContingency:
        '0.25GB plus defined2h absolute cleanup deadline;hard enforcement unbound',
      uncertaintyBuffer:
        'At least max(25% of complete bounded modeled max+rollback+diagnostic allowance,CAD5);recommendation only after all material costs bind',
    },
    RECOMMENDED_EXECUTION_CEILING_CAD: 'UNSUPPORTED',
    HUMAN_APPROVED_EXECUTION_CEILING_CAD: 'UNBOUND',
    quality: {
      MATERIAL_COST_COMPONENTS_BOUND: 'NO',
      KNOWN_USAGE_LIMITS: 'PROPOSED_YES_ENFORCEMENT_UNBOUND',
      BUILDER_BOUND: 'NO',
      NETWORK_COSTS_BOUND: 'METERS_BOUND;COURIER_AND_CAP_ENFORCEMENT_UNBOUND',
      ROLLBACK_INCLUDED: 'DESIGN_ONLY_MATERIAL_COSTS_UNBOUND',
    },
  }
}
export function validateDag(steps) {
  const ids = new Set(steps.map((step) => step.id))
  assert.equal(ids.size, steps.length, 'DUPLICATE_PLAN_ID')
  const visiting = new Set()
  const done = new Set()
  const byId = new Map(steps.map((step) => [step.id, step]))
  function visit(id) {
    assert(ids.has(id), `MISSING_PREREQUISITE:${id}`)
    assert(!visiting.has(id), `EXECUTION_DAG_CYCLE:${id}`)
    if (done.has(id)) return
    visiting.add(id)
    for (const dependency of byId.get(id).dependsOn) visit(dependency)
    visiting.delete(id)
    done.add(id)
  }
  for (const step of steps) visit(step.id)
  const order = new Map(steps.map((step, index) => [step.id, index]))
  for (const step of steps)
    assert(
      step.dependsOn.every((dependency) => order.get(dependency) < order.get(step.id)),
      'ORDERED_PLAN_NOT_TOPOLOGICAL',
    )
  return true
}
export function executionPlan(builder, packet) {
  const steps = []
  function step(
    id,
    owner,
    resource,
    action,
    dependsOn,
    pre,
    post,
    rollback,
    authority = 'Explicit human Decision A/B/C and subsequent bounded execution authorization',
  ) {
    steps.push({
      STEP: steps.length + 1,
      id,
      OWNER: owner,
      RESOURCE: resource,
      ACTION: action,
      dependsOn,
      PRECONDITIONS: pre,
      POSTCONDITIONS: post,
      ROLLBACK: rollback,
      HUMAN_AUTHORITY_REQUIRED: authority,
      execution: 'NOT_EXECUTED',
    })
  }
  step(
    'human-decisions',
    'PROOF',
    'Three-decision packet',
    'Bind A/B/C only after technical residuals close;approve exact packet digests',
    [],
    ['ROOT-1 closed', 'G3R3 technical gate PASS required;currently BLOCKED'],
    ['Human operator != approver;scope/cost bound'],
    'No resources yet',
  )
  step(
    'human-rg-bootstrap',
    'G3',
    rg,
    'Create exact empty RG through separately verified existing human authority',
    ['human-decisions'],
    ['No operator subscription grant', 'No collision'],
    ['RG exists;owned tags'],
    'Delete empty owned RG only',
  )
  step(
    'scoped-rbac',
    'RBAC',
    'Exact proposed RG/G2 grants',
    'Define/grant approved custom roles;deny broader grants',
    ['human-rg-bootstrap'],
    ['Human RBAC authority', 'Exact condition/principal bindings'],
    ['Readback;minimum roles;expiry enforcement'],
    'Revoke only created assignments;do not revoke existing staging grant',
  )
  step(
    'authorized-render',
    'G3',
    'Frozen qualified module source/templates',
    'Review authority-specific provisioning/RBAC/activation rendering;do not execute current false-only package or silently unlock it',
    ['scoped-rbac'],
    ['Exact signed approvals', 'No source architecture/protocol/root1 reopening'],
    ['Execution package hash bound to approval'],
    'Discard unexecuted render;retain frozen source',
  )
  step(
    'g3-foundation',
    'G3',
    `${rg}:network,identities,observability,vault,DNS`,
    'Deploy owned RG modules and G3-side peer;no G2 writes from source',
    ['authorized-render'],
    [
      'Network predeploy checks',
      'Directory identities strictlybelow98%',
      'Exact platform-IP prefix binding before activation',
    ],
    ['Exactly2 UAMIs;KV private;peering pending until reciprocal'],
    'Reverse owned DAG only;preserve unrelated G2',
  )
  step(
    'g2-preparation',
    'G2',
    packet.approval.RESOURCES_AFFECTED,
    'Apply exact approved G2 packet changes except post-identity-dependent role grants deferred below',
    ['g3-foundation'],
    ['Fresh etag/hash baseline accepted by human', 'No packet-target collision'],
    ['Peers Connected;firewall/DNS exact diff'],
    'Remove owned link/peer/collections with conflict guards',
  )
  step(
    'empty-environment',
    'G3',
    `${rg}/providers/Microsoft.App/managedEnvironments/nzila-g3-env-95086e2f`,
    'Create INTERNAL Consumption environment and returned-domain DNS,without workload',
    ['g2-preparation'],
    ['Platform NSG/DNS/firewall paths ready'],
    ['DefaultDomain/staticIP recorded;no workload'],
    'Delete owned env/DNS after artifacts retained',
  )
  step(
    'quota-query',
    'PROOF',
    'Actual managed environment usages',
    'GET Consumption core quota for exact returned environmentId',
    ['empty-environment'],
    ['Environment exists;same ID as later activation'],
    ['Quota evidence/time/environment bound'],
    'No quota mutation',
  )
  step(
    'quota-gate',
    'PROOF',
    'Capacity evidence',
    'Require availableConsumptionMilliCores>=250;deny on missing,wrong-environment,insufficient/stale evidence',
    ['quota-query'],
    ['Explicit quota record'],
    ['Gate PASS or STOP/no builder/activation'],
    'Leave idle owned environment only until authorized cleanup deadline;no automatic quota request',
  )
  step(
    'private-production',
    'REGISTRY',
    builder.temporaryResourcesIfBound,
    'Execute only bound private production model;current model BLOCKED so this step cannot start',
    ['quota-gate'],
    [
      'Builder model BOUND',
      'Hard TTL/credential/courier/network artifacts verified',
      'Operator Writer exact repo',
    ],
    ['Private push;source/config/platform preserved;receiver artifacts retained'],
    'Independent TTL,deallocate/delete owned adjunct resources,revoke temporary writer',
  )
  step(
    'bind-registry-manifest',
    'REGISTRY',
    `${registry}/repositories/g3-synthetic-runtime`,
    'Read exact authorized new registry manifest digest and verify content/source/platform',
    ['private-production'],
    ['No public ACR change', 'No local config-id substitution'],
    ['Immutable repository@sha256 runtime binding'],
    'Delete only newly owned manifest via separate cleaner authority',
  )
  step(
    'runtime-roles-and-secret',
    'RBAC',
    [secret, registry],
    'Private human-seed synthetic value,grant exact platform pull/runtime secret reader roles',
    ['bind-registry-manifest'],
    ['Actual2 UAMI principal IDs', 'Human seeder/RBAC authority;no secret in evidence'],
    ['Secret logical/version metadata;exact grants'],
    'Revoke owned roles;delete synthetic secret only;no purge',
  )
  step(
    'workload-activation',
    'G3',
    `${rg}/providers/Microsoft.App/containerApps/nzila-g3-proof-95086e2f`,
    'Activate max1 replica/revision immutable qualified source',
    ['runtime-roles-and-secret', 'quota-gate'],
    [
      'Quota refreshed if stale',
      'Explicit workload human authority',
      'Immutable registry digest',
      'Proof/cost/TTL enforcement active',
    ],
    ['Private health ready;Main/None identity separation'],
    'Disable/delete owned workload before secret/network rollback',
  )
  step(
    'private-secret-proof',
    'PROOF',
    'Private /healthz and /proof/secret',
    'Execute future authorized HMAC proof with independently held secret',
    ['workload-activation'],
    ['No live challenge until explicit authority', 'Private proof client bound'],
    ['Retain only nonce,proof,status,time,registry digest,revision,secret IDs'],
    'On disclosure/mismatch STOP and contain within authority',
  )
  step(
    'negative-controls',
    'PROOF',
    'Ten accepted negative probe specifications',
    'Execute only separately authorized bounded negatives',
    ['private-secret-proof'],
    ['Connectivity controls discriminate403 vs404/timeout', 'No mutation probe beyond authority'],
    ['All authorization/network/capacity denials evidenced'],
    'Unexpected success STOP;preserve sanitized evidence;scoped revoke/contain',
  )
  step(
    'reconcile',
    'PROOF',
    'G3 owned resources and retained G2 baseline',
    'Read ownership,network,RBAC,image/log/secret reference and accepted baselines',
    ['negative-controls'],
    ['Artifacts retained', 'No silent defaults'],
    ['No hidden G2 mutations or residual credentials'],
    'STOP on foreign drift;do not overwrite foreign changes',
  )
  step(
    'teardown',
    'G3',
    'Owned mission resources/grants and exact G2 additions',
    'By deadline remove adjunct and proof resources in reverse dependency order;retain sanitized evidence',
    ['reconcile'],
    ['Human-approved retained-vs-delete decision within A/B/C', 'Independent cleanup enforcement'],
    [
      'VM deallocated/deleted,NIC/disk removed,temporary grants revoked,G2 owned changes rolled back as approved',
    ],
    'Conflict-aware rollback;no stale full-resource restore',
  )
  validateDag(steps)
  return {
    status: 'DETERMINISTIC_NONEXECUTABLE_PLAN_WITH_EXACT_BUILDER_AND_COST_STOP_GATES',
    steps,
    graph: steps.flatMap((step) =>
      step.dependsOn.map((dependency) => ({ from: dependency, to: step.id })),
    ),
    currentMutationFlags: 'ALL_FALSE_AND_ALLOWED_FALSE;unchanged',
    postEnvironmentQuotaGate: [
      'ENVIRONMENT_CREATE',
      'QUERY_MANAGED_ENVIRONMENT_CONSUMPTION_CORE_QUOTA',
      'VERIFY_AVAILABLE_MILLICORES>=250',
      'WORKLOAD_ACTIVATION',
    ],
    missingOrInsufficientQuota: 'DENY_WORKLOAD_ACTIVATION;NO_AUTOMATIC_QUOTA_REQUEST',
    orderedRollback: [...steps].reverse().map((step) => ({ id: step.id, rollback: step.ROLLBACK })),
    authorization: 'NOT_AUTHORIZED',
    root1Reopened: false,
  }
}
const outputNames = [
  'G3R3_OPERATOR_PRIVILEGE_PACKET.json',
  'G3R3_G2_MUTATION_PACKET.json',
  'G3R3_EXECUTION_COST_ENVELOPE.json',
  'G3R3_EXECUTION_PLAN.json',
  'G3R3_FINAL_HUMAN_AUTHORIZATION_PACKET.md',
  'G3R3_EXECUTION_READINESS.json',
  'G3R3_EXECUTION_READINESS.md',
]
const config = await resolveConfig(path.join(root, '..', '..', 'package.json'))
async function json(name, value) {
  writeFileSync(
    path.join(evidence, name),
    await format(JSON.stringify(value), { ...config, parser: 'json' }),
  )
}
async function markdown(name, value) {
  writeFileSync(path.join(evidence, name), await format(value, { ...config, parser: 'markdown' }))
}
export async function generate() {
  verifyPreservation()
  assert.equal(read(path.join(evidence, 'G3R2I_IMAGE_QUALIFICATION.json')).G3R2I_GATE, 'PASS')
  const operator = privilegePacket()
  const g2 = mutationPacket(operator)
  const builder = builderModel()
  const costs = costEnvelope(builder)
  const plan = executionPlan(builder, g2)
  await json(outputNames[0], operator)
  await json(outputNames[1], g2)
  await json(outputNames[2], costs)
  await json(outputNames[3], plan)
  await markdown(
    outputNames[4],
    `# G3R3 final human authorization packet - NOT APPROVABLE FOR EXECUTION YET

Exactly three decision groups. Technical gate BLOCKED; no decision below is inferred or approved.
ROOT-1 remains closed; no fourth source decision. [Readiness](./G3R3_EXECUTION_READINESS.json)
contains exact subordinate ROOT-3/4 technical residuals before a complete executable packet can be offered.

## DECISION A - ACCOUNTABILITY

- Lifecycle owner: **HUMAN_BINDING_REQUIRED**.
- Execution operator: recommended **${principal}** (\`nzila-os-build\`), **NOT_APPOINTED**.
- Human approver: **HUMAN_BINDING_REQUIRED**; execution operator **must differ** from approver.
- Explicitly delegate secret-seeder,scope-limited RBAC and rollback duties within these roles;
  no service principal self-grant,unrelated staging grant or third UAMI is inferred.
- [Privilege packet](./G3R3_OPERATOR_PRIVILEGE_PACKET.json): no currently visible G3/G2 grant
  suffices;one unrelated staging AcrPush is excess to this mission but untouched. Scoped custom
  resource roles and ABAC repository grants proposed,not granted. Human bootstraps exact RG;
  no subscription-wide operator grant. Builder permission delta cannot be final until model binds.
- Approval status: **UNBOUND**.

## DECISION B - G2 CHANGESET

- [Exact core G2 packet](./G3R3_G2_MUTATION_PACKET.json) digest:
  **${g2.approval.G2_MUTATION_PACKET_DIGEST}**.
- Change count: **${g2.changes.length}** (reverse peer,DNS link,two firewall property changes,
  repository writer/reader/rollback-cleaner grants). Two firewall properties share one guarded PUT.
- Rollback: **CORE COMPLETE** with ownership,etag/conflict guards;no stale whole-resource restore.
- Explicitly accept the fresh captured G2 resource baseline;missing historical sealed G2
  packet is not claimed recovered. Public ACR stays disabled.
- Builder adjunct network/production model is still **BLOCKED**. No speculative bootstrap rule
  is hidden in this digest; if exact future G2 changes become necessary,recompute and reapprove
  digest before execution.
- Approval status: **UNBOUND**;current core packet does not authorize unknown adjunct changes.

## DECISION C - COST CEILING

- Recommended execution ceiling: **CAD UNSUPPORTED**.
- [Cost envelope](./G3R3_EXECUTION_COST_ENVELOPE.json): known conditional component maximum
  **CAD ${costs.knownComponentConditionalMaximumCAD.toFixed(4)}**, not an all-in cost or recommendation.
- Builder bootstrap/credential delivery,hard TTL/watchdog,courier/disk transactions,
  Standard-vault ordinary operation price and cap-enforcement facts remain unresolved.
- Exact ACR headroom is sufficient for0.2GiB reservation;existing base costs are shared/sunk,
  not double charged. No wrong vault SKU/geography or free egress allowance substitutes.
- Approve ceiling: **UNBOUND**. Do not approve a numerical ceiling from the conditional subtotal.

G3 execution **BLOCKED**;G3A **NOT_AUTHORIZED_PENDING_HUMAN_DECISIONS**;G3B **NOT_AUTHORIZED**.
This packet requests no appointment,grant,deployment,push,private builder or proof execution now.
`,
  )
  const ledger = read(path.join(evidence, 'G3R3_AZURE_READ_LEDGER.json'))
  const publicLedger = read(path.join(evidence, 'G3R3_PUBLIC_READ_LEDGER.json'))
  const readiness = {
    mission: 'NZ-20261008-INFRA-001',
    phase: 'G3R3',
    G3R3_GATE: 'BLOCKED',
    ROOT_1: 'CLOSED_BY_PROSPECTIVE_SUPERSESSION',
    ROOT_1_REOPENED: 'NO',
    ROOT_2_TECHNICAL_PACKET: operator.ROOT_2_TECHNICAL_PACKET,
    ROOT_2_HUMAN_AUTHORIZATION: 'PENDING',
    ROOT_3_TECHNICAL_PACKET: 'CORE_CHANGESET_ROLLBACK_COMPLETE;BUILDER_NETWORK_ADJUNCT_UNBOUND',
    ROOT_3_HUMAN_AUTHORIZATION: 'PENDING',
    ROOT_4_COST_MODEL: 'INCOMPLETE_EXACT_MATERIAL_ITEMS',
    ROOT_4_HUMAN_AUTHORIZATION: 'PENDING',
    G3_EXECUTION_READINESS: 'BLOCKED',
    G3A: 'NOT_AUTHORIZED_PENDING_HUMAN_DECISIONS',
    G3B: 'NOT_AUTHORIZED',
    remainingRoots: [
      'ROOT-2_ACCOUNTABILITY',
      'ROOT-3_G2_MUTATION_AUTHORITY',
      'ROOT-4_EXECUTION_ENVELOPE_AND_HUMAN_CEILING',
    ],
    exactTechnicalResiduals: costs.unresolvedMaterialItems,
    builder,
    G2_MUTATION_PACKET_DIGEST: g2.approval.G2_MUTATION_PACKET_DIGEST,
    RECOMMENDED_EXECUTION_CEILING_CAD: 'UNSUPPORTED',
    HUMAN_APPROVED_EXECUTION_CEILING_CAD: 'UNBOUND',
    executionGraphAcyclic: true,
    postEnvironmentQuotaGatePreserved: true,
    hiddenG2SourceMutations: 0,
    localValidation: {
      file: 'G3R3_LOCAL_VALIDATION.json',
      sha256: hash(readFileSync(path.join(evidence, 'G3R3_LOCAL_VALIDATION.json'))),
      scope: 'LOCAL_PACKET_VALIDATION_ONLY;NOT_EXECUTION_AUTHORITY_OR_LIVE_PROOF',
    },
    readOnlyEvidence: {
      azureCalls: ledger.length,
      azureSucceeded: ledger.filter((entry) => entry.status === 'SUCCEEDED').length,
      azureFailed: ledger.filter((entry) => entry.status === 'FAILED').length,
      publicPricingCalls: publicLedger.length,
      publicSucceeded: publicLedger.filter((entry) => entry.status === 'SUCCEEDED').length,
      publicFailed: publicLedger.filter((entry) => entry.status === 'FAILED').length,
      publicFailureDisposition:
        'One bandwidth catalog429 retained;successful bounded retry captured;no silent replacement of failed response',
      azureLedgerSha256: hash(readFileSync(path.join(evidence, 'G3R3_AZURE_READ_LEDGER.json'))),
      publicLedgerSha256: hash(readFileSync(path.join(evidence, 'G3R3_PUBLIC_READ_LEDGER.json'))),
    },
    preservation: {
      manifest: 'G3R3_HISTORICAL_PRESERVATION.json',
      sha256: hash(readFileSync(path.join(evidence, 'G3R3_HISTORICAL_PRESERVATION.json'))),
      unchanged: true,
    },
    boundaries: {
      AZURE_RESOURCE_MUTATIONS: 0,
      AZURE_RBAC_MUTATIONS: 0,
      AZURE_REGISTRY_MUTATIONS: 0,
      G2_MUTATIONS: 0,
      IMAGE_PUSHED: 'NO',
      LIVE_SECRET_CHALLENGE_EXECUTED: 'NO',
      G3_CONTROLLER_EXECUTED: 'NO',
      G3A_EXECUTED: 'NO',
      G3B_EXECUTED: 'NO',
      PRIVATE_BUILDER_EXECUTED: 'NO',
      NEW_LOCAL_IMAGE_BUILD: 'NO',
      ACCOUNTABLE_HUMANS_APPOINTED: 'NO',
      COST_CEILING_APPROVED: 'NO',
    },
  }
  await json(outputNames[5], readiness)
  await markdown(
    outputNames[6],
    `# G3R3 execution-readiness - BLOCKED

ROOT-1 remains CLOSED;qualified source/image/proof architecture unchanged. No historical recovery search.

- [Operator](./G3R3_OPERATOR_PRIVILEGE_PACKET.json): recommended ${principal},not appointed.
  Fresh identity/federation,transitive groups,direct/subscription/inherited roles/definitions and deny
  evidence captured. No visible target execution privileges;staging AcrPush not usable for G3.
- [G2 changes](./G3R3_G2_MUTATION_PACKET.json): ${g2.changes.length} exact core changes,
  digest **${g2.approval.G2_MUTATION_PACKET_DIGEST}**,rollback and ownership guards complete.
  No G2 route-table mutation is needed for selected peered prefixes;effective-route validation still required.
  No builder bootstrap allowance is invented. Human authority is unbound.
- [Builder](./G3R3_EXECUTION_READINESS.json): one proposed ephemeral G3 private VM/offline receiver
  candidate,not an executable selection. No accepted courier/tooling,credential-delivery or independent
  billable-lifetime/deletion watchdog contract. Current frozen builder NSG intentionally denies traffic.
- [Cost envelope](./G3R3_EXECUTION_COST_ENVELOPE.json): CAD meters captured with exact provenance,
  explicit quantities and traffic surfaces. ACR4,681,097 bytes used of500GiB included,0.2GiB reservation
  fits;existing base fees are shared/sunk. Ordinary Standard KV Operations CAD meter not available in
  CanadaCentral or primary Global catalog;Premium/foreign meters are not silently used.
  Known conditional component maximum **CAD ${costs.knownComponentConditionalMaximumCAD.toFixed(4)}**
  is not expected/all-in maximum or ceiling. Courier/disk transactions/watchdog/cap enforcement incomplete.
- Recommended ceiling **UNSUPPORTED**,human approval **UNBOUND**. Expected/all-in max,rollback,
  diagnostic contingency and uncertainty numbers remain null rather than manufactured.
- [Ordered DAG](./G3R3_EXECUTION_PLAN.json): acyclic;human decisions and scoped grants precede
  foundation/network,empty environment,actual quota read/gate,private production,new registry manifest,
  roles/secret,workload/proofs/reconciliation and cleanup. Missing/insufficient quota denies activation,
  no automatic quota request. Current false-only package stays unchanged;future authority-specific
  execution rendering is downstream of approval,not a reopened source root.
- [Human packet](./G3R3_FINAL_HUMAN_AUTHORIZATION_PACKET.md) has exactly three decision groups A/B/C.
  It cannot be offered as complete executable authority until the exact subordinate ROOT-3/4 facts close.
- [Local validation](./G3R3_LOCAL_VALIDATION.json):511 permitted offline regression tests,
  syntax/formatting,byte-identical generation,preservation and documentation checks passed.
  This validates local packets only,not effective future authorization,builder operation or live proof.

## Exact technical residuals (no new root categories)

${costs.unresolvedMaterialItems.map((item) => `- **${item.root}/${item.id}:** ${item.fact} Required: ${item.required}`).join('\n')}

## Read-only and execution boundaries

${ledger.length} Azure calls,all successful GET/account-only;${publicLedger.length} public price GETs,
one429 preserved and retried successfully. All prior evidence,qualified source,candidate and G2 source
hashes preserved. Azure resource/RBAC/registry,G2 mutations0;no image push,private builder,controller,
live proof,G3A/G3B,appointments or ceiling approval. G3 execution BLOCKED;
G3A NOT_AUTHORIZED_PENDING_HUMAN_DECISIONS;G3B NOT_AUTHORIZED.
`,
  )
  await json('G3R3_OUTPUT_BINDING.json', {
    generatorSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
    files: [...outputNames, 'G3R3_LOCAL_VALIDATION.json'].map((name) => ({
      name,
      sha256: hash(readFileSync(path.join(evidence, name))),
    })),
    readFiles: readdirSync(evidence)
      .filter((name) =>
        /^G3R3_(READ_|PRICE_|AZURE_READ_LEDGER|PUBLIC_READ_LEDGER|HISTORICAL_PRESERVATION)/.test(
          name,
        ),
      )
      .map((name) => ({ name, sha256: hash(readFileSync(path.join(evidence, name))) })),
  })
  verifyPreservation()
  return readiness
}
export function check() {
  verifyPreservation()
  const binding = read(path.join(evidence, 'G3R3_OUTPUT_BINDING.json'))
  assert.equal(hash(readFileSync(fileURLToPath(import.meta.url))), binding.generatorSha256)
  for (const entry of [...binding.files, ...binding.readFiles])
    assert.equal(
      hash(readFileSync(path.join(evidence, entry.name))),
      entry.sha256,
      `G3R3_OUTPUT_OR_READ_CHANGED:${entry.name}`,
    )
  validateDag(read(path.join(evidence, outputNames[3])).steps)
  assert.equal(
    read(path.join(evidence, outputNames[2])).RECOMMENDED_EXECUTION_CEILING_CAD,
    'UNSUPPORTED',
  )
  return { status: 'PASS_LOCAL_PACKET_HASH_GRAPH_AND_HISTORICAL_PRESERVATION;G3R3_BLOCKED' }
}
export async function main(args) {
  assert(
    args.length === 1 && ['--write', '--check'].includes(args[0]),
    'G3R3_LOCAL_PACKET_FLAGS_ONLY',
  )
  if (args[0] === '--write') await generate()
  else check()
  console.log(
    'PASS local G3R3 packet validation;G3R3 BLOCKED exact builder/cost residuals;zero mutation.',
  )
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2))
