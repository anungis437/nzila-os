import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { gitRead, recoverAuthority } from './g3r1-authority-recovery.mjs'
import {
  buildG3R1,
  directoryCapacity,
  generateG3R1,
  main,
  networkContract,
  verifyPreservation,
} from './g3r1-local-closure.mjs'

const root = fileURLToPath(new URL('./', import.meta.url))
const evidence = path.join(root, 'g3-readiness-evidence')
const read = (name) =>
  JSON.parse(readFileSync(path.join(evidence, name), 'utf8').replace(/^\uFEFF/, ''))
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const recovery = read('G3R1_AUTHORITY_RECOVERY.json')
const prior = read('G3_EXECUTION_READINESS.json')
const { normalized, network, costs } = buildG3R1()

test('recovery is bounded to all local reachable refs and path history', () => {
  assert.equal(
    recovery.search.refScope,
    'ALL_LOCAL_REACHABLE_REFS;no fetch,reflog or dangling-object claim',
  )
  assert(recovery.search.totalReachableCommits >= 3030)
  assert(recovery.search.revisions.length <= 80)
  assert(recovery.search.candidateObjects <= 300)
  assert.equal(recovery.search.inspectedBlobs, recovery.search.inspected.length)
  assert.equal(recovery.FROZEN_G3_PACKAGE_GIT_HISTORY_RESULT, 'NOT_FOUND')
})
test('history recovery has deterministic repeated results with no working tree overwrite', () => {
  assert.deepEqual(recoverAuthority(), recovery)
  assert.equal(recovery.workingTreeOverwrite, false)
  assert.equal(recovery.historicalBytesChanged, false)
  assert.deepEqual(recovery.recoveredArtifacts, [])
})
for (const item of recovery.search.inspected)
  test(`exact Git historical blob digest:${item.oid}`, () => {
    const bytes = gitRead(['cat-file', 'blob', item.oid])
    assert.equal(hash(bytes), item.sha256)
    assert.equal(bytes.length, item.byteLength)
    if (item.sourceCommits.length) {
      const historical = gitRead(['show', `${item.sourceCommits[0]}:${item.sourcePath}`])
      assert.equal(hash(historical), item.sha256)
    }
  })
for (const command of [
  'checkout',
  'reset',
  'restore',
  'rebase',
  'merge',
  'cherry-pick',
  'fetch',
  'push',
])
  test(`Git reader refuses mutator:${command}`, () => {
    assert.throws(() => gitRead([command]), /GIT_READ_ONLY_COMMANDS/)
  })
test('seven module names are not fabricated when original path manifest is absent', () => {
  assert.equal(recovery.EXPECTED_G3_MODULES, 7)
  assert.equal(recovery.RECOVERED_G3_MODULES, 0)
  assert.equal(recovery.MISSING_G3_MODULES.count, 7)
  assert.equal(recovery.MISSING_G3_MODULES.exactPaths, null)
  assert.equal(recovery.CONTROLLER_AUTHORITY, 'NOT_FOUND')
  assert.equal(recovery.SEALED_G2_TERMINAL_PACKET, 'NOT_FOUND')
  assert.equal(recovery.QUALIFIED_IMAGE_SOURCE, 'BLOCKED')
  assert(recovery.supportingSyntheticSource.some((item) => item.sourcePath.endsWith('main.go')))
  assert(recovery.supportingSyntheticSource.every((item) => !item.qualifiedDigestMention))
})
test('historical readiness interpretations remain byte identical while supersession is explicit', () => {
  verifyPreservation(recovery)
  assert.equal(normalized.supersedes.interpretationOnly, true)
  assert.equal(normalized.supersedes.historicalBytesChanged, false)
  assert.equal(prior.status.G3_QUOTA_STATUS, 'BLOCKED')
  assert.equal(
    normalized.capacity.ACA_CONSUMPTION_CORE_QUOTA_CLASS,
    'POST_ENVIRONMENT_CREATE_PRE_WORKLOAD_ACTIVATION',
  )
  assert.equal(normalized.capacity.PRE_DEPLOY_CAPACITY, 'SUBSCRIPTION_AND_REGION_CAPABILITY_ONLY')
})
test('tampered historical hashes are rejected without rewriting evidence', () => {
  const altered = structuredClone(recovery)
  altered.preservation['G3_EXECUTION_READINESS.json'] = '0'.repeat(64)
  assert.throws(() => verifyPreservation(altered), /HISTORICAL_EVIDENCE_CHANGED/)
})
test('G2 working source bytes remain equal to the pre-G3R1 recorded hashes', () => {
  for (const [source, expected] of Object.entries(prior.preservation.localG2SourceHashes))
    assert.equal(hash(readFileSync(path.join(root, source))), expected)
})
test('Consumption cores can only gate workload activation after empty environment creation', () => {
  const gate = normalized.capacity.POST_CREATE_GATE_1
  assert.equal(gate.requiredCPU, 0.25)
  assert.deepEqual(gate.sequence, [
    'CREATE_AUTHORIZED_EMPTY_G3_ENVIRONMENT',
    'QUERY_MANAGED_ENVIRONMENT_CONSUMPTION_CORE_QUOTA',
    'CONFIRM_REQUIRED_CAPACITY',
    'ONLY_THEN_AUTHORIZE_WORKLOAD_ACTIVATION',
  ])
  assert.equal(gate.currentEnvironmentExists, false)
  assert.equal(gate.workloadActivation, 'NOT_AUTHORIZED')
  assert(!normalized.rootBlockers.some((item) => /CONSUMPTION|CORE_QUOTA/.test(item.type)))
})
test('UAMI capacity uses total Entra directory objects,not SP count or regional cores', () => {
  const capacity = normalized.capacity.UAMI_DIRECTORY_CAPACITY
  assert.equal(capacity.classification, 'ENTRA_DIRECTORY_OBJECT_CAPACITY')
  assert.equal(capacity.total, 500000)
  assert.equal(capacity.used, 1183)
  assert.equal(capacity.futureUsed, 1185)
  assert.equal(capacity.managedIdentityThreshold, 490000)
  assert.equal(capacity.status, 'PASS_CAPTURED_DIRECTORY_HEADROOM')
  assert.equal(capacity.regionComputeQuota, false)
  assert.equal(capacity.reservation, false)
  assert.equal(normalized.capacity.identityCounts.totalNewUamis, 2)
})
test('managed identity quota fails closed exactly at98% threshold', () => {
  assert.equal(
    directoryCapacity({ total: 100, used: 95 }).status,
    'PASS_CAPTURED_DIRECTORY_HEADROOM',
  )
  assert.equal(directoryCapacity({ total: 100, used: 96 }).status, 'BLOCKED_DIRECTORY_THRESHOLD')
  assert.equal(directoryCapacity({ total: 100, used: 99 }).status, 'BLOCKED_DIRECTORY_THRESHOLD')
})
for (const quota of [
  null,
  {},
  { total: 0, used: 0 },
  { total: 100, used: -1 },
  { total: 100.5, used: 1 },
])
  test(`missing/invalid directory quota is explicitly unverifiable:${JSON.stringify(quota)}`, () => {
    assert.equal(directoryCapacity(quota).status, 'UNVERIFIABLE_WITH_CURRENT_AUTHORITY')
  })
test('inherited region-deny evidence is inspected rather than inferred from provider registration', () => {
  assert.equal(normalized.capacity.predeploy.policyAssignments.length, 2)
  assert.equal(normalized.capacity.predeploy.visibleDenyAssignments, 0)
  assert.deepEqual(normalized.capacity.predeploy.regionalPolicy.rule.if, {
    equals: 'westeurope',
    field: 'location',
  })
  assert.equal(normalized.capacity.predeploy.regionalPolicy.appliesToCanadaCentral, false)
})
test('captured recommended build principal is not appointed or granted permissions', () => {
  const comparison = normalized.operatorComparison
  assert.equal(comparison.recommendedOperatorCandidate, 'bfa4a851-696a-4d3f-927b-5fb1526f79f2')
  assert.equal(comparison.recommendedAppId, '5c02d25b-cbdc-412f-8c2a-9ed43b73ac20')
  assert(comparison.candidates.every((candidate) => candidate.selected === false))
  assert.equal(comparison.grantMutations, 0)
  assert.equal(comparison.slots.G3_HUMAN_APPROVER, 'HUMAN_BINDING_REQUIRED')
  assert.equal(comparison.separation, 'EXECUTION_OPERATOR != HUMAN_APPROVER')
})
for (const candidate of normalized.operatorComparison.candidates)
  test(`objective comparison retains current assignments and federation:${candidate.displayName}`, () => {
    assert(candidate.principalId && candidate.appId)
    assert(
      candidate.federation.every(
        (item) => item.issuer === 'https://token.actions.githubusercontent.com',
      ),
    )
    assert(candidate.currentRoleAssignments.length)
    assert.equal(candidate.excessPrivilege.length, candidate.currentRoleAssignments.length)
    assert(candidate.missingPrivilege.length)
    assert.equal(candidate.currentConditions.length, candidate.currentRoleAssignments.length)
  })
test('network contains collision-free subnets and two explicit peering directions', () => {
  assert.equal(network.addresses.noCollision, true)
  assert.equal(network.addresses.vnet, '10.91.0.0/16')
  assert.equal(network.acaDelegation, 'Microsoft.App/environments')
  assert.equal(network.peering.length, 2)
  assert.equal(network.peering[0].parent, network.peering[1].remote)
  assert.equal(network.peering[1].parent, network.peering[0].remote)
  assert(
    network.peering.every(
      (item) => item.allowForwardedTraffic && !item.useRemoteGateways && !item.allowGatewayTransit,
    ),
  )
  assert.equal(network.routes[0].nextHopIp, '10.90.0.4')
})
test('network refuses a live VNet collision', () => {
  const collision = structuredClone(prior)
  collision.cidrs.existingRangesChecked.push({ vnet: 'collision', cidr: '10.91.0.0/16' })
  assert.throws(
    () => networkContract(collision, normalized.operatorComparison),
    /G3R1_LIVE_CIDR_COLLISION/,
  )
})
test('network refuses subnet containment failure and overlapping siblings', () => {
  const outside = structuredClone(prior)
  outside.cidrs.acaSubnet = '10.92.1.0/24'
  assert.throws(
    () => networkContract(outside, normalized.operatorComparison),
    /G3R1_SUBNET_CONTAINMENT/,
  )
  const siblings = structuredClone(prior)
  siblings.cidrs.acaSubnet = siblings.cidrs.privateEndpointSubnet
  assert.throws(
    () => networkContract(siblings, normalized.operatorComparison),
    /G3R1_SUBNET_COLLISION/,
  )
})
test('G2 mutations are separated from local network completeness', () => {
  assert.equal(network.G2_PEERING_CHANGE, 'SEPARATE_EXPLICIT_HUMAN_AUTHORITY_REQUIRED')
  assert.equal(network.g2AdditionalMutations.length, 2)
  assert.equal(network.mutations, 0)
  assert.equal(network.firewall.mutated, false)
  assert.equal(
    normalized.readiness.NETWORK_MUTATION_AUTHORITY,
    'SEPARATE_EXPLICIT_HUMAN_AUTHORITY_REQUIRED',
  )
})
for (const dependency of [
  'MicrosoftContainerRegistry',
  'AzureFrontDoorFirstParty',
  'AzureContainerRegistry',
  'AzureActiveDirectory',
  'AzureKeyVault',
  'AzurePlatformDNS',
  'AzureMonitor',
])
  test(`explicit platform dependency:${dependency}`, () => {
    const rule = network.firewall.rules.find((item) => item.dependency === dependency)
    assert(rule?.selected)
    assert.equal(rule.status, 'DESIGN_ONLY')
    assert(rule.provenance && rule.requiredForPlatformOrWorkload)
  })
test('no genericInternet shortcut or dotted service tag is placed in an actual rule', () => {
  assert(
    !network.nsg.outbound.some(
      (rule) => rule.destination === 'Internet' || rule.destination === 'AzureCloud',
    ),
  )
  assert(
    !network.firewall.rules.some(
      (rule) =>
        rule.destinations.includes('Internet') ||
        rule.destinations.includes('*') ||
        rule.destinations.includes('AzureFrontDoor.FirstParty'),
    ),
  )
  assert.equal(network.egress.internetShortcut, 'PROHIBITED')
  assert.equal(network.egress.dockerHubRuntime, 'PROHIBITED')
})
test('DNS accounts for internal environment zone without an ACA private endpoint', () => {
  assert.equal(network.dns.ACA_PRIVATE_ENDPOINT, 'NOT_REQUIRED')
  assert.equal(network.dns.zones.length, 3)
  assert.deepEqual(
    network.dns.zones.map((zone) => zone.zone),
    [
      'privatelink.azurecr.io',
      'privatelink.vaultcore.azure.net',
      '<G3_ENVIRONMENT_DEFAULT_DOMAIN>',
    ],
  )
  assert(
    network.dns.zones.every(
      (zone) => zone.status === 'DESIGN_ONLY' && zone.vnetLink.registrationEnabled === false,
    ),
  )
  assert(network.dns.zones[0].authority.includes('separate authority'))
  assert(network.dns.zones[2].authority.includes('apex and wildcard'))
})
test('NSG explicitly preserves platform DNS,probes and only private proof-client ingress', () => {
  assert(
    network.nsg.outbound.some(
      (rule) => rule.destination === 'AzurePlatformDNS' && rule.action === 'Allow',
    ),
  )
  assert(
    network.nsg.inbound.some(
      (rule) => rule.source === 'AzureLoadBalancer' && rule.ports.includes('30000-32767'),
    ),
  )
  assert.equal(network.ingress.allowPublic, false)
  assert.equal(network.ingress.allowInsecure, false)
  assert(
    network.nsg.inbound.some(
      (rule) => rule.source === '10.91.3.0/24' && rule.ports.includes(31443),
    ),
  )
  assert(network.nsg.outbound.some((rule) => rule.binding?.includes('failsclosed')))
})
test('proposed grants are exact resource/RG scopes and no mutation', () => {
  assert(network.rbac.grants.every((grant) => grant.status === 'PROPOSED_NOT_GRANTED'))
  assert(network.rbac.grants.every((grant) => grant.exactScope.includes('/resourceGroups/')))
  assert(
    network.rbac.grants.every(
      (grant) => grant.purpose && grant.whyRequired && grant.whyNarrowerScopeIsInsufficient,
    ),
  )
  const pull = network.rbac.grants.find((grant) =>
    grant.role.startsWith('Container Registry Repository Reader'),
  )
  assert(
    pull.condition.expression.includes('content/read') &&
      pull.condition.expression.includes('metadata/read'),
  )
  assert(pull.condition.expression.includes("StringEquals 'g3-synthetic-runtime'"))
  const writer = network.rbac.grants.find((grant) =>
    grant.role.startsWith('Container Registry Repository Writer'),
  )
  assert(
    writer.condition.expression.includes('content/write') &&
      writer.condition.expression.includes('metadata/write'),
  )
  const runtime = network.rbac.grants.find((grant) =>
    grant.role.startsWith('Key Vault Secrets User'),
  )
  assert(runtime.exactScope.endsWith('/secrets/g3-proof-secret'))
  assert.equal(network.rbac.rolesCreated, false)
})
for (const [component, meter] of Object.entries(costs.meters))
  test(`captured CAD price provenance:${component}`, () => {
    assert.equal(meter.currency, 'CAD')
    const summary = read(meter.sourceFile)
    assert(
      summary.items.some(
        (item) =>
          item.meterId === meter.meterId &&
          item.retailPrice === meter.retailPrice &&
          item.isPrimaryMeterRegion,
      ),
    )
    if (component.startsWith('intraRegionPeering')) {
      assert.equal(meter.productName, 'Virtual Network Peering')
      assert.equal(meter.armRegionName, 'Global')
      assert.equal(meter.skuName, 'Intra-Region')
    } else if (component === 'privateEndpointEgress')
      assert.equal(meter.meterId, 'e7f162f6-7cb8-4cea-ad4f-12cdb5dda25b')
    else assert.equal(meter.retailPrice, prior.costs.prices[component].retailPrice)
  })
test('all five requested cost scenarios preserve unknowncomplete totals', () => {
  assert.deepEqual(
    costs.scenarios.map((item) => item.name),
    [
      'G3_PROOF_RUN_COST',
      'G3_IDLE_MONTHLY_COST',
      'G3_LOW_USAGE_MONTHLY_COST',
      'G3_EXPECTED_MONTHLY_COST',
      'G3_UPPER_BOUND_SCENARIO',
    ],
  )
  for (const scenario of costs.scenarios) {
    assert.equal(scenario.completeTotalCAD, null)
    assert.equal(scenario.COST_STATUS, 'UNRESOLVED_METER')
    assert(scenario.knownSubtotalCAD > 0)
    assert(scenario.omissions.length)
  }
})
test('monthly standing charges use two newzones and managedIP,not existingACRzonebase', () => {
  assert.equal(costs.designQuantities.incrementalPrivateDnsZones, 2)
  assert.equal(costs.designQuantities.hoursPerMonth, 730)
  assert.equal(costs.designQuantities.freeAllowances, 'NOT_ASSUMED')
  assert(costs.scenarios[1].knownComponents.PLATFORM_MANAGED_EGRESS_IP > 0)
  assert.equal(costs.scenarios[1].knownComponents.ACA_USAGE_COSTS, 0)
  assert.equal(
    costs.scenarios[0].knownComponents.FIXED_COSTS,
    2 * costs.meters.privateDnsZone.retailPrice,
  )
})
test('cost arithmetic exactly prices explicit CPU,memory,request andlog quantities', () => {
  for (const scenario of costs.scenarios) {
    const q = scenario.quantities
    const expected =
      q.activeHours *
        3600 *
        (0.25 * costs.meters.activeCpu.retailPrice + 0.5 * costs.meters.activeMemory.retailPrice) +
      q.requestsMillion * costs.meters.requests.retailPrice
    assert.equal(scenario.knownComponents.ACA_USAGE_COSTS, Number(expected.toFixed(6)))
    assert.equal(
      scenario.knownComponents.LOG_INGESTION_COSTS,
      Number((q.logsGB * costs.meters.logIngestion.retailPrice).toFixed(6)),
    )
    assert.equal(
      scenario.knownComponents.PEERING_COSTS,
      Number(
        (
          scenario.peeringQuantities.totalTransferredGB *
          (costs.meters.intraRegionPeeringIngress.retailPrice +
            costs.meters.intraRegionPeeringEgress.retailPrice)
        ).toFixed(6),
      ),
    )
    assert.equal(
      scenario.knownComponents.PRIVATE_ENDPOINT_COSTS,
      Number(
        (
          q.retainedHours * costs.meters.vaultPrivateEndpoint.retailPrice +
          0.5 *
            (q.privateEndpointGB + scenario.peeringQuantities.g2RegistryTransferGB) *
            (costs.meters.privateEndpointData.retailPrice +
              costs.meters.privateEndpointEgress.retailPrice)
        ).toFixed(6),
      ),
    )
    assert.equal(
      scenario.knownSubtotalCAD,
      Number(
        Object.values(scenario.knownComponents)
          .reduce((a, b) => a + b, 0)
          .toFixed(6),
      ),
    )
  }
})
test('builder example is marked a nonauthoritativeproxy and excluded from all-in totals', () => {
  assert.equal(costs.BUILDER_EPHEMERAL_COSTS.authoritativeCAD, null)
  assert.equal(
    costs.BUILDER_EPHEMERAL_COSTS.nonAuthoritativeProxy.excludedFromAuthoritativeTotals,
    true,
  )
  assert.equal(
    costs.BUILDER_EPHEMERAL_COSTS.nonAuthoritativeProxy.status,
    'SCENARIO_PROXY_ONLY_NOT_QUALIFIED_OR_SELECTED',
  )
})
test('recommendedcomponent ceiling includes rollback,diagnostics and50%buffer but is not approval', () => {
  const recommendation = costs.recommendation
  const expected =
    1.5 *
    (recommendation.proofRunAllowanceKnownCAD +
      recommendation.rollbackAllowanceKnownCAD +
      recommendation.unexpectedDiagnosticLogsAllowanceCAD)
  assert.equal(costs.pricedComponentRecommendationCAD, Number(expected.toFixed(6)))
  assert.equal(recommendation.bufferPercentage, 50)
  assert.equal(costs.HUMAN_APPROVED_EXECUTION_CEILING_CAD, 'UNBOUND')
  assert.equal(costs.humanApprovalImplied, false)
  assert(costs.RECOMMENDED_EXECUTION_CEILING_CAD.startsWith('UNRESOLVED'))
})
test('root blocker taxonomy excludes downstreampackage duplicate and circularquota gate', () => {
  assert.deepEqual(
    normalized.rootBlockers.map((item) => item.id),
    ['ROOT-1', 'ROOT-2', 'ROOT-3', 'ROOT-4'],
  )
  assert.equal(
    normalized.downstream.find((item) => item.id === 'EXECUTABLE_PROOF_PACKAGE').root,
    'ROOT-1',
  )
  assert.equal(
    normalized.downstream.find((item) => item.id === 'EXECUTABLE_PROOF_PACKAGE').state,
    'DOWNSTREAM_OF_FROZEN_AUTHORITY_PACKAGE',
  )
  assert.equal(normalized.readiness.G3R1_GATE, 'PASS')
  assert(normalized.readiness.AZURE_EXECUTION_READINESS.startsWith('BLOCKED'))
})
test('new Azure ledger and retainedoriginalledger record zeromutation', () => {
  const ledger = read('G3R1_AZURE_READ_LEDGER.json')
  assert.equal(ledger.length, 5)
  assert(
    ledger.every(
      (entry) =>
        entry.mutation === false && ['GET', 'ACCOUNT_SHOW_READ_ONLY'].includes(entry.method),
    ),
  )
  assert(read('azure-read-only-ledger.json').every((entry) => entry.mutation === false))
  assert.equal(normalized.zeroMutationEvidence.previousCalls, 71)
  assert.equal(normalized.zeroMutationEvidence.additionalCalls, 5)
})
for (const [name, value] of Object.entries(normalized.proofBoundaries))
  test(`proofboundary remainszero/NO:${name}`, () => {
    assert(value === 0 || value === 'NO')
  })
test('noG3A/G3B execution permission is inferred from localPASS', () => {
  assert.equal(normalized.readiness.G3A, 'NOT_AUTHORIZED')
  assert.equal(normalized.readiness.G3B, 'NOT_AUTHORIZED')
  assert.equal(normalized.readiness.UE_LANE, 'UNTOUCHED')
})
test('two generations have identicalbytes without touching historicalevidence', async () => {
  assert.deepEqual(await generateG3R1(), await generateG3R1())
  verifyPreservation(recovery)
})
test('persisted G3R1 deliverables satisfy --check', async () => {
  await main(['--check'])
})
for (const flag of ['--deploy', '--execute', '--what-if', '--push', '--grant', '--create'])
  test(`localgenerator rejects executionflag:${flag}`, async () => {
    await assert.rejects(main([flag]), /LOCAL_G3R1_FLAGS_ONLY/)
  })
