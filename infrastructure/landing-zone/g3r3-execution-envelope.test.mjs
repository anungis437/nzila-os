import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { evidence, hash, read, root, source } from './g3r2i-preservation.mjs'
import { allowedUrl, verifyPreservation } from './g3r3-read-census.mjs'
import {
  builderModel,
  check,
  costEnvelope,
  covered,
  main,
  matches,
  mutationPacket,
  privilegePacket,
  validateDag,
} from './g3r3-execution-envelope.mjs'

const operator = read(path.join(evidence, 'G3R3_OPERATOR_PRIVILEGE_PACKET.json'))
const g2 = read(path.join(evidence, 'G3R3_G2_MUTATION_PACKET.json'))
const costs = read(path.join(evidence, 'G3R3_EXECUTION_COST_ENVELOPE.json'))
const plan = read(path.join(evidence, 'G3R3_EXECUTION_PLAN.json'))
const readiness = read(path.join(evidence, 'G3R3_EXECUTION_READINESS.json'))
const sub = '/subscriptions/5d819f33-d16f-429c-a3c0-5b0e94740ba3'
const principal = 'bfa4a851-696a-4d3f-927b-5fb1526f79f2'

test('all accepted evidence/source/candidate/G2 bytes remain frozen and ROOT-1 remains closed', () => {
  const baseline = verifyPreservation()
  assert.equal(baseline.ROOT_1_REOPENED, 'NO')
  assert.equal(readiness.ROOT_1_REOPENED, 'NO')
  assert.equal(readiness.ROOT_1, 'CLOSED_BY_PROSPECTIVE_SUPERSESSION')
  assert.deepEqual(
    readiness.remainingRoots.map((id) => id.slice(0, 6)),
    ['ROOT-2', 'ROOT-3', 'ROOT-4'],
  )
})
test('recommended operator is active captured SP with exact build federation,not appointed', () => {
  assert.equal(operator.servicePrincipal.id, principal)
  assert.equal(operator.servicePrincipal.accountEnabled, true)
  assert.equal(operator.servicePrincipal.appId, operator.application.appId)
  assert.equal(operator.application.id, '3594a951-fcff-4877-a52f-043ed52a9eb0')
  assert(
    operator.federation.some(
      (entry) =>
        entry.issuer === 'https://token.actions.githubusercontent.com' &&
        entry.subject === 'repo:anungis437/nzila-os:environment:build' &&
        entry.audiences.includes('api://AzureADTokenExchange'),
    ),
  )
  assert.equal(operator.recommendationIsAppointment, false)
  assert.equal(operator.humanRoles.G3_EXECUTION_OPERATOR, 'RECOMMENDED_CANDIDATE_NOT_APPOINTED')
  assert.equal(operator.humanRoles.G3_HUMAN_APPROVER, 'HUMAN_BINDING_REQUIRED')
  assert.equal(operator.humanRoles.G3_LIFECYCLE_OWNER, 'HUMAN_BINDING_REQUIRED')
  assert.equal(operator.humanRoles.requirement, 'G3_EXECUTION_OPERATOR != G3_HUMAN_APPROVER')
})
test('fresh direct/inherited/group/condition/deny evidence does not invent effective grants', () => {
  assert.equal(operator.currentDirectAndVisibleInheritedAssignments.length, 1)
  assert.deepEqual(operator.transitiveGroups, [])
  assert.deepEqual(operator.scopeVerification.inheritedCandidateAssignments, [])
  assert.deepEqual(operator.scopeVerification.visibleDenyAssignments, [])
  assert.deepEqual(operator.ALREADY_SUFFICIENT, [])
  assert.equal(operator.EXCESS_EXISTING_PRIVILEGES.length, 1)
  assert(operator.EXCESS_EXISTING_PRIVILEGES[0].scope.endsWith('/registries/nzilacanadaacr'))
  assert(operator.MISSING_PRIVILEGES.length > 0)
})
for (const operation of operator.requiredOperations)
  test(`required operation fields:${operation.OPERATION_ID}`, () => {
    for (const key of [
      'OPERATION_ID',
      'AZURE_ACTION',
      'TARGET_RESOURCE_TYPE',
      'TARGET_SCOPE',
      'REQUIRED_ROLE_OR_CUSTOM_PERMISSION',
      'PRINCIPAL_CLASS',
      'TEMPORARY_OR_PERSISTENT',
      'RATIONALE',
    ])
      assert(operation[key])
    assert(operation.TARGET_SCOPE.startsWith(sub))
    assert(!operation.AZURE_ACTION.includes('*'))
    assert(!/listKeys|listCredentials|quota.*write/i.test(operation.AZURE_ACTION))
  })
test('privilege matcher enforces wildcard exclusions,planes,scope boundary and unknown conditions', () => {
  const definitions = [
    {
      id: `${sub}/providers/Microsoft.Authorization/roleDefinitions/example`,
      properties: {
        permissions: [
          {
            actions: ['Microsoft.Network/*'],
            notActions: ['Microsoft.Network/virtualNetworks/delete'],
            dataActions: ['repo/read'],
            notDataActions: [],
          },
        ],
      },
    },
  ]
  const assignment = {
    properties: {
      scope: `${sub}/resourceGroups/g3`,
      roleDefinitionId: definitions[0].id,
      condition: null,
    },
  }
  const operation = {
    TARGET_SCOPE: `${sub}/resourceGroups/g3/providers/Microsoft.Network/virtualNetworks/test`,
    AZURE_ACTION: 'Microsoft.Network/virtualNetworks/write',
    plane: 'CONTROL',
  }
  assert.equal(covered(operation, assignment, definitions), true)
  assert.equal(
    covered(
      { ...operation, AZURE_ACTION: 'Microsoft.Network/virtualNetworks/delete' },
      assignment,
      definitions,
    ),
    false,
  )
  assert.equal(
    covered(
      {
        ...operation,
        TARGET_SCOPE: `${sub}/resourceGroups/g30/providers/Microsoft.Network/virtualNetworks/test`,
      },
      assignment,
      definitions,
    ),
    false,
  )
  assert.equal(covered({ ...operation, plane: 'DATA' }, assignment, definitions), false)
  assert.equal(
    covered(
      operation,
      { properties: { ...assignment.properties, condition: 'unverified condition' } },
      definitions,
    ),
    false,
  )
  assert.equal(matches('Microsoft.Network/*/read', 'microsoft.network/virtualNetworks/read'), true)
})
test('provider catalogs bind real action names and every linked authorization is proposed', () => {
  const names = new Set()
  function visit(value) {
    if (!value || typeof value !== 'object') return
    if (typeof value.name === 'string') names.add(value.name.toLowerCase())
    for (const child of Object.values(value))
      if (Array.isArray(child)) child.forEach(visit)
      else if (child && typeof child === 'object') visit(child)
  }
  assert.equal(operator.linkedAuthorizationCatalogs.length, 3)
  for (const catalog of operator.linkedAuthorizationCatalogs)
    visit(read(path.join(evidence, catalog.responseFile)))
  for (const entry of operator.requiredOperations)
    if (/^Microsoft\.(KeyVault|App|Network)\//i.test(entry.AZURE_ACTION))
      assert(names.has(entry.AZURE_ACTION.toLowerCase()), entry.AZURE_ACTION)
  for (const id of [
    'environment-join',
    'vault-private-endpoint-approval',
    'nsg-join',
    'route-table-join',
    'vnet-join',
    'g3-dns-zone-join',
  ])
    assert(operator.requiredOperations.some((entry) => entry.OPERATION_ID === id))
  const peering = operator.proposedAssignments.find(
    (entry) => entry.assignmentId === 'operator-g2-peering',
  )
  const dns = operator.proposedAssignments.find((entry) => entry.assignmentId === 'operator-g2-dns')
  assert(!peering.EXACT_SCOPE.includes('/virtualNetworkPeerings/'))
  assert(!dns.EXACT_SCOPE.includes('/virtualNetworkLinks/'))
  assert(peering.PURPOSE.includes('cannot name-isolate'))
  assert(dns.PURPOSE.includes('cannot name-isolate'))
  const seeder = operator.proposedAssignments.find(
    (entry) => entry.assignmentId === 'synthetic-secret-seeder',
  )
  assert(!seeder.EXACT_SCOPE.includes('/secrets/'))
  assert(seeder.PURPOSE.includes('verify empty'))
})
test('every operator core operation is covered by proposed custom/builtin scoped delta', () => {
  for (const operation of operator.requiredOperations.filter(
    (entry) => entry.PRINCIPAL_CLASS === 'EXECUTION_OPERATOR',
  )) {
    const grants = operator.proposedAssignments.filter((grant) => grant.PRINCIPAL_ID === principal)
    assert(
      grants.some((grant) => {
        if (
          !(
            operation.TARGET_SCOPE.toLowerCase() === grant.EXACT_SCOPE.toLowerCase() ||
            operation.TARGET_SCOPE.toLowerCase().startsWith(`${grant.EXACT_SCOPE.toLowerCase()}/`)
          )
        )
          return false
        const permissions =
          grant.ROLE.permissions?.flatMap((entry) =>
            operation.plane === 'DATA' ? entry.dataActions : entry.actions,
          ) ?? grant.ROLE[operation.plane === 'DATA' ? 'dataActions' : 'actions']
        return permissions?.includes(operation.AZURE_ACTION)
      }),
      `MISSING_PROPOSED_CORE_OPERATION:${operation.OPERATION_ID}`,
    )
  }
})
for (const grant of operator.proposedAssignments)
  test(`proposed assignment is scope/purpose/lifetime bound:${grant.assignmentId}`, () => {
    assert.equal(grant.STATUS, 'PROPOSED_NOT_GRANTED')
    assert(grant.EXACT_SCOPE !== sub)
    assert(grant.PRINCIPAL_ID && grant.ROLE && grant.PURPOSE && grant.LIFETIME)
    if (grant.ROLE.name?.startsWith('Container Registry')) {
      assert.equal(grant.CONDITION.version, '2.0')
      assert(grant.CONDITION.expression.includes("StringEquals 'g3-synthetic-runtime'"))
    }
  })
test('writer cannot cleanup and separate conditional cleaner is accounted', () => {
  const writer = operator.proposedAssignments.find(
    (entry) => entry.assignmentId === 'operator-repository-writer',
  )
  const cleaner = operator.proposedAssignments.find(
    (entry) => entry.assignmentId === 'rollback-repository-cleaner',
  )
  assert(
    writer.ROLE.permissions.every((permission) =>
      permission.dataActions.every((action) => !action.endsWith('/delete')),
    ),
  )
  assert(
    cleaner.ROLE.permissions.some((permission) =>
      permission.dataActions.some((action) => action.endsWith('/delete')),
    ),
  )
  assert.notEqual(cleaner.PRINCIPAL_ID, principal)
  assert.equal(operator.subscriptionWideOperatorGrantProposed, false)
})
for (const change of g2.changes)
  test(`exact G2 mutation and guarded rollback:${change.CHANGE_ID}`, () => {
    for (const key of [
      'CHANGE_ID',
      'CURRENT_STATE',
      'DESIRED_STATE',
      'RESOURCE_ID',
      'RESOURCE_GROUP',
      'RESOURCE_TYPE',
      'PROPERTY_PATH',
      'MUTATION_OPERATION',
      'WHY_REQUIRED',
      'G3_DEPENDENCY',
      'SECURITY_EFFECT',
      'ROLLBACK_OPERATION',
      'VALIDATION_AFTER_CHANGE',
    ])
      assert(change[key])
    assert.equal(change.STATUS, 'PROPOSED_NOT_AUTHORIZED')
    assert.equal(change.OWNER, 'G2_OWNED')
    assert.equal(change.RESOURCE_GROUP, 'nzila-g2-proof-xre47vggs5uhw')
    assert(change.ROLLBACK_OPERATION.guard)
    assert(change.VALIDATION_AFTER_CHANGE.length)
  })
test('G2 complete core changes include peer,DNS,firewall and repo grants with exact packet digest', () => {
  assert.equal(g2.changes.length, 7)
  assert.deepEqual(
    g2.changes.map((entry) => entry.CHANGE_ID),
    [
      'G2-PEERING',
      'G2-ACR-DNS-LINK',
      'G2-FIREWALL-networkRuleCollections',
      'G2-FIREWALL-applicationRuleCollections',
      'G2-RBAC-operator-repository-writer',
      'G2-RBAC-platform-repository-reader',
      'G2-RBAC-rollback-repository-cleaner',
    ],
  )
  const original = structuredClone(g2)
  delete original.digestMethod
  delete original.approval.G2_MUTATION_PACKET_DIGEST
  assert.equal(hash(JSON.stringify(original)), g2.approval.G2_MUTATION_PACKET_DIGEST)
  assert.equal(g2.approval.APPROVAL_STATUS, 'UNBOUND')
  assert.equal(g2.approval.CHANGE_COUNT, 7)
  assert.equal(g2.routeTransit.requiredG2RouteMutation, false)
  assert.equal(g2.routeTransit.ACA_PRIVATE_ENDPOINT, 'NOT_REQUIRED')
})
test('peering directions each own a single boundary with exact accepted gateway/forwarding flags', () => {
  assert.equal(g2.peeringContract.length, 2)
  const directions = new Set()
  for (const peer of g2.peeringContract) {
    assert.equal(peer.ALLOW_VNET_ACCESS, true)
    assert.equal(peer.ALLOW_FORWARD_TRAFFIC, true)
    assert.equal(peer.ALLOW_GATEWAY_TRANSIT, false)
    assert.equal(peer.USE_REMOTE_GATEWAYS, false)
    directions.add(`${peer.SOURCE_VNET}->${peer.REMOTE_VNET}`)
  }
  assert.equal(directions.size, 2)
  assert.equal(g2.HIDDEN_G2_MUTATIONS_IN_G3_SOURCE, 0)
  assert(
    g2.ownership.every((entry) =>
      ['G3_OWNED', 'G2_OWNED', 'CROSS_BOUNDARY_VALIDATION_ONLY'].includes(entry.owner),
    ),
  )
  assert.equal(new Set(g2.ownership.map((entry) => entry.operation)).size, g2.ownership.length)
  const sourceNetwork = readFileSync(path.join(source, 'modules', 'network.bicep'), 'utf8')
  assert(sourceNetwork.includes("name: 'g3-to-g2'"))
  assert(!sourceNetwork.includes("name: 'g2-to-g3'"))
  assert(!sourceNetwork.includes('azureFirewalls@'))
})
for (const rule of g2.firewallRules)
  test(`firewall exact rule fields/default-deny:${rule.RULE_ID}`, () => {
    assert(Array.isArray(rule.SOURCE) && rule.SOURCE.length)
    assert(Array.isArray(rule.DESTINATION) && rule.DESTINATION.length)
    assert.deepEqual(rule.PORT, [443])
    assert(
      !rule.DESTINATION.some((destination) =>
        ['Internet', 'AzureCloud', '*', '0.0.0.0/0'].includes(destination),
      ),
    )
    assert(rule.EVIDENCE_SOURCE.acceptedContract && rule.EVIDENCE_SOURCE.uri)
    assert(rule.PURPOSE && rule.PLATFORM_OR_WORKLOAD)
  })
test('firewall rollback changes named owned collections,not stale whole-object restoration', () => {
  for (const change of g2.changes.filter((entry) => entry.CHANGE_ID.startsWith('G2-FIREWALL'))) {
    assert.equal(change.CURRENT_STATE.value.length, 0)
    assert.equal(change.DESIRED_STATE.value.length, 1)
    assert(change.DESIRED_STATE.preservation.includes('retain sku'))
    assert(change.ROLLBACK_OPERATION.guard.includes('foreign'))
    assert.equal(
      change.MUTATION_OPERATION,
      'CONDITIONAL_FIREWALL_READ_MODIFY_WRITE;two property changes one PUT',
    )
  }
  assert.equal(g2.privateDns.registrationEnabled, false)
  assert(g2.privateDns.rollback.includes('retain zone/records'))
  assert(
    g2.privateDns.records.some((record) =>
      record.properties.aRecords?.some((entry) => entry.ipv4Address.startsWith('10.90.2.')),
    ),
  )
})
test('builder is not declared bound without courier,identity delivery,NSG adjunct and billed TTL facts', () => {
  const builder = readiness.builder
  assert.equal(builder.BUILDER_MODEL_STATUS, 'BLOCKED_EXACT_REASON')
  assert.equal(builder.selectedExecutableModel, null)
  assert.equal(builder.BUILDER_MAX_LIFETIME_MINUTES, 30)
  assert.equal(builder.FAIL_CLOSED_IF_TTL_CANNOT_BE_ENFORCED, true)
  assert.equal(builder.startAllowed, false)
  assert.deepEqual(
    builder.exactResiduals.map((item) => item.id),
    ['BUILDER-BOOTSTRAP', 'BUILDER-NETWORK', 'BUILDER-TTL'],
  )
  assert(builder.exactResiduals.every((item) => ['ROOT-3', 'ROOT-4'].includes(item.root)))
  assert.equal(builder.temporaryResourcesIfBound.length, 5)
  assert.equal(builder.candidate.publicIp, 'NONE')
  assert(builder.candidate.credentials.includes('no third G3 UAMI'))
  assert(
    builder.alternativeEvaluation
      .find((entry) => entry.model === 'REUSE_EXISTING_G2_VM')
      .reason.includes('No VM command executed'),
  )
})
test('actual source BOM and hypothetical adjunct never represented as created/bound', () => {
  assert.equal(costs.persistentBom.resources.length, 23)
  assert.equal(costs.persistentBom.inlineResources[0].count, 3)
  assert.equal(
    costs.sourceBomSha256,
    hash(readFileSync(path.join(source, 'G3_BILL_OF_MATERIALS.json'))),
  )
  assert.equal(costs.adjunctBom.length, readiness.builder.temporaryResourcesIfBound.length)
  assert(costs.retainedSharedCosts.includes('Existing Premium ACR base'))
})
for (const binding of costs.priceBindings)
  test(`exact CAD primary meter provenance and arithmetic:${binding.id}`, () => {
    const snapshot = read(path.join(evidence, binding.SOURCE))
    assert(
      snapshot.items.some(
        (item) =>
          item.meterId === binding.METER_ID &&
          item.retailPrice === binding.RETAIL_RATE &&
          item.skuName === binding.SKU &&
          item.armRegionName === binding.REGION &&
          item.currencyCode === 'CAD' &&
          item.isPrimaryMeterRegion,
      ),
    )
    assert.equal(binding.SOURCE_SHA256, hash(readFileSync(path.join(evidence, binding.SOURCE))))
    assert.equal(binding.CURRENCY, 'CAD')
    assert.equal(
      binding.MAX_COST,
      Number(((binding.QUANTITY_LIMIT / binding.divisor) * binding.RETAIL_RATE).toFixed(8)),
    )
    assert(binding.EFFECTIVE_DATE && binding.UNIT && binding.METER)
  })
test('known conditional arithmetic excludes shared base but never presents incomplete total as ceiling', () => {
  assert.equal(
    costs.knownComponentConditionalMaximumCAD,
    Number(
      costs.priceBindings
        .filter((entry) => entry.classification !== 'SHARED_EXISTING_PLATFORM_COST_NOT_INCREMENTAL')
        .reduce((sum, entry) => sum + entry.MAX_COST, 0)
        .toFixed(8),
    ),
  )
  for (const key of [
    'EXPECTED_PROOF_RUN_COST_CAD',
    'MAX_BOUNDED_PROOF_RUN_COST_CAD',
    'ROLLBACK_ALLOWANCE_CAD',
    'DIAGNOSTIC_CONTINGENCY_CAD',
    'UNCERTAINTY_BUFFER_CAD',
  ])
    assert.equal(costs[key], null)
  assert.equal(costs.RECOMMENDED_EXECUTION_CEILING_CAD, 'UNSUPPORTED')
  assert.equal(costs.HUMAN_APPROVED_EXECUTION_CEILING_CAD, 'UNBOUND')
  assert.equal(costs.quality.MATERIAL_COST_COMPONENTS_BOUND, 'NO')
  assert.equal(costs.quality.BUILDER_BOUND, 'NO')
  assert(costs.allowanceDesign.uncertaintyBuffer.includes('25%'))
  assert(costs.allowanceDesign.rollback && costs.allowanceDesign.diagnosticContingency)
})
test('ordinary Standard vault operations price is not Premium/HSM/renewal or foreign substitution', () => {
  assert(
    costs.unresolvedMaterialItems.some((entry) => entry.id === 'VAULT-STANDARD-OPERATIONS-METER'),
  )
  assert(!costs.priceBindings.some((entry) => entry.SERVICE === 'Key Vault'))
  const budget = costs.vaultOperationBudget
  assert.equal(
    budget.set +
      budget.runtimePlatformGetIncludingRetries +
      budget.metadataAndVersionRead +
      budget.controlledNegativeAuthenticatedAttempts +
      budget.cleanupDelete +
      budget.contingencyOperations,
    100,
  )
  assert.equal(budget.HMACRequestsCauseVaultCalls, false)
  assert.equal(budget.secretValueGeneratedOrRetrieved, false)
})
test('ACR zero incremental storage backed by exact headroom and recheck,not unsupported replication meter', () => {
  const acr = costs.acrStorage
  assert.equal(acr.sku, 'Premium')
  assert.equal(acr.currentBytes, 4681097)
  assert.equal(acr.includedBytes, 536870912000)
  assert(acr.headroomBytesAfterReservation > 0)
  assert.equal(
    acr.headroomBytesAfterReservation,
    acr.includedBytes - acr.currentBytes - acr.reservedG3Bytes,
  )
  assert.equal(acr.refreshRequiredBeforePush, true)
  assert.equal(acr.failClosedIfNoHeadroom, true)
  assert.equal(acr.geoReplications, 0)
  const storage = costs.priceBindings.find((entry) => entry.id === 'ACR-STORAGE-INCREMENTAL')
  assert.equal(storage.METER, 'Data Stored')
  assert.equal(storage.QUANTITY_LIMIT, 0)
  assert.equal(storage.MAX_COST, 0)
})
test('traffic private and public surfaces prevent full byte duplication/double-counting', () => {
  const byId = new Map(costs.priceBindings.map((entry) => [entry.id, entry]))
  assert.equal(
    byId.get('ACR-PE-IN').QUANTITY_LIMIT + byId.get('ACR-PE-OUT').QUANTITY_LIMIT,
    costs.hardQuantityCaps.MAX_ACR_PE_PROCESSED_GB,
  )
  assert.equal(
    byId.get('KV-PE-IN').QUANTITY_LIMIT + byId.get('KV-PE-OUT').QUANTITY_LIMIT,
    costs.hardQuantityCaps.MAX_KV_PE_PROCESSED_GB,
  )
  assert.equal(byId.get('PEERING-SOURCE').QUANTITY_LIMIT, costs.hardQuantityCaps.MAX_PEERING_GB)
  assert.equal(
    byId.get('PEERING-DESTINATION').QUANTITY_LIMIT,
    costs.hardQuantityCaps.MAX_PEERING_GB,
  )
  const privatePath = costs.trafficAccounting.find(
    (entry) => entry.path === 'G3_VM_PUSH_PLUS_ACA_PULLS',
  )
  assert.equal(privatePath.firewallGB, 0)
  assert.equal(privatePath.publicEgressGB, 0)
  const publicPath = costs.trafficAccounting.find(
    (entry) => entry.path === 'PLATFORM_CONTROL_TO_ALLOWED_PUBLIC_MICROSOFT_DEPENDENCIES',
  )
  assert(publicPath.outboundGB < publicPath.totalBidirectionalGB)
  assert.equal(byId.get('INTERNET-EGRESS').QUANTITY_LIMIT, publicPath.outboundGB)
  assert.equal(byId.get('INTERNET-EGRESS').RETAIL_RATE, 0.12324)
})
test('quantities are explicit proposed caps and delayed quota/guest shutdown not hard guarantees', () => {
  assert.equal(costs.hardQuantityCaps.MAX_CONTAINER_VCPU_SECONDS, 0.25 * 2 * 3600)
  assert.equal(costs.hardQuantityCaps.MAX_CONTAINER_GIB_SECONDS, 0.5 * 2 * 3600)
  assert.equal(costs.hardQuantityCaps.MAX_REPLICAS, 1)
  assert.equal(costs.hardQuantityCaps.MAX_REVISIONS, 1)
  assert.equal(costs.capEnforcement.implemented, false)
  assert(costs.capEnforcement.diagnostics.includes('not hard'))
  assert(costs.unresolvedMaterialItems.some((entry) => entry.id === 'CAP-ENFORCEMENT'))
})
test('ordered execution DAG contains no cycle and exact irreversible gates precede workload', () => {
  assert.equal(validateDag(plan.steps), true)
  const byId = new Map(plan.steps.map((step) => [step.id, step]))
  assert.deepEqual(byId.get('quota-query').dependsOn, ['empty-environment'])
  assert.deepEqual(byId.get('quota-gate').dependsOn, ['quota-query'])
  assert(byId.get('private-production').dependsOn.includes('quota-gate'))
  assert(byId.get('workload-activation').dependsOn.includes('quota-gate'))
  assert(byId.get('workload-activation').dependsOn.includes('runtime-roles-and-secret'))
  assert.equal(
    plan.missingOrInsufficientQuota,
    'DENY_WORKLOAD_ACTIVATION;NO_AUTOMATIC_QUOTA_REQUEST',
  )
  assert(plan.currentMutationFlags.includes('ALL_FALSE'))
  assert(
    plan.steps.every(
      (step) => step.execution === 'NOT_EXECUTED' && step.ROLLBACK && step.HUMAN_AUTHORITY_REQUIRED,
    ),
  )
  assert.equal(plan.orderedRollback.length, plan.steps.length)
})
for (const steps of [
  [{ id: 'a', dependsOn: ['a'] }],
  [
    { id: 'a', dependsOn: ['b'] },
    { id: 'b', dependsOn: ['a'] },
  ],
  [{ id: 'a', dependsOn: ['missing'] }],
  [
    { id: 'a', dependsOn: [] },
    { id: 'a', dependsOn: [] },
  ],
])
  test(`execution DAG rejects invalid shape:${JSON.stringify(steps)}`, () =>
    assert.throws(() => validateDag(steps)))
test('final human packet contains exactly three decision groups,no inferred appointments/cost approval', () => {
  const text = readFileSync(path.join(evidence, 'G3R3_FINAL_HUMAN_AUTHORIZATION_PACKET.md'), 'utf8')
  assert.deepEqual(
    [...text.matchAll(/^## DECISION ([ABC]) /gm)].map((match) => match[1]),
    ['A', 'B', 'C'],
  )
  assert.equal((text.match(/^## /gm) ?? []).length, 3)
  assert(text.includes(g2.approval.G2_MUTATION_PACKET_DIGEST))
  assert(text.includes('CAD UNSUPPORTED'))
  assert(text.includes('must differ'))
  assert(text.includes('NOT_APPOINTED'))
})
test('Azure and public read ledgers bind hashes and retain throttled read without mutations', () => {
  const ledger = read(path.join(evidence, 'G3R3_AZURE_READ_LEDGER.json'))
  assert.equal(ledger.length, 26)
  for (const entry of ledger) {
    assert.equal(entry.mutation, false)
    assert.equal(entry.status, 'SUCCEEDED')
    assert.equal(hash(readFileSync(path.join(evidence, entry.responseFile))), entry.responseSha256)
    if (entry.method === 'GET') {
      assert.equal(entry.command[1], 'rest')
      assert.equal(entry.command[3], 'get')
      assert.equal(allowedUrl(entry.command[5]), true)
    } else assert.equal(entry.method, 'ACCOUNT_SHOW_READ_ONLY')
  }
  const pricing = read(path.join(evidence, 'G3R3_PUBLIC_READ_LEDGER.json'))
  assert(pricing.some((entry) => entry.httpStatus === 429 && entry.status === 'FAILED'))
  assert(
    pricing.some((entry) => entry.name === 'bandwidth-catalog' && entry.status === 'SUCCEEDED'),
  )
  for (const entry of pricing) {
    assert.equal(entry.method, 'GET')
    assert.equal(entry.mutation, false)
    assert.equal(new URL(entry.url).hostname, 'prices.azure.com')
    assert.equal(hash(readFileSync(path.join(evidence, entry.responseFile))), entry.responseSha256)
  }
})
for (const url of [
  'https://example.com/',
  'https://management.azure.com/subscriptions/other/providers/Microsoft.Authorization/roleAssignments?api-version=2022-04-01',
  'https://management.azure.com/subscriptions/5d819f33-d16f-429c-a3c0-5b0e94740ba3/providers/Microsoft.Authorization/roleAssignments?api-version=2022-04-01&unknown=1',
])
  test(`collector denies unapproved URL:${url}`, () => assert.equal(allowedUrl(url), false))
for (const [name, value] of Object.entries(readiness.boundaries))
  test(`zero-execution boundary:${name}`, () => assert(value === 'NO' || value === 0))
test('blocked gate reflects only exact subordinate ROOT-3/4 engineering facts,not new source roots', () => {
  assert.equal(readiness.G3R3_GATE, 'BLOCKED')
  assert.equal(readiness.G3_EXECUTION_READINESS, 'BLOCKED')
  assert.equal(readiness.G3A, 'NOT_AUTHORIZED_PENDING_HUMAN_DECISIONS')
  assert.equal(readiness.G3B, 'NOT_AUTHORIZED')
  assert(
    readiness.exactTechnicalResiduals.every((entry) => ['ROOT-3', 'ROOT-4'].includes(entry.root)),
  )
  assert.equal(readiness.remainingRoots.length, 3)
  assert.equal(readiness.RECOMMENDED_EXECUTION_CEILING_CAD, 'UNSUPPORTED')
})
test('pure packet generators repeat deterministically without any collector/controller/image execution', () => {
  assert.deepEqual(privilegePacket(), operator)
  assert.deepEqual(mutationPacket(operator), g2)
  assert.deepEqual(builderModel(), readiness.builder)
  assert.deepEqual(costEnvelope(readiness.builder), costs)
  assert.equal(
    check().status,
    'PASS_LOCAL_PACKET_HASH_GRAPH_AND_HISTORICAL_PRESERVATION;G3R3_BLOCKED',
  )
})
for (const flag of [
  '--deploy',
  '--grant',
  '--push',
  '--execute',
  '--private-builder',
  '--approve-cost',
  '--appoint',
])
  test(`packet writer denies execution flag:${flag}`, async () =>
    assert.rejects(main([flag]), /G3R3_LOCAL_PACKET_FLAGS_ONLY/))
