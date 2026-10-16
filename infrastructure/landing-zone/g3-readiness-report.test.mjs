import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import {
  buildReadiness,
  candidateCidrs,
  candidateNames,
  cidrRange,
  generateReadiness,
  main,
  overlaps,
  platformEgress,
  verifyPriceSnapshots,
  verifyReadSnapshots,
} from './g3-readiness-report.mjs'

const root = fileURLToPath(new URL('./', import.meta.url))
const evidence = path.join(root, 'g3-readiness-evidence')
const model = buildReadiness()

test('readiness fails closed without prior source/controller/G2 terminal authority', () => {
  assert.equal(model.status.G3_EXECUTION_READINESS, 'BLOCKED')
  assert(model.blockers.some((blocker) => blocker.id === 'G3-PRIOR-AUTHORITY-PACKAGE-MISSING'))
  assert.equal(model.status.TARGET_REGISTRY_IMAGE_PRESENT, 'NOT_PROVEN')
  assert.equal(model.status.G3A_BICEP_LOCAL_BUILD, 'FAIL')
  assert.equal(model.status.G3B_BICEP_LOCAL_BUILD, 'FAIL')
  assert.equal(model.preservation.noImageBuildPushImport, true)
})
test('accepted runtime,image,identities and split are not redesigned', () => {
  assert.equal(model.frozenDesign.runtime, 'AZURE_CONTAINER_APPS')
  assert.equal(model.frozenDesign.environmentType, 'WORKLOAD_PROFILES')
  assert.equal(model.frozenDesign.workloadProfile, 'CONSUMPTION')
  assert.equal(model.frozenDesign.accessibility, 'INTERNAL')
  assert.equal(
    model.frozenDesign.image.manifest,
    'sha256:1a6085926ff5fd78cc81bb2fb6df8ceb9bc62660e3222bbe088e47807a91bb61',
  )
  assert.equal(model.frozenDesign.image.blobSize, 3271902)
  assert.equal(model.frozenDesign.image.platform, 'linux/amd64')
  assert.equal(model.status.G3_ARTIFACT_EXECUTION_SPLIT, 'G3A_G3B')
  assert.equal(candidateNames.resourceGroup, 'nzila-shared-test-g3-001-rg')
})
for (const provider of model.live.providers)
  test(`required provider:${provider.namespace}`, () => {
    assert.equal(provider.registration, 'Registered')
    assert.equal(model.status.G3_PROVIDER_REGISTRATION, 'PASS')
  })
for (const resource of model.live.regionResources)
  test(`Canada Central subscription-visible metadata:${resource.namespace}/${resource.type}`, () => {
    assert.equal(resource.subscriptionVisibleCanadaCentral, true)
  })
test('existing Consumption profiles prove regional visibility,not reserved capacity', () => {
  assert.equal(model.status.G3_REGION_AVAILABILITY, 'PASS')
  assert(model.live.existingCanadaCentralConsumptionProfiles.length >= 1)
  assert.equal(model.live.consumptionCoreQuota.targetEnvironmentExists, false)
  assert.equal(model.live.consumptionCoreQuota.limit, null)
  assert.equal(model.status.G3_QUOTA_STATUS, 'BLOCKED')
  assert.equal(model.live.managedEnvironmentQuota.current, 4)
  assert.equal(model.live.managedEnvironmentQuota.limit, 20)
  assert.equal(model.live.managedEnvironmentQuota.headroom, 16)
})
for (const quota of model.live.networkQuota)
  test(`exact network headroom:${quota.name}`, () => {
    assert.equal(quota.headroom, quota.limit - quota.current)
    assert.equal(quota.sufficient, true)
    assert(quota.headroom >= quota.required)
  })
test('candidate CIDRs contain distinct delegated and PE subnets', () => {
  assert.equal(model.status.G3_NETWORK_ADDRESS_PLAN, 'PASS')
  assert.equal(model.cidrs.acaDelegation, 'Microsoft.App/environments')
  assert.equal(model.cidrs.noOverlap, true)
  assert.equal(model.cidrs.contained, true)
  assert.equal(model.cidrs.siblingOverlap, false)
  assert.equal(candidateCidrs.vnet, '10.91.0.0/16')
  assert(overlaps(candidateCidrs.vnet, candidateCidrs.acaSubnet))
  assert(!overlaps(candidateCidrs.acaSubnet, candidateCidrs.privateEndpointSubnet))
  assert(!overlaps(candidateCidrs.vnet, '10.90.0.0/16'))
  assert(!overlaps(candidateCidrs.vnet, '10.1.0.0/16'))
})
for (const cidr of ['10.91.1.1/24', '256.0.0.0/24', '10.1.0.0/33', 'not-cidr'])
  test(`reject malformed/noncanonical CIDR:${cidr}`, () => {
    assert.throws(() => cidrRange(cidr))
  })
test('global vault availability is proven by non-reserving operation,not inventory absence', () => {
  assert.equal(model.status.G3_NAME_COLLISION_CHECK, 'PASS')
  assert.equal(model.status.G3_RESOURCE_GROUP_COLLISION, 'PASS')
  assert.equal(model.ledger.nonReservingNameCheckPost.result.nameAvailable, true)
  assert.equal(model.ledger.nonReservingNameCheckPost.mutation, false)
  assert(!model.blockers.some((blocker) => blocker.id.includes('NAME-COLLISION')))
})
test('routing to a retained private firewall is not labeled ready without transit/rules', () => {
  assert.equal(model.status.G3_FIREWALL_UDR_MODEL, 'BLOCKED')
  assert.deepEqual(model.live.g2Peerings, [])
  assert.equal(model.live.g2Firewall[0].sku.tier, 'Basic')
  assert.deepEqual(model.live.g2Firewall[0].applicationRules, [])
  assert.deepEqual(model.live.g2Firewall[0].networkRules, [])
})
test('existing federated identities are inventoried but not silently approved/regranted', () => {
  const build = model.live.operatorCandidates.find(
    (principal) => principal.displayName === 'nzila-os-build',
  )
  assert(build)
  assert(
    build.federation.some(
      (entry) => entry.subject === 'repo:anungis437/nzila-os:environment:build',
    ),
  )
  assert(build.grants.every((entry) => !entry.scope.includes(candidateNames.resourceGroup)))
  assert.equal(model.live.g3RoleAssignmentsReturned, 0)
  assert.equal(model.status.G3_OPERATOR_PRINCIPAL_CANDIDATE, 'NONE')
  assert(model.live.operatorCandidates.every((principal) => principal.selectedForG3 === false))
})
test('governance approver is not conflated with an Azure deployment identity', () => {
  assert.equal(model.status.G3_GOVERNANCE_APPROVER, 'UNBOUND_NO_PERSONAL_IDENTIFIERS_STORED')
  assert(model.live.operatorCandidates.every((principal) => principal.type !== 'User'))
})
test('pullNone/runtimeMain and exact repository/secret scope remain narrow contracts', () => {
  assert.equal(model.futureContracts.pull.lifecycle, 'None')
  assert.equal(model.futureContracts.runtime.lifecycle, 'Main')
  assert.equal(model.futureContracts.pull.repositoryEquals, 'g3-synthetic-runtime')
  assert.equal(model.futureContracts.pull.acrPullFallback, 'PROHIBITED')
  assert.equal(model.futureContracts.pull.ACA_ABAC_IMAGE_PULL, 'MUST_PROVE')
  assert.deepEqual(model.futureContracts.runtime.acrRoles, [])
  assert.deepEqual(model.futureContracts.runtime.buildRoles, [])
  assert(model.futureContracts.runtime.scope.endsWith('/secrets/g3-proof-secret'))
})
test('secret proof never stores a value or counts404/timeout as an authorization denial', () => {
  assert.equal(model.futureContracts.vault.secretCount, 1)
  assert.equal(model.futureContracts.vault.secretValuePersisted, false)
  assert.equal(model.futureContracts.secretChallenge.publicFallback, 'PROHIBITED')
  assert(model.futureContracts.secretChallenge.wrongReference.includes('not authorization denial'))
  assert.equal(model.futureContracts.negativeProofs.length, 7)
  assert(
    model.futureContracts.negativeProofs.some(
      (proof) =>
        proof.name === 'PUBLIC_CONTAINER_APP_ACCESS' &&
        proof.expected.includes('notanRBAC403claim'),
    ),
  )
})
test('service-tag breadth records accepted synthetic limitation,not tenant isolation', () => {
  assert.equal(platformEgress.G3_PLATFORM_EGRESS_BREADTH, 'ACCEPTED_FOR_SYNTHETIC_PROOF')
  assert.equal(platformEgress.G3_SERVICE_TAG_EGRESS_LIMITATION, 'ACCEPTED_AND_DOCUMENTED')
  assert(platformEgress.PLATFORM_MANDATORY.serviceTags.includes('AzureFrontDoorFirstParty'))
  assert(!platformEgress.PLATFORM_MANDATORY.serviceTags.includes('AzureFrontDoor.FirstParty'))
  assert.equal(platformEgress.ACR.runtimeDockerHub, 'PROHIBITED')
  assert.equal(platformEgress.DNS.destination, '168.63.129.16')
  assert.equal(platformEgress.DNS.port, 53)
  assert(platformEgress.scope.includes('not arbitrary Internet'))
  assert.equal(platformEgress.deployedRules, 'NO')
})
test('internal ACA is not a public ACA with PrivateEndpoint', () => {
  assert.equal(model.status.G3_ACA_PRIVATE_ENDPOINT, 'NOT_REQUIRED')
  assert.equal(
    model.frozenDesign.distinction,
    'INTERNAL_ENVIRONMENT != PUBLIC_ENVIRONMENT_WITH_PRIVATE_ENDPOINT',
  )
  assert.equal(model.costs.ACA_PRIVATE_ENDPOINT_COST, 'EXCLUDED_NOT_SELECTED')
  assert.equal(model.futureContracts.vault.privateEndpoint, true)
})
test('ABAC mode is proven by the explicit latest-stable ARM field,not guessed from repository roles', () => {
  assert.equal(model.live.registryMode.apiVersion, '2025-11-01')
  assert.equal(model.live.registryMode.explicitRoleAssignmentMode, 'AbacRepositoryPermissions')
  assert.equal(model.live.registryMode.conclusion, 'ABAC_MODE_PROVEN_BY_EXPLICIT_ARM_GET')
  assert(!model.blockers.some((blocker) => blocker.id.includes('REGISTRY-MODE')))
})
for (const [component, meter] of Object.entries(model.costs.prices))
  test(`current CAD meter/unit retained:${component}`, () => {
    assert.equal(meter.currency, 'CAD')
    assert(meter.meterId && meter.unitOfMeasure && Number.isFinite(meter.retailPrice))
    assert(meter.retailPrice >= 0)
  })
test('subtotal is not mislabeled a completed idle estimate or approved ceiling', () => {
  const prices = model.costs.prices
  const expected = Number(
    (
      730 * (prices.vaultPrivateEndpoint.retailPrice + prices.loadBalancer.retailPrice) +
      2 * prices.privateDnsZone.retailPrice
    ).toFixed(6),
  )
  assert.equal(model.costs.idleKnownStandingSubtotalCAD, expected)
  assert.equal(model.status.G3_CANDIDATE_IDLE_MONTHLY_COST_CAD, 'UNRESOLVED')
  assert.equal(model.status.G3_PROOF_COST_CEILING_CAD, 'UNRESOLVED')
  assert.equal(model.costs.existingG2FirewallBaseIncremental, 0)
  assert.equal(model.costs.noFreeAllowanceAssumed, true)
  assert(model.costs.missing.length > 0)
})
test('every attempted call is ledgered as read-only,including nonmutating nameCheckPOST exception', () => {
  const ledger = JSON.parse(
    readFileSync(path.join(evidence, 'azure-read-only-ledger.json'), 'utf8').replace(/^\uFEFF/, ''),
  )
  assert.equal(model.ledger.azureCalls, ledger.length)
  assert.equal(model.ledger.successful + model.ledger.failed, ledger.length)
  for (const entry of ledger) {
    assert.equal(entry.mutation, false)
    assert(entry.command.includes('--only-show-errors'))
    assert.equal(typeof entry.exitCode, 'number')
    assert(entry.startedAtUtc && entry.completedAtUtc && entry.responseSha256)
    if (entry.command[3] === 'post')
      assert.equal(entry.httpMethod, 'POST_NAME_AVAILABILITY_NONMUTATING')
  }
})
test('failed responses and retention limits remain explicit,not success-shaped fallback', () => {
  assert(model.ledger.failed > 0)
  assert.equal(model.ledger.unretainedHistoricalResponses, 1)
  assert(
    model.ledger.audit.some(
      (entry) =>
        entry.status === 'FAILED' && entry.retentionStatus === 'HISTORICAL_RESPONSE_NOT_RETAINED',
    ),
  )
})
test('current Azure aliases are bound to their latest successful ledger digest', () => {
  const ledger = JSON.parse(
    readFileSync(path.join(evidence, 'azure-read-only-ledger.json'), 'utf8').replace(/^\uFEFF/, ''),
  )
  verifyReadSnapshots(ledger)
  assert.throws(
    () =>
      verifyReadSnapshots(ledger, (name) =>
        name === 'account.json' ? Buffer.from('{}') : readFileSync(path.join(evidence, name)),
      ),
    /CURRENT_AZURE_ALIAS_DIGEST_MISMATCH:account/,
  )
})
test('Graph aggregate tampering fails even when every raw page remains intact', () => {
  const ledger = JSON.parse(
    readFileSync(path.join(evidence, 'azure-read-only-ledger.json'), 'utf8').replace(/^\uFEFF/, ''),
  )
  assert.throws(
    () =>
      verifyReadSnapshots(ledger, (name) => {
        const bytes = readFileSync(path.join(evidence, name))
        if (name !== 'service-principals.json') return bytes
        const aggregate = JSON.parse(bytes.toString().replace(/^\uFEFF/, ''))
        return Buffer.from(JSON.stringify({ ...aggregate, value: [] }))
      }),
    /GRAPH_AGGREGATE_MISMATCH/,
  )
})
test('public prices are bound to retained raw bytes and reject raw tampering', () => {
  const ledger = JSON.parse(
    readFileSync(path.join(evidence, 'public-pricing-read-ledger.json'), 'utf8'),
  )
  verifyPriceSnapshots(ledger)
  assert.throws(
    () =>
      verifyPriceSnapshots(ledger, (name) =>
        name === ledger[0].responseFile
          ? Buffer.from('{}')
          : readFileSync(path.join(evidence, name)),
      ),
    /PUBLIC_PRICING_DIGEST_MISMATCH/,
  )
})
test('a derived pricing summary cannot silently change a ledgered meter rate', () => {
  const ledger = JSON.parse(
    readFileSync(path.join(evidence, 'public-pricing-read-ledger.json'), 'utf8'),
  )
  assert.throws(
    () =>
      verifyPriceSnapshots(ledger, (name) => {
        const bytes = readFileSync(path.join(evidence, name))
        if (name !== 'pricing-Azure-Container-Apps.json') return bytes
        const summary = JSON.parse(bytes)
        summary.items[0].retailPrice += 1
        return Buffer.from(JSON.stringify(summary))
      }),
    /PUBLIC_PRICING_SUMMARY_NOT_BOUND_TO_RAW_RESPONSES/,
  )
})
test('all successful Azure calls have retained hash-verified responses', () => {
  assert(
    model.ledger.audit
      .filter((entry) => entry.status === 'SUCCEEDED')
      .every((entry) => entry.retentionStatus === 'DIGEST_VERIFIED_RETAINED'),
  )
})
test('collector contains no Azure resource mutators or unrestricted REST method', () => {
  const source = readFileSync(path.join(root, 'g3-readiness-census.ps1'), 'utf8')
  assert(
    !/\baz\s+(login|account\s+set|deployment|provider\s+register|role\s+assignment\s+(create|delete)|acr\s+(import|build)|containerapp\s+(create|update|delete))/i.test(
      source,
    ),
  )
  assert(source.includes("$Arguments[2] -eq 'get'"))
  assert(source.includes('checkNameAvailability?api-version=2024-11-01'))
  assert(
    source.includes(
      "'Azure account is not readable. No login, account switch or Azure mutation attempted.'",
    ),
  )
  assert(source.includes('$azurePython -IBm azure.cli'))
})
test('public price collector sends only GETs to the public pricing host', () => {
  const ledger = JSON.parse(
    readFileSync(path.join(evidence, 'public-pricing-read-ledger.json'), 'utf8'),
  )
  for (const entry of ledger) {
    assert.equal(entry.method, 'GET')
    assert.equal(entry.mutation, false)
    assert.equal(new URL(entry.url).hostname, 'prices.azure.com')
    assert.equal(entry.status, 'SUCCEEDED')
  }
})
test('report generation is side-effect-free and two generations have identical bytes', async () => {
  assert.deepEqual(await generateReadiness(), await generateReadiness())
})
test('persisted readiness bytes match the deterministic report', async () => {
  await main(['--check', '--self-test'])
})
for (const flag of ['--deploy', '--apply', '--execute', '--push', '--grant', '--g3a', '--g3b'])
  test(`report refuses execution flag:${flag}`, async () => {
    await assert.rejects(main([flag]), /LOCAL_REPORT_FLAGS_ONLY/)
  })
test('no G3 technical/product/data permission is inferred from read-only closure', () => {
  assert.equal(model.status.G3_TECHNICAL_EXECUTION_AUTHORIZED, 'NO')
  assert.equal(model.status.APPLICATION_ROLLOUT_AUTHORIZED, 'NO')
  assert.equal(model.status.PRODUCTION_DATA_AUTHORIZED, 'NO')
  assert.equal(model.status.AZURE_MUTATIONS, 0)
  assert.equal(model.status.REGISTRY_MUTATIONS, 0)
  assert.equal(model.status.UE_INFRA, 'INFRA_NO_GO')
  assert.equal(model.status.CORA_INFRA, 'INFRA_NO_GO')
  assert.equal(model.preservation.noG2ExecutionAuthorityReused, true)
})
