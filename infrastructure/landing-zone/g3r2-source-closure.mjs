import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { costModel, verifyPreservation } from './g3r1-local-closure.mjs'
import { validateParameters } from './g3-source/controllers/local-plan.mjs'

const root = fileURLToPath(new URL('./', import.meta.url))
const repo = path.resolve(root, '..', '..')
const source = path.join(root, 'g3-source')
const evidence = path.join(root, 'g3-readiness-evidence')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const read = (name) =>
  JSON.parse(readFileSync(path.join(evidence, name), 'utf8').replace(/^\uFEFF/, ''))
const sourceCommit = '7bec20aad11d43eeae8099c14e021b3074154b27'
const modules = [
  ['network', 'G3 network/subnets/NSGs/UDR and G3-side peering;G2 dependencies external'],
  ['identities', 'Exactly two separate platform-pull/build-slot and runtime UAMIs;no credentials'],
  ['observability', 'Log Analytics lifecycle/retention/capping separate from identities'],
  ['vault', 'Private RBAC Key Vault,endpoint and DNS;secret seeding external'],
  ['environment', 'Empty INTERNAL Consumption workload-profiles environment and diagnostics'],
  ['internal-dns', 'Post-create defaultDomain/staticIP DNS dependency boundary'],
  ['workload', 'Digest-pinned synthetic app with capacity/identity gates'],
  ['bindings', 'Explicitly locked secret-scoped runtime assignment;registry grants external'],
].map(([id, responsibility]) => ({
  id,
  responsibility,
  path: `modules/${id}.bicep`,
  scope: 'resourceGroup',
}))
export function walk(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory())
        return entry.name === 'build' ? [] : walk(path.join(directory, entry.name), relative)
      return [{ path: relative, sha256: sha(readFileSync(path.join(directory, entry.name))) }]
    })
    .sort((a, b) => a.path.localeCompare(b.path))
}
export function captureG3R2Preservation() {
  return Object.fromEntries(
    readdirSync(evidence)
      .filter((name) => !name.startsWith('G3R2_'))
      .map((name) => [name, sha(readFileSync(path.join(evidence, name)))]),
  )
}
function verifyPreservedBaseline(baseline) {
  for (const [name, hash] of Object.entries(baseline))
    assert.equal(
      sha(readFileSync(path.join(evidence, name))),
      hash,
      `G3R2_HISTORICAL_BYTES_CHANGED:${name}`,
    )
}
export function reviewImage() {
  const files = ['.dockerignore', 'Dockerfile', 'go.mod', 'main.go', 'main_test.go']
  const snapshots = files.map((name) => {
    const original = `infrastructure/landing-zone/synthetic-health/${name}`
    const result = spawnSync('git', ['--no-pager', 'show', `${sourceCommit}:${original}`], {
      cwd: repo,
      maxBuffer: 1024 * 1024,
    })
    assert.equal(result.status, 0, `COMMITTED_SOURCE_READ_FAILED:${original}`)
    return { name, original, bytes: result.stdout, sha256: sha(result.stdout) }
  })
  const main = snapshots.find((item) => item.name === 'main.go').bytes.toString()
  const dockerfile = snapshots.find((item) => item.name === 'Dockerfile').bytes.toString()
  return {
    decision: 'BLOCKED',
    candidateId: 'G3_SYNTHETIC_HEALTH_V1_CANDIDATE_NOT_QUALIFIED',
    lineage: 'PROSPECTIVE_G3R2',
    sourceCommit,
    sourceFiles: snapshots.map(({ bytes, ...item }) => item),
    buildContextDigest: sha(
      JSON.stringify(snapshots.map((item) => ({ name: item.name, sha256: item.sha256 }))),
    ),
    digestMethod: 'SHA256(sorted ordered candidate name+fileSHA manifest);not OCI image digest',
    dockerfileDigest: snapshots.find((item) => item.name === 'Dockerfile').sha256,
    review: {
      base: 'scratch;no runtimebasepull',
      dependencySurface:
        'Go standardlibrary only;go1.22 language directive isnot an exactcompilerpin',
      runtimeUser: '65532:65532',
      listeningPort: 3000,
      healthRoutes: ['/health/readiness', '/health/liveness'],
      healthBehavior: 'GET200 staticstatus;othermethods405;otherpaths404;PORTvalidated',
      runtimeNetwork: 'No sourceinitiatedoutboundrequests;ACAplatform dependencies stillrequired',
      secretUsage: 'NONE;doesnotconsumeG3_PROOF_SECRET orrequestruntimeMI/KVtoken',
      networkChallengeObservationImplemented: false,
      containerContext:
        'Dockerfile copies health-server;binary isnot committed and build recipe/compilerqualification isnot in committedcandidate',
      workingTreeDifference:
        'Current visible directory contains Node server.mjs,not the selectedcommittedGo tree. It ispreserved,not silentlyoverwritten.',
      healthSourceEvidence:
        main.includes('/health/readiness') && dockerfile.includes('FROM scratch'),
    },
    exactDeficiencies: [
      {
        id: 'IMAGE-1',
        fact: 'Committedcandidate has no non-disclosingruntime secretchallenge observation.',
        needed:
          'Explicit prospectiveimage amendment or accepted artifact-preservingobserver design;do notsilentlyfixhistorical/currentsource.',
      },
      {
        id: 'IMAGE-2',
        fact: 'Dockercontext requires health-server,but exactpinnedcompiler/buildrecipe/binaryprovenance are absent.',
        needed:
          'Explicit reproducibleprospectivebinary-production contract before imagequalification;no build performed.',
      },
    ],
    expectedRepository: 'g3-synthetic-runtime',
    tagPolicy: 'g3r2-source-<canonicalsourcehash>;tag not finalauthority',
    futureImmutableDigestBinding:
      'REQUIRED_AFTER_FUTURE_AUTHORIZED_BUILD;new prospectiveimage mustnot claim historicalmanifest',
    historicalManifestReused: false,
    imageBuilt: false,
    imagePushed: false,
    snapshots,
  }
}
function armRule(rule, name) {
  const properties = {
    priority: rule.priority,
    direction: name.startsWith('in-') ? 'Inbound' : 'Outbound',
    access: rule.action.startsWith('Allow') ? 'Allow' : 'Deny',
    protocol: rule.protocol === 'TCP' ? 'Tcp' : '*',
    sourceAddressPrefix: rule.source,
    sourcePortRange: '*',
  }
  if (Array.isArray(rule.destination))
    return rule.destination.flatMap((destination, index) =>
      armRule({ ...rule, destination, priority: rule.priority + index }, `${name}-${index}`),
    )
  properties.destinationAddressPrefix = rule.destination
  const ports = rule.ports.map(String)
  if (ports.length === 1) properties.destinationPortRange = ports[0]
  else properties.destinationPortRanges = ports
  return [{ name, properties }]
}
function parameterContract(prior, network) {
  const tags = {
    mission: 'NZ-20261008-INFRA-001',
    environment: 'integration-test',
    product: 'shared',
    component: 'g3-synthetic',
    owner: 'HUMAN_BINDING_REQUIRED',
    dataClassification: 'synthetic',
  }
  const inbound = network.nsg.inbound.flatMap((rule, i) => armRule(rule, `in-${i}`))
  const outbound = network.nsg.outbound
    .filter((rule) => ![120, 140].includes(rule.priority))
    .flatMap((rule, i) => armRule(rule, `out-${i}`))
  const parameters = {
    provisionResources: false,
    location: 'canadacentral',
    names: prior.candidateNames,
    tags,
    networkRules: { inbound, outbound },
    g2VnetId: network.g2VnetId,
    keyVaultPurgeProtection: false,
    discoveredEndpointIps: [],
    approvedPlatformPrefixes: [],
    immutableImage: '',
    quotaEvidenceId: '',
    availableConsumptionMilliCores: 0,
    workloadActivationAuthorized: false,
    rbacAuthorized: false,
  }
  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'G3R2 local-only source parameters;example isnot deployauthority',
    type: 'object',
    additionalProperties: false,
    required: Object.keys(parameters),
    properties: Object.fromEntries(
      Object.entries(parameters).map(([name, value]) => {
        const type = Array.isArray(value)
          ? 'array'
          : typeof value === 'number'
            ? 'integer'
            : typeof value
        const fixed = ![
          'keyVaultPurgeProtection',
          'discoveredEndpointIps',
          'approvedPlatformPrefixes',
          'immutableImage',
          'quotaEvidenceId',
          'availableConsumptionMilliCores',
        ].includes(name)
        return [
          name,
          {
            type,
            ...(fixed ? { const: value } : {}),
            ...(type === 'array'
              ? { items: { type: 'string', pattern: '^\\d{1,3}(\\.\\d{1,3}){3}(/\\d{1,2})?$' } }
              : {}),
            classification:
              name === 'keyVaultPurgeProtection'
                ? 'HUMAN_BINDING_REQUIRED'
                : [
                      'discoveredEndpointIps',
                      'quotaEvidenceId',
                      'availableConsumptionMilliCores',
                    ].includes(name)
                  ? 'POST_CREATE_DISCOVERY'
                  : ['approvedPlatformPrefixes', 'immutableImage'].includes(name)
                    ? 'FUTURE_RUNTIME_DISCOVERY'
                    : 'FIXED_GOVERNED_VALUES',
          },
        ]
      }),
    ),
    secretReferences: [
      {
        SECRET_LOGICAL_ID: 'g3-proof-secret',
        VAULT_REFERENCE: prior.candidateNames.keyVault,
        CONSUMER_IDENTITY: prior.candidateNames.runtimeIdentity,
        ACCESS_REQUIREMENT: 'GET only viaexactsecret-scopedrole',
        EXPECTED_ROTATION_MODEL:
          'Human-authorizedsyntheticsecretversion rotation;observermustretainsafeevidence only',
      },
    ],
    humanSlots: {
      operatorPrincipal: 'HUMAN_BINDING_REQUIRED',
      lifecycleOwner: 'HUMAN_BINDING_REQUIRED',
      separateHumanApprover: 'HUMAN_BINDING_REQUIRED',
      purgeProtection: 'HUMAN_BINDING_REQUIRED;examplefalseisnotdecision',
    },
    forbidden: [
      'Secretvalueparameter',
      'DeployauthorizationfromCI/NODE_ENV/branch',
      'Mutableimageauthority',
    ],
  }
  validateParameters(parameters, schema)
  return {
    schema,
    example: { lineage: 'PROSPECTIVE_G3R2', deployable: false, exampleOnly: true, parameters },
  }
}
function proofPackage(prior, network, image) {
  const negative = [
    [
      'RUNTIME_CANNOT_PUSH_IMAGE',
      'KnownexistingG3repository,connectivitycontrol,runtimeprincipal;authorization403/denialnot404/timeout',
    ],
    [
      'BUILD_CANNOT_READ_RUNTIME_SECRET',
      'Knownexistingsecret,buildprincipal,directprivateTLSconnectivitycontrol;explicitauthorization403',
    ],
    [
      'UNAUTHORIZED_PRINCIPAL_CANNOT_DEPLOY',
      'No futurewriteprobe withoutseparateauthority;read-onlypermissionevidence orisolatedcontrollednegativeaction;no successcleanup omitted',
    ],
    [
      'PUBLIC_PATH_CANNOT_REACH_PRIVATE_ENDPOINT',
      'Independentpublic-origin DNS/networkdenial;notmisclassifiedasRBAC403',
    ],
    [
      'WORKLOAD_DENIED_BEFORE_CAPACITY_GATE',
      'Localpolicydeniesmissing/wrongenvironmentquotaevidence;noactivation',
    ],
    [
      'UNAPPROVED_G2_MUTATION_REJECTED',
      'G3source hasnoG2resourcemutator;separateauthority+G2root reconciliationrequired',
    ],
  ].map(([id, acceptance]) => ({
    id,
    acceptance,
    execution: 'NOT_EXECUTED',
    expectedUnexpectedSuccessHandling:
      'STOP,revokeexactfutureauthority,contain/rollbackonlywithinexplicitpermission,preserveevidence;notcontinue',
  }))
  const rollback = {
    lineage: 'PROSPECTIVE_G3R2',
    execution: 'NOT_EXECUTED',
    nodes: [
      {
        id: 'retain-evidence',
        dependsOn: [],
        action:
          'Persistcommands/resourceownership/digests/correlations;nevertokens/cleartextsecret',
      },
      {
        id: 'disable-workload',
        dependsOn: ['retain-evidence'],
        action: 'RemoveonlyG3-ownedapp afterseparateauthority;quota failure keepsappabsent',
      },
      {
        id: 'remove-bindings',
        dependsOn: ['disable-workload'],
        action:
          'RemoveonlyG3-createdsecretrole andexternallyapprovedregistryassignments;noexistingG2grants',
      },
      {
        id: 'remove-environment-dns',
        dependsOn: ['disable-workload'],
        action:
          'RemoveG3internalzone/records/link andemptyenvironment;do notmodifyME_managedRGmanually',
      },
      {
        id: 'remove-vault-endpoint',
        dependsOn: ['remove-bindings', 'disable-workload'],
        action:
          'RemoveG3KVPE/zonegroup/DNSlinks andvault accordingto approvedsoftdelete/purgeprotection;noautomaticpurge',
      },
      {
        id: 'external-g2-rollback',
        dependsOn: ['remove-environment-dns'],
        action:
          'Separatehumanauthority restoresonlyG3-addedG2peering/DNSlink/firewalldiff againstsealedbaseline',
      },
      {
        id: 'remove-identities',
        dependsOn: ['remove-bindings', 'remove-environment-dns'],
        action:
          'RemoveonlytwoG3-ownedUAMIs afterreferencescleared;Entrasoftdeleteevidence retained',
      },
      {
        id: 'remove-network',
        dependsOn: ['external-g2-rollback', 'remove-vault-endpoint', 'remove-environment-dns'],
        action: 'G3-sidepeering/subnets/NSGs/UDR/VNet only;builderabsenceverified',
      },
      {
        id: 'retain-workspace',
        dependsOn: ['retain-evidence'],
        action: 'Logevidenceretentionseparatelygoverned;neverautodeletebeforeexport',
      },
      {
        id: 'remove-rg-if-authorized',
        dependsOn: ['remove-network', 'remove-identities'],
        action:
          'Ownershipinventory andworkspaceevidence dispositionrequired;no broadRGdeletefromthiscontroller',
      },
    ],
    G2_EXTERNAL_ROLLBACK_DEPENDENCY: 'SEPARATE_EXPLICIT_HUMAN_AUTHORITY_REQUIRED',
  }
  const reconciliation = {
    lineage: 'PROSPECTIVE_G3R2',
    execution: 'NOT_EXECUTED',
    expectedResources: 'G3_BILL_OF_MATERIALS.json;ownership tags andexactIDs',
    expectedIdentities: [
      {
        name: prior.candidateNames.pullIdentity,
        lifecycle: 'None',
        role: 'RepositoryReader exactg3-synthetic-runtime',
        runtimeAvailability: 'DENIED',
      },
      {
        name: prior.candidateNames.runtimeIdentity,
        lifecycle: 'Main',
        role: 'Exactsecret-scopedKeyVaultSecretsUser',
        registryRoles: [],
      },
    ],
    expectedRbac: network.rbac.grants,
    expectedNetworkPaths: network.routes,
    expectedDns: network.dns,
    expectedLogs: ['ContainerAppConsoleLogs', 'ContainerAppSystemLogs;capturedsafeproofevents'],
    expectedImageDigest:
      'Newprospectiveimmutablemanifest afterfuturebuild;historicaldigestnotasserted',
    expectedSecretReference: `https://${prior.candidateNames.keyVault}.vault.azure.net/secrets/g3-proof-secret`,
    expectedPublicExposure:
      'NONE_FOR_ACA_KV_ACR;workspacepublicAzureMonitoringestion isselectedplatformtelemetrynotworkloadpublicingress',
    effectivePermissionProof:
      'Freshprincipal/roleconditions+controllednegatives;assignmentexistenceisnotaccessproof',
    residualState:
      'G2sealedrootpacketnotrecovered;externalhumanmustbind acceptedterminalbaselinebeforemutation',
  }
  const manifest = {
    lineage: 'PROSPECTIVE_G3R2',
    execution: 'NOT_EXECUTED',
    specificationReadiness: 'COMPLETE_WITH_EXACT_IMAGE_OBSERVER_BLOCKER',
    sequence: [
      'Localcompile/parameter/digestcheck',
      'Humanappointroles andapproveG2changes/cost',
      'SeparateG3Aimageproductionauthority',
      'Bindnewimmutablemanifest',
      'SeparateemptyG3environmentauthority',
      'Queryactualenvironmentconsumptioncores',
      'Separateworkloadactivationauthority',
      'Privatehealth/secret/negativeproofs',
      'ReconcileownershipandretainedG2state',
    ],
    secretChallenge: {
      input:
        'SyntheticsecretlogicalID+nonsecretchallengeID;secretvalueprovidedonlybyfuturehumancontrolledseed,neverstoredhere',
      expectedRuntimeObservation:
        'Safenonreversiblechallengeboundattestationfromruntime usingonlyruntimeMI andprivateKV path;no token/secretreturn',
      nonDisclosure: 'Nevercleartextsecret/token;onlysanitizedstatus/digest/correlation',
      unauthorizedPrincipalProbe: negative[1],
      artifactRetention:
        'Immutableimage bytesmustnotchange;retainproofmetadata outsidecontainerimage',
      rollback: rollback.nodes[0],
      implementedObserver: false,
      blocker: image.exactDeficiencies[0],
    },
    negativeProbeCount: negative.length,
    capacityRequirementMilliCores: 250,
    missingQuotaBehavior: 'DENY_WORKLOAD_ACTIVATION',
    imageBinding: image.futureImmutableDigestBinding,
    noPublicFallback: true,
  }
  return {
    manifest,
    negative: { lineage: 'PROSPECTIVE_G3R2', probes: negative, execution: 'NOT_EXECUTED' },
    rollback,
    reconciliation,
  }
}
function compileSources(compiler) {
  const build = path.join(source, 'build')
  mkdirSync(build, { recursive: true })
  const version = spawnSync(compiler, ['--version'], { encoding: 'utf8' })
  assert.equal(version.status, 0, 'INSTALLED_BICEP_COMPILER_REQUIRED')
  const entries = ['main.bicep', ...modules.map((module) => module.path)]
  const results = entries.map((entry) => {
    const result = spawnSync(compiler, ['build', path.join(source, entry), '--stdout'], {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    })
    assert.equal(result.status, 0, `LOCAL_BICEP_BUILD_FAILED:${entry}:${result.stderr}`)
    const arm = JSON.parse(result.stdout)
    const outputName = `${entry.replaceAll('/', '-').replace('.bicep', '')}.json`
    writeFileSync(path.join(build, outputName), result.stdout)
    return {
      source: entry,
      sourceSha256: sha(readFileSync(path.join(source, entry))),
      templatePath: `build/${outputName}`,
      templateSha256: sha(Buffer.from(result.stdout)),
      result: 'PASS',
      stderr: result.stderr.trim(),
      requiredParameters: Object.entries(arm.parameters ?? {})
        .filter(([, item]) => !('defaultValue' in item))
        .map(([name]) => name),
      resourceDefinitions: arm.resources ?? [],
    }
  })
  return {
    compilerVersion: version.stdout.trim(),
    commands: entries.map((entry) => `${compiler} build ${path.join(source, entry)} --stdout`),
    entries: results,
    buildErrors: 0,
    unresolvedModules: 0,
    generatedTemplatesAreAuthority: false,
    azureCalls: 0,
  }
}
function billOfMaterials(prior, builds) {
  const names = prior.candidateNames
  const resourceNames = {
    group: names.resourceGroup,
    acaNsg: names.nsg,
    builderNsg: `${names.nsg}-builder`,
    endpointNsg: `${names.nsg}-pe`,
    route: names.routeTable,
    vnet: names.vnet,
    peering: 'g3-to-g2',
    buildIdentity: names.pullIdentity,
    runtimeIdentity: names.runtimeIdentity,
    workspace: names.workspace,
    vault: names.keyVault,
    endpoint: names.keyVaultEndpoint,
    zoneGroup: 'default',
    environment: names.environment,
    diagnostics: 'g3-console-system-logs',
    apex: '@',
    wildcard: '*',
    app: names.application,
    runtimeGrant: 'guid(exactsecretscope,runtimeprincipal,roleId)',
  }
  const resources = []
  for (const build of builds.entries) {
    const text = readFileSync(path.join(source, build.source), 'utf8')
    for (const match of text.matchAll(/resource\s+(\w+)\s+'([^']+)'\s*(existing)?\s*=/g)) {
      if (match[3]) continue
      const [resourceType] = match[2].split('@')
      const moduleName =
        build.source === 'main.bicep' ? 'subscription-root' : path.basename(build.source, '.bicep')
      let canonicalName = resourceNames[match[1]]
      if (match[1] === 'zone')
        canonicalName =
          moduleName === 'vault'
            ? 'privatelink.vaultcore.azure.net'
            : '<POST_CREATE_DEFAULT_DOMAIN>'
      if (match[1] === 'link')
        canonicalName = moduleName === 'vault' ? names.keyVaultDnsLink : `${names.environment}-link`
      assert(canonicalName, `BOM_CANONICAL_NAME_REQUIRED:${match[1]}`)
      resources.push({
        logicalResourceId: `${moduleName}.${match[1]}`,
        resourceType,
        apiVersion: match[2].split('@')[1],
        canonicalName,
        resourceGroup: names.resourceGroup,
        location: resourceType.includes('privateDnsZones') ? 'global' : 'canadacentral',
        geography: 'CanadaCentralresources;globalDNScontrolplaneexception',
        owningModule: moduleName,
        count: 1,
        sku: resourceType.endsWith('workspaces')
          ? 'PerGB2018'
          : resourceType.endsWith('vaults')
            ? 'Standard'
            : resourceType.endsWith('containerApps')
              ? 'Consumption0.25vCPU/0.5Gi'
              : 'NOT_APPLICABLE',
        lifetimeClass: 'G3_SYNTHETIC_RETAINED_UNTIL_SEPARATE_ROLLBACK_AUTHORITY',
        proofDurationHours: 2,
        idleDurationHours: 730,
        expectedUsageDriver: 'G3R2 scenarios;notapprovedduration',
        priceMeterBinding: resourceType.endsWith('workspaces')
          ? 'logIngestion'
          : resourceType.endsWith('privateDnsZones')
            ? 'privateDnsZone'
            : resourceType.endsWith('privateEndpoints')
              ? 'vaultPrivateEndpoint+data'
              : resourceType.endsWith('containerApps')
                ? 'activeCpu+activeMemory+requests'
                : resourceType.endsWith('vaults')
                  ? 'UNRESOLVED_ORDINARY_SECRET_OPERATION_METER'
                  : 'NO_SEPARATE_RETAIL_METER_IDENTIFIED;notall-inzero-costclaim',
      })
    }
  }
  return {
    lineage: 'PROSPECTIVE_G3R2',
    resources,
    inlineResources: [
      {
        type: 'Microsoft.Network/virtualNetworks/subnets',
        count: 3,
        names: [names.acaSubnet, names.privateEndpointSubnet, names.builderSubnet],
        owningModule: 'network',
        cidrs: ['10.91.1.0/24', '10.91.2.0/24', '10.91.3.0/24'],
      },
    ],
    platformManagedCosts: [
      'StandardLB<=5rules',
      'OneplatformegressIPv4',
      'Intra-regionG2transitpeering',
      'ExistingG2ACRPEincrementaldata',
      'ExistingG2Basicfirewallincrementaldata',
    ],
    externalDependencies: [
      'G2reversepeering',
      'G2ACRDNSlink',
      'G2firewallallowlist',
      'G2registryABACbindings',
      'PrivateG3Aartifactbuilder',
      'Syntheticsecretseeding',
    ],
    secretLogicalResources: [
      {
        id: 'g3-proof-secret',
        valueInSource: false,
        provisioning: 'SEPARATE_HUMAN_AUTHORIZED_SECRET_SEED;notBicepparameter',
      },
    ],
    builder: {
      model: 'UNRESOLVED_PRIVATE_ARTIFACT_PRODUCTION;committedbinarybuildcontractincomplete',
      skuOrService: 'UNBOUND',
      expectedRuntimeMinutes: null,
      bootDisk: null,
      dataTransferGB: null,
      buildCount: 1,
      priceSource: 'CapturedCADB1s/E4isnon-authoritativeproxy only',
      BUILDER_COST: 'UNRESOLVED',
    },
  }
}
export async function generateSourceClosure(compiler) {
  const prior = read('G3_EXECUTION_READINESS.json')
  const recovery = read('G3R1_AUTHORITY_RECOVERY.json')
  const network = read('G3R1_NETWORK_CONTRACT.json')
  verifyPreservation(recovery)
  const baselinePath = path.join(evidence, 'G3R2_HISTORICAL_PRESERVATION.json')
  const baseline = existsSync(baselinePath)
    ? JSON.parse(readFileSync(baselinePath, 'utf8'))
    : captureG3R2Preservation()
  verifyPreservedBaseline(baseline)
  const config = await resolveConfig(path.join(repo, 'package.json'))
  const writeJson = async (directory, name, value) =>
    writeFileSync(
      path.join(directory, name),
      await format(JSON.stringify(value), { ...config, parser: 'json' }),
    )
  if (!existsSync(baselinePath))
    await writeJson(evidence, 'G3R2_HISTORICAL_PRESERVATION.json', baseline)
  const image = reviewImage()
  mkdirSync(path.join(source, 'image-candidate'), { recursive: true })
  for (const item of image.snapshots)
    writeFileSync(path.join(source, 'image-candidate', item.name), item.bytes)
  const { snapshots, ...imageReport } = image
  const params = parameterContract(prior, network)
  await writeJson(source, 'parameters.schema.json', params.schema)
  await writeJson(source, 'parameters.example.json', params.example)
  const proof = proofPackage(prior, network, imageReport)
  mkdirSync(path.join(source, 'proof'), { recursive: true })
  for (const [name, value] of [
    ['G3_PROOF_MANIFEST.json', proof.manifest],
    ['G3_NEGATIVE_PROBES.json', proof.negative],
    ['G3_ROLLBACK_PLAN.json', proof.rollback],
    ['G3_RECONCILIATION_PLAN.json', proof.reconciliation],
  ])
    await writeJson(path.join(source, 'proof'), name, value)
  await writeJson(source, 'EXTERNAL_G2_MUTATION_DEPENDENCIES.json', {
    status: 'EXTERNAL_G2_MUTATION_DEPENDENCY',
    allowedByG3R2: false,
    peering: network.peering,
    firewallRules: network.firewall,
    dns: network.dns.zones.filter((item) => item.zone === 'privatelink.azurecr.io'),
    registryBindings: network.rbac.grants.filter((item) =>
      item.exactScope.includes('ContainerRegistry'),
    ),
    provenanceSha256: sha(readFileSync(path.join(evidence, 'G3R1_NETWORK_CONTRACT.json'))),
  })
  const builds = compileSources(compiler)
  const required = builds.entries.find((entry) => entry.source === 'main.bicep').requiredParameters
  assert(
    required.every((name) => name in params.example.parameters),
    'UNBOUND_SOURCE_PARAMETER',
  )
  const bom = billOfMaterials(prior, builds)
  await writeJson(source, 'G3_BILL_OF_MATERIALS.json', bom)
  const costs = costModel(prior, network)
  assert.equal(
    bom.resources.filter((item) => item.resourceType === 'Microsoft.Network/privateDnsZones')
      .length,
    costs.designQuantities.incrementalPrivateDnsZones,
    'BOM_DNS_COUNT_COST_MISMATCH',
  )
  assert.equal(
    bom.resources.filter((item) => item.resourceType === 'Microsoft.Network/privateEndpoints')
      .length,
    1,
    'BOM_PE_COUNT_COST_MISMATCH',
  )
  const recomputedCosts = {
    ...costs,
    lineage: 'PROSPECTIVE_G3R2',
    derivedFromBomSha256: sha(readFileSync(path.join(source, 'G3_BILL_OF_MATERIALS.json'))),
    recomputation:
      'Scenarioformulas reevaluated againstcanonicalBOM countchecks andcapturedmeterprovenance;notoldsubtotalcopy',
    builder: bom.builder,
    RECOMMENDED_FULL_PROOF_EXECUTION_CEILING_CAD: 'UNRESOLVED',
    HUMAN_APPROVED_EXECUTION_CEILING_CAD: 'UNBOUND',
  }
  const manifest = {
    SOURCE_AUTHORITY_ID: 'NZ-20261008-INFRA-001:G3_SOURCE_AUTHORITY_V1',
    VERSION: 'G3_SOURCE_AUTHORITY_V1',
    LINEAGE_CLASS: 'PROSPECTIVE_G3R2',
    CREATED_FROM_CONTRACTS: Object.keys(baseline)
      .filter((name) => /^(G3_EXECUTION_READINESS|G3R1_)/.test(name))
      .map((name) => ({ name, sha256: baseline[name] })),
    acceptedLocalInputs: ['README.md', 'naming.json', 'G2_PRIVATE_CONTROL_PLANE_EVIDENCE.md'].map(
      (name) => ({ name, sha256: sha(readFileSync(path.join(root, name))) }),
    ),
    HISTORICAL_PACKAGE_RECOVERY_STATUS: 'NOT_FOUND_IN_BOUNDED_RECOVERY_UNIVERSE',
    HISTORICAL_EXPECTED_MODULE_COUNT: 7,
    HISTORICAL_RECOVERED_MODULE_COUNT: 0,
    NEW_CANONICAL_MODULE_COUNT: modules.length,
    MODULES: modules,
    decompositionRationale:
      'Eightindependentboundaries:network,identities,observability,privatevault,emptyenvironment,post-createinternalDNS,activationgatedworkload,explicitRBAC. DNSruntime-namecannotbeinlineenvironmentresource;identity/workspacelifecyclesseparate. Countnotderivedfromhistoricalseven.',
    rootScope: 'subscription',
    CONTROLLERS: [
      {
        path: 'controllers/local-plan.mjs',
        lineage: 'PROSPECTIVE_G3R2',
        actions: [
          'PLAN',
          'LOCAL_VALIDATE',
          'PROOF_MANIFEST',
          'ROLLBACK_PLAN',
          'RECONCILIATION_PLAN',
        ],
        AZURE_EXECUTION_ALLOWED: 'NO',
        executionStatus: 'NOT_EXECUTED',
      },
    ],
    IMAGE_SOURCE: imageReport,
    NETWORK_CONTRACT_DIGEST: baseline['G3R1_NETWORK_CONTRACT.json'],
    IDENTITY_CONTRACT: {
      build: prior.candidateNames.pullIdentity,
      buildPurpose: 'Platformpullonly,None;operatorwritesseparately',
      runtime: prior.candidateNames.runtimeIdentity,
      runtimePurpose: 'Main,exactsyntheticsecretscope,noACR/buildroles',
      count: 2,
      roleAssignments: 'PROPOSED_NOT_AUTHORIZED',
      operatorCandidate: 'bfa4a851-696a-4d3f-927b-5fb1526f79f2',
      humanSlots: params.schema.humanSlots,
    },
    COST_BOM: {
      path: 'G3_BILL_OF_MATERIALS.json',
      sha256: sha(readFileSync(path.join(source, 'G3_BILL_OF_MATERIALS.json'))),
    },
    BUILD_COMMANDS: builds.commands,
    VALIDATION_COMMANDS: [
      'node --test infrastructure\\landing-zone\\g3r2-source-closure.test.mjs',
      'node infrastructure\\landing-zone\\g3r2-source-closure.mjs --check',
      'pnpm validate:docs',
    ],
    DEPLOYMENT_STATUS: 'NOT_AUTHORIZED',
    AZURE_MUTATION_ALLOWED: 'NO',
    sourceFiles: walk(source).filter(
      (entry) => !entry.path.startsWith('G3_SOURCE_AUTHORITY_MANIFEST.'),
    ),
    controllerExecution:
      'NOT_EXECUTED;pureparameter/gatefunctions onlytestableoffline;noCLIinvocation',
    sourceCompleteness: 'LOCAL_INFRASTRUCTURE_COMPILES;IMAGE_DEPENDENT_PROOF_EXACTLY_BLOCKED',
    localTooling: {
      generator: {
        path: 'g3r2-source-closure.mjs',
        sha256: sha(readFileSync(fileURLToPath(import.meta.url))),
      },
      parameterValidation:
        'Purelocalcontrollerhelpercalls only;no controllerCLI/planningorchestrator execution',
    },
    requiredParameterAccounting: {
      required,
      unaccounted: [],
      humanOrDiscoveryValuesAreNotDeploymentReady: true,
    },
  }
  await writeJson(source, 'G3_SOURCE_AUTHORITY_MANIFEST.json', manifest)
  writeFileSync(
    path.join(source, 'G3_SOURCE_AUTHORITY_MANIFEST.md'),
    await format(
      `# Prospective G3 source authority V1

Lineage: **PROSPECTIVE_G3R2**. New local source, not recovered historical authority. Eight modules: ${modules.map((item) => item.id).join(', ')}. Root scope is subscription; all modules are resource-group scoped. Internal DNS is separated because its name depends on returned environment defaultDomain; identities and observability have independent lifecycles.

[Manifest](./G3_SOURCE_AUTHORITY_MANIFEST.json) binds source/contract hashes, module ownership, image review, BOM and exact build commands. [Parameter contract](./parameters.schema.json) distinguishes governed, human and post-create values; [example](./parameters.example.json) is local-only and contains no secret values. All provisioning/activation/RBAC flags are locked to false even at direct module entrypoints; future mutation needs a separately reviewed source/authority amendment.

G2-side peering, firewall, ACR DNS and registry bindings are [external dependencies](./EXTERNAL_G2_MUTATION_DEPENDENCIES.json), not hidden resources. G3-side peering is prospective source only.

The committed Go health source is copied byte-for-byte into [image-candidate](./image-candidate) as a **prospective review candidate**, not historical recovery. It is **BLOCKED**: no secret challenge observation and no pinned binary-production recipe for Docker's required health-server. No existing synthetic-health source was modified. A new source digest must bind a new future immutable manifest; the historical image digest is not recycled.

[Proof specifications](./proof/G3_PROOF_MANIFEST.json), [negative probes](./proof/G3_NEGATIVE_PROBES.json), [rollback DAG](./proof/G3_ROLLBACK_PLAN.json) and [reconciliation](./proof/G3_RECONCILIATION_PLAN.json) are local plans, never executed. The secret observer portion is explicitly incomplete, so ROOT-1 is not closed.

Generated [build artifacts](./build) prove local syntax/module closure only; they are not source authority or deployment permission. No image build, controller CLI execution, cloud validation or deployment occurred.
`,
      { ...config, parser: 'markdown' },
    ),
  )
  const closure = {
    phase: 'G3R2',
    lineage: 'PROSPECTIVE_G3R2',
    G3R2_GATE: 'BLOCKED',
    CANONICAL_SOURCE_MANIFEST: 'COMPLETE_WITH_EXACT_IMAGE_BLOCKER',
    NEW_CANONICAL_MODULE_COUNT: modules.length,
    MODULE_RESPONSIBILITIES: 'COMPLETE',
    LOCAL_BICEP_BUILD: 'PASS',
    MODULE_REFERENCES: 'CLOSED',
    REQUIRED_PARAMETERS: 'ACCOUNTED_CLASSIFIED_NOT_LIVE_BOUND',
    SECRET_VALUES_IN_SOURCE: 0,
    NETWORK_CONTRACT_INTEGRATED: 'YES_WITH_BUILDER_ACTIVATION_DENIED',
    IDENTITY_SEPARATION: 'YES',
    G2_MUTATION_BOUNDARY_PRESERVED: 'YES',
    CONTROLLERS: 'LOCAL_ONLY_NOT_EXECUTED',
    PROOF_PACKAGE: 'SPECIFICATIONS_COMPLETE;IMAGE_OBSERVATION_BLOCKED',
    ROLLBACK_PLAN: 'COMPLETE_LOCAL_SPECIFICATION',
    RECONCILIATION_PLAN: 'COMPLETE_LOCAL_SPECIFICATION',
    QUALIFIED_IMAGE_SOURCE: 'BLOCKED',
    imageDeficiencies: imageReport.exactDeficiencies,
    ROOT_1_FROZEN_SOURCE_AUTHORITY: 'REMAINS_BLOCKED_PROSPECTIVE_IMAGE_AND_OBSERVER_NOT_QUALIFIED',
    HISTORICAL_SEVEN_MODULE_PACKAGE_RECOVERED: 'NO',
    HISTORICAL_CONTROLLERS_RECOVERED: 'NO',
    SEALED_G2_TERMINAL_PACKET_RECOVERED: 'NO',
    remainingRoots: [
      'ROOT-1:explicitprospectiveimage/binaryrecipe/observeramendment',
      'ROOT-2:accountableoperator+separatehumanapprover',
      'ROOT-3:separateG2networkmutationauthorityandretainedbaseline',
      'ROOT-4:completecostinputs+humanceiling',
    ],
    G3_EXECUTION_READINESS: 'BLOCKED',
    G3A: 'NOT_AUTHORIZED',
    G3B: 'NOT_AUTHORIZED',
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
      G3_CONTROLLER_EXECUTED: 'NO',
      G3A_EXECUTED: 'NO',
      G3B_EXECUTED: 'NO',
    },
    historicalPreservation: {
      path: 'G3R2_HISTORICAL_PRESERVATION.json',
      files: Object.keys(baseline).length,
      unchanged: true,
    },
    manifestSha256: sha(readFileSync(path.join(source, 'G3_SOURCE_AUTHORITY_MANIFEST.json'))),
  }
  await writeJson(evidence, 'G3R2_SOURCE_AUTHORITY_CLOSURE.json', closure)
  await writeJson(evidence, 'G3R2_LOCAL_BUILD_EVIDENCE.json', {
    ...builds,
    entries: builds.entries.map(({ resourceDefinitions, ...entry }) => entry),
    unboundRequiredParameters: 0,
    unboundHumanOrRuntimeValues: 'EXPLICIT_SCHEMA_CLASSES;notclaimeddeploymentready',
    localValidationRecord: {
      path: 'G3R2_LOCAL_VALIDATION.json',
      sha256: sha(readFileSync(path.join(evidence, 'G3R2_LOCAL_VALIDATION.json'))),
      status: read('G3R2_LOCAL_VALIDATION.json').overall,
    },
  })
  await writeJson(evidence, 'G3R2_COST_CLOSURE.json', recomputedCosts)
  writeFileSync(
    path.join(evidence, 'G3R2_SOURCE_AUTHORITY_CLOSURE.md'),
    await format(
      `# G3R2 source closure — BLOCKED

New lineage **PROSPECTIVE_G3R2**, version G3_SOURCE_AUTHORITY_V1. [Source manifest](../g3-source/G3_SOURCE_AUTHORITY_MANIFEST.json) contains eight architecture-derived modules, one local-only controller, parameter contracts, proof specifications and source hashes. Historical recovery remains 0/7; controllers and sealed G2 terminal packet remain NOT_FOUND. No further historical search was made.

## Local build

All nine Bicep entrypoints compiled locally with ${builds.compilerVersion}; zero build errors and unresolved module references. Required source parameters are accounted for in the example/schema, not falsely live-bound. [Build evidence](./G3R2_LOCAL_BUILD_EVIDENCE.json) records exact commands and source-to-template digests. Generated ARM is validation output only.

[Local validation](./G3R2_LOCAL_VALIDATION.json) records 237 passing offline tests, 27 PowerShell rejection cases, Node syntax, formatting, byte determinism, persisted-output checks and documentation validation (zero errors; existing warnings retained). Historical recovery/blob-inspection cases were excluded to respect the no-further-search boundary. [Secret scan](./G3R2_SECRET_SCAN.json): raw scanner exit 1 with five exact public resource-name/built-in-role-ID false positives, zero unresolved findings; this is an explicit adjudication, not a raw scanner PASS or an allowlist/config change.

## Exact image-dependent blockers

${imageReport.exactDeficiencies.map((item) => `- **${item.id}:** ${item.fact} Required: ${item.needed}`).join('\n')}

The committed candidate is a static scratch/non-root Go health server; it cannot attest a runtime secret read. The private secret reference in workload source does not make the application observe it. No silent source repair, image build or historical digest claim was made. ROOT-1 therefore remains blocked, not CLOSED_BY_PROSPECTIVE_SUPERSESSION.

## Contracts and cost

Network/identity/RBAC definitions are prospective, mutation-locked; all G2 resources remain external dependencies. Exactly two UAMIs retain None/Main separation; operator recommendation is not appointment. Internal environment DNS is post-create; capacity requires actual environment evidence before activation.

[BOM](../g3-source/G3_BILL_OF_MATERIALS.json) accounts for every prospective source resource and three inline subnets. [Recomputed cost model](./G3R2_COST_CLOSURE.json) validates BOM zone/endpoint counts against captured CAD meters. Builder qualification and ordinary vault, registry excess-storage, applicable platform/public-egress costs remain unresolved. Full proof ceiling UNRESOLVED; human ceiling UNBOUND. Known subtotals are not executable ceilings.

## Residual authority and proof boundary

[Residual packet](./G3R2_RESIDUAL_AUTHORITY_PACKET.md): image/source amendment, accountable roles, separate G2 network authority and human cost closure. G3 execution BLOCKED; G3A/G3B NOT_AUTHORIZED. Every mutation boundary is zero; image/controller/provisioning steps remain NO. All original G3/G3R1 evidence hashes are preserved.
`,
      { ...config, parser: 'markdown' },
    ),
  )
  writeFileSync(
    path.join(evidence, 'G3R2_RESIDUAL_AUTHORITY_PACKET.md'),
    await format(
      `# G3R2 residual authority — BLOCKED, no execution permission

## ROOT-1 prospective image decision

The new Bicep/source/proof specification package exists and compiles. Explicitly authorize a prospective image amendment that provides a non-disclosing runtime secret observer and pinned Go binary-production recipe, or approve an artifact-preserving observation design compatible with unchanged health source. Do not treat static health200 or successful platform secret resolution as runtime-read proof. No replacement or in-place repair was silently made.

## ROOT-2 accountable roles

Recommended existing operator remains bfa4a851-696a-4d3f-927b-5fb1526f79f2; not appointed. Bind lifecycle owner, execution operator and a separate human approver, verify effective permissions, and separately govern exact scoped RBAC/secret seeding. The build-slot UAMI is platform pull only; repository writer is the separately appointed operator.

## ROOT-3 G2 boundary

Separate explicit human authority is required for G2-side peering, ACR DNS link, firewall allowlist and repository grants, against an explicitly bound retained G2 terminal baseline. Historical sealed packet remains missing. No new source resource writes into G2.

## ROOT-4 costs

Complete qualified private builder SKU/runtime/disk/transfer, ordinary vault operations, registry storage/headroom and applicable egress meters/quantities. Known-component arithmetic is not a full recommended ceiling. HUMAN_APPROVED_EXECUTION_CEILING_CAD=UNBOUND.

## Future sequence

No G3A/G3B execution is authorized. Image source qualification and immutable new manifest must precede separate workload authority. After a separately authorized empty environment exists, query its Consumption quota and confirm required capacity before activation. Source's mutation/activation/RBAC flags are currently locked false; neither environment variables nor CI can unlock them.
`,
      { ...config, parser: 'markdown' },
    ),
  )
  verifyPreservedBaseline(baseline)
  await writeJson(evidence, 'G3R2_OUTPUT_BINDING.json', {
    status: 'LOCAL_OUTPUT_HASH_BINDING_NOT_EXECUTION_AUTHORITY',
    files: [
      'G3R2_SOURCE_AUTHORITY_CLOSURE.json',
      'G3R2_SOURCE_AUTHORITY_CLOSURE.md',
      'G3R2_LOCAL_BUILD_EVIDENCE.json',
      'G3R2_COST_CLOSURE.json',
      'G3R2_RESIDUAL_AUTHORITY_PACKET.md',
    ].map((name) => ({ name, sha256: sha(readFileSync(path.join(evidence, name))) })),
    sourceManifestMarkdownSha256: sha(
      readFileSync(path.join(source, 'G3_SOURCE_AUTHORITY_MANIFEST.md')),
    ),
  })
  return closure
}
export async function checkClosure() {
  const baseline = read('G3R2_HISTORICAL_PRESERVATION.json')
  verifyPreservedBaseline(baseline)
  const manifest = JSON.parse(
    readFileSync(path.join(source, 'G3_SOURCE_AUTHORITY_MANIFEST.json'), 'utf8'),
  )
  assert.equal(
    sha(readFileSync(fileURLToPath(import.meta.url))),
    manifest.localTooling.generator.sha256,
    'SOURCE_GENERATOR_DIGEST_CHANGED',
  )
  assert.deepEqual(
    walk(source).filter((entry) => !entry.path.startsWith('G3_SOURCE_AUTHORITY_MANIFEST.')),
    manifest.sourceFiles,
    'SOURCE_FILE_SET_OR_DIGEST_CHANGED',
  )
  for (const input of manifest.acceptedLocalInputs)
    assert.equal(
      sha(readFileSync(path.join(root, input.name))),
      input.sha256,
      `ACCEPTED_LOCAL_INPUT_CHANGED:${input.name}`,
    )
  const binding = read('G3R2_OUTPUT_BINDING.json')
  for (const output of binding.files)
    assert.equal(
      sha(readFileSync(path.join(evidence, output.name))),
      output.sha256,
      `OUTPUT_DIGEST_CHANGED:${output.name}`,
    )
  assert.equal(
    sha(readFileSync(path.join(source, 'G3_SOURCE_AUTHORITY_MANIFEST.md'))),
    binding.sourceManifestMarkdownSha256,
  )
  for (const entry of manifest.sourceFiles)
    assert.equal(
      sha(readFileSync(path.join(source, entry.path))),
      entry.sha256,
      `SOURCE_DIGEST_CHANGED:${entry.path}`,
    )
  const builds = read('G3R2_LOCAL_BUILD_EVIDENCE.json')
  assert.equal(
    sha(readFileSync(path.join(evidence, builds.localValidationRecord.path))),
    builds.localValidationRecord.sha256,
    'LOCAL_VALIDATION_RECORD_CHANGED',
  )
  for (const entry of builds.entries) {
    assert.equal(sha(readFileSync(path.join(source, entry.source))), entry.sourceSha256)
    assert.equal(sha(readFileSync(path.join(source, entry.templatePath))), entry.templateSha256)
  }
  assert.equal(
    read('G3R2_SOURCE_AUTHORITY_CLOSURE.json').manifestSha256,
    sha(readFileSync(path.join(source, 'G3_SOURCE_AUTHORITY_MANIFEST.json'))),
  )
  validateParameters(
    JSON.parse(readFileSync(path.join(source, 'parameters.example.json'), 'utf8')).parameters,
    JSON.parse(readFileSync(path.join(source, 'parameters.schema.json'), 'utf8')),
  )
  return {
    status: 'PASS_PERSISTED_SOURCE_AND_BUILD_HASH_CHECK',
    historicalFiles: Object.keys(baseline).length,
  }
}
export async function main(args) {
  assert(
    args.length === 1 && ['--write', '--check'].includes(args[0]),
    'LOCAL_SOURCE_CLOSURE_FLAGS_ONLY',
  )
  if (args[0] === '--write')
    await generateSourceClosure(path.join(process.env.USERPROFILE, '.azure', 'bin', 'bicep.exe'))
  else await checkClosure()
  console.log(
    'PASS local G3R2 evidence validation;G3R2/image authority BLOCKED;zero Azure/controller/image execution.',
  )
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2))
