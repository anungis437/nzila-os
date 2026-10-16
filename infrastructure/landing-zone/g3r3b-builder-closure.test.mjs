import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { evidence, hash, read, source } from './g3r2i-preservation.mjs'
import {
  allowedAzure,
  allowedPrice,
  azureRequests,
  checkReads,
  coreDigest,
  documents,
  g2,
  registry,
  verify,
  vm,
} from './g3r3b-read-evidence.mjs'
import {
  canonical,
  check,
  choose,
  compareBuilders,
  composite,
  conditionalCost,
  criteria,
  digest,
  main,
  outputs,
  priceFacts,
  sourceDelivery,
  storageHeadroom,
  sumTraffic,
  supplement,
  traffic,
  vaultBudget,
} from './g3r3b-builder-closure.mjs'
import { validateDag } from './g3r3-execution-envelope.mjs'

const output = (index) => read(path.join(evidence, outputs[index]))
const comparison = output(0)
const selection = output(1)
const privileges = output(2)
const supplementPacket = output(3)
const costs = output(4)
const plan = output(5)
const readiness = output(7)
const candidateA = comparison.candidates[0]
const candidateB = comparison.candidates[1]
const ledger = read(path.join(evidence, 'G3R3B_READ_LEDGER.json'))

test('frozen G3R3/source/image/candidate/G2/tool evidence remains byte-identical', () => {
  const baseline = verify()
  assert(baseline.evidence.length > 300)
  assert(baseline.tools.some((entry) => entry.name === 'g3r3-execution-envelope.mjs'))
  assert.equal(baseline.coreDigest, coreDigest)
  assert.equal(readiness.ROOT_1_REOPENED, 'NO')
  assert.equal(readiness.G3R2I_IMAGE_QUALIFICATION, 'PRESERVED')
  assert.equal(readiness.G3_SYNTHETIC_PROOF_V1, 'QUALIFIED_LOCAL_NOT_PUSHED')
})
test('frozen core semantic digest and file digest are distinct verified linkages', () => {
  const core = read(path.join(evidence, 'G3R3_G2_MUTATION_PACKET.json'))
  delete core.digestMethod
  delete core.approval.G2_MUTATION_PACKET_DIGEST
  assert.equal(hash(JSON.stringify(core)), coreDigest)
  assert.equal(supplementPacket.PARENT_G2_PACKET_SHA256, coreDigest)
  assert.equal(
    supplementPacket.PARENT_G2_FILE_SHA256,
    hash(readFileSync(path.join(evidence, 'G3R3_G2_MUTATION_PACKET.json'))),
  )
  assert.equal(
    privileges.PARENT_OPERATOR_PACKET_DIGEST,
    hash(readFileSync(path.join(evidence, 'G3R3_OPERATOR_PRIVILEGE_PACKET.json'))),
  )
})
test('exactly two authorized candidates;retired new B2s design is not deleted/reselected', () => {
  assert.deepEqual(comparison.candidateUniverse, [
    'EXISTING_G2_BUILDER_VM',
    'ACR_DEDICATED_AGENT_POOL_S1',
  ])
  assert.equal(comparison.candidates.length, 2)
  assert.equal(comparison.EPHEMERAL_B2S_OFFLINE_OCI_RECEIVER, 'SUPERSEDED_AS_DEFAULT_NOT_SELECTED')
  assert.equal(selection.SELECTED_PRIVATE_BUILD_MODEL, 'NONE')
  assert.equal(selection.newArchitectureAuthorized, false)
})
test('A binds actual existing VM,NIC,subnet,disk and agent without a new VM', () => {
  assert.equal(candidateA.resource.id, vm)
  assert.equal(candidateA.resource.newVM, false)
  assert.equal(candidateA.resource.disk.sku, 'StandardSSD_LRS')
  assert.equal(candidateA.resource.disk.sizeGiB, 32)
  assert(candidateA.resource.nic.endsWith('/networkInterfaces/nzila-g2-builder-nic-y3koaeijzi6mu'))
  assert(candidateA.resource.subnet.endsWith('/subnets/BuilderSubnet'))
  assert(
    candidateA.resource.agent.vmAgent.statuses.some((entry) => entry.displayStatus === 'Ready'),
  )
})
for (const name of [
  'VM_EXISTS',
  'VM_AGENT_READY',
  'EXPECTED_VM_RESOURCE_ID',
  'EXPECTED_NETWORK_INTERFACE',
  'EXPECTED_SUBNET',
  'PRIVATE_ACR_DNS_RESOLVES',
  'PRIVATE_ACR_TCP_443_REACHABLE',
  'CONTAINER_ENGINE_PRESENT',
  'SUFFICIENT_TEMP_DISK',
  'NO_ACTIVE_CONFLICTING_BUILD',
])
  test(`A preflight denies before build without installation:${name}`, () => {
    const preflight = candidateA.preflight.find((entry) => entry.check === name)
    assert(preflight)
    assert(preflight.onFailure.includes('DENY_BEFORE_BUILD_OR_PUSH'))
    assert(preflight.onFailure.includes('NO_TOOL_INSTALLATION'))
    if (
      ['CONTAINER_ENGINE_PRESENT', 'SUFFICIENT_TEMP_DISK', 'NO_ACTIVE_CONFLICTING_BUILD'].includes(
        name,
      )
    )
      assert.equal(preflight.state, 'RUNTIME_PREFLIGHT_REQUIRED')
  })
test('unknown A guest tooling is runtime fail-closed,not the material authorization blocker', () => {
  assert(candidateA.requiredTooling.policy.includes('=> DENY'))
  assert(candidateA.requiredTooling.policy.includes('no package manager'))
  assert(candidateA.requiredTooling.selfContained.includes('not itself an authorization blocker'))
  assert.equal(candidateA.criteria.SOURCE_DELIVERY.status, 'PASS')
  assert.equal(candidateA.criteria.PRIVATE_ACR_REACHABILITY.status, 'PASS')
})
test('A source payload count,bytes,base64,request shape and expected on-VM digest are measured', () => {
  const delivery = sourceDelivery()
  assert.equal(delivery.SOURCE_FILE_COUNT, 6)
  assert.equal(delivery.BUILD_CONTEXT_FILE_COUNT, 5)
  let bytes = 0
  let encoded = 0
  for (const entry of delivery.perFile) {
    const content = readFileSync(path.join(source, 'workload', 'synthetic-proof', entry.path))
    assert.equal(content.length, entry.bytes)
    assert.equal(hash(content), entry.sha256)
    const base64 = content.toString('base64')
    assert.deepEqual(Buffer.from(base64, 'base64'), content)
    bytes += content.length
    encoded += Buffer.byteLength(base64)
  }
  assert.equal(delivery.SOURCE_TOTAL_BYTES, bytes)
  assert.equal(delivery.ENCODED_PAYLOAD_BYTES, encoded)
  assert(delivery.INLINE_SCRIPT_BYTES > encoded)
  assert(delivery.REPRESENTATIVE_REQUEST_BYTES > delivery.INLINE_SCRIPT_BYTES)
  assert(delivery.REPRESENTATIVE_REQUEST_BYTES < 4 * 1024 * 1024)
  assert.equal(delivery.SOURCE_TREE_SHA256, delivery.EXPECTED_ON_VM_SOURCE_SHA256)
  assert.equal(
    delivery.SOURCE_TREE_SHA256,
    read(path.join(evidence, 'G3R2I_IMAGE_QUALIFICATION.json')).SOURCE_DIGESTS.SOURCE_TREE_SHA256,
  )
  assert(
    delivery.sizeInterpretation.includes('not advertised as a Compute inline-script guarantee'),
  )
})
test('A protected short-lived credential contract never acquires/sends token or uses registry admin', () => {
  assert.equal(candidateA.credentialModel.credentialAcquiredOrSent, false)
  assert(candidateA.credentialModel.delivery.includes('protectedParameters'))
  assert(candidateA.credentialModel.use.includes('password-stdin'))
  assert(candidateA.credentialModel.use.includes('no set-x/debug'))
  assert(candidateA.credentialModel.validity.includes('3h'))
  assert.equal(privileges.repository.REGISTRY_WIDE_ADMIN, 'NO')
  assert(privileges.repository.writer.CONDITION.expression.includes('g3-synthetic-runtime'))
})
test('A standing identity exposure is recorded rather than hidden behind intended token', () => {
  assert(
    candidateA.standingGuestIdentityAssignments.some((entry) =>
      entry.condition.includes('synthetic-health'),
    ),
  )
  assert(
    candidateA.standingGuestIdentityAssignments.some((entry) =>
      entry.condition.includes('g2-tooling'),
    ),
  )
  assert.equal(candidateA.criteria.LEAST_PRIVILEGE.status, 'BLOCKED_EXACT_FACT')
  assert.equal(candidateA.noStandingGrantRevoked, true)
})
test('A cleanup is owned-only and cannot deallocate/delete shared G2 VM resources', () => {
  assert.equal(candidateA.cleanup.enforced, false)
  assert(candidateA.cleanup.existingVMDeallocation.startsWith('PROHIBITED'))
  assert.equal(candidateA.cleanup.newVMWatchdogRequired, false)
  assert(candidateA.cleanup.exactGap.includes('daemon-side'))
  assert(candidateA.cleanup.desired.includes('retain G2 VM/NIC/disk/UAMI'))
  assert.equal(candidateA.costs.G3_INCREMENTAL_COMPUTE_COST_CAD, 0)
})
for (const candidate of comparison.candidates)
  test(`finite base-pull hosts and no generic egress:${candidate.model}`, () => {
    const pull =
      candidate.model === 'EXISTING_G2_BUILDER_VM' ? candidate.basePull : candidate.network.basePull
    assert.equal(pull.FQDNS.length, 4)
    assert.deepEqual(pull.PORTS, [443])
    assert(pull.FQDNS.every((host) => !host.includes('*')))
    assert(pull.immutableImage.includes('@sha256:'))
    assert(pull.rollback.includes('deny any unlisted redirect'))
  })
test('B current CanadaCentral/Premium/VNet/local source/private ACR service support is captured', () => {
  for (const key of [
    'CANADA_CENTRAL_SUPPORTED',
    'PREMIUM_ACR_REQUIRED',
    'CURRENT_G2_ACR_TIER_COMPATIBLE',
    'VNET_AGENT_POOL_SUPPORTED',
    'LOCAL_SOURCE_CONTEXT_SUPPORTED',
    'PRIVATE_ACR_BUILD_PATH_SUPPORTED',
  ])
    assert.equal(candidateB.support[key], true)
  assert.equal(candidateB.FEATURE_STATUS, 'PREVIEW')
  assert.equal(candidateB.USE_SCOPE, 'ONE_SYNTHETIC_G3_PROOF')
  assert.equal(candidateB.PRODUCTION_RUNTIME_DEPENDENCY, 'NO')
  assert.equal(candidateB.LONG_TERM_PRODUCTION_DEPENDENCY, 'NO')
  assert.equal(
    candidateB.pool.subnet,
    read(path.join(evidence, 'G3R1_NETWORK_CONTRACT.json')).vnetId + '/subnets/G3BuilderSubnet',
  )
  assert.equal(candidateB.pool.location, 'canadacentral')
  assert.equal(candidateB.pool.tier, 'S1')
  assert.equal(candidateB.pool.cpus, 2)
})
test('B exact quick-build OpenAPI timeout binds min/max;timeout does not cap allocated pool', () => {
  const e = ledger.findLast(
    (entry) => entry.name === 'doc-task-openapi' && entry.status === 'SUCCEEDED',
  )
  const api = read(path.join(evidence, e.responseFile))
  assert.equal(
    candidateB.TASK_API_MINIMUM,
    api.definitions.DockerBuildRequest.properties.timeout.minimum,
  )
  assert.equal(
    candidateB.TASK_API_MAXIMUM,
    api.definitions.DockerBuildRequest.properties.timeout.maximum,
  )
  assert(
    candidateB.BUILD_TIMEOUT_SECONDS >= candidateB.TASK_API_MINIMUM &&
      candidateB.BUILD_TIMEOUT_SECONDS <= candidateB.TASK_API_MAXIMUM,
  )
  assert.equal(candidateB.FAIL_CLOSED_ON_TIMEOUT, 'YES')
  assert(candidateB.timeoutRationale.includes('not a measured remote SLA'))
  assert(
    !Object.keys(api.definitions.AgentPoolProperties.properties).some((key) =>
      /ttl|expiry|timeout/i.test(key),
    ),
  )
  assert.equal(candidateB.cleanup.BUILDER_B_CLEANUP_ENFORCEMENT, 'UNBOUND')
  assert.equal(candidateB.pool.AGENT_POOL_COUNT_BEFORE, 0)
  assert.equal(candidateB.pool.AGENT_POOL_COUNT_DURING, 1)
  assert.equal(candidateB.pool.AGENT_POOL_COUNT_AFTER, 0)
})
test('B local context/caller/source upload contract does not require courier VM or public Git', () => {
  assert(candidateB.sourceDelivery.model.includes('--agent-pool'))
  assert(candidateB.sourceDelivery.model.includes('--source-acr-auth-id [caller]'))
  assert(candidateB.sourceDelivery.model.includes('--timeout1800'))
  assert(candidateB.sourceDelivery.dynamicUriGate.includes('before uploading'))
  assert.equal(candidateB.credentialModel.noLongLivedCredential, true)
  assert.equal(candidateB.credentialModel.noNewIdentity, true)
})
test('B documented service dependency ports include AzureMonitor12000,no broad catchall', () => {
  assert.deepEqual(
    candidateB.network.dependencies.map((entry) => entry.destination),
    ['AzureKeyVault', 'Storage', 'EventHub', 'AzureActiveDirectory', 'AzureMonitor'],
  )
  assert.deepEqual(candidateB.network.dependencies.at(-1).ports, [443, 12000])
  assert(candidateB.network.delta.includes('core collections are ACA-only'))
  assert(candidateB.network.privateAcr.includes('no public access'))
})
for (const candidate of comparison.candidates)
  for (const criterion of criteria)
    test(`scored criterion is explicit:${candidate.model}:${criterion}`, () => {
      assert(['PASS', 'FAIL', 'BLOCKED_EXACT_FACT'].includes(candidate.criteria[criterion].status))
      assert(candidate.criteria[criterion].fact)
    })
test('selection rejects incomplete criteria,third model and unmeasured both-pass preferences', () => {
  const missing = structuredClone(comparison)
  delete missing.candidates[0].criteria.CLEANUP_ENFORCEMENT
  assert.throws(() => choose(missing))
  const third = structuredClone(comparison)
  third.candidateUniverse.push('NEW_VM')
  assert.throws(() => choose(third))
  const twoPass = structuredClone(comparison)
  for (const c of twoPass.candidates)
    for (const entry of Object.values(c.criteria)) entry.status = 'PASS'
  assert.throws(() => choose(twoPass), /UNBOUND_PREFERENCE/)
})
function bothPass() {
  const x = structuredClone(comparison)
  for (const c of x.candidates) {
    for (const entry of Object.values(c.criteria)) entry.status = 'PASS'
    c.preferenceMetrics = {
      g2MutationSurface: 1,
      cleanupStrength: 1,
      operatorPrivilegeBreadth: 6,
      boundedIncrementalCostCAD: 1,
      preview: c.model === 'ACR_DEDICATED_AGENT_POOL_S1',
    }
  }
  return x
}
for (const [name, key, av, bv, expected] of [
  ['mutation', 'g2MutationSurface', 2, 1, 'ACR_DEDICATED_AGENT_POOL_S1'],
  ['cleanup', 'cleanupStrength', 2, 1, 'EXISTING_G2_BUILDER_VM'],
  ['privilege', 'operatorPrivilegeBreadth', 7, 6, 'ACR_DEDICATED_AGENT_POOL_S1'],
  ['cost', 'boundedIncrementalCostCAD', 1, 2, 'EXISTING_G2_BUILDER_VM'],
  ['preview', 'preview', false, true, 'EXISTING_G2_BUILDER_VM'],
])
  test(`both-pass preference applies ordered criterion:${name}`, () => {
    const x = bothPass()
    x.candidates[0].preferenceMetrics[key] = av
    x.candidates[1].preferenceMetrics[key] = bv
    assert.equal(choose(x).SELECTED_PRIVATE_BUILD_MODEL, expected)
  })
test('mutation surface preference outranks no-preview and cost', () => {
  const x = bothPass()
  x.candidates[1].preferenceMetrics.g2MutationSurface = 0
  x.candidates[1].preferenceMetrics.boundedIncrementalCostCAD = 100
  assert.equal(choose(x).SELECTED_PRIVATE_BUILD_MODEL, 'ACR_DEDICATED_AGENT_POOL_S1')
})
test('applicable Standard Global vault CAD meter binds non-primary/regional rows,not Premium proxy', () => {
  const price = priceFacts().vault
  assert.equal(price.status, 'BOUND')
  assert.equal(price.meter.skuName, 'Standard')
  assert.equal(price.meter.meterName, 'Operations')
  assert.equal(price.meter.armRegionName, 'Global')
  assert.equal(price.meter.currencyCode, 'CAD')
  assert.equal(price.meter.isPrimaryMeterRegion, false)
  assert.equal(price.meter.retailPrice, 0.042497)
  assert.equal(price.meter.meterId, '0f824807-2376-435c-95c9-f992b67a07b0')
})
test('vault plan arithmetic bounds100 authenticated calls and zero purges/HMAC transactions', () => {
  const budget = vaultBudget(priceFacts().vault.meter)
  assert.equal(budget.MAX_SECRET_CREATES, 1)
  assert.equal(budget.MAX_SECRET_GETS, 40)
  assert.equal(budget.MAX_SECRET_LISTS, 10)
  assert.equal(budget.MAX_SECRET_DELETES, 1)
  assert.equal(budget.MAX_SECRET_PURGES_IF_USED, 0)
  assert.equal(budget.MAX_AUTHENTICATED_REST_CALLS, 100)
  assert.equal(budget.MAX_SECRET_TRANSACTION_COST_CAD, 0.00042497)
  assert(budget.planDerivation.includes('shared100-call counter'))
  assert(budget.hmacRequests.includes('No per-HMAC'))
  assert.throws(() => vaultBudget({ ...priceFacts().vault.meter, unitOfMeasure: '1 Hour' }))
})
test('actual E4 SSD transaction meter and two-hour-window conservative scenario are bound', () => {
  const prices = priceFacts()
  assert.equal(prices.disk.actualSku, 'StandardSSD_LRS')
  assert.equal(prices.disk.meter.meterId, 'df249cf3-71c9-5327-8738-56f65fa3fcda')
  assert.equal(prices.disk.meter.retailPrice, 0.0034)
  assert.equal(prices.disk.hourlyPaidTransactionCap, 43400)
  const row = conditionalCost('EXISTING_G2_BUILDER_VM', prices).lines.find(
    (line) => line.id === 'EXISTING_E4_DISK_TRANSACTIONS',
  )
  assert.equal(row.quantity, 86800)
  assert.equal(row.divisor, 10000)
  assert(Math.abs(row.conditionalMaximumCAD - 0.029512) < 1e-12)
})
test('dedicated allocation tariff cannot use task-vCPU duration or free-tier proxy', () => {
  assert.equal(costs.priceFacts.agentPool.allocationMeter, null)
  assert.equal(costs.priceFacts.agentPool.status, 'BLOCKED_EXACT_FACT')
  assert(
    costs.priceFacts.agentPool.catalogs.every(
      (catalog) => catalog.matches.length === 0 && catalog.itemCount > 0,
    ),
  )
  assert(/Neither.+silently substituted/.test(costs.priceFacts.agentPool.rejectedProxy))
})
test('ACR exact byte reservation headroom allows zero incremental storage,not missing-price fallback', () => {
  assert.equal(costs.acrStorage.CURRENT_BYTES_USED, 4681097)
  assert.equal(costs.acrStorage.INCLUDED_STORAGE_BYTES, 536870912000)
  assert.equal(costs.acrStorage.G3_RESERVED_IMAGE_BYTES, Math.ceil(0.2 * 1024 ** 3))
  assert.equal(costs.acrStorage.INCREMENTAL_STORAGE_COST_CAD, 0)
  assert(costs.acrStorage.prePushGate.includes('Fresh usage GET'))
  assert.throws(() => storageHeadroom(11, 10, 1), /ACR_RESERVATION_EXCEEDS/)
  for (const value of [-1, NaN, 0.1, Infinity]) assert.throws(() => storageHeadroom(value, 10, 1))
})
test('logging quota is explicitly soft;finite contingency cannot create hard maximum', () => {
  assert.equal(costs.logging.MAX_LOG_INGESTION_GB, 0.25)
  assert.equal(costs.logging.MAX_LOG_COST_CAD_CONDITIONAL, costs.logging.PRICE_PER_GB * 0.25)
  assert.equal(costs.logging.contingencyCoversAllPossibleOverrun, false)
  assert(costs.logging.ENFORCEMENT.includes('NO_HARD_CAP'))
})
for (const model of comparison.candidateUniverse)
  test(`traffic surfaces count each path once and distinguish inbound/public/private:${model}`, () => {
    const paths = traffic(model)
    const totals = sumTraffic(paths)
    const push = paths.find((row) => row.id === 'FINAL_IMAGE_PUSH')
    assert.equal(push.peeringGB, model === 'EXISTING_G2_BUILDER_VM' ? 0 : 0.2)
    assert.equal(paths.find((row) => row.id === 'PINNED_PUBLIC_BASE').azurePublicOutboundGB, 0.01)
    assert(Math.abs(totals.privateEndpointGB - 0.62) < 1e-12)
    assert.equal(totals.azurePublicOutboundGB, 0.26)
    assert.equal(totals.peeringGB, model === 'EXISTING_G2_BUILDER_VM' ? 0.4 : 0.6000000000000001)
    assert.throws(() => sumTraffic([...paths, paths[0]]), /DUPLICATED_TRAFFIC_PATH/)
    const bad = structuredClone(paths)
    bad.find((row) => row.id === 'FINAL_IMAGE_PUSH').firewallGB = 0.1
    assert.throws(() => sumTraffic(bad), /PRIVATE_PATH_MISCHARGED/)
    bad[0].azurePublicOutboundGB = 10
    assert.throws(() => sumTraffic(bad), /INVALID_TRAFFIC_SURFACE/)
  })
for (const scenario of costs.candidateConditionalReconstruction)
  test(`conditional cost reconstruction uses exact unit rates,not parent subtotal:${scenario.model}`, () => {
    assert.equal(scenario.parentSubtotalReused, false)
    assert.equal(scenario.allIn, false)
    assert.equal(scenario.hardBound, false)
    assert.equal(scenario.selectedBuilderMaximumCAD, null)
    assert.equal(new Set(scenario.lines.map((row) => row.id)).size, scenario.lines.length)
    assert.equal(
      scenario.conditionalSubtotalCAD,
      scenario.lines.reduce(
        (sum, row) => sum + (row.quantity / row.divisor) * row.meter.retailPrice,
        0,
      ),
    )
    assert(!scenario.lines.some((row) => /VM.*CANDIDATE|DISK.*MOUNT|ACR_BASE/.test(row.id)))
    for (const row of scenario.lines) {
      assert.equal(
        row.meter.sourceSha256,
        hash(readFileSync(path.join(evidence, row.meter.sourceFile))),
      )
      const snapshot = read(path.join(evidence, row.meter.sourceFile))
      const items = snapshot.items ?? snapshot.Items
      assert(
        items.some(
          (item) =>
            item.meterId === row.meter.meterId && item.retailPrice === row.meter.retailPrice,
        ),
        row.id,
      )
      assert.equal(row.conditionalMaximumCAD, (row.quantity / row.divisor) * row.meter.retailPrice)
    }
    const ingress = scenario.lines.find((row) => row.id === 'ACR_PE_INGRESS')
    const egress = scenario.lines.find((row) => row.id === 'ACR_PE_EGRESS')
    assert.equal(ingress.quantity + egress.quantity, 0.6)
  })
test('unsupported ceiling and all-in amounts remain explicit null without selected builder', () => {
  for (const key of [
    'SELECTED_BUILDER_MAX_COST_CAD',
    'EXPECTED_PROOF_RUN_COST_CAD',
    'BOUNDED_MAX_PROOF_RUN_COST_CAD',
    'ROLLBACK_ALLOWANCE_CAD',
    'DIAGNOSTIC_CONTINGENCY_CAD',
    'UNCERTAINTY_BUFFER_CAD',
  ])
    assert.equal(costs[key], null)
  assert.equal(costs.RECOMMENDED_EXECUTION_CEILING_CAD, 'UNSUPPORTED')
  assert.equal(costs.HUMAN_APPROVED_EXECUTION_CEILING_CAD, 'UNBOUND')
  assert.equal(costs.numericCeilingRule.filter((entry) => entry.status === 'BOUND').length, 2)
})
test('real catalog action names correct singular managed-write typo,no extra broad lifecycle grants', () => {
  const a = privileges.candidateRequirements.EXISTING_G2_BUILDER_VM
  assert(
    a.some(
      (entry) =>
        entry.AZURE_ACTION === 'Microsoft.Compute/virtualMachines/runCommands/write' &&
        entry.EXACT_SCOPE === vm,
    ),
  )
  assert(!a.some((entry) => entry.AZURE_ACTION === 'Microsoft.Compute/virtualMachines/write'))
  assert.equal(privileges.documentedSingularAction.status, 'NOT_IN_CURRENT_PROVIDER_CATALOG')
  assert.deepEqual(privileges.ADDITIONAL_ACTIONS, [])
  assert.deepEqual(privileges.ADDITIONAL_SCOPES, [])
  assert.equal(privileges.SELECTED_BUILDER, 'NONE')
  for (const row of Object.values(privileges.candidateRequirements).flat()) {
    assert.equal(row.STATUS, 'PROPOSED_NOT_GRANTED')
    assert(!row.AZURE_ACTION.includes('*'))
    assert(
      row.EXACT_SCOPE === vm ||
        row.EXACT_SCOPE === registry ||
        row.EXACT_SCOPE === candidateA.resource.nic ||
        row.EXACT_SCOPE.startsWith(g2 + '/providers/Microsoft.Compute/disks/'),
    )
  }
})
test('supplement0 means not selected,not no candidate G2 changes;composite cannot approve unknown adjuncts', () => {
  assert.equal(supplementPacket.STATUS, 'PROPOSED_NOT_AUTHORIZED')
  assert.equal(privileges.STATUS, 'PROPOSED_NOT_GRANTED')
  assert.equal(supplementPacket.SUPPLEMENT_CHANGE_COUNT, 0)
  assert.equal(supplementPacket.SELECTED_BUILDER, 'NONE')
  assert.equal(supplementPacket.candidateDeltasNotAuthorized.length, 2)
  assert(supplementPacket.absenceMeaning.includes('NOT a claim'))
  assert.equal(supplementPacket.composite.TOTAL_CHANGE_COUNT, 7)
  assert(supplementPacket.composite.STATUS.includes('NOT_COMPLETE_OR_APPROVABLE'))
  assert.throws(
    () => supplement({ SELECTED_PRIVATE_BUILD_MODEL: 'EXISTING_G2_BUILDER_VM' }),
    /REQUIRES_EXACT_SUPPLEMENT/,
  )
})
test('canonical supplemental/composite digests reject field drift and bind frozen core,not overwrite', () => {
  const { SUPPLEMENT_DIGEST, composite: manifest, ...unsigned } = supplementPacket
  assert.equal(digest(unsigned), SUPPLEMENT_DIGEST)
  assert.notEqual(digest({ ...unsigned, SUPPLEMENT_CHANGE_COUNT: 1 }), SUPPLEMENT_DIGEST)
  const { COMPOSITE_AUTHORIZATION_DIGEST, ...unsignedManifest } = manifest
  assert.equal(digest(unsignedManifest), COMPOSITE_AUTHORIZATION_DIGEST)
  assert.notEqual(
    digest({ ...unsignedManifest, SUPPLEMENT_DIGEST: '0'.repeat(64) }),
    COMPOSITE_AUTHORIZATION_DIGEST,
  )
  assert.equal(canonical({ z: 2, a: 1 }), canonical({ a: 1, z: 2 }))
  assert.throws(() => canonical({ bad: undefined }), /UNDEFINED_PACKET_FIELD/)
  assert.deepEqual(composite(supplement(selection)), manifest)
})
test('parent17-step DAG retains cycles0,quota250 and build->registry digest->activation', () => {
  assert.equal(plan.NEW_STEP_COUNT, 17)
  assert.equal(plan.CYCLES, 0)
  assert.equal(
    plan.PARENT_EXECUTION_PLAN_DIGEST,
    hash(readFileSync(path.join(evidence, 'G3R3_EXECUTION_PLAN.json'))),
  )
  assert.deepEqual(plan.steps, read(path.join(evidence, 'G3R3_EXECUTION_PLAN.json')).steps)
  validateDag(plan.steps)
  assert.deepEqual(plan.postEnvironmentQuotaGate, [
    'ENVIRONMENT_CREATE',
    'QUERY_MANAGED_ENVIRONMENT_CONSUMPTION_CORE_QUOTA',
    'VERIFY_AVAILABLE_MILLICORES>=250',
    'WORKLOAD_ACTIVATION',
  ])
  assert.equal(plan.imageAuthority.MUTABLE_TAG_AUTHORITY, 'PROHIBITED')
  assert.equal(plan.imageAuthority.buildMustPrecedeActivation, true)
  assert.equal(plan.imageAuthority.localConfigDigestIsRegistryAuthority, false)
  assert.equal(plan.authorization, 'NOT_AUTHORIZED')
  const cycle = structuredClone(plan.steps)
  cycle[0].dependsOn = [cycle.at(-1).id]
  assert.throws(() => validateDag(cycle))
})
test('only three human slots reserved;final packet withheld while BLOCKED,parent untouched', () => {
  assert.deepEqual(Object.keys(readiness.normalizedHumanSlots), ['A', 'B', 'C'])
  assert.equal(readiness.normalizedHumanSlots.A.LIFECYCLE_OWNER, 'UNBOUND')
  assert.equal(readiness.normalizedHumanSlots.A.EXECUTION_OPERATOR, 'RECOMMENDED_NOT_APPOINTED')
  assert.equal(readiness.normalizedHumanSlots.A.HUMAN_APPROVER, 'UNBOUND')
  assert.equal(readiness.normalizedHumanSlots.B.CORE_PACKET_DIGEST, coreDigest)
  assert.equal(readiness.normalizedHumanSlots.B.HUMAN_APPROVAL, 'UNBOUND')
  assert.equal(readiness.normalizedHumanSlots.C.RECOMMENDED_EXECUTION_CEILING_CAD, 'UNSUPPORTED')
  const notice = readFileSync(path.join(evidence, outputs[6]), 'utf8')
  assert(notice.includes('NOT ISSUED'))
  assert.equal([...notice.matchAll(/^## [ABC] -/gm)].length, 3)
  assert(!notice.includes('## D -'))
  assert.equal(readiness.FINAL_HUMAN_PACKET, 'NOT_ISSUED;G3R3B_PASS_REQUIRED_BEFORE_PRESENTATION')
})
test('blocked gate and execution states preserve nonapproval and zero mutation boundaries', () => {
  assert.equal(readiness.G3R3B_GATE, 'BLOCKED')
  assert.equal(readiness.G3_EXECUTION_READINESS, 'BLOCKED')
  assert.equal(readiness.G3A, 'NOT_AUTHORIZED_PENDING_HUMAN_DECISIONS')
  assert.equal(readiness.G3B, 'NOT_AUTHORIZED')
  assert(Object.values(readiness.boundaries).every((value) => value === 0))
  assert(Object.values(readiness.executionBoundaries).every((value) => value === 'NO'))
})
test('ledger binds successful and failed reads,exact GET allowlist and public snapshot hashes', () => {
  checkReads()
  assert.equal(ledger.length, readiness.readOnlyEvidence.calls)
  assert.equal(ledger.filter((entry) => entry.status === 'FAILED').length, 3)
  for (const entry of ledger) {
    assert.equal(entry.mutation, false)
    assert(['GET', 'ACCOUNT_SHOW_READ_ONLY'].includes(entry.method))
    if (entry.responseSha256)
      assert.equal(
        hash(readFileSync(path.join(evidence, entry.responseFile))),
        entry.responseSha256,
      )
    if (entry.stderrSha256)
      assert.equal(hash(readFileSync(path.join(evidence, entry.stderrFile))), entry.stderrSha256)
  }
  for (const [, url] of azureRequests) assert(allowedAzure(url))
  for (const [, url] of documents) assert(!allowedAzure(url))
})
for (const url of [
  'https://management.azure.com/subscriptions/other/providers/Microsoft.Compute/operations?api-version=2024-07-01',
  `https://management.azure.com${vm}/runCommands/new?api-version=2024-07-01`,
  `https://management.azure.com${registry}/scheduleRun?api-version=2025-03-01-preview`,
  `https://management.azure.com${vm}?api-version=2024-07-01&unknown=1`,
  `https://attacker.invalid${vm}?api-version=2024-07-01`,
])
  test(`read allowlist rejects execution or foreign URL:${url}`, () =>
    assert.equal(allowedAzure(url), false))
for (const change of [
  ['currencyCode', "'USD'"],
  ['api-version', 'unknown'],
  ['$filter', "serviceName eq 'Other'"],
  ['$skip', '-1'],
  ['unknown', '1'],
  ['currencyCode', 'CAD'],
])
  test(`price allowlist rejects unapproved query:${change.join('=')}`, () => {
    const url = new URL(ledger.find((entry) => entry.kind === 'PRICE').url)
    url.searchParams.set(...change)
    assert.equal(allowedPrice(url.href), false)
  })
test('price allowlist validates every retained page and denies another origin', () => {
  for (const entry of ledger.filter((entry) => entry.kind === 'PRICE'))
    assert(allowedPrice(entry.url))
  const url = new URL(ledger.find((entry) => entry.kind === 'PRICE').url)
  url.hostname = 'attacker.invalid'
  assert.equal(allowedPrice(url.href), false)
})
test('comparison/selection/cost/supplement pure outputs repeat deterministically', () => {
  assert.deepEqual(compareBuilders(), comparison)
  assert.deepEqual(choose(compareBuilders()), selection)
  assert.deepEqual(compareBuilders(), compareBuilders())
  check()
})
for (const flag of [
  '--deploy',
  '--grant',
  '--run-command',
  '--agent-pool',
  '--build',
  '--push',
  '--approve',
  '--execute',
  '--appoint',
])
  test(`writer refuses execution flag:${flag}`, async () =>
    assert.rejects(main([flag]), /LOCAL_PACKET_ONLY/))
