import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import {
  activationGate,
  azureExecutionAllowed,
  validateParameters,
} from './g3-source/controllers/local-plan.mjs'
import { checkClosure, main, reviewImage, walk } from './g3r2-source-closure.mjs'
import { overlaps } from './g3-readiness-report.mjs'
import { checkFrozenG3R2 } from './g3r2i-preservation.mjs'

const root = fileURLToPath(new URL('./', import.meta.url))
const evidence = path.join(root, 'g3-readiness-evidence')
const archive = path.join(evidence, 'g3r2-frozen-source')
const source = existsSync(archive) ? archive : path.join(root, 'g3-source')
const read = (directory, name) =>
  JSON.parse(readFileSync(path.join(directory, name), 'utf8').replace(/^\uFEFF/, ''))
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const manifest = read(source, 'G3_SOURCE_AUTHORITY_MANIFEST.json')
const closure = read(evidence, 'G3R2_SOURCE_AUTHORITY_CLOSURE.json')
const builds = read(evidence, 'G3R2_LOCAL_BUILD_EVIDENCE.json')
const bom = read(source, 'G3_BILL_OF_MATERIALS.json')
const schema = read(source, 'parameters.schema.json')
const example = read(source, 'parameters.example.json').parameters
const proof = read(source, 'proof/G3_PROOF_MANIFEST.json')
const rollback = read(source, 'proof/G3_ROLLBACK_PLAN.json')
const prior = read(evidence, 'G3_EXECUTION_READINESS.json')

test('new prospective lineage never claims historical recovery or arbitraryseven module count', () => {
  assert.equal(manifest.LINEAGE_CLASS, 'PROSPECTIVE_G3R2')
  assert.equal(manifest.VERSION, 'G3_SOURCE_AUTHORITY_V1')
  assert.equal(manifest.HISTORICAL_EXPECTED_MODULE_COUNT, 7)
  assert.equal(manifest.HISTORICAL_RECOVERED_MODULE_COUNT, 0)
  assert.equal(manifest.NEW_CANONICAL_MODULE_COUNT, 8)
  assert.equal(manifest.MODULES.length, 8)
  assert(manifest.decompositionRationale.includes('DNSruntime-name'))
})
for (const module of manifest.MODULES)
  test(`architecture responsibility:${module.id}`, () => {
    assert.equal(module.scope, 'resourceGroup')
    assert(module.responsibility)
    assert(
      readFileSync(path.join(source, module.path), 'utf8').includes(
        "targetScope = 'resourceGroup'",
      ),
    )
    assert(builds.entries.some((entry) => entry.source === module.path && entry.result === 'PASS'))
  })
for (const entry of builds.entries)
  test(`localbuild/source/template binding:${entry.source}`, () => {
    assert.equal(hash(readFileSync(path.join(source, entry.source))), entry.sourceSha256)
    assert.equal(hash(readFileSync(path.join(source, entry.templatePath))), entry.templateSha256)
    assert.equal(entry.result, 'PASS')
    assert.equal(entry.stderr, '')
    const template = read(source, entry.templatePath)
    const flags = Object.entries(template.parameters ?? {}).filter(([name]) =>
      /Authorized|provisionResources/.test(name),
    )
    assert(flags.length)
    for (const [, flag] of flags) {
      assert.equal(flag.defaultValue, false)
      assert.deepEqual(flag.allowedValues, [false])
    }
  })
test('allnine entrypoints compile with noerrors and no cloudvalidation', () => {
  assert.equal(builds.entries.length, 9)
  assert.equal(builds.buildErrors, 0)
  assert.equal(builds.unresolvedModules, 0)
  assert.equal(builds.unboundRequiredParameters, 0)
  assert.equal(builds.azureCalls, 0)
  assert.equal(builds.generatedTemplatesAreAuthority, false)
})
test('main requiredsource parameters are present but latehuman/runtime bindings remain classified', () => {
  const required = builds.entries.find((entry) => entry.source === 'main.bicep').requiredParameters
  assert(required.every((name) => name in example))
  assert.equal(validateParameters(example, schema).executionAllowed, false)
  assert.equal(schema.properties.location.classification, 'FIXED_GOVERNED_VALUES')
  assert.equal(schema.properties.quotaEvidenceId.classification, 'POST_CREATE_DISCOVERY')
  assert.equal(schema.properties.keyVaultPurgeProtection.classification, 'HUMAN_BINDING_REQUIRED')
  assert.equal(schema.humanSlots.separateHumanApprover, 'HUMAN_BINDING_REQUIRED')
})
for (const key of ['provisionResources', 'workloadActivationAuthorized', 'rbacAuthorized'])
  test(`deny mutatedauthorization flag:${key}`, () => {
    assert.throws(
      () => validateParameters({ ...example, [key]: true }, schema),
      /GOVERNED_PARAMETER/,
    )
  })
for (const input of [
  { ...example, secretValue: 'do-not-store' },
  { ...example, location: 'eastus' },
  { ...example, approvedPlatformPrefixes: ['0.0.0.0/0'] },
  { ...example, approvedPlatformPrefixes: ['256.1.0.0/24'] },
  { ...example, approvedPlatformPrefixes: ['10.0.0.0/8'] },
  { ...example, approvedPlatformPrefixes: ['10.0.0.1/24'] },
  { ...example, discoveredEndpointIps: ['10.91.2.0/24'] },
])
  test(`reject extra,foreign or unbounded parameter:${JSON.stringify(input.approvedPlatformPrefixes ?? input.location)}`, () => {
    assert.throws(() => validateParameters(input, schema))
  })
test('missingrequired parameter is not silentlydefaulted', () => {
  const missing = { ...example }
  delete missing.names
  assert.throws(() => validateParameters(missing, schema), /REQUIRED_PARAMETER/)
})
test('activationdenies missingcapacity,wrongenv,mutableimage and unqualifiedsource', () => {
  const eligible = {
    explicitHumanWorkloadAuthority: true,
    environmentId: 'expected-env',
    quotaEnvironmentId: 'expected-env',
    quotaEvidenceId: 'future-captured-proof',
    availableConsumptionMilliCores: 250,
    imageSourceQualified: true,
    immutableImage: `nzilag2tzo75uuozprbo.azurecr.io/g3-synthetic-runtime@sha256:${'a'.repeat(64)}`,
  }
  assert.equal(activationGate(eligible), 'ELIGIBLE_FOR_SEPARATE_FUTURE_AUTHORIZATION_NOT_EXECUTION')
  for (const mutation of [
    { availableConsumptionMilliCores: 249 },
    { quotaEvidenceId: '' },
    { quotaEnvironmentId: 'wrong' },
    { explicitHumanWorkloadAuthority: false },
    { imageSourceQualified: false },
    { immutableImage: 'registry/repository:latest' },
    { environmentId: '' },
    { availableConsumptionMilliCores: NaN },
  ])
    assert.equal(activationGate({ ...eligible, ...mutation }), 'DENY')
  assert.equal(azureExecutionAllowed, false)
})
test('controller containslocalonly plans,not childprocess/cloudmutation paths', () => {
  const controller = readFileSync(path.join(source, 'controllers/local-plan.mjs'), 'utf8')
  assert(
    !/child_process|spawnSync|execSync|fetch\(|process\.env|NODE_ENV|az deployment/.test(
      controller,
    ),
  )
  assert.equal(manifest.CONTROLLERS.length, 1)
  assert.equal(manifest.CONTROLLERS[0].executionStatus, 'NOT_EXECUTED')
  assert.equal(manifest.CONTROLLERS[0].AZURE_EXECUTION_ALLOWED, 'NO')
  assert.equal(manifest.CONTROLLERS[0].actions.length, 5)
})
test('network usesacceptedCIDRs,no broadInternet and exactservice tags', () => {
  const networkText = readFileSync(path.join(source, 'modules/network.bicep'), 'utf8')
  for (const cidr of ['10.91.0.0/16', '10.91.1.0/24', '10.91.2.0/24', '10.91.3.0/24'])
    assert(networkText.includes(cidr))
  assert(networkText.includes("nextHopIpAddress: '10.90.0.4'"))
  const destinations = example.networkRules.outbound.map(
    (rule) => rule.properties.destinationAddressPrefix,
  )
  for (const tag of [
    'MicrosoftContainerRegistry',
    'AzureFrontDoorFirstParty',
    'AzureContainerRegistry',
    'AzureActiveDirectory',
    'AzureKeyVault',
    'AzurePlatformDNS',
    'AzureMonitor',
  ])
    assert(destinations.includes(tag))
  assert(!destinations.includes('Internet') && !destinations.includes('AzureCloud'))
  assert.equal(example.approvedPlatformPrefixes.length, 0)
})
test('canonicalVNetCIDRdoesnotoverlapcapturedbaselinesandsubnetssiblingsaredisjoint', () => {
  const subnets = bom.inlineResources[0].cidrs
  assert(prior.cidrs.existingRangesChecked.every((entry) => !overlaps('10.91.0.0/16', entry.cidr)))
  for (const [i, cidr] of subnets.entries())
    assert(subnets.slice(i + 1).every((other) => !overlaps(cidr, other)))
})
test('peeringonlywritesG3side andG2modifications remainexternalauthority', () => {
  const external = read(source, 'EXTERNAL_G2_MUTATION_DEPENDENCIES.json')
  assert.equal(external.allowedByG3R2, false)
  assert.equal(external.peering.length, 2)
  assert(external.registryBindings.length)
  const templates = builds.entries.map((entry) => read(source, entry.templatePath))
  for (const template of templates) {
    for (const resource of template.resources ?? []) {
      assert(!/azureFirewalls|ContainerRegistry/.test(resource.type))
      assert(!String(resource.scope ?? '').includes('nzila-g2-proof'))
    }
  }
})
test('privateendpointNSG enforcesonlyprivateconsumers and sourcepreservesDNSplatformexemption', () => {
  const networkText = readFileSync(path.join(source, 'modules/network.bicep'), 'utf8')
  assert(networkText.includes('NetworkSecurityGroupEnabled'))
  assert(networkText.includes('deny-other-pe-ingress'))
  assert(networkText.includes('private-vault-consumers'))
  assert(
    example.networkRules.outbound.some(
      (rule) =>
        rule.properties.destinationAddressPrefix === 'AzurePlatformDNS' &&
        rule.properties.access === 'Allow',
    ),
  )
})
test('onlyselectedprivateDNS zones andpostcreate internalapex/wildcard arepresent', () => {
  const internal = readFileSync(path.join(source, 'modules/internal-dns.bicep'), 'utf8')
  assert(internal.includes('name: defaultDomain'))
  assert(internal.includes("name: '@'") && internal.includes("name: '*'"))
  assert(internal.includes('registrationEnabled: false'))
  const environmentText = readFileSync(path.join(source, 'modules/environment.bicep'), 'utf8')
  assert(environmentText.includes('environment!.properties.defaultDomain'))
  assert(environmentText.includes('environment!.properties.staticIp'))
  assert(environmentText.includes("publicNetworkAccess: 'Disabled'"))
  assert(!environmentText.includes('privateEndpoint'))
})
test('identitybuildslotplatformpull staysNone andruntimeMain,no rolecollapse', () => {
  assert.equal(manifest.IDENTITY_CONTRACT.count, 2)
  assert.notEqual(manifest.IDENTITY_CONTRACT.build, manifest.IDENTITY_CONTRACT.runtime)
  assert.equal(manifest.IDENTITY_CONTRACT.operatorCandidate, 'bfa4a851-696a-4d3f-927b-5fb1526f79f2')
  const workloadText = readFileSync(path.join(source, 'modules/workload.bicep'), 'utf8')
  assert(/identity:\s*buildIdentityId[\s,]+lifecycle:\s*'None'/.test(workloadText))
  assert(/identity:\s*runtimeIdentityId[\s,]+lifecycle:\s*'Main'/.test(workloadText))
  assert.equal(manifest.IDENTITY_CONTRACT.roleAssignments, 'PROPOSED_NOT_AUTHORIZED')
})
test('secretvalue isneveraparameter/resource;role referencesexistingexactsecret', () => {
  assert(!Object.keys(schema.properties).some((name) => /secretValue|password|token/i.test(name)))
  const vaultText = readFileSync(path.join(source, 'modules/vault.bicep'), 'utf8')
  assert(!/resource \w+ 'Microsoft.KeyVault\/vaults\/secrets/.test(vaultText))
  const bindingsText = readFileSync(path.join(source, 'modules/bindings.bicep'), 'utf8')
  assert(bindingsText.includes("name: 'g3-proof-secret'"))
  assert(bindingsText.includes('scope: secret'))
  assert(bindingsText.includes('4633458b-17de-408a-b874-0445c86b69e6'))
})
test('committedimage bytes/digests bindprospectivecandidate,nothistoricalqualifiedartifact', () => {
  const review = reviewImage()
  assert.equal(review.decision, 'BLOCKED')
  assert.equal(review.lineage, 'PROSPECTIVE_G3R2')
  assert.equal(review.historicalManifestReused, false)
  for (const item of review.sourceFiles)
    assert.equal(hash(readFileSync(path.join(source, 'image-candidate', item.name))), item.sha256)
  assert.equal(review.buildContextDigest, manifest.IMAGE_SOURCE.buildContextDigest)
  assert.equal(review.dockerfileDigest, manifest.IMAGE_SOURCE.dockerfileDigest)
  assert.equal(review.imageBuilt, false)
  assert.equal(review.imagePushed, false)
})
test('sourcequalificationblockedfactsarenotmaskedbyhealth200orplatformsecretresolution', () => {
  assert.equal(closure.QUALIFIED_IMAGE_SOURCE, 'BLOCKED')
  assert.equal(
    manifest.IMAGE_SOURCE.review.secretUsage,
    'NONE;doesnotconsumeG3_PROOF_SECRET orrequestruntimeMI/KVtoken',
  )
  assert.equal(proof.secretChallenge.implementedObserver, false)
  assert.equal(manifest.IMAGE_SOURCE.exactDeficiencies.length, 2)
  assert(closure.ROOT_1_FROZEN_SOURCE_AUTHORITY.startsWith('REMAINS_BLOCKED'))
  assert.equal(closure.G3R2_GATE, 'BLOCKED')
})
test('sixnegativefutureprobes specifyexplicitdenialandcontainmentwithoutliveexecution', () => {
  const probes = read(source, 'proof/G3_NEGATIVE_PROBES.json')
  assert.equal(probes.probes.length, 6)
  const expected = [
    'RUNTIME_CANNOT_PUSH_IMAGE',
    'BUILD_CANNOT_READ_RUNTIME_SECRET',
    'UNAUTHORIZED_PRINCIPAL_CANNOT_DEPLOY',
    'PUBLIC_PATH_CANNOT_REACH_PRIVATE_ENDPOINT',
    'WORKLOAD_DENIED_BEFORE_CAPACITY_GATE',
    'UNAPPROVED_G2_MUTATION_REJECTED',
  ]
  assert.deepEqual(
    probes.probes.map((probe) => probe.id),
    expected,
  )
  assert(
    probes.probes.every(
      (probe) =>
        probe.execution === 'NOT_EXECUTED' &&
        probe.expectedUnexpectedSuccessHandling.startsWith('STOP'),
    ),
  )
})
test('rollbackdependenciesformDAG,preserveevidence andexternalG2boundary', () => {
  const done = new Set()
  while (done.size < rollback.nodes.length) {
    const ready = rollback.nodes.filter(
      (node) => !done.has(node.id) && node.dependsOn.every((dependency) => done.has(dependency)),
    )
    assert(ready.length, 'ROLLBACK_CYCLE_OR_UNKNOWN_DEPENDENCY')
    for (const node of ready) done.add(node.id)
  }
  assert.equal(
    rollback.G2_EXTERNAL_ROLLBACK_DEPENDENCY,
    'SEPARATE_EXPLICIT_HUMAN_AUTHORITY_REQUIRED',
  )
  assert.equal(rollback.nodes[0].id, 'retain-evidence')
  assert.equal(rollback.execution, 'NOT_EXECUTED')
})
test('reconciliationcoversresourcesidentitiesRBACnetworkDNSlogsimageandsecretwithoutliveclaims', () => {
  const plan = read(source, 'proof/G3_RECONCILIATION_PLAN.json')
  for (const key of [
    'expectedResources',
    'expectedIdentities',
    'expectedRbac',
    'expectedNetworkPaths',
    'expectedDns',
    'expectedLogs',
    'expectedImageDigest',
    'expectedSecretReference',
    'expectedPublicExposure',
  ])
    assert(key in plan)
  assert.equal(plan.execution, 'NOT_EXECUTED')
  assert(plan.residualState.includes('notrecovered'))
})
test('BOMcorrespondsexactlytoallcompiledprospectiveresourcesandthreeinlinesubnets', () => {
  const actual = builds.entries
    .flatMap((entry) => read(source, entry.templatePath).resources ?? [])
    .filter((resource) => resource.type !== 'Microsoft.Resources/deployments')
  assert.equal(bom.resources.length, actual.length)
  const actualTypes = actual.map((resource) => resource.type).sort()
  assert.deepEqual(bom.resources.map((item) => item.resourceType).sort(), actualTypes)
  assert.equal(bom.inlineResources[0].count, 3)
  assert(
    bom.resources.every(
      (item) =>
        item.logicalResourceId && item.canonicalName && item.owningModule && item.priceMeterBinding,
    ),
  )
  assert.equal(
    bom.resources.filter(
      (item) => item.resourceType === 'Microsoft.ManagedIdentity/userAssignedIdentities',
    ).length,
    2,
  )
  assert.equal(
    bom.resources.filter((item) => item.resourceType === 'Microsoft.Network/networkSecurityGroups')
      .length,
    3,
  )
})
test('costsrecomputedfromBOMcountsandretainedmeterswithoutinventedbuilderzeros', () => {
  const costs = read(evidence, 'G3R2_COST_CLOSURE.json')
  assert.equal(
    costs.derivedFromBomSha256,
    hash(readFileSync(path.join(source, 'G3_BILL_OF_MATERIALS.json'))),
  )
  assert.equal(costs.designQuantities.incrementalPrivateDnsZones, 2)
  assert.equal(costs.scenarios.length, 5)
  assert(
    costs.scenarios.every(
      (scenario) =>
        scenario.completeTotalCAD === null && scenario.COST_STATUS === 'UNRESOLVED_METER',
    ),
  )
  assert.equal(costs.builder.BUILDER_COST, 'UNRESOLVED')
  assert.equal(costs.HUMAN_APPROVED_EXECUTION_CEILING_CAD, 'UNBOUND')
  assert.equal(costs.RECOMMENDED_FULL_PROOF_EXECUTION_CEILING_CAD, 'UNRESOLVED')
  for (const meter of Object.values(costs.meters)) {
    const snapshot = read(evidence, meter.sourceFile)
    assert(
      snapshot.items.some(
        (item) =>
          item.meterId === meter.meterId &&
          item.retailPrice === meter.retailPrice &&
          item.currencyCode === 'CAD' &&
          item.isPrimaryMeterRegion,
      ),
    )
  }
})
test('secret scanrawfindingsremainexplicitandexactnonsecretadjudicationisnotsuppression', () => {
  const scan = read(evidence, 'G3R2_SECRET_SCAN.json')
  assert.equal(scan.scannerExitCode, 1)
  assert.equal(scan.rawFindings, 5)
  assert.equal(scan.exactNonsecretAdjudications.length, 5)
  assert.equal(scan.unresolvedFindings, 0)
  assert.equal(scan.secretValuesFound, 0)
  assert.equal(scan.repositoryScannerConfigChanged, false)
  assert.equal(scan.generatedAllowlistOrBaselineUsed, false)
  assert.deepEqual(scan.sourceDigests, walk(source))
  assert.equal(
    scan.repositoryScannerConfigSha256,
    hash(readFileSync(path.join(root, '..', '..', '.gitleaks.toml'))),
  )
})
test('alloriginalG3/G3R1snapshotsandG2workingbytespreserved', () => {
  const baseline = read(evidence, 'G3R2_HISTORICAL_PRESERVATION.json')
  for (const [name, expected] of Object.entries(baseline))
    assert.equal(hash(readFileSync(path.join(evidence, name))), expected)
  for (const [name, expected] of Object.entries(prior.preservation.localG2SourceHashes))
    assert.equal(hash(readFileSync(path.join(root, name))), expected)
})
test('historicmissingpacketsstaymissingandnotprospectivelyrecovered', () => {
  assert.equal(closure.HISTORICAL_SEVEN_MODULE_PACKAGE_RECOVERED, 'NO')
  assert.equal(closure.HISTORICAL_CONTROLLERS_RECOVERED, 'NO')
  assert.equal(closure.SEALED_G2_TERMINAL_PACKET_RECOVERED, 'NO')
  assert.equal(closure.G3_EXECUTION_READINESS, 'BLOCKED')
  assert.equal(closure.G3A, 'NOT_AUTHORIZED')
  assert.equal(closure.G3B, 'NOT_AUTHORIZED')
  assert.equal(closure.remainingRoots.length, 4)
})
for (const [name, value] of Object.entries(closure.proofBoundaries))
  test(`noexecutionboundary:${name}`, () => {
    assert(value === 0 || value === 'NO')
  })
test('persistedsource/templatecheckdoesnotinvokecontrollerorAzure', async () => {
  const result = existsSync(archive) ? checkFrozenG3R2() : await checkClosure()
  assert.equal(result.status, 'PASS_PERSISTED_SOURCE_AND_BUILD_HASH_CHECK')
})
for (const flag of [
  '--deploy',
  '--build-image',
  '--push',
  '--execute-controller',
  '--grant',
  '--what-if',
])
  test(`sourceevidencegeneratorrejectscloud/imageflags:${flag}`, async () => {
    await assert.rejects(main([flag]), /LOCAL_SOURCE_CLOSURE_FLAGS_ONLY/)
  })
