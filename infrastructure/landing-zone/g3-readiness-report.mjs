import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

const directory = fileURLToPath(new URL('./g3-readiness-evidence/', import.meta.url))
const root = fileURLToPath(new URL('./', import.meta.url))
const subscription = '5d819f33-d16f-429c-a3c0-5b0e94740ba3'
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const read = (name) =>
  JSON.parse(readFileSync(path.join(directory, name), 'utf8').replace(/^\uFEFF/, ''))
const suffix = hash(`NZ-20261008-INFRA-001:${subscription}:G3`).slice(0, 8)
export const candidateNames = {
  resourceGroup: 'nzila-shared-test-g3-001-rg',
  environment: `nzila-g3-env-${suffix}`,
  application: `nzila-g3-proof-${suffix}`,
  pullIdentity: `nzila-g3-pull-${suffix}`,
  runtimeIdentity: `nzila-g3-runtime-${suffix}`,
  keyVault: `nzg3kv${suffix}`,
  vnet: `nzila-g3-vnet-${suffix}`,
  acaSubnet: 'G3ContainerAppsSubnet',
  privateEndpointSubnet: 'G3PrivateEndpointSubnet',
  builderSubnet: 'G3BuilderSubnet',
  nsg: `nzila-g3-aca-nsg-${suffix}`,
  routeTable: `nzila-g3-aca-rt-${suffix}`,
  keyVaultEndpoint: `nzila-g3-kv-pe-${suffix}`,
  keyVaultDnsZone: 'privatelink.vaultcore.azure.net',
  keyVaultDnsLink: `nzila-g3-kv-link-${suffix}`,
  workspace: `nzila-g3-logs-${suffix}`,
}
export const candidateCidrs = {
  vnet: '10.91.0.0/16',
  acaSubnet: '10.91.1.0/24',
  privateEndpointSubnet: '10.91.2.0/24',
  builderSubnet: '10.91.3.0/24',
}
export function cidrRange(cidr) {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)\/(\d+)$/.exec(cidr)
  assert(match, 'INVALID_IPV4_CIDR')
  const octets = match.slice(1, 5).map(Number)
  const prefix = Number(match[5])
  assert(
    octets.every((octet) => octet >= 0 && octet <= 255) && prefix >= 0 && prefix <= 32,
    'INVALID_IPV4_CIDR',
  )
  const ip = octets.reduce((value, octet) => value * 256 + octet, 0)
  const size = 2 ** (32 - prefix)
  assert(ip % size === 0, 'NON_CANONICAL_CIDR')
  return [ip, ip + size - 1]
}
export function overlaps(a, b) {
  const [aStart, aEnd] = cidrRange(a)
  const [bStart, bEnd] = cidrRange(b)
  return aStart <= bEnd && bStart <= aEnd
}
export const platformEgress = {
  G3_PLATFORM_EGRESS_BREADTH: 'ACCEPTED_FOR_SYNTHETIC_PROOF',
  G3_SERVICE_TAG_EGRESS_LIMITATION: 'ACCEPTED_AND_DOCUMENTED',
  scope:
    'Only Microsoft-documented dependencies for this synthetic ACA proof;not arbitrary Internet egress,tenant-exclusive isolation,exfiltration-proofing or production certification.',
  source: 'https://learn.microsoft.com/en-us/azure/container-apps/use-azure-firewall',
  PLATFORM_MANDATORY: {
    serviceTags: ['MicrosoftContainerRegistry', 'AzureFrontDoorFirstParty'],
    applicationFqdns: [
      'mcr.microsoft.com',
      '*.data.mcr.microsoft.com',
      'packages.aks.azure.com',
      'acs-mirror.azureedge.net',
    ],
    ruleChoice:
      'MCR service tags or its documented application FQDN equivalent;AKS/CNI FQDN dependencies separately evaluated.',
  },
  IDENTITY: {
    serviceTags: ['AzureActiveDirectory'],
    applicationFqdns: [
      '*.identity.azure.net',
      'login.microsoftonline.com',
      '*.login.microsoftonline.com',
      '*.login.microsoft.com',
      'login.microsoft.com',
    ],
  },
  ACR: {
    serviceTags: ['AzureContainerRegistry', 'AzureActiveDirectory'],
    applicationFqdns: [
      'nzilag2tzo75uuozprbo.azurecr.io',
      'nzilag2tzo75uuozprbo.canadacentral.data.azurecr.io',
      'login.microsoft.com',
    ],
    documentedStorageDependency: '*.blob.core.windows.net',
    storageLimitation:
      'Documented storage wildcard is broader than one tenant/storage account;recorded for synthetic platform use only,not a product data-plane allowlist.',
    privateDnsZone: 'privatelink.azurecr.io',
    runtimeDockerHub: 'PROHIBITED',
  },
  KEY_VAULT: {
    serviceTags: ['AzureKeyVault', 'AzureActiveDirectory'],
    applicationFqdns: [`${candidateNames.keyVault}.vault.azure.net`, 'login.microsoft.com'],
    privateDnsZone: candidateNames.keyVaultDnsZone,
    publicFallback: 'PROHIBITED',
  },
  TELEMETRY: {
    serviceTags: ['AzureMonitor'],
    status:
      'Exact workspace ingestion/control endpoints must be bound in the recovered G3 package;not a generic wildcard approval.',
  },
  DNS: { destination: '168.63.129.16', protocols: ['UDP', 'TCP'], port: 53 },
  serviceTagSpelling:
    'The documented network service tag is AzureFrontDoorFirstParty;AzureFrontDoor.FirstParty is not substituted into NSG/firewall rules.',
  deployedRules: 'NO',
}
export function verifyReadSnapshots(
  ledger,
  loadBytes = (name) => readFileSync(path.join(directory, name)),
) {
  const latest = new Map(ledger.map((entry) => [entry.name, entry]))
  for (const [name, entry] of latest) {
    if (
      entry.status !== 'SUCCEEDED' ||
      ['service-principals', 'deployment-applications'].includes(name)
    )
      continue
    assert.equal(
      hash(loadBytes(`${name}.json`)),
      entry.responseSha256,
      `CURRENT_AZURE_ALIAS_DIGEST_MISMATCH:${name}`,
    )
  }
  for (const name of ['service-principals', 'deployment-applications']) {
    const pages = [...latest.values()]
      .filter((entry) => entry.name.startsWith(`${name}-page-`) && entry.status === 'SUCCEEDED')
      .sort((a, b) => Number(a.name.split('-').at(-1)) - Number(b.name.split('-').at(-1)))
    const aggregate = JSON.parse(
      loadBytes(`${name}.json`)
        .toString()
        .replace(/^\uFEFF/, ''),
    )
    assert.equal(aggregate.sourcePages, pages.length, `GRAPH_PAGE_COUNT_MISMATCH:${name}`)
    assert.deepEqual(
      aggregate.value,
      pages.flatMap(
        (entry) =>
          JSON.parse(
            loadBytes(`${entry.name}.json`)
              .toString()
              .replace(/^\uFEFF/, ''),
          ).value,
      ),
      `GRAPH_AGGREGATE_MISMATCH:${name}`,
    )
  }
}
export function verifyPriceSnapshots(
  ledger,
  loadBytes = (name) => readFileSync(path.join(directory, name)),
) {
  for (const entry of ledger) {
    assert.equal(entry.method, 'GET', 'PUBLIC_PRICING_GET_REQUIRED')
    assert.equal(new URL(entry.url).hostname, 'prices.azure.com', 'PUBLIC_PRICING_HOST_REQUIRED')
    assert.equal(entry.status, 'SUCCEEDED', 'INCOMPLETE_PUBLIC_PRICING_CALL')
    assert.equal(
      hash(loadBytes(entry.responseFile)),
      entry.responseSha256,
      `PUBLIC_PRICING_DIGEST_MISMATCH:${entry.responseFile}`,
    )
  }
  for (const name of readdirSync(directory).filter(
    (name) => /^pricing-.+\.json$/.test(name) && !name.startsWith('pricing-response-'),
  )) {
    const summary = JSON.parse(loadBytes(name))
    const matching = ledger.filter(
      (entry) =>
        entry.name === summary.service &&
        new URL(entry.url).searchParams.get('$filter') === summary.filter,
    )
    let verified = false
    for (let start = 0; start <= matching.length - summary.pages; start++) {
      const pages = matching
        .slice(start, start + summary.pages)
        .map((entry) => JSON.parse(loadBytes(entry.responseFile)))
      const primary = pages.flatMap((page) =>
        page.Items.filter((item) => item.isPrimaryMeterRegion),
      )
      if (JSON.stringify(primary) === JSON.stringify(summary.items)) {
        verified = true
        break
      }
    }
    assert(verified, `PUBLIC_PRICING_SUMMARY_NOT_BOUND_TO_RAW_RESPONSES:${name}`)
  }
}
function reconcileLedger(ledger) {
  const retained = readdirSync(directory).filter((name) => /^\d{3}-.+\.json$/.test(name))
  return ledger.map((entry, index) => {
    assert(entry.mutation === false, 'MUTATING_AZURE_LEDGER_ENTRY')
    const args = entry.command
    assert(args[0] === 'az', 'UNEXPECTED_LEDGER_EXECUTABLE')
    assert(
      (args[1] === 'account' && args[2] === 'show') ||
        (args[1] === 'rest' && args[2] === '--method' && args[3] === 'get') ||
        (args[1] === 'rest' &&
          args[2] === '--method' &&
          args[3] === 'post' &&
          args[5] ===
            `https://management.azure.com/subscriptions/${subscription}/providers/Microsoft.KeyVault/checkNameAvailability?api-version=2024-11-01` &&
          args[6] === '--body' &&
          JSON.parse(args[7]).name === candidateNames.keyVault &&
          JSON.parse(args[7]).type === 'Microsoft.KeyVault/vaults'),
      'NON_READ_ONLY_AZURE_COMMAND',
    )
    const original = path.join(directory, entry.responseFile)
    const matches = existsSync(original) && hash(readFileSync(original)) === entry.responseSha256
    const recovered = matches
      ? entry.responseFile
      : retained.find(
          (name) => hash(readFileSync(path.join(directory, name))) === entry.responseSha256,
        )
    return {
      ledgerIndex: index + 1,
      name: entry.name,
      status: entry.status,
      exitCode: entry.exitCode,
      command: entry.command,
      mutation: false,
      responseSha256: entry.responseSha256,
      retainedMatchingResponse: recovered ?? null,
      retentionStatus: recovered ? 'DIGEST_VERIFIED_RETAINED' : 'HISTORICAL_RESPONSE_NOT_RETAINED',
      limitation: recovered
        ? null
        : 'Initial collector reused response aliases before unique sequence filenames were introduced;this earlier failed transport response was overwritten. Recorded call,exit status and original SHA remain;do not fabricate its bytes.',
    }
  })
}
function priceSelections() {
  const pick = (file, predicate) => {
    const result = read(file).items.filter(predicate)
    assert(result.length === 1, `EXACT_PRICE_SELECTION_REQUIRED:${file}:${result.length}`)
    const item = result[0]
    assert(item.currencyCode === 'CAD' && item.isPrimaryMeterRegion, 'PRIMARY_CAD_METER_REQUIRED')
    return {
      meterId: item.meterId,
      productName: item.productName,
      skuName: item.skuName,
      meterName: item.meterName,
      armRegionName: item.armRegionName,
      currency: item.currencyCode,
      unitOfMeasure: item.unitOfMeasure,
      retailPrice: item.retailPrice,
      effectiveStartDate: item.effectiveStartDate,
      sourceFile: file,
    }
  }
  const global = (item) => item.armRegionName === 'Global'
  return {
    activeCpu: pick(
      'pricing-Azure-Container-Apps.json',
      (item) => item.meterName === 'Standard vCPU Active Usage',
    ),
    activeMemory: pick(
      'pricing-Azure-Container-Apps.json',
      (item) => item.meterName === 'Standard Memory Active Usage',
    ),
    requests: pick(
      'pricing-Azure-Container-Apps.json',
      (item) => item.meterName === 'Standard Requests',
    ),
    logIngestion: pick(
      'pricing-Log-Analytics.json',
      (item) => item.meterName === 'Analytics Logs Data Ingestion' && item.retailPrice > 0,
    ),
    vaultPrivateEndpoint: pick(
      'pricing-Virtual-Network-global-fallback.json',
      (item) => global(item) && item.meterName === 'Standard Private Endpoint',
    ),
    privateEndpointData: pick(
      'pricing-Virtual-Network-global-fallback.json',
      (item) =>
        global(item) &&
        item.meterName === 'Standard Data Processed - Ingress' &&
        item.tierMinimumUnits === 0,
    ),
    privateDnsZone: pick(
      'pricing-Azure-DNS-global-fallback.json',
      (item) =>
        item.armRegionName === '' &&
        item.meterName === 'Private Zone' &&
        item.tierMinimumUnits === 0,
    ),
    privateDnsQueries: pick(
      'pricing-Azure-DNS-global-fallback.json',
      (item) => item.armRegionName === '' && item.meterName === 'Private Queries',
    ),
    loadBalancer: pick(
      'pricing-Load-Balancer-global-fallback.json',
      (item) => global(item) && item.meterName === 'Standard Included LB Rules and Outbound Rules',
    ),
    loadBalancerData: pick(
      'pricing-Load-Balancer-global-fallback.json',
      (item) => global(item) && item.meterName === 'Standard Data Processed',
    ),
    firewallData: pick(
      'pricing-Azure-Firewall-global-fallback.json',
      (item) => global(item) && item.meterName === 'Basic Data Processed',
    ),
    potentialPlatformEgressIp: pick(
      'pricing-Virtual-Network-global-fallback.json',
      (item) => global(item) && item.meterName === 'Standard IPv4 Static Public IP',
    ),
    unselectedBuilderCpu: pick(
      'pricing-Virtual-Machines.json',
      (item) => item.productName === 'Virtual Machines BS Series',
    ),
    unselectedBuilderDisk: pick(
      'pricing-Storage.json',
      (item) =>
        item.productName === 'Standard SSD Managed Disks' && item.meterName === 'E4 LRS Disk',
    ),
  }
}
export function buildReadiness() {
  const account = read('account.json')
  assert(account.id === subscription, 'WRONG_CENSUS_SUBSCRIPTION')
  const ledger = read('azure-read-only-ledger.json')
  assert(
    ledger.every((entry) => entry.status === 'SUCCEEDED' || entry.status === 'FAILED'),
    'UNFINISHED_AZURE_CALL',
  )
  const audit = reconcileLedger(ledger)
  assert(
    audit.every((entry) => entry.status !== 'SUCCEEDED' || entry.retainedMatchingResponse),
    'SUCCESSFUL_AZURE_RESPONSE_NOT_RETAINED',
  )
  verifyReadSnapshots(ledger)
  verifyPriceSnapshots(read('public-pricing-read-ledger.json'))
  const providers = [
    'Microsoft.App',
    'Microsoft.ContainerRegistry',
    'Microsoft.ManagedIdentity',
    'Microsoft.Network',
    'Microsoft.KeyVault',
    'Microsoft.OperationalInsights',
    'Microsoft.Insights',
    'Microsoft.Authorization',
  ].map((namespace) => ({
    namespace,
    registration: read(`provider-${namespace}.json`).registrationState,
  }))
  const regionResources = [
    ['Microsoft.App', 'managedEnvironments'],
    ['Microsoft.App', 'containerApps'],
    ['Microsoft.KeyVault', 'vaults'],
    ['Microsoft.Network', 'privateEndpoints'],
    ['Microsoft.Network', 'virtualNetworks'],
    ['Microsoft.Network', 'networkSecurityGroups'],
    ['Microsoft.Network', 'routeTables'],
    ['Microsoft.ManagedIdentity', 'userAssignedIdentities'],
    ['Microsoft.OperationalInsights', 'workspaces'],
  ].map(([namespace, type]) => ({
    namespace,
    type,
    subscriptionVisibleCanadaCentral:
      read(`provider-${namespace}.json`)
        .resourceTypes.find((entry) => entry.resourceType.toLowerCase() === type.toLowerCase())
        ?.locations.includes('Canada Central') === true,
    evidence: `provider-${namespace}.json`,
  }))
  const usage = read('aca-regional-usage.json').value
  const environments = usage.find((item) => item.name.value === 'ManagedEnvironmentCount')
  assert(environments, 'MANAGED_ENVIRONMENT_QUOTA_REQUIRED')
  const netQuota = read('network-regional-usage.json').value
  const requirements = {
    VirtualNetworks: 1,
    NetworkSecurityGroups: 1,
    RouteTables: 1,
    PrivateEndpoints: 1,
    NetworkInterfaces: 2,
    StandardSkuLoadBalancers: 1,
    PublicIPAddresses: 0,
  }
  const networkQuota = Object.entries(requirements).map(([name, required]) => {
    const item = netQuota.find((item) => item.name.value === name)
    assert(item, `MISSING_NETWORK_USAGE:${name}`)
    return {
      name,
      current: item.currentValue,
      limit: item.limit,
      required,
      headroom: item.limit - item.currentValue,
      sufficient: item.limit - item.currentValue >= required,
    }
  })
  const groups = read('resource-groups.json')
  const resources = read('resources.json')
  assert(!groups.nextLink && !resources.nextLink, 'COLLISION_CENSUS_INCOMPLETE')
  const groupAbsent = !groups.value.some(
    (item) => item.name.toLowerCase() === candidateNames.resourceGroup,
  )
  const globalNameCheck = read('g3-key-vault-global-name.json')
  const scopedNames = Object.entries(candidateNames).filter(
    ([key]) =>
      ![
        'resourceGroup',
        'acaSubnet',
        'privateEndpointSubnet',
        'builderSubnet',
        'keyVaultDnsZone',
      ].includes(key),
  )
  const collisions = scopedNames.map(([kind, name]) => ({
    kind,
    name,
    subscriptionInventoryMatch: resources.value
      .filter((item) => item.name.toLowerCase() === name.toLowerCase())
      .map((item) => item.id),
    globalNamespaceAvailable:
      kind === 'keyVault' ? globalNameCheck.nameAvailable : 'NOT_APPLICABLE_OR_PARENT_SCOPED',
    globalCheckEvidence:
      kind === 'keyVault'
        ? 'g3-key-vault-global-name.json;documented non-reserving checkNameAvailability POST'
        : null,
  }))
  const vnets = read('vnets.json')
  assert(!vnets.nextLink, 'VNET_CENSUS_INCOMPLETE')
  const existingCidrs = vnets.value.flatMap((vnet) =>
    vnet.properties.addressSpace.addressPrefixes.map((cidr) => ({ vnet: vnet.id, cidr })),
  )
  const noOverlap = existingCidrs.every((existing) => !overlaps(existing.cidr, candidateCidrs.vnet))
  const subnets = Object.entries(candidateCidrs).filter(([key]) => key !== 'vnet')
  const contained = subnets.every(([, cidr]) => {
    const [start, end] = cidrRange(cidr),
      [parentStart, parentEnd] = cidrRange(candidateCidrs.vnet)
    return start >= parentStart && end <= parentEnd
  })
  const siblingOverlap = subnets.some(([, a], index) =>
    subnets.some(([, b], other) => other > index && overlaps(a, b)),
  )
  const profiles = read('aca-environments.json').value.filter((environment) =>
    environment.properties.workloadProfiles?.some(
      (profile) => profile.workloadProfileType === 'Consumption',
    ),
  )
  const allAssignments = read('role-assignments.json')
  const definitions = read('role-definitions.json')
  const servicePrincipals = read('service-principals.json')
  const apps = read('deployment-applications.json')
  assert(
    !allAssignments.nextLink &&
      !definitions.nextLink &&
      !servicePrincipals['@odata.nextLink'] &&
      !apps['@odata.nextLink'],
    'IDENTITY_CENSUS_PAGINATION_INCOMPLETE',
  )
  const assignments = allAssignments.value.filter(
    (entry) => entry.properties.principalType === 'ServicePrincipal',
  )
  const principals = [...new Set(assignments.map((entry) => entry.properties.principalId))].map(
    (principalId) => {
      const principal = servicePrincipals.value.find((entry) => entry.id === principalId)
      const federationFile = `federation-${principalId}.json`
      const federation = existsSync(path.join(directory, federationFile))
        ? read(federationFile).value
        : []
      return {
        principalId,
        appId: principal?.appId ?? null,
        type: principal?.servicePrincipalType ?? 'NOT_RESOLVED',
        displayName: principal?.displayName ?? 'NOT_RESOLVED',
        federation: federation.map(({ issuer, subject, audiences }) => ({
          issuer,
          subject,
          audiences,
        })),
        grants: assignments
          .filter((entry) => entry.properties.principalId === principalId)
          .map((entry) => ({
            role:
              definitions.value.find(
                (role) => role.id.toLowerCase() === entry.properties.roleDefinitionId.toLowerCase(),
              )?.properties.roleName ?? 'NOT_RESOLVED',
            scope: entry.properties.scope,
            condition: entry.properties.condition ?? null,
          })),
        lifecycleOwner: 'NOT_BOUND_IN_G3_AUTHORITY',
        currentUse: federation.map((entry) => entry.subject),
        selectedForG3: false,
      }
    },
  )
  const g3Grants = assignments.filter((entry) =>
    entry.properties.scope
      .toLowerCase()
      .includes(`/resourcegroups/${candidateNames.resourceGroup}`),
  )
  const prices = priceSelections()
  const idleKnownStandingSubtotal =
    730 * (prices.vaultPrivateEndpoint.retailPrice + prices.loadBalancer.retailPrice) +
    2 * prices.privateDnsZone.retailPrice
  const capturedAt = ledger.filter((entry) => entry.status === 'SUCCEEDED').at(-1).completedAtUtc
  const g2SourceFiles = [
    'G2_PRIVATE_CONTROL_PLANE_EVIDENCE.md',
    'g2-proof.bicep',
    'g2-artifact-foundation.bicep',
    'g2-artifact-network.bicep',
    'synthetic-health/server.mjs',
    'synthetic-health/Dockerfile',
  ]
  const sourceHashes = Object.fromEntries(
    g2SourceFiles.map((file) => [file, hash(readFileSync(path.join(root, file)))]),
  )
  const blockers = [
    {
      id: 'G3-PRIOR-AUTHORITY-PACKAGE-MISSING',
      fact: 'The visible workspace contains G2 templates and an older synthetic-health source, but none of the referenced seven G3 modules, G3A/G3B controllers, qualified 3,271,902-byte image source/provenance, or sealed G2 terminal-root packet.',
      needed:
        'Bind read-only paths/digests for the existing frozen G3 readiness/source/controller/module packet and sealed G2 terminal record. Do not rebuild another artifact and claim the supplied digest.',
    },
    {
      id: 'G3-CAPACITY-LIMITS-NOT-PREPROVEN',
      fact: 'Regional managed-environment quota and network quotas have headroom. The new environment consumption-core limit is environment-scoped and cannot be read for an environment that does not exist. Microsoft.ManagedIdentity regional usages is not an exposed resource type at the attempted API.',
      needed:
        'An accepted pre-execution capacity assurance path for 0.25 Consumption vCPU and two UAMIs; record documented limits/support/capacity evidence rather than treating inventory count or missing API as unlimited quota.',
    },
    {
      id: 'G3-OPERATOR-GRANTS-AND-ACCOUNTABILITY-UNBOUND',
      fact: 'Existing GitHub-federated build/staging principals are visible, but their grants target legacy resources. No G3 scope grants were returned. Subscription-wide Contributors are unsuitable shortcuts. Nonpersonal lifecycle ownership and the accountable G3 human governance approver are not bound by this packet.',
      needed:
        'Select an appropriate existing nonpersonal operator with its lifecycle owner and separate human approver; approve exact future G3A/G3B scoped grants. No grants created here.',
    },
    {
      id: 'G3-FIREWALL-TRANSIT-AND-DNS-UNBOUND',
      fact: 'The retained G2 firewall is Basic at 10.90.0.4; the returned application/network rule collections are empty and no G2 VNet peerings exist. A G3 VNet 10.91.0.0/16 route to that private firewall is not currently reachable. Private ACR DNS/link/transit and exact ACA platform/telemetry egress are not wired.',
      needed:
        'Bind a governed routing/peering/DNS/allowlist design and reconcile any future changes to retained G2 against its sealed terminal authority;no associations or rules changed now.',
    },
    {
      id: 'G3-CONTROLLERS-BICEP-AND-PROOF-MECHANICS-INCOMPLETE',
      fact: 'The supplied qualified image cannot be inspected locally from its authority packet. Existing visible G2 health code has only two health routes and no secret challenge. No G3 top-level transaction/controllers are available to compile or to prove ownership, one bounded push, negative authorization, rollback and retained-state reconciliation.',
      needed:
        'Complete the existing G3A/G3B package from its recovered source authority, including the private builder, artifact-preserving secret proof, repository-conditioned pull/write bindings, lifecycle None/Main, secret-scoped runtime role, and negative probes. Do not execute it.',
    },
    {
      id: 'G3-COST-TOTAL-AND-HUMAN-CEILING-UNRESOLVED',
      fact: 'Current CAD compute/network/DNS/logging meters are captured. Exact applicable normal-vault secret-operation and nonreplicated ACR excess-storage meter mappings are not finalized; builder selection, proof durations/log/traffic budgets and platform-managed egress-IP billing treatment are unbound. No acceptable hard cost ceiling was supplied by the human risk owner.',
      needed:
        'Finalize all material incremental quantities/meters and complete proof/idle totals; propose at least 1.5x contingency for explicit human approval. Do not count existing G2 firewall base cost or ACA Private Endpoint charges.',
    },
  ]
  if (!globalNameCheck.nameAvailable)
    blockers.push({
      id: 'G3-KEY-VAULT-GLOBAL-NAME-COLLISION',
      fact: `Non-reserving name check did not confirm ${candidateNames.keyVault} as available.`,
      needed:
        'Bind another valid deterministic candidate and rerun only its nonmutating name check;no reservation or creation.',
    })
  return {
    mission: 'NZ-20261008-INFRA-001',
    gate: 'G3_PRIVATE_APPLICATION_SUBSTRATE',
    capturedAtUtc: capturedAt,
    subscriptionId: subscription,
    status: {
      G2_PRIVATE_CONTROL_PLANE: 'PASS_ACCEPTED_FROM_USER_NOT_REEXECUTED',
      G3_EXECUTION_READINESS: 'BLOCKED',
      G3_PROVIDER_REGISTRATION: providers.every((entry) => entry.registration === 'Registered')
        ? 'PASS'
        : 'BLOCKED',
      G3_REGION_AVAILABILITY:
        regionResources.every((entry) => entry.subscriptionVisibleCanadaCentral) && profiles.length
          ? 'PASS'
          : 'BLOCKED',
      G3_QUOTA_STATUS: 'BLOCKED',
      G3_RESOURCE_GROUP_COLLISION: groupAbsent ? 'PASS' : 'FAIL',
      G3_NAME_COLLISION_CHECK:
        collisions.every((entry) => entry.subscriptionInventoryMatch.length === 0) &&
        globalNameCheck.nameAvailable
          ? 'PASS'
          : 'FAIL',
      G3_NETWORK_ADDRESS_PLAN: noOverlap && contained && !siblingOverlap ? 'PASS' : 'FAIL',
      G3_FIREWALL_UDR_MODEL: 'BLOCKED',
      G3_OPERATOR_PRINCIPAL_CANDIDATE: 'NONE',
      G3_GOVERNANCE_APPROVER: 'UNBOUND_NO_PERSONAL_IDENTIFIERS_STORED',
      G3_PULL_IDENTITY_CONTRACT: 'BLOCKED',
      G3_RUNTIME_IDENTITY_CONTRACT: 'BLOCKED',
      G3_SECRET_PROOF_CONTRACT: 'BLOCKED',
      G3A_PRODUCTION_SUBSTRATE: 'BLOCKED',
      G3A_BICEP_LOCAL_BUILD: 'FAIL',
      G3B_BICEP_LOCAL_BUILD: 'FAIL',
      G3_PROOF_COST_CEILING_CAD: 'UNRESOLVED',
      G3_CANDIDATE_IDLE_MONTHLY_COST_CAD: 'UNRESOLVED',
      G3_PLATFORM_EGRESS_BREADTH: platformEgress.G3_PLATFORM_EGRESS_BREADTH,
      G3_SERVICE_TAG_EGRESS_LIMITATION: platformEgress.G3_SERVICE_TAG_EGRESS_LIMITATION,
      G3_ACA_PRIVATE_ENDPOINT: 'NOT_REQUIRED',
      G3_ARTIFACT_EXECUTION_SPLIT: 'G3A_G3B',
      TARGET_REGISTRY_IMAGE_PRESENT: 'NOT_PROVEN',
      G3_TECHNICAL_EXECUTION_AUTHORIZED: 'NO',
      APPLICATION_ROLLOUT_AUTHORIZED: 'NO',
      PRODUCTION_DATA_AUTHORIZED: 'NO',
      AZURE_MUTATIONS: 0,
      REGISTRY_MUTATIONS: 0,
      G2_TERMINAL_ROOT_UNCHANGED: 'NOT_PROVEN_SEALED_ROOT_PACKET_NOT_PRESENT;noG2mutation',
      UE_INFRA: 'INFRA_NO_GO',
      CORA_INFRA: 'INFRA_NO_GO',
    },
    frozenDesign: {
      runtime: 'AZURE_CONTAINER_APPS',
      environmentType: 'WORKLOAD_PROFILES',
      workloadProfile: 'CONSUMPTION',
      accessibility: 'INTERNAL',
      acaPrivateEndpoint: 'NOT_REQUIRED',
      distinction: 'INTERNAL_ENVIRONMENT != PUBLIC_ENVIRONMENT_WITH_PRIVATE_ENDPOINT',
      image: {
        repository: 'g3-synthetic-runtime',
        tag: 'g3-2f0866acebb61f7aaa7216c2b8e952b934f04b835e93f49178d884a71040c1ad',
        manifest: 'sha256:1a6085926ff5fd78cc81bb2fb6df8ceb9bc62660e3222bbe088e47807a91bb61',
        platform: 'linux/amd64',
        blobSize: 3271902,
        qualification: 'FROZEN_USER_ASSERTION;local source/provenance authority unavailable',
        registryPresence: 'NOT_PROVEN',
        pushed: false,
      },
      capacityCandidate: {
        cpu: 0.25,
        memoryGiB: 0.5,
        minReplicas: 0,
        maxReplicas: 1,
        verification:
          'Keep one replica active during future proof;scale-to-zero only after validation. Qualified-image resource compatibility not re-proven.',
      },
      pullIdentity: 'SEPARATE_PULL_UAMI_PLATFORM_ONLY_LIFECYCLE_NONE',
      runtimeIdentity: 'SEPARATE_RUNTIME_UAMI_MAIN_ONLY_SECRET_SCOPED_NO_ACR',
      resourceGroup: candidateNames.resourceGroup,
    },
    ledger: {
      azureCalls: ledger.length,
      successful: ledger.filter((entry) => entry.status === 'SUCCEEDED').length,
      failed: ledger.filter((entry) => entry.status === 'FAILED').length,
      source: 'azure-read-only-ledger.json',
      audit,
      publicPricingCalls: read('public-pricing-read-ledger.json').length,
      publicPricingSource: 'public-pricing-read-ledger.json',
      unretainedHistoricalResponses: audit.filter((entry) => !entry.retainedMatchingResponse)
        .length,
      noAzureValidationOrWhatIfPerformed: true,
      noCredentialsOrSecretValuesQueried: true,
      nonReservingNameCheckPost: {
        endpoint: 'Microsoft.KeyVault/checkNameAvailability',
        apiVersion: '2024-11-01',
        mutation: false,
        result: globalNameCheck,
        documentation:
          'https://learn.microsoft.com/en-us/rest/api/keyvault/keyvault/vaults/check-name-availability?view=rest-keyvault-keyvault-2024-11-01',
      },
      initialTransportLimitation:
        'First Windows cmd transport split Graph URLs at ampersands. All attempted calls/status/originalSHA are retained;one earlier failed stdout alias was overwritten. Corrected paginated GET responses have unique snapshots. This is a declared retention limitation,not a successful capacity or permission proof.',
    },
    live: {
      providers,
      regionResources,
      regionSupportCeiling:
        'Provider metadata/existingConsumption environments prove subscription-visible regional support,not reserved capacity for a new environment.',
      existingCanadaCentralConsumptionProfiles: profiles.map((environment) => ({
        name: environment.name,
        profiles: environment.properties.workloadProfiles,
      })),
      managedEnvironmentQuota: {
        current: environments.currentValue,
        limit: environments.limit,
        required: 1,
        headroom: environments.limit - environments.currentValue,
      },
      consumptionCoreQuota: {
        scope: 'One managed environment',
        targetEnvironmentExists: false,
        current: null,
        limit: null,
        required: 0.25,
        status: 'NOT_QUERYABLE_BEFORE_TARGET_ENVIRONMENT_EXISTS',
        source: 'https://learn.microsoft.com/en-us/azure/container-apps/quotas',
      },
      networkQuota,
      managedIdentityQuota: {
        existingSubscriptionCount: read('managed-identities.json').value.length,
        required: 2,
        limit: null,
        note: 'Microsoft.ManagedIdentity regional usages request returned InvalidResourceType;inventory count is not quota assurance.',
      },
      currentVnets: existingCidrs,
      g2Firewall: read('firewalls.json').value.map((firewall) => ({
        id: firewall.id,
        sku: firewall.properties.sku,
        ips: firewall.properties.ipConfigurations.map((entry) => entry.properties.privateIPAddress),
        applicationRules: firewall.properties.applicationRuleCollections,
        networkRules: firewall.properties.networkRuleCollections,
      })),
      g2Peerings: read('g2-peering-corrected.json').value,
      operatorCandidates: principals,
      g3RoleAssignmentsReturned: g3Grants.length,
      managementGroupOrPimOrDirectoryGroupEffectiveGrants:
        'NOT_FULLY_RESOLVED;subscription assignments and directprincipal metadata are not complete effective-permission proof',
      registryMode: {
        responseFile: 'g2-registry-mode-latest-stable.json',
        apiVersion: '2025-11-01',
        explicitRoleAssignmentMode:
          read('g2-registry-mode-latest-stable.json').properties.roleAssignmentMode ?? null,
        conclusion:
          read('g2-registry-mode-latest-stable.json').properties.roleAssignmentMode ===
          'AbacRepositoryPermissions'
            ? 'ABAC_MODE_PROVEN_BY_EXPLICIT_ARM_GET'
            : 'NOT_PROVEN_FROM_THIS_GET',
      },
    },
    candidateNames,
    nameChecks: collisions,
    cidrs: {
      ...candidateCidrs,
      existingRangesChecked: existingCidrs,
      noOverlap,
      contained,
      siblingOverlap,
      scopeCeiling: 'Visible subscription;no all-tenant/on-prem claim',
      acaDelegation: 'Microsoft.App/environments',
      acaDedicatedSubnet: true,
    },
    platformEgress,
    futureContracts: {
      pull: {
        role: 'Container Registry Repository Reader',
        roleId: 'b93aa761-3e63-49ed-ac28-beffa264f7ac',
        conditionVersion: '2.0',
        repositoryEquals: 'g3-synthetic-runtime',
        conditionMustCover: [
          'Microsoft.ContainerRegistry/registries/repositories/metadata/read',
          'Microsoft.ContainerRegistry/registries/repositories/content/read',
        ],
        lifecycle: 'None',
        acrPullFallback: 'PROHIBITED',
        ACA_ABAC_IMAGE_PULL: 'MUST_PROVE',
        applicationTokenAccess: 'DENIED_MUST_PROVE',
      },
      runtime: {
        lifecycle: 'Main',
        acrRoles: [],
        buildRoles: [],
        role: 'Key Vault Secrets User',
        roleId: '4633458b-17de-408a-b874-0445c86b69e6',
        scope: `.../vaults/${candidateNames.keyVault}/secrets/g3-proof-secret`,
        note: 'Microsoft supports individual-secret RBAC scopes;this intentional synthetic-proof exception must be tested. No claim that the builtin forces vault-level scope. No vault-level fallback.',
        stricterCustomRoleOption:
          'Only Microsoft.KeyVault/vaults/secrets/getSecret/action;if its creation/design is explicitly governed,not created here',
      },
      vault: {
        name: candidateNames.keyVault,
        location: 'canadacentral',
        purpose: 'NEW_G3_SYNTHETIC_KEY_VAULT',
        rbac: true,
        publicNetworkAccess: 'Disabled',
        privateEndpoint: true,
        privateDns: candidateNames.keyVaultDnsZone,
        softDelete: true,
        purgeProtectionDecision:
          'UNBOUND;irreversible enablement/teardown retention must be chosen with cost/lifecycle governance',
        secretName: 'g3-proof-secret',
        secretCount: 1,
        productSecrets: 'PROHIBITED',
        secretValuePersisted: false,
      },
      secretChallenge: {
        protocol:
          'Future cryptographically random single synthetic secret;fresh nonce and HMAC challenge over authenticated proof endpoint. Secret stays inside memory,never health/log/evidence. Bind source support without changing frozen artifact.',
        evidenceFields: [
          'KV_PRIVATE_DNS',
          'KV_PRIVATE_IP',
          'KV_TLS',
          'KV_AUTHORIZATION',
          'SECRET_CHALLENGE',
          'secretIdentifier',
          'nonce',
          'safeHmacResult',
          'PASS_OR_FAIL',
        ],
        privatePath:
          'runtime -> private DNS -> KV private endpoint -> TLS hostname validation -> identity authorization',
        publicFallback: 'PROHIBITED',
        wrongReference:
          '404 may demonstrate an incorrect reference,not authorization denial;an existing protected secret with wrong identity must yield explicit403.',
      },
      g3A: {
        writerRole: 'Container Registry Repository Writer',
        roleId: '2a1e307c-b015-4ebd-883e-5b7698a07328',
        repositoryEquals: 'g3-synthetic-runtime',
        conditionMustCover: ['metadata/read', 'content/read', 'metadata/write', 'content/write'],
        catalogLister: 'NOT_GRANTED',
        registryWideAcrPush: 'PROHIBITED',
        operator: 'NOT_BOUND',
        substrate: 'NOT_BOUND_NO_G2_EXECUTION_AUTHORITY_REUSE',
        oneBoundedPush: 'REQUIRED_NOT_IMPLEMENTED',
        transientVmIfSelected:
          'PrivateNIC,disk,identity,noPublicIP,noSSH,governed bounded execution channel and exact teardown;not yet selected/implemented',
      },
      g3B: {
        operator: 'NOT_BOUND',
        deploymentScope: `/subscriptions/${subscription}/resourceGroups/${candidateNames.resourceGroup}`,
        subscriptionContributorOrOwner: 'PROHIBITED',
        futurePermissionCategories: [
          'Exact transaction-created ACA/identity/network/KV/PE/DNS/LogAnalytics resource management withinG3RG',
          'ManagedIdentity attach permission for exactG3UAMIs',
          'Constrained role-assignment write/delete for exact principals and approved Reader/SecretsUser roles',
          'Read exact evidence and clean only transaction-owned resources',
        ],
        broadBuiltinGap:
          'ContainerApps/Network/ManagedIdentity/KeyVault/LogAnalytics contributor roles are broader than individual owned resources;exact least-privilege/customrole set cannot be finalized without the controller/resource-ownership manifest. No subscription-wide substitution.',
        retainedG2Changes:
          'Require explicit terminal-state reconciliation and fresh authority before any network/DNS/registry alteration',
      },
      negativeProofs: [
        {
          name: 'IMAGE_PULL_IDENTITY_OTHER_REPOSITORY_READ',
          identity: 'PULL_UAMI',
          request: 'GET /v2/<existingOtherRepository>/manifests/<boundDigest>',
          endpoint: 'private target ACR',
          expected: '403or insufficient_scope,never404-only',
          missing: 'Other existing repository/digest fixture and exact token/evidence mechanics',
        },
        {
          name: 'IMAGE_PULL_IDENTITY_REGISTRY_WRITE',
          identity: 'PULL_UAMI',
          request: 'POST /v2/g3-synthetic-runtime/blobs/uploads/',
          endpoint: 'private target ACR',
          expected: 'explicitauthorization denial',
          missing:
            'Unexpectedsuccess cleanup and one-shot mutation-containment authority in future controller',
        },
        {
          name: 'RUNTIME_IDENTITY_ACR_READ',
          identity: 'RUNTIME_UAMI',
          request: 'GET approvedrepository manifest by frozen digest',
          endpoint: 'private target ACR',
          expected: 'explicitauthorization denial,notnetwork timeout',
        },
        {
          name: 'RUNTIME_IDENTITY_ACR_WRITE',
          identity: 'RUNTIME_UAMI',
          request: 'POST approvedrepository upload initiation',
          endpoint: 'private target ACR',
          expected: 'explicitauthorization denial;unexpectedsuccess isFAIL/containment',
        },
        {
          name: 'RUNTIME_IDENTITY_BUILD_REPOSITORY_ACCESS',
          identity: 'RUNTIME_UAMI',
          request: 'GET existingg2-tooling manifest byboundDigest',
          endpoint: 'private target ACR',
          expected: 'explicitauthorization denial;fixture mustexist',
        },
        {
          name: 'RUNTIME_IDENTITY_UNAUTHORIZED_SECRET_READ',
          identity: 'RUNTIME_UAMI plusseparate unauthorizedidentity control',
          request:
            'GET /secrets/<unauthorizedReference>?api-version=<boundVersion>;wrongidentityGET existingg3-proof-secret',
          endpoint: 'private KeyVaultTLSendpoint',
          expected:
            '403withKeyVaultauthorizationcode forwrongidentity;404fornonexistentreference isnotpermissionproof',
        },
        {
          name: 'PUBLIC_CONTAINER_APP_ACCESS',
          identity: 'untrustedexternalprobe',
          request: 'HTTPS GET health on bound internalappFQDN fromoutsideVNet',
          endpoint: 'internalACA',
          expected:
            'noreachablepublicroute;privateDNS/IPandtimeout/refusal evidence;notanRBAC403claim',
        },
      ],
      denialEvidence: [
        'identityResourceId',
        'requestMethod',
        'sanitizedEndpoint',
        'knownExistingFixture',
        'DNS/IP',
        'TLS/connectivityControl',
        'HTTPstatus',
        'authorizationErrorCode',
        'correlationId',
        'safeBodyDigest',
        'PASS_OR_FAIL;never tokens/secretvalues',
      ],
    },
    costs: {
      status: 'UNRESOLVED_NO_HARD_CEILING_APPROVED',
      currency: 'CAD',
      prices,
      noFreeAllowanceAssumed: true,
      ACA_PRIVATE_ENDPOINT_COST: 'EXCLUDED_NOT_SELECTED',
      DEDICATED_MANAGEMENT_CHARGE:
        'NOT_TRIGGERED_BY_SELECTED_CONSUMPTION_ONLY_INTERNAL_ENVIRONMENT;do not adddedicatedprofile/ACAprivateendpoint/plannedmaintenance',
      existingG2FirewallBaseIncremental: 0,
      incrementalG2FirewallData: prices.firewallData,
      idleKnownStandingSubtotalCAD: Number(idleKnownStandingSubtotal.toFixed(6)),
      idleSubtotalDefinition:
        'Illustrative subtotal:730h * (1KVPE + 1standardLB<=5rules) + 2newly-billed privateDNSzones. Not the selected candidate total;reusing the existing G2 ACR DNS zone does not add another zone base charge. Scalezero ACA compute=0;all unknown charges remain unresolved.',
      potentialPlatformEgressPublicIpMonthlyCAD: Number(
        (730 * prices.potentialPlatformEgressIp.retailPrice).toFixed(6),
      ),
      publicIpDecision:
        'No user-managed G3publicIP selected. Microsoft custom-VNet docs also list a managed egressIP charge;exact UDR/internal deployment charge treatment must be resolved,not silently zeroed.',
      missing: [
        'Exact standardsecretoperation primarymeter mapping',
        'Nonreplicated ACR excessstorage meter and includedstorageheadroom;replication meter isnot a substitute',
        'Qualified G3A builder and source/tooling/network/disktransaction budgets',
        'Proof resource duration,requests,DNS,logs,data processing/peeringtraffic quantities and enforcedtermination',
        'G3-specific platformmanaged publicIP charges under UDR',
        'Human acceptable hard proof ceiling with contingency',
      ],
      contingencyRule:
        'Propose >=1.5 * complete expected proofcost;human approval is not implied by arithmetic',
    },
    localValidation: {
      scope:
        'READ_ONLY_COLLECTORS_AND_OFFLINE_REPORT_ONLY;not G3A/G3B executable-package validation',
      nodeRegression: {
        command: 'node --test infrastructure\\landing-zone\\g3-readiness-report.test.mjs',
        result: 'PASS',
        tests: 75,
      },
      powershellPolicy: {
        command: '& .\\infrastructure\\landing-zone\\g3-readiness-census.test.ps1',
        result: 'PASS',
        rejectedCommandsAndStages: 15,
        azureCalls: 0,
      },
      syntax: {
        commands: [
          'node --check infrastructure\\landing-zone\\g3-public-pricing.mjs',
          'node --check infrastructure\\landing-zone\\g3-readiness-report.mjs',
          'node --check infrastructure\\landing-zone\\g3-readiness-report.test.mjs',
        ],
        result: 'PASS',
      },
      formatting: {
        command:
          'pnpm exec prettier --check infrastructure\\landing-zone\\g3-public-pricing.mjs infrastructure\\landing-zone\\g3-readiness-report.mjs infrastructure\\landing-zone\\g3-readiness-report.test.mjs',
        result: 'PASS',
      },
      generation: {
        command: 'node infrastructure\\landing-zone\\g3-readiness-report.mjs --check --self-test',
        result: 'PASS',
      },
      documentation: {
        command: 'pnpm validate:docs',
        result: 'PASS_NO_CRITICAL_ERRORS;existing warnings/info remain',
      },
      scopedLint: {
        command:
          'pnpm exec eslint infrastructure\\landing-zone\\g3-public-pricing.mjs infrastructure\\landing-zone\\g3-readiness-report.mjs infrastructure\\landing-zone\\g3-readiness-report.test.mjs',
        result: 'FAILED_CONFIGURATION_NOT_FOUND',
        detail:
          'Installed ESLint9 has no root eslint.config.*. No new lint configuration was introduced and no lint pass is claimed.',
      },
    },
    preservation: {
      localG2SourceHashes: sourceHashes,
      localG2FilesEdited: 0,
      sealedG2TerminalRoot: 'NOT_AVAILABLE_IN_THIS_WORKSPACE',
      noG2ExecutionAuthorityReused: true,
      noG3ControllerExecuted: true,
      noImageBuildPushImport: true,
      noAzureDeploymentValidationWhatIf: true,
      noEntraOrRbacMutation: true,
      g3aLocalBuildAttempt: 'NOT_RUN_FROZEN_PACKAGE_NOT_AVAILABLE',
      g3bLocalBuildAttempt: 'NOT_RUN_FROZEN_PACKAGE_NOT_AVAILABLE',
      buildStatusMeaning:
        'Required PASS|FAIL output uses FAIL because no passing build evidence exists;not an observed Bicep compiler failure.',
    },
    documents: [
      platformEgress.source,
      'https://learn.microsoft.com/en-us/azure/container-apps/managed-identity',
      'https://learn.microsoft.com/en-us/azure/container-apps/custom-virtual-networks',
      'https://learn.microsoft.com/en-us/azure/container-apps/networking',
      'https://learn.microsoft.com/en-us/azure/container-apps/quotas',
      'https://learn.microsoft.com/en-us/azure/container-apps/billing',
      'https://learn.microsoft.com/en-us/azure/container-apps/containers',
      'https://learn.microsoft.com/en-us/azure/container-registry/container-registry-rbac-abac-repository-permissions',
      'https://learn.microsoft.com/en-us/azure/key-vault/general/rbac-guide',
      'https://prices.azure.com/api/retail/prices?api-version=2023-01-01-preview',
    ],
    blockers,
    smallestFurtherReadinessAuthority: {
      subject: 'READ_ONLY_G3_AUTHORITY_BINDING_AND_LOCAL_PACKAGE_COMPLETION',
      needs: [
        'Supply frozen priorG3 package and sealedG2 terminalroot paths/digests',
        'Bind nonpersonal lifecycle/operator selection and separate accountable humanapprover',
        'Bind capacity assurance path',
        'Bind exact G2 transit/DNS and G3 repository-scoped grant authority without consuming G2 execution',
        'Complete local controllers/top-levelBicep/challenge/negativefixtures and CAD totals',
        'Approve proposed proofcostceiling after complete model',
      ],
      azureResourceMutations: 'NOT_AUTHORIZED',
      g3AExecution: 'NOT_AUTHORIZED',
      g3BExecution: 'NOT_AUTHORIZED',
      productionDataAndProductDeployment: 'NOT_AUTHORIZED',
    },
  }
}
export async function generateReadiness() {
  const model = buildReadiness()
  const config = await resolveConfig(path.join(root, '..', '..', 'package.json'))
  const providerRows = model.live.providers
    .map((item) => `| ${item.namespace} | ${item.registration} |`)
    .join('\n')
  const quotaRows = model.live.networkQuota
    .map(
      (item) =>
        `| ${item.name} | ${item.current} | ${item.limit} | ${item.required} | ${item.headroom} |`,
    )
    .join('\n')
  const priceRows = Object.entries(model.costs.prices)
    .map(
      ([key, item]) =>
        `| ${key} | ${item.meterName} | ${item.armRegionName || 'Global meter'} | ${item.retailPrice} | ${item.unitOfMeasure} |`,
    )
    .join('\n')
  const blockers = model.blockers
    .map((blocker) => `### ${blocker.id}\n\n${blocker.fact}\n\nRequired: ${blocker.needed}\n`)
    .join('\n')
  const names = Object.entries(model.candidateNames)
    .map(([key, name]) => `| ${key} | ${name} |`)
    .join('\n')
  const text = `# G3 execution readiness live account closure — BLOCKED

Mission \`NZ-20261008-INFRA-001\`. Account facts captured ${model.capturedAtUtc}. Subscription \`${subscription}\`. All Azure calls are account-show, explicit GET, or the documented non-reserving Key Vault name-availability POST. No deployment, what-if, resource mutation, RBAC changes, ACR push/import, secret access or guest execution occurred.

## Closed census facts

All eight required providers are registered; Canada Central provider metadata supports the nine checked resource types. Two existing Canada Central environments have explicit Consumption workload profiles. This proves regional/subscription visibility, not reserved capacity for a future environment.

The G3 resource group is absent. Proposed \`10.91.0.0/16\` does not overlap visible \`10.1.0.0/16\` or G2 \`10.90.0.0/16\`. ACA \`10.91.1.0/24\` is dedicated and delegated to \`Microsoft.App/environments\`; PE \`10.91.2.0/24\` and future builder \`10.91.3.0/24\` are distinct. Workload profiles require at least /27; this /24 has proof headroom, not a Consumption-only /23 assumption.

The registry GET using subscription-supported stable API 2025-11-01 returned \`roleAssignmentMode=AbacRepositoryPermissions\`. ABAC mode is now proven explicitly; the older API's absent field is not used as the conclusion. G3 repository-conditioned grants and future ACA image-pull proof still belong to the unexecuted package.

| Provider | Live state |
|---|---|
${providerRows}

Managed environment count: ${model.live.managedEnvironmentQuota.current}/${model.live.managedEnvironmentQuota.limit}; proof requires one, with headroom ${model.live.managedEnvironmentQuota.headroom}. The new environment's Consumption cores quota is environment-scoped and not queryable before it exists. An unavailable identity usages API is not unlimited quota.

| Network quota | Current | Limit | Proposed additional | Remaining before proof |
|---|---|---|---|---|
${quotaRows}

## Surviving blockers

${blockers}

## Candidate names and authority ceiling

These deterministic candidates are local planning metadata, not reservations or deployment permission. No subscription name matches were returned; the documented non-reserving Key Vault name check returned \`nameAvailable=${model.ledger.nonReservingNameCheckPost.result.nameAvailable}\`. Future execution must recheck collisions.

| Resource | Candidate |
|---|---|
${names}

The exact prior G3 source/image authority is not present. The supplied image freeze is preserved:

- Repository: \`g3-synthetic-runtime\`
- Tag: \`g3-2f0866acebb61f7aaa7216c2b8e952b934f04b835e93f49178d884a71040c1ad\`
- Manifest: \`sha256:1a6085926ff5fd78cc81bb2fb6df8ceb9bc62660e3222bbe088e47807a91bb61\`
- Platform: \`linux/amd64\`; blob size: 3,271,902 bytes.

TARGET_REGISTRY_IMAGE_PRESENT=NOT_PROVEN. Existing G2 health source is not substituted for the qualified G3 image.

## Accepted platform egress and private topology

G3_PLATFORM_EGRESS_BREADTH=ACCEPTED_FOR_SYNTHETIC_PROOF.
G3_SERVICE_TAG_EGRESS_LIMITATION=ACCEPTED_AND_DOCUMENTED.
Exact categories, FQDNs, service tags and DNS \`168.63.129.16:53\` are in [the JSON report](./G3_EXECUTION_READINESS.json). Use the documented tag \`AzureFrontDoorFirstParty\`, not the dotted spelling. Docker Hub runtime egress is prohibited.
Acceptance is only for documented Microsoft platform dependencies, not arbitrary Internet, tenant-exclusive isolation, exfiltration-proofing or production certification. Existing firewall rule collections are empty, no peering exists, and no new rules/routes/associations were made.

G3_ACA_PRIVATE_ENDPOINT=NOT_REQUIRED. INTERNAL_ENVIRONMENT != PUBLIC_ENVIRONMENT_WITH_PRIVATE_ENDPOINT. No ACA Private Endpoint or associated Dedicated Plan Management charge is included. Key Vault Private Endpoint/private DNS remains required.

## Future identity and proof contracts

Separate pull UAMI: Container Registry Repository Reader (condition v2, exact \`g3-synthetic-runtime\`), lifecycle None, no AcrPull fallback. ACA_ABAC_IMAGE_PULL=MUST_PROVE, not already proven compatible.

Separate runtime UAMI: lifecycle Main, no ACR/build roles, secret-scoped Key Vault Secrets User. Microsoft supports individual-secret RBAC scope; vault-level scope is not forced. A narrower getSecret-only custom role remains a governed option, not a created role.

One synthetic secret \`g3-proof-secret\` is planned in a new Canada Central RBAC/private Key Vault. No secret value was collected or persisted. The purge-protection decision and image-supported challenge remain unbound.

Future private path: runtime -> private DNS -> Key Vault PE -> TLS -> identity authorization. Incorrect-reference 404 is not denial proof; a wrong identity accessing an existing protected secret must produce authorization 403. ACR negative fixtures must exist and connectivity must be proven so timeout/404 is not counted as RBAC denial. Unexpected successful negative writes require containment/cleanup. No probes were executed.

## CAD meters and unresolved totals

Current public CAD primary meters, paginated responses and GET ledger are persisted. No free-grant assumption is made. The existing G2 firewall base is excluded; Basic traffic at 0.092076 CAD/GB remains incremental.

| Component | Meter | Region | CAD rate | Billing unit |
|---|---|---|---|---|
${priceRows}

Known idle standing subtotal: ${model.costs.idleKnownStandingSubtotalCAD} CAD/month for 730h * (one Key Vault PE + one Standard LB <=5 rules) + two private DNS zones. **Not the candidate idle total.** Scale-zero ACA compute contributes zero under that assumption; logs, operations, traffic, storage and potential managed egress IP remain unresolved.

The two-zone term assumes two newly billed zones only. Reusing the retained G2 ACR private DNS zone does not incur another zone base charge. The selected DNS reuse/topology decision remains unbound.

Potential documented managed egress IPv4 adds ${model.costs.potentialPlatformEgressPublicIpMonthlyCAD} CAD/month if triggered. A user-managed G3 public IP is not selected; platform-managed charges must not be silently zeroed.

G3_PROOF_COST_CEILING_CAD=UNRESOLVED; G3_CANDIDATE_IDLE_MONTHLY_COST_CAD=UNRESOLVED. Builder B1s/E4 rates are examples only, not selected or qualified G3A substrate. Contingency >=1.5x requires a complete model and explicit human ceiling approval.

## Ledger and preservation

${model.ledger.azureCalls} attempted Azure calls: ${model.ledger.successful} successful / ${model.ledger.failed} failed. Full commands/status/digests are in [Azure read ledger](./azure-read-only-ledger.json); public pricing GETs are in [pricing read ledger](./public-pricing-read-ledger.json). Failed CLI transport and unsupported usages URLs are retained as failures, not silent defaults. One historical failed response has a retention limitation; successful corrected GET snapshots corroborate current facts. No credentials/secret values were queried; the human approver remains unbound rather than storing personal IDs.

Current fact aliases, Graph page aggregates and primary pricing summaries are checked against retained raw response hashes/data. All successful Azure responses must be retained. Historical failed-response loss is explicit, not presented as successful evidence.

Local G2 source files are unchanged; hashes are recorded. The accepted G2 PASS is not reopened. Its sealed terminal root cannot be byte-compared without the missing packet, so G2_TERMINAL_ROOT_UNCHANGED is not falsely asserted as proven. No G2 authority was reused and no Azure G2 mutation occurred.

G3A_BICEP_LOCAL_BUILD=FAIL and G3B_BICEP_LOCAL_BUILD=FAIL mean no passing build evidence is available. Both build attempts are NOT_RUN_FROZEN_PACKAGE_NOT_AVAILABLE, not observed compiler failures.

## Local validation

Exact commands and results are recorded in \`localValidation\` in [the JSON report](./G3_EXECUTION_READINESS.json). Offline Node regressions: 75 passed. PowerShell AST/negative-policy tests: 15 rejected commands/stages, with zero Azure calls or ledger changes. JavaScript syntax, scoped Prettier, deterministic generation and documentation validation passed.

Scoped ESLint could not run because ESLint 9 found no root \`eslint.config.*\`; this is recorded as FAILED_CONFIGURATION_NOT_FOUND, not a lint pass. No new tooling or configuration was added to mask it. These checks do not certify the missing executable G3A/G3B package.

## Terminal state

G3_EXECUTION_READINESS=BLOCKED;G3_PRIVATE_APPLICATION_SUBSTRATE=NOT_EXECUTED.
G3_TECHNICAL_EXECUTION_AUTHORIZED=NO;APPLICATION_ROLLOUT_AUTHORIZED=NO;PRODUCTION_DATA_AUTHORIZED=NO.
AZURE_MUTATIONS=0;REGISTRY_MUTATIONS=0;UE_INFRA=INFRA_NO_GO;CORA_INFRA=INFRA_NO_GO.
No G3A/G3B authority is issued. The smallest further readiness authority is read-only binding of the missing frozen package/G2 root plus local package, capacity, cost and owner/grant closure — not permission to deploy.
`
  return {
    'G3_EXECUTION_READINESS.json': await format(JSON.stringify(model), {
      ...config,
      parser: 'json',
    }),
    'G3_EXECUTION_READINESS.md': await format(text, { ...config, parser: 'markdown' }),
  }
}
export async function main(args) {
  assert(
    args.length &&
      args.every((argument) => ['--write', '--check', '--self-test'].includes(argument)),
    'LOCAL_REPORT_FLAGS_ONLY',
  )
  const generated = await generateReadiness()
  if (args.includes('--self-test'))
    assert.deepEqual(generated, await generateReadiness(), 'NONDETERMINISTIC_G3_READINESS')
  for (const [name, bytes] of Object.entries(generated)) {
    const file = path.join(directory, name)
    if (args.includes('--check'))
      assert.equal(readFileSync(file, 'utf8'), bytes, `G3_READINESS_DRIFT:${name}`)
    else if (args.includes('--write')) writeFileSync(file, bytes)
  }
  console.log(
    'PASS local G3 readiness report validation;readiness BLOCKED,no Azure/controller execution',
  )
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
