import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'

export const environmentCodes = JSON.parse(readFileSync(new URL('./naming.json', import.meta.url), 'utf8')).environmentCodes
export const environments = Object.keys(environmentCodes)
export const requiredTags = ['product', 'environment', 'service', 'owner', 'cost_center', 'data_classification']

export function validateRuntimeInputs(input) {
  if (!input || typeof input !== 'object') throw new Error('Runtime inputs must be an object')
  if (!['union-eyes', 'cora'].includes(input.product)) throw new Error('Unsupported product')
  if (!environments.includes(input.environment)) throw new Error('Unsupported environment')
  if (input.location !== 'canadacentral') throw new Error('Primary must be Canada Central')
  for (const key of ['owner', 'costCenter', 'workloadName']) {
    if (typeof input[key] !== 'string' || !input[key].trim()) throw new Error(`Missing ${key}`)
  }
  if (!/^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){0,9}$/.test(input.workloadName)) throw new Error('Invalid workload name')
  if (!['synthetic', 'internal', 'confidential', 'institutional'].includes(input.dataClassification)) {
    throw new Error('Unsupported data classification')
  }
  if (input.environment !== 'production' && input.dataClassification !== 'synthetic') {
    throw new Error('Low-cost nonproduction profile admits synthetic data only')
  }
  if (!/^[a-z0-9]+\.azurecr\.io$/.test(input.imageRegistry)) throw new Error('Expected Azure ACR login server')
  if (!/^[a-z0-9]+(?:[._/-][a-z0-9]+)*$/.test(input.imageRepository)) throw new Error('Invalid image repository')
  if (!/^[0-9a-f]{40}$/.test(input.sourceCommit)) throw new Error('A full lowercase source commit SHA is required')
  if (!/^[0-9a-f]{64}$/.test(input.imageDigest)) throw new Error('A complete lowercase SHA256 digest is required')
  for (const key of ['readinessPath', 'livenessPath']) {
    if (typeof input[key] !== 'string' || !input[key].startsWith('/')) throw new Error(`Invalid ${key}`)
  }
  if (!Number.isInteger(input.targetPort) || input.targetPort < 1 || input.targetPort > 65535) {
    throw new Error('Invalid target port')
  }
}

function resources(template) {
  const top = Array.isArray(template.resources) ? template.resources : Object.values(template.resources ?? {})
  return top.flatMap(resource => [
    resource,
    ...resources({ resources: resource.properties?.template?.resources ?? resource.resources ?? [] }),
  ])
}

function validateTags(template, inherited = {}) {
  function tagObject(value) {
    if (value && typeof value === 'object') return value
    if (typeof value === 'string') {
      const variable = value.match(/^\[(?:union\()?variables\('([^']+)'\)/)
      if (variable) return tagObject(template.variables?.[variable[1]])
      const parameter = value.match(/^\[(?:union\()?parameters\('([^']+)'\)/)
      if (parameter) return tagObject(inherited[parameter[1]])
    }
    throw new Error('Unresolved required resource tags')
  }
  const taggable = new Set([
    'Microsoft.Resources/resourceGroups', 'Microsoft.Network/virtualNetworks',
    'Microsoft.Network/privateDnsZones', 'Microsoft.Network/privateDnsZones/virtualNetworkLinks',
    'Microsoft.Network/privateEndpoints', 'Microsoft.ManagedIdentity/userAssignedIdentities',
    'Microsoft.DBforPostgreSQL/flexibleServers', 'Microsoft.KeyVault/vaults',
    'Microsoft.Storage/storageAccounts', 'Microsoft.ContainerRegistry/registries',
    'Microsoft.App/managedEnvironments',
    'Microsoft.App/containerApps', 'Microsoft.Cdn/profiles', 'Microsoft.Cdn/profiles/afdEndpoints',
    'Microsoft.Network/frontdoorWebApplicationFirewallPolicies', 'Microsoft.OperationalInsights/workspaces',
  ].map(type => type.toLowerCase()))
  const top = Array.isArray(template.resources) ? template.resources : Object.values(template.resources ?? {})
  for (const resource of top) {
    if (taggable.has(resource.type.toLowerCase())) {
      const tags = tagObject(resource.tags)
      for (const tag of requiredTags) {
        if (!(tag in tags)) throw new Error(`Missing resource tag ${tag} on ${resource.type}`)
      }
    }
    if (resource.properties?.template) {
      const passedTags = resource.properties.parameters?.tags?.value
      validateTags(resource.properties.template, passedTags ? { tags: tagObject(passedTags) } : {})
    }
  }
}

export function validateCompiledFoundation(templates) {
  function find(name, type) {
    const resource = resources(templates[name]).find(item => item.type.toLowerCase() === type.toLowerCase())
    if (!resource) throw new Error(`Missing ${type} in ${name}`)
    return resource
  }
  function require(condition, message) {
    if (!condition) throw new Error(message)
  }
  const db = find('foundation', 'Microsoft.DBforPostgreSQL/flexibleServers')
  require(db.properties.network.publicNetworkAccess === 'Disabled', 'PostgreSQL is not private')
  require(db.properties.authConfig.passwordAuth === 'Disabled', 'Database password auth is enabled')
  require(db.properties.network.delegatedSubnetResourceId && db.properties.network.privateDnsZoneArmResourceId,
    'Missing private database routing/DNS')
  const kv = find('foundation', 'Microsoft.KeyVault/vaults')
  const storage = find('foundation', 'Microsoft.Storage/storageAccounts')
  for (const resource of [kv, storage]) {
    require(resource.properties.publicNetworkAccess === 'Disabled', `${resource.type} has public access`)
    require(resource.properties.networkAcls.defaultAction === 'Deny', `${resource.type} has default Allow`)
    require(resource.properties.networkAcls.bypass === 'None', `${resource.type} bypasses network controls`)
  }
  require(storage.properties.allowSharedKeyAccess === false, 'Storage shared-key access enabled')
  require(JSON.stringify(templates.foundation).includes('privatelink.azurecr.io'),
    'ACR private DNS zone is missing from the foundation')
  const registry = find('registry', 'Microsoft.ContainerRegistry/registries')
  require(registry.sku.name === 'Premium', 'Private ACR requires Premium')
  require(registry.properties.publicNetworkAccess === 'Disabled', 'ACR public access is enabled')
  require(registry.properties.adminUserEnabled === false, 'ACR admin credentials are enabled')
  require(registry.properties.anonymousPullEnabled === false, 'ACR anonymous pull is enabled')
  require(registry.properties.networkRuleBypassOptions === 'None', 'ACR Azure-service bypass is enabled')
  const registryEndpointModule = resources(templates.registry).find(resource =>
    resource.type.toLowerCase() === 'microsoft.resources/deployments' &&
    resource.name === 'registry-endpoint')
  require(registryEndpointModule?.properties.parameters.groupId?.value === 'registry',
    'ACR private endpoint targets the wrong subresource')
  require(registryEndpointModule?.properties.parameters.targetId?.value?.includes(
    'Microsoft.ContainerRegistry/registries'), 'ACR private endpoint must target the registry')
  require(registryEndpointModule?.properties.parameters.dnsZoneId?.value?.includes(
    "parameters('registryPrivateDnsZoneId')"), 'ACR private endpoint must use its private DNS zone')
  const registryPrivateEndpoint = resources(templates.registry).find(resource =>
    resource.type.toLowerCase() === 'microsoft.network/privateendpoints')
  require(registryPrivateEndpoint, 'ACR private endpoint is missing')
  require(registryPrivateEndpoint.properties.privateLinkServiceConnections[0].properties.groupIds
    .includes("[parameters('groupId')]"), 'ACR endpoint must use the registry subresource')
  const registryDnsGroup = resources(templates.registry).find(resource =>
    resource.type.toLowerCase() === 'microsoft.network/privateendpoints/privatednszonegroups')
  require(registryDnsGroup?.properties.privateDnsZoneConfigs[0].properties.privateDnsZoneId,
    'ACR private endpoint DNS zone is missing')
  const acrPull = resources(templates.registry).find(resource =>
    resource.type.toLowerCase() === 'microsoft.authorization/roleassignments' &&
    resource.properties.roleDefinitionId?.includes('7f951dda-4ed3-4680-a7ca-43fe172d538d') &&
    resource.scope?.includes('Microsoft.ContainerRegistry/registries') &&
    resource.properties.principalId?.includes("parameters('workloadPrincipalId')"))
  require(acrPull, 'Registry-scoped AcrPull assignment is missing')
  const env = find('runtime', 'Microsoft.App/managedEnvironments')
  require(env.properties.publicNetworkAccess === 'Disabled', 'ACA origin bypass possible')
  require(env.properties.vnetConfiguration.internal === true, 'ACA environment must use an internal VIP')
  const acaEndpointModule = resources(templates.runtime).find(resource =>
    resource.type.toLowerCase() === 'microsoft.resources/deployments' &&
    resource.name === 'runtime-endpoint')
  require(acaEndpointModule?.properties.parameters.groupId?.value === 'managedEnvironments',
    'ACA private endpoint targets the wrong subresource')
  require(acaEndpointModule?.properties.parameters.subnetId?.value?.includes("parameters('endpointSubnetId')"),
    'ACA private endpoint must use the dedicated endpoint subnet')
  require(acaEndpointModule?.properties.parameters.targetId?.value?.includes('Microsoft.App/managedEnvironments'),
    'ACA private endpoint must target the managed environment')
  require(acaEndpointModule?.properties.parameters.dnsZoneId?.value?.includes("parameters('appPrivateDnsZoneId')"),
    'ACA private endpoint must use its private DNS zone')
  const acaPrivateEndpoint = resources(templates.runtime).find(resource =>
    resource.type.toLowerCase() === 'microsoft.network/privateendpoints')
  require(acaPrivateEndpoint, 'ACA environment private endpoint is missing')
  require(acaPrivateEndpoint.properties.privateLinkServiceConnections[0].properties.groupIds
    .includes("[parameters('groupId')]"), 'ACA endpoint must use its declared subresource')
  require(acaPrivateEndpoint.properties.subnet.id, 'ACA private endpoint subnet is missing')
  const acaDnsGroup = resources(templates.runtime).find(resource =>
    resource.type.toLowerCase() === 'microsoft.network/privateendpoints/privatednszonegroups')
  require(acaDnsGroup?.properties.privateDnsZoneConfigs[0].properties.privateDnsZoneId,
    'ACA private endpoint DNS zone is missing')
  const app = find('runtime', 'Microsoft.App/containerApps')
  require(app.identity.type === 'UserAssigned', 'Missing workload identity')
  require(app.properties.template.containers[0].image.includes('@sha256:'), 'Mutable image contract')
  require(!JSON.stringify(app.properties).includes(':latest'), 'latest image contract')
  const edge = find('edge', 'Microsoft.Cdn/profiles')
  require(edge.sku.name === 'Premium_AzureFrontDoor', 'Private origin requires Premium')
  const origin = find('edge', 'Microsoft.Cdn/profiles/originGroups/origins')
  require(origin.properties.sharedPrivateLinkResource.groupId === 'managedEnvironments', 'Missing private origin')
  require(origin.properties.sharedPrivateLinkResource.privateLink.id, 'Private origin target is missing')
  require(origin.properties.enforceCertificateNameCheck === true, 'Origin certificate validation must be enabled')
  const route = find('edge', 'Microsoft.Cdn/profiles/afdEndpoints/routes')
  require(route.properties.supportedProtocols.length === 1 &&
    route.properties.supportedProtocols[0] === 'Https', 'Edge route must accept HTTPS only')
  require(route.properties.forwardingProtocol === 'HttpsOnly' &&
    route.properties.httpsRedirect === 'Disabled', 'Edge origin forwarding must be HTTPS-only')
  find('edge', 'Microsoft.Cdn/profiles/securityPolicies')
  const waf = find('edge', 'Microsoft.Network/frontdoorWebApplicationFirewallPolicies')
  require(waf.properties.policySettings.enabledState === 'Enabled' &&
    waf.properties.policySettings.mode === 'Prevention', 'WAF must be enabled in prevention mode')
  require(waf.properties.managedRules.managedRuleSets.some(ruleSet =>
    ruleSet.ruleSetType === 'Microsoft_DefaultRuleSet' && ruleSet.ruleSetVersion === '2.1' &&
    ruleSet.ruleSetAction === 'Block'), 'Managed WAF default rules must block by default')
  const edgeDiagnostics = resources(templates.edge).filter(resource =>
    resource.type.toLowerCase() === 'microsoft.insights/diagnosticsettings')
  require(edgeDiagnostics.length === 2, 'Separate edge operations and security diagnostics are required')
  for (const [name, template] of Object.entries(templates)) {
    const tagContext = name === 'registry'
      ? { tags: Object.fromEntries(requiredTags.map(tag => [tag, true])) }
      : {}
    validateTags(template, tagContext)
  }
  require(JSON.stringify(templates.foundation).includes('Standard_D2s_v3'), 'Unexpected production capacity profile')
  require(!JSON.stringify(templates).includes('Standard_E8'), 'Oversized default profile')
}

export function validateLegacyCompiled(template) {
  const modules = resources(template).filter(resource => {
    if (resource.type.toLowerCase() !== 'microsoft.resources/deployments') return false
    return resources(resource.properties.template).some(child => child.type === 'Microsoft.App/containerApps')
  })
  if (modules.length !== 2) throw new Error('Expected primary and secondary legacy runtime modules')
  for (const module of modules) {
    if (module.properties.parameters.environment?.value !== "[parameters('env')]" ||
        module.properties.parameters.imageDigests?.value !== "[parameters('imageDigests')]") {
      throw new Error('Missing production digest gate on legacy module')
    }
    const app = resources(module.properties.template).find(resource => resource.type === 'Microsoft.App/containerApps')
    const image = app.properties.template.containers[0].image
    if (!image.startsWith("[if(equals(parameters('environment'), 'prod'),") ||
        !image.includes("@sha256:") || !image.includes("parameters('imageDigests')")) {
      throw new Error('Legacy production must resolve immutable artifacts without a tag fallback')
    }
  }
}

export function validateProofOrchestration(template) {
    const modules = resources(template).filter(resource =>
      resource.type.toLowerCase() === 'microsoft.resources/deployments')
    function moduleNamed(name) {
      const result = modules.find(resource => resource.name === name)
      if (!result) throw new Error(`Missing ${name} deployment module`)
      return result
    }
    function require(condition, message) {
      if (!condition) throw new Error(message)
    }
    const foundation = moduleNamed('nzila-g2-proof-foundation')
    const registry = moduleNamed('nzila-g2-proof-artifact-registry')
    const runtime = moduleNamed('nzila-g2-proof-runtime')
    const edge = moduleNamed('nzila-g2-proof-edge')
    require(foundation.properties.parameters.product?.value === 'union-eyes' &&
      foundation.properties.parameters.environment?.value === 'integration-test' &&
      foundation.properties.parameters.dataClassification?.value === 'synthetic' &&
      foundation.properties.parameters.purpose?.value === 'infrastructure-proof',
    'Proof foundation must be fixed to the approved synthetic-only boundary')
    for (const key of ['owner', 'costCenter', 'databaseAdminGroupName', 'databaseAdminGroupObjectId']) {
      require(foundation.properties.parameters[key]?.value?.includes(`parameters('${key}')`),
        `Foundation must receive explicit ${key}`)
    }
    const runtimeParameters = runtime.properties.parameters
    for (const key of [
      'imageRegistry', 'imageRepository', 'sourceCommit', 'imageDigest', 'workloadIdentityId',
      'appSubnetId', 'endpointSubnetId', 'appPrivateDnsZoneId', 'operationsWorkspaceId',
    ]) {
      require(runtimeParameters[key]?.value, `Runtime orchestration is missing ${key}`)
    }
    require(!Object.hasOwn(template.parameters ?? {}, 'imageRegistry'),
      'Registry host must not be an arbitrary proof input')
    require(runtimeParameters.imageRegistry.value.includes('nzila-g2-proof-artifact-registry'),
      'Runtime registry must come from the proof-scoped ACR module')
    const registryParameters = registry.properties.parameters
    for (const key of ['registryName', 'endpointSubnetId', 'registryPrivateDnsZoneId', 'workloadPrincipalId']) {
      require(registryParameters[key]?.value, `Registry orchestration is missing ${key}`)
    }
    for (const key of ['endpointSubnetId', 'registryPrivateDnsZoneId', 'workloadPrincipalId']) {
      require(registryParameters[key].value.includes('nzila-g2-proof-foundation'),
        `Registry ${key} must come from the proof foundation`)
    }
    require(runtimeParameters.imageDigest.value.includes("parameters('imageDigest')"),
      'Runtime digest must be an explicit deployment input')
    require(runtimeParameters.sourceCommit.value.includes("parameters('sourceCommit')"),
      'Runtime source commit must be an explicit deployment input')
    const edgeParameters = edge.properties.parameters
    for (const key of ['managedEnvironmentId', 'originHost', 'operationsWorkspaceId', 'securityWorkspaceId']) {
      require(edgeParameters[key]?.value, `Edge orchestration is missing ${key}`)
    }
    require(edgeParameters.managedEnvironmentId.value.includes('nzila-g2-proof-runtime') &&
      edgeParameters.originHost.value.includes('nzila-g2-proof-runtime'),
    'Edge Private Link target and origin must come from the deployed runtime outputs')
}

export function validateArtifactFoundationOrchestration(template) {
  const all = resources(template)
  const allowedTypes = new Set([
    'Microsoft.Resources/resourceGroups',
    'Microsoft.Resources/deployments',
    'Microsoft.Network/virtualNetworks',
    'Microsoft.Network/networkSecurityGroups',
    'Microsoft.Network/privateDnsZones',
    'Microsoft.Network/privateDnsZones/virtualNetworkLinks',
    'Microsoft.Network/privateEndpoints',
    'Microsoft.Network/privateEndpoints/privateDnsZoneGroups',
    'Microsoft.ManagedIdentity/userAssignedIdentities',
    'Microsoft.ContainerRegistry/registries',
    'Microsoft.Authorization/roleAssignments',
  ].map(type => type.toLowerCase()))
  function require(condition, message) {
    if (!condition) throw new Error(message)
  }
  for (const resource of all) {
    require(allowedTypes.has(resource.type.toLowerCase()),
      `Artifact bootstrap contains out-of-scope resource ${resource.type}`)
  }
  const modules = all.filter(resource =>
    resource.type.toLowerCase() === 'microsoft.resources/deployments')
  function moduleNamed(name) {
    const result = modules.find(resource => resource.name === name)
    if (!result) throw new Error(`Missing ${name} deployment module`)
    return result
  }
  const networkModule = moduleNamed('nzila-g2-proof-network')
  const registry = moduleNamed('nzila-g2-proof-artifact-registry')
  require(modules.length === 3 && modules.some(resource => resource.name === 'registry-endpoint'),
    'Artifact bootstrap must contain only its network, registry, and registry-endpoint modules')
  const groups = all.filter(resource =>
    resource.type.toLowerCase() === 'microsoft.resources/resourcegroups')
  require(groups.length === 1 && groups[0].name === 'nzila-union-eyes-integration-test-rg',
    'Artifact bootstrap must target only the approved synthetic UE resource group')
  require(networkModule.properties.parameters.product?.value === 'union-eyes' &&
    networkModule.properties.parameters.environment?.value === 'integration-test' &&
    networkModule.properties.parameters.location?.value === 'canadacentral',
  'Artifact network must be fixed to the Canada Central synthetic-only boundary')

  const networkTemplate = networkModule.properties.template
  require(networkTemplate.variables?.prefix ===
    "[format('nzila-{0}-{1}', parameters('product'), parameters('environment'))]" &&
    networkTemplate.variables?.networkIndex === 33,
  'Artifact network must retain the canonical UE integration-test naming and address allocation')
  const networkResources = networkTemplate.resources ?? []
  const vnets = networkResources.filter(resource =>
    resource.type.toLowerCase() === 'microsoft.network/virtualnetworks')
  require(vnets.length === 1 && vnets[0].name === "[format('{0}-vnet', variables('prefix'))]",
    'Artifact bootstrap must reuse the canonical UE integration-test VNet')
  const vnet = vnets[0]
  require(JSON.stringify(vnet.properties.addressSpace.addressPrefixes) ===
    '["[format(\'10.{0}.0.0/16\', variables(\'networkIndex\'))]"]',
    'Artifact bootstrap must reuse the canonical 10.33.0.0/16 address space')
  const subnetPrefixes = Object.fromEntries((vnet.properties.subnets ?? []).map(subnet => [
    subnet.name, subnet.properties.addressPrefix,
  ]))
  require(JSON.stringify(subnetPrefixes) === JSON.stringify({
    apps: "[format('10.{0}.0.0/23', variables('networkIndex'))]",
    database: "[format('10.{0}.2.0/24', variables('networkIndex'))]",
    'private-endpoints': "[format('10.{0}.3.0/24', variables('networkIndex'))]",
    builders: "[format('10.{0}.4.0/24', variables('networkIndex'))]",
  }), 'Artifact bootstrap subnets must match the canonical UE integration-test allocation')
  require(vnet.properties.subnets.find(subnet => subnet.name === 'apps')?.properties.delegations
    ?.some(delegation => delegation.properties.serviceName === 'Microsoft.App/environments') &&
    vnet.properties.subnets.find(subnet => subnet.name === 'database')?.properties.delegations
      ?.some(delegation => delegation.properties.serviceName === 'Microsoft.DBforPostgreSQL/flexibleServers') &&
    vnet.properties.subnets.find(subnet => subnet.name === 'private-endpoints')?.properties
      .privateEndpointNetworkPolicies === 'Disabled',
  'Artifact bootstrap subnets must preserve their delegated and private-endpoint roles')
  const builderSubnet = vnet.properties.subnets.find(subnet => subnet.name === 'builders')
  const builderNsg = networkResources.filter(resource =>
    resource.type.toLowerCase() === 'microsoft.network/networksecuritygroups')
  require(builderSubnet?.properties.defaultOutboundAccess === false &&
    builderSubnet.properties.networkSecurityGroup?.id ===
      "[resourceId('Microsoft.Network/networkSecurityGroups', format('{0}-builder-nsg', variables('prefix')))]" &&
    builderNsg.length === 1 &&
    builderNsg[0].properties.securityRules?.length === 1 &&
    builderNsg[0].properties.securityRules[0].name === 'deny-all-inbound' &&
    builderNsg[0].properties.securityRules[0].properties.direction === 'Inbound' &&
    builderNsg[0].properties.securityRules[0].properties.access === 'Deny',
  'Private-builder subnet must disable default egress and deny all inbound traffic')

  const dnsZones = all.filter(resource => resource.type.toLowerCase() === 'microsoft.network/privatednszones')
  const dnsLinks = networkResources.filter(resource =>
    resource.type.toLowerCase() === 'microsoft.network/privatednszones/virtualnetworklinks')
  require(dnsZones.length === 1 && dnsZones[0].name === 'privatelink.azurecr.io' &&
    dnsLinks.length === 1 &&
    dnsLinks[0].name === "[format('{0}/{1}', 'privatelink.azurecr.io', format('{0}-link', variables('prefix')))]",
    'Artifact bootstrap must create only the ACR private DNS zone and its VNet link')
  require(dnsLinks[0].properties.registrationEnabled === false &&
    dnsLinks[0].properties.virtualNetwork.id ===
      "[resourceId('Microsoft.Network/virtualNetworks', format('{0}-vnet', variables('prefix')))]",
  'ACR private DNS link must target the canonical VNet without auto-registration')

  const identities = networkResources.filter(resource =>
    resource.type.toLowerCase() === 'microsoft.managedidentity/userassignedidentities')
  require(identities.length === 1 &&
    identities[0].name === "[format('{0}-proof-api-identity', variables('prefix'))]",
    'Artifact bootstrap must declare only the approved proof workload identity')

  const registries = all.filter(resource =>
    resource.type.toLowerCase() === 'microsoft.containerregistry/registries')
  require(registries.length === 1 && registries[0].sku.name === 'Premium' &&
    registries[0].properties.publicNetworkAccess === 'Disabled' &&
    registries[0].properties.adminUserEnabled === false &&
    registries[0].properties.anonymousPullEnabled === false &&
    registries[0].properties.networkRuleBypassOptions === 'None',
  'Artifact bootstrap ACR must be Premium and private with admin, anonymous, and bypass access disabled')
  const endpoints = all.filter(resource => resource.type.toLowerCase() === 'microsoft.network/privateendpoints')
  require(endpoints.length === 1, 'Artifact bootstrap must contain exactly one private endpoint')
  const endpoint = endpoints[0]
  require(JSON.stringify(endpoint.properties.privateLinkServiceConnections?.[0]?.properties?.groupIds) ===
    '["[parameters(\'groupId\')]"]' &&
    endpoint.properties.privateLinkServiceConnections?.[0]?.properties?.privateLinkServiceId
      === "[parameters('targetId')]" &&
    endpoint.properties.subnet?.id === "[parameters('subnetId')]",
  'Artifact private endpoint must target only the in-boundary ACR registry subresource')

  const assignments = all.filter(resource =>
    resource.type.toLowerCase() === 'microsoft.authorization/roleassignments')
  require(assignments.length === 2, 'Artifact bootstrap must contain only the runtime pull and private-builder push assignments')
  const pull = assignments.find(resource =>
    JSON.stringify(resource.properties.roleDefinitionId).includes('7f951dda-4ed3-4680-a7ca-43fe172d538d'))
  const push = assignments.find(resource =>
    JSON.stringify(resource.properties.roleDefinitionId).includes('8311e382-0749-4cb8-b61a-304f252e45ec'))
  require(pull && push &&
    pull.properties.principalId === "[parameters('workloadPrincipalId')]" &&
    push.properties.principalId.includes('Microsoft.ManagedIdentity/userAssignedIdentities') &&
    push.properties.principalId.includes('-build-identity') &&
    pull.scope === "[resourceId('Microsoft.ContainerRegistry/registries', parameters('registryName'))]",
  'Artifact bootstrap may grant only registry-scoped AcrPull to runtime and AcrPush to the private-builder identity')
  require(push.scope === pull.scope,
    'Private-builder AcrPush must be scoped to the isolated proof registry')
  for (const key of ['endpointSubnetId', 'registryPrivateDnsZoneId', 'workloadPrincipalId']) {
    require(registry.properties.parameters[key]?.value?.includes('nzila-g2-proof-network'),
      `Artifact registry ${key} must come from the proof network module`)
  }
  require(registry.properties.parameters.workloadIdentityName?.value ===
    'nzila-union-eyes-integration-test-proof-api-identity',
  'Artifact registry pull-role name must identify the canonical proof workload UAMI')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [artifactDirectory, parameterFile] = process.argv.slice(2)
  if (!artifactDirectory) throw new Error('Usage: node validate.mjs <compiled-artifact-directory> [runtime-parameters.json]')
  const templates = Object.fromEntries(['foundation', 'runtime', 'edge', 'operations'].map(name => [
    name, JSON.parse(readFileSync(join(artifactDirectory, `g1-${name}.json`), 'utf8')),
  ]))
  templates.registry = JSON.parse(readFileSync(join(artifactDirectory, 'g2-artifact-registry.json'), 'utf8'))
  validateCompiledFoundation(templates)
  validateLegacyCompiled(JSON.parse(readFileSync(join(artifactDirectory, 'g1-legacy-main.json'), 'utf8')))
  validateProofOrchestration(JSON.parse(readFileSync(join(artifactDirectory, 'g2-proof.json'), 'utf8')))
  validateArtifactFoundationOrchestration(
    JSON.parse(readFileSync(join(artifactDirectory, 'g2-artifact-foundation.json'), 'utf8')),
  )
  if (parameterFile) {
    const parameters = JSON.parse(readFileSync(parameterFile, 'utf8')).parameters
    if (!parameters) throw new Error('Expected ARM deployment parameter file')
    validateRuntimeInputs(Object.fromEntries(Object.entries(parameters).map(([key, entry]) => [key, entry.value])))
  }
  console.log('PASS: compiled private foundation contracts; no runtime certification')
}
