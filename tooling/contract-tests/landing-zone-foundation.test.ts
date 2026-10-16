import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { environmentCodes, environments, requiredTags, validateArtifactFoundationOrchestration, validateCompiledFoundation, validateLegacyCompiled, validateProofOrchestration, validateRuntimeInputs } from '../../infrastructure/landing-zone/validate.mjs'

const root = join(__dirname, '..', '..', 'infrastructure', 'landing-zone')
const read = (name: string) => readFileSync(join(root, name), 'utf8')
type EmittedResource = {
  type: string
  properties?: {
    template?: { resources?: EmittedResource[] }
    publicNetworkAccess?: string
    roleDefinitionId?: string
    [key: string]: unknown
  }
}
const emittedResources = (template: { resources?: EmittedResource[] }): EmittedResource[] => {
  const top = template.resources ?? []
  return top.flatMap(resource => [
    resource,
    ...emittedResources({ resources: resource.properties?.template?.resources ?? [] }),
  ])
}
const valid = {
  product: 'union-eyes',
  environment: 'production',
  location: 'canadacentral',
  owner: 'platform',
  costCenter: 'institutional',
  workloadName: 'web',
  dataClassification: 'institutional',
  imageRegistry: 'nzilacanadaacr.azurecr.io',
  imageRepository: 'nzila/union-eyes',
  sourceCommit: 'b'.repeat(40),
  imageDigest: 'a'.repeat(64),
  targetPort: 3000,
  readinessPath: '/health/readiness',
  livenessPath: '/health/liveness',
}

describe('institutional landing-zone foundation', () => {
  it('accepts immutable artifacts for either product and all synthetic nonproduction environments', () => {
    for (const product of ['union-eyes', 'cora']) {
      for (const environment of environments) {
        expect(() => validateRuntimeInputs({
          ...valid, product, environment,
          dataClassification: environment === 'production' ? 'institutional' : 'synthetic',
        })).not.toThrow()
      }
    }
  })

  it.each(['latest', 'v1.2.3', 'a'.repeat(63), 'a'.repeat(65), 'g'.repeat(64), 'A'.repeat(64)])(
    'rejects mutable or malformed digest %s', imageDigest => {
      expect(() => validateRuntimeInputs({ ...valid, imageDigest })).toThrow(/SHA256/)
    },
  )

  it.each([
    { environment: 'prod' },
    { environment: 'pilot' },
    { product: 'shared' },
    { location: 'eastus' },
    { owner: '' },
    { costCenter: ' ' },
    { imageRegistry: 'https://nzilacanadaacr.azurecr.io' },
    { imageRepository: 'nzila/union-eyes:latest' },
    { targetPort: 0 },
    { readinessPath: 'health' },
    { workloadName: 'overlong-workload' },
    { workloadName: 'invalid--' },
    { environment: 'staging', dataClassification: 'institutional' },
  ])('fails closed on invalid boundaries: %j', override => {
    expect(() => validateRuntimeInputs({ ...valid, ...override })).toThrow()
  })

  it('has no application or edge deployment in the data-plane foundation', () => {
    const foundation = read('foundation.bicep')
    expect(foundation).not.toContain("'Microsoft.App/containerApps")
    expect(foundation).not.toContain("'Microsoft.Cdn/profiles")
    expect(foundation).not.toContain('administratorLoginPassword')
    expect(foundation).not.toContain('firewallRules')
    expect(foundation).toContain("passwordAuth: 'Disabled'")
  })

  it('allocates eight distinct product/environment address spaces', () => {
    const addresses = ['union-eyes', 'cora'].flatMap(product =>
      environments.map((_, index) => `10.${(product === 'union-eyes' ? 32 : 48) + index}.0.0/16`))
    expect(new Set(addresses).size).toBe(8)
    expect(read('foundation.bicep')).toContain("var networkIndex = (product == 'union-eyes' ? 32 : 48) + environmentIndex")
  })

  it('keeps runtime and edge names within Azure length limits', () => {
    for (const environment of environments) {
      for (const product of ['union-eyes', 'cora']) {
        const prefix = `nzila-${product}-${environmentCodes[environment]}`
        expect(`${prefix}-${'a'.repeat(10)}`.length).toBeLessThanOrEqual(32)
        expect(`${prefix}-${'a'.repeat(13)}`.length).toBeLessThanOrEqual(46)
      }
    }
    expect(read('runtime.bicep')).toContain("loadJsonContent('naming.json')")
    expect(read('edge.bicep')).toContain("loadJsonContent('naming.json')")
  })

  it('defines required attribution and private controls on the canonical sources', () => {
    expect(requiredTags).toEqual(['product', 'environment', 'service', 'owner', 'cost_center', 'data_classification'])
    for (const name of ['foundation.bicep', 'runtime.bicep', 'edge.bicep', 'operations.bicep', 'g2-proof.bicep']) {
      const source = read(name)
      for (const tag of requiredTags) expect(source).toContain(`${tag}:`)
    }
    expect(read('runtime.bicep')).toContain("publicNetworkAccess: 'Disabled'")
    expect(read('runtime.bicep')).toContain('@sha256:${imageDigest}')
    expect(read('edge.bicep')).toContain("groupId: 'managedEnvironments'")
    expect(read('private-endpoint.bicep')).toContain('privateDnsZoneGroups')
    const registry = read('artifact-registry.bicep')
    expect(registry).toContain("sku: {name: 'Premium'}")
    expect(registry).toContain("publicNetworkAccess: 'Disabled'")
    expect(registry).toContain("networkRuleBypassOptions: 'None'")
    expect(registry).toContain("groupId: 'registry'")
    expect(registry).toContain("'7f951dda-4ed3-4680-a7ca-43fe172d538d'")
    expect(read('foundation.bicep')).toContain("'privatelink.azurecr.io'")
  })

  it('uses an internal ACA environment with its private endpoint and DNS group', () => {
    const runtime = read('runtime.bicep')
    expect(runtime).toContain("internal: true")
    expect(runtime).toContain("module endpoint 'private-endpoint.bicep'")
    expect(runtime).toContain("groupId: 'managedEnvironments'")
    expect(runtime).toContain('endpointSubnetId')
    expect(runtime).toContain('appPrivateDnsZoneId')
  })

  it('limits Front Door routes to HTTPS and enables blocking managed WAF rules', () => {
    const edge = read('edge.bicep')
    expect(edge).toContain("supportedProtocols: ['Https']")
    expect(edge).toContain("forwardingProtocol: 'HttpsOnly'")
    expect(edge).toContain("httpsRedirect: 'Disabled'")
    expect(edge).toContain("mode: 'Prevention'")
    expect(edge).toContain("ruleSetAction: 'Block'")
  })

  it('uses explicit subscription resource-group scopes rather than copyIndex references', () => {
    const landingZone = read('landing-zone.bicep')
    expect(landingZone).toContain('scope: operationsGroup')
    expect(landingZone).toContain('scope: securityGroup')
    expect(landingZone).not.toContain('sharedGroups[')
  })

  it('fixes the proof entrypoint to the approved synthetic-only infrastructure boundary', () => {
    const proof = read('g2-proof.bicep')
    expect(proof).toContain("product: 'union-eyes'")
    expect(proof).toContain("environment: 'integration-test'")
    expect(proof).toContain("dataClassification: 'synthetic'")
    expect(proof).toContain("purpose: 'infrastructure-proof'")
    expect(proof).not.toContain('param imageRegistry string')
    expect(proof).toContain("name: 'nzila-g2-proof-artifact-registry'")
    expect(proof).toContain('imageRegistry: registry.outputs.loginServer')
    expect(proof).toContain("imageDigest: imageDigest")
    expect(proof).toContain("sourceCommit: sourceCommit")
    expect(proof).toContain("scope: resourceGroup(subscription().subscriptionId, 'nzila-union-eyes-integration-test-rg')")
    expect(proof).toContain("scope: resourceGroup(subscription().subscriptionId, 'nzila-shared-integration-test-edge-rg')")
    expect(read('runtime.bicep')).toContain('source_commit: sourceCommit')
  })

  it('keeps the artifact bootstrap limited to private network, DNS, registry, and workload identity', () => {
    const artifactFoundation = read('g2-artifact-foundation.bicep')
    expect(artifactFoundation).toContain("name: 'nzila-g2-proof-network'")
    expect(artifactFoundation).toContain("name: 'nzila-g2-proof-artifact-registry'")
    expect(artifactFoundation).toContain('output registryLoginServer string')
    expect(artifactFoundation).not.toContain('databaseAdminGroup')
    expect(artifactFoundation).not.toContain("module runtime")
    expect(artifactFoundation).not.toContain("module edge")
    const network = read('g2-artifact-network.bicep')
    expect(network).toContain("addressPrefixes: ['10.${networkIndex}.0.0/16']")
    expect(network).toContain("var networkIndex = 33")
    expect(network).toContain("name: 'privatelink.azurecr.io'")
    expect(network).not.toContain('Microsoft.DBforPostgreSQL/flexibleServers@')
    expect(network).not.toContain('Microsoft.KeyVault/vaults@')
    expect(network).not.toContain('Microsoft.Storage/storageAccounts@')
  })

  it('removes the production tag fallback from both legacy shared orchestrator lanes', () => {
    const legacyRoot = join(root, '..', 'bicep')
    const main = readFileSync(join(legacyRoot, 'main.bicep'), 'utf8')
    const module = readFileSync(join(legacyRoot, 'modules', 'container-apps.bicep'), 'utf8')
    expect(main.match(/environment: env\s+imageDigests: imageDigests/g)).toHaveLength(2)
    expect(module).toContain("image: environment == 'prod'")
    expect(module).toContain('@sha256:${imageDigests[app.name]}')
    const productionBranch = module.split("image: environment == 'prod'")[1].split(': (hasAcr')[0]
    expect(productionBranch).not.toContain('imageTag')
  })
})

const compiledDirectory = process.env.G1_BICEP_OUTPUT
describe.skipIf(!compiledDirectory)('compiled foundation controls', () => {
  function loadTemplates() {
    const names = ['foundation', 'runtime', 'edge', 'operations']
    return {
      ...Object.fromEntries(names.map(name => [
        name, JSON.parse(readFileSync(join(compiledDirectory!, `g1-${name}.json`), 'utf8')),
      ])),
      registry: JSON.parse(readFileSync(join(compiledDirectory!, 'g2-artifact-registry.json'), 'utf8')),
    }
  }

  it('validates the emitted foundation-to-runtime-to-edge orchestration', () => {
    const proof = JSON.parse(readFileSync(join(compiledDirectory!, 'g2-proof.json'), 'utf8'))
    expect(() => validateProofOrchestration(proof)).not.toThrow()
  })

  it('validates the emitted registry-first artifact foundation stage', () => {
    const template = JSON.parse(readFileSync(join(compiledDirectory!, 'g2-artifact-foundation.json'), 'utf8'))
    expect(() => validateArtifactFoundationOrchestration(template)).not.toThrow()
  })

  it('rejects an out-of-scope data service in the emitted artifact bootstrap', () => {
    const template = JSON.parse(readFileSync(join(compiledDirectory!, 'g2-artifact-foundation.json'), 'utf8'))
    template.resources.push({ type: 'Microsoft.DBforPostgreSQL/flexibleServers', name: 'unexpected' })
    expect(() => validateArtifactFoundationOrchestration(template)).toThrow(/out-of-scope resource/)
  })

  it('rejects an artifact bootstrap resource group outside the approved boundary', () => {
    const template = JSON.parse(readFileSync(join(compiledDirectory!, 'g2-artifact-foundation.json'), 'utf8'))
    const group = template.resources.find((resource: { type: string }) =>
      resource.type === 'Microsoft.Resources/resourceGroups')
    group.name = 'nzila-canada-staging-rg'
    expect(() => validateArtifactFoundationOrchestration(template)).toThrow(/approved synthetic UE resource group/)
  })

  it('rejects public ACR access and an AcrPush grant to the runtime identity', () => {
    const template = JSON.parse(readFileSync(join(compiledDirectory!, 'g2-artifact-foundation.json'), 'utf8'))
    const registry = emittedResources(template)
      .find(resource => resource.type === 'Microsoft.ContainerRegistry/registries')
    if (!registry?.properties) throw new Error('Emitted ACR resource is missing')
    registry.properties.publicNetworkAccess = 'Enabled'
    expect(() => validateArtifactFoundationOrchestration(template)).toThrow(/private with admin/)
    registry.properties.publicNetworkAccess = 'Disabled'
    const assignments = emittedResources(template)
      .filter(resource => resource.type === 'Microsoft.Authorization/roleAssignments')
    const assignment = assignments.find((resource: { properties: { roleDefinitionId: string } }) =>
      JSON.stringify(resource.properties.roleDefinitionId).includes('8311e382-0749-4cb8-b61a-304f252e45ec'))
    if (!assignment?.properties) throw new Error('Emitted builder role assignment is missing')
    assignment.properties.principalId = "[parameters('workloadPrincipalId')]"
    expect(() => validateArtifactFoundationOrchestration(template)).toThrow(/AcrPush to the private-builder identity/)
  })

  it('rejects a builder AcrPush assignment outside the private ACR scope', () => {
    const template = JSON.parse(readFileSync(join(compiledDirectory!, 'g2-artifact-foundation.json'), 'utf8'))
    const assignment = emittedResources(template)
      .find(resource => resource.type === 'Microsoft.Authorization/roleAssignments' &&
        JSON.stringify(resource.properties.roleDefinitionId).includes('8311e382-0749-4cb8-b61a-304f252e45ec'))
    if (!assignment) throw new Error('Emitted builder role assignment is missing')
    assignment.scope = "[subscription().id]"
    expect(() => validateArtifactFoundationOrchestration(template)).toThrow(/scoped to the isolated proof registry/)
  })

  it('rejects an inbound-open or default-egress builder subnet', () => {
    const template = JSON.parse(readFileSync(join(compiledDirectory!, 'g2-artifact-foundation.json'), 'utf8'))
    const network = emittedResources(template)
      .find(resource => resource.type === 'Microsoft.Resources/deployments' &&
        resource.name === 'nzila-g2-proof-network')
    if (!network?.properties?.template) throw new Error('Emitted network module is missing')
    const vnet = network.properties.template.resources.find((resource: { type: string }) =>
      resource.type === 'Microsoft.Network/virtualNetworks')
    const builder = vnet.properties.subnets.find((subnet: { name: string }) => subnet.name === 'builders')
    builder.properties.defaultOutboundAccess = true
    expect(() => validateArtifactFoundationOrchestration(template)).toThrow(/disable default egress/)
  })

  it('verifies the actual emitted ARM resources', () => {
    expect(() => validateCompiledFoundation(loadTemplates())).not.toThrow()
  })

  it('verifies both actual emitted legacy runtime module gates', () => {
    const template = JSON.parse(readFileSync(join(compiledDirectory!, 'g1-legacy-main.json'), 'utf8'))
    expect(() => validateLegacyCompiled(template)).not.toThrow()
  })

  it.each([
    ['foundation', 'Microsoft.DBforPostgreSQL/flexibleServers'],
    ['foundation', 'Microsoft.KeyVault/vaults'],
    ['foundation', 'Microsoft.Storage/storageAccounts'],
    ['runtime', 'Microsoft.App/managedEnvironments'],
  ])('rejects public access on emitted %s %s', (template, type) => {
    const templates = loadTemplates()
    const resource = templates[template].resources.find((entry: { type: string }) => entry.type === type)
    resource.properties.publicNetworkAccess = 'Enabled'
    if (type === 'Microsoft.DBforPostgreSQL/flexibleServers') {
      resource.properties.network.publicNetworkAccess = 'Enabled'
    }
    expect(() => validateCompiledFoundation(templates)).toThrow()
  })

  it('rejects a publicly addressable ACA environment', () => {
    const templates = loadTemplates()
    const environment = templates.runtime.resources.find((entry: { type: string }) =>
      entry.type === 'Microsoft.App/managedEnvironments')
    environment.properties.vnetConfiguration.internal = false
    expect(() => validateCompiledFoundation(templates)).toThrow(/internal VIP/)
  })

  it('rejects HTTP-enabled Front Door routes', () => {
    const templates = loadTemplates()
    const route = templates.edge.resources.find((entry: { type: string }) =>
      entry.type === 'Microsoft.Cdn/profiles/afdEndpoints/routes')
    route.properties.supportedProtocols = ['Http', 'Https']
    expect(() => validateCompiledFoundation(templates)).toThrow(/HTTPS only/)
  })

  it('rejects an ACA private endpoint targeting the wrong subresource', () => {
    const templates = loadTemplates()
    const endpoint = templates.runtime.resources.find((entry: { name: string }) =>
      entry.name === 'runtime-endpoint')
    endpoint.properties.parameters.groupId.value = 'vault'
    expect(() => validateCompiledFoundation(templates)).toThrow(/ACA private endpoint targets/)
  })

  it('rejects a mutable image even if its parameter files look valid', () => {
    const templates = loadTemplates()
    const app = templates.runtime.resources.find((entry: { type: string }) => entry.type === 'Microsoft.App/containerApps')
    app.properties.template.containers[0].image = 'registry.azurecr.io/product:latest'
    expect(() => validateCompiledFoundation(templates)).toThrow(/image contract/)
  })

  it('rejects a publicly reachable emitted ACR', () => {
    const templates = loadTemplates()
    const registry = templates.registry.resources.find((entry: { type: string }) =>
      entry.type === 'Microsoft.ContainerRegistry/registries')
    registry.properties.publicNetworkAccess = 'Enabled'
    expect(() => validateCompiledFoundation(templates)).toThrow(/ACR public access/)
  })

  it('rejects a role grant other than AcrPull', () => {
    const templates = loadTemplates()
    const assignment = templates.registry.resources.find((entry: { type: string }) =>
      entry.type === 'Microsoft.Authorization/roleAssignments')
    assignment.properties.roleDefinitionId = "[subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'other')]"
    expect(() => validateCompiledFoundation(templates)).toThrow(/AcrPull assignment/)
  })

  it('rejects AcrPull outside the registry resource scope', () => {
    const templates = loadTemplates()
    const assignment = templates.registry.resources.find((entry: { type: string }) =>
      entry.type === 'Microsoft.Authorization/roleAssignments')
    assignment.scope = '[resourceGroup().id]'
    expect(() => validateCompiledFoundation(templates)).toThrow(/AcrPull assignment/)
  })

  it('rejects AcrPull assigned to an identity other than the workload UAMI', () => {
    const templates = loadTemplates()
    const assignment = templates.registry.resources.find((entry: { type: string }) =>
      entry.type === 'Microsoft.Authorization/roleAssignments')
    assignment.properties.principalId = "[parameters('otherPrincipalId')]"
    expect(() => validateCompiledFoundation(templates)).toThrow(/AcrPull assignment/)
  })

  it('rejects a missing cost attribution field', () => {
    const templates = loadTemplates()
    delete templates.edge.variables.tags.cost_center
    expect(() => validateCompiledFoundation(templates)).toThrow(/cost_center/)
  })
})
