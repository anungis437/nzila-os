import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { evidence, files, hash, read, root, source } from './g3r2i-preservation.mjs'
import { validateDag } from './g3r3-execution-envelope.mjs'
import { checkReads, coreDigest, g2, registry, verify, vm } from './g3r3b-read-evidence.mjs'

const repository = 'g3-synthetic-runtime'
const principal = 'bfa4a851-696a-4d3f-927b-5fb1526f79f2'
const ledger = read(path.join(evidence, 'G3R3B_READ_LEDGER.json'))
const parentOperator = read(path.join(evidence, 'G3R3_OPERATOR_PRIVILEGE_PACKET.json'))
const parentPlan = read(path.join(evidence, 'G3R3_EXECUTION_PLAN.json'))
const network = read(path.join(evidence, 'G3R1_NETWORK_CONTRACT.json'))
const qualification = read(path.join(evidence, 'G3R2I_IMAGE_QUALIFICATION.json'))
const meters = read(path.join(evidence, 'G3R2_COST_CLOSURE.json')).meters
export const criteria = [
  'PRIVATE_ACR_REACHABILITY',
  'SOURCE_DELIVERY',
  'NO_LONG_LIVED_CREDENTIALS',
  'LEAST_PRIVILEGE',
  'NO_GENERIC_PUBLIC_EGRESS',
  'DETERMINISTIC_ROLLBACK',
  'CLEANUP_ENFORCEMENT',
  'COST_METER_COMPLETENESS',
  'COST_BOUNDABILITY',
  'SOURCE_PROVENANCE',
  'OPERATOR_PRIVILEGE_COMPLETENESS',
]
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`
  assert.notEqual(value, undefined, 'UNDEFINED_PACKET_FIELD')
  return JSON.stringify(value)
}
export const digest = (value) => hash(canonical(value))
const fileHash = (name) => hash(readFileSync(path.join(evidence, name)))
function captured(name) {
  const pages = ledger.filter(
    (entry) => entry.name.startsWith(`${name}-page-`) && entry.status === 'SUCCEEDED',
  )
  assert(pages.length, `REQUIRED_CAPTURE_UNAVAILABLE:${name}`)
  const values = pages.map((entry) => read(path.join(evidence, entry.responseFile)))
  return values[0].value ? { value: values.flatMap((page) => page.value) } : values[0]
}
function document(name) {
  const entry = ledger.findLast(
    (entry) => entry.name === `doc-${name}` && entry.status === 'SUCCEEDED',
  )
  assert(entry, `DOCUMENT_UNAVAILABLE:${name}`)
  return {
    SOURCE: entry.url,
    CAPTURE: entry.responseFile,
    SHA256: entry.responseSha256,
    READ_AT_UTC: entry.completedAtUtc,
  }
}
function text(name) {
  return readFileSync(path.join(evidence, document(name).CAPTURE), 'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}
function exactPrice(name, predicate) {
  const sourceFile = `G3R3B_PRICE_${name}.json`
  const snapshot = read(path.join(evidence, sourceFile))
  const matches = snapshot.items.filter(predicate)
  assert.equal(matches.length, 1, `METER_AMBIGUOUS_OR_ABSENT:${name}:${matches.length}`)
  return {
    ...matches[0],
    sourceFile,
    sourceSha256: fileHash(sourceFile),
    rawSources: snapshot.sources,
  }
}
export function sourceDelivery() {
  const directory = path.join(source, 'workload', 'synthetic-proof')
  const actual = files(directory)
  assert.deepEqual(actual, qualification.SOURCE_DIGESTS.files)
  assert.equal(hash(JSON.stringify(actual)), qualification.SOURCE_DIGESTS.SOURCE_TREE_SHA256)
  const payload = actual.map((entry) => {
    assert(
      /^(?:\.dockerignore|Dockerfile|go\.mod|main\.go|main_test\.go|README\.md)$/.test(entry.path),
      'UNEXPECTED_SOURCE_PATH',
    )
    const bytes = readFileSync(path.join(directory, entry.path))
    return { ...entry, bytes: bytes.length, base64: bytes.toString('base64') }
  })
  const script = [
    'set -eu',
    'umask 077',
    ': "${G3_APPROVED_EMPTY_STAGING_DIRECTORY:?preflight and authorization required}"',
    'cd "$G3_APPROVED_EMPTY_STAGING_DIRECTORY"',
    ...payload.flatMap((entry) => [
      `printf '%s' '${entry.base64}' | base64 -d > '${entry.path}'`,
      `printf '%s\\n' '${entry.sha256}  ${entry.path}' | sha256sum -c - >/dev/null`,
    ]),
  ].join('\n')
  const request = {
    location: 'canadacentral',
    properties: {
      source: { script },
      timeoutInSeconds: 1800,
      asyncExecution: false,
      treatFailureAsDeploymentFailure: true,
      protectedParameters: [
        { name: 'G3_ACR_SHORT_LIVED_TOKEN', value: '<FUTURE_PROTECTED_VALUE_NOT_ACQUIRED>' },
      ],
    },
  }
  const encodedRequestBytes = Buffer.byteLength(JSON.stringify(request))
  assert(encodedRequestBytes < 4 * 1024 * 1024)
  return {
    SOURCE_FILE_COUNT: payload.length,
    BUILD_CONTEXT_FILE_COUNT: qualification.SOURCE_DIGESTS.buildContext.length,
    SOURCE_TOTAL_BYTES: payload.reduce((sum, entry) => sum + entry.bytes, 0),
    ENCODED_PAYLOAD_BYTES: payload.reduce((sum, entry) => sum + Buffer.byteLength(entry.base64), 0),
    INLINE_SCRIPT_BYTES: Buffer.byteLength(script),
    REPRESENTATIVE_REQUEST_BYTES: encodedRequestBytes,
    REQUEST_MODEL:
      'Microsoft.Compute/virtualMachines/runCommands@2024-07-01;properties.source.script:string;protectedParameters;JSON UTF-8',
    SOURCE_TREE_SHA256: hash(JSON.stringify(actual)),
    EXPECTED_ON_VM_SOURCE_SHA256: hash(JSON.stringify(actual)),
    BUILD_CONTEXT_SHA256: qualification.SOURCE_DIGESTS.BUILD_CONTEXT_SHA256,
    perFile: payload.map(({ base64, ...entry }) => entry),
    schema: document('run-command-schema'),
    sizeEvidence: document('arm-limits'),
    sizeInterpretation:
      'Inline string is supported with no documented schema maxLength;measured request is below documented ARM4MB deployment request limit. ARM deployment limit is not advertised as a Compute inline-script guarantee;future request rejection denies build. No undocumented script-size ceiling invented.',
    scope:
      'Source transport shape only;not an executable build/credential/cleanup controller;no script sent or executed',
  }
}
export function priceFacts() {
  const vault = exactPrice(
    'key-vault-all',
    (item) =>
      item.productName === 'Key Vault' &&
      item.skuName === 'Standard' &&
      item.meterName === 'Operations' &&
      item.armRegionName === 'Global' &&
      item.tierMinimumUnits === 0,
  )
  assert.equal(vault.currencyCode, 'CAD')
  assert.equal(vault.unitOfMeasure, '10K')
  assert(text('key-vault-pricing').includes('Secrets operations'))
  const regional = read(path.join(evidence, vault.sourceFile)).items.filter(
    (item) =>
      item.meterId === vault.meterId &&
      item.skuName === 'Standard' &&
      item.armRegionName === 'canadacentral',
  )
  assert.equal(regional.length, 1)
  assert.equal(regional[0].retailPrice, vault.retailPrice)
  const disk = exactPrice(
    'ssd-transactions',
    (item) =>
      item.productName === 'Standard SSD Managed Disks' &&
      item.meterName === 'Disk Transactions LRS Disk Operations' &&
      item.armRegionName === 'canadacentral' &&
      item.tierMinimumUnits === 0,
  )
  const catalogs = ['registry-all', 'registry-products'].map((name) => ({
    sourceFile: `G3R3B_PRICE_${name}.json`,
    sha256: fileHash(`G3R3B_PRICE_${name}.json`),
    itemCount: read(path.join(evidence, `G3R3B_PRICE_${name}.json`)).items.length,
    matches: read(path.join(evidence, `G3R3B_PRICE_${name}.json`)).items.filter((item) =>
      /dedicated|allocation|agent.?pool/i.test(
        `${item.productName} ${item.meterName} ${item.skuName}`,
      ),
    ),
  }))
  assert(catalogs.every((catalog) => catalog.matches.length === 0))
  return {
    vault: {
      status: 'BOUND',
      meter: vault,
      appliesTo: 'Ordinary synthetic secret REST operations on Standard vault',
      applicability:
        'Exact Standard Global and CanadaCentral rows share meterId/rate;both are non-primary. Primary-only filtering hid these applicable rows;no foreign/Premium SKU substitution.',
      pricing: document('key-vault-pricing'),
    },
    disk: {
      status: 'BOUND_RATE_AND_EXISTING_SKU',
      meter: disk,
      diskResource: captured('vm-os-disk').id,
      actualSku: captured('vm-os-disk').sku.name,
      actualSizeGiB: captured('vm-os-disk').properties.diskSizeGB,
      hourlyPaidTransactionCap: 43400,
      pricing: document('standard-ssd-pricing'),
      transactionUnit:
        'Each<=256KiB I/O is one transaction;larger I/O counts multiple transactions',
      durationBound: 'UNBOUND_UNTIL_BUILD_AND_CLEANUP_ENFORCEMENT_BINDS',
    },
    agentPool: {
      status: 'BLOCKED_EXACT_FACT',
      allocationMeter: null,
      catalogs,
      required:
        'Applicable S1 dedicated2-vCPU allocation-second CAD rate,or authoritative explicit mapping of Task vCPU Duration meter to allocation billing',
      pricing: document('registry-pricing'),
      rejectedProxy:
        'Task vCPU Duration has paid0.000142CAD/vCPU-second plus6000-second free tier;pricing distinguishes task duration from dedicated allocation. Neither task-duration tariff nor free tier is silently substituted.',
    },
  }
}
function operationNames() {
  const names = new Set()
  function visit(value) {
    if (!value || typeof value !== 'object') return
    if (typeof value.name === 'string') names.add(value.name.toLowerCase())
    for (const entry of Object.values(value))
      if (Array.isArray(entry)) entry.forEach(visit)
      else if (entry && typeof entry === 'object') visit(entry)
  }
  visit(captured('compute-operations'))
  visit(captured('registry-operations'))
  const parentLedger = read(path.join(evidence, 'G3R3_AZURE_READ_LEDGER.json'))
  for (const entry of parentLedger.filter((entry) =>
    entry.name.startsWith('network-operations-page-'),
  ))
    visit(read(path.join(evidence, entry.responseFile)))
  return names
}
function requirement(action, scope, reason) {
  assert(operationNames().has(action.toLowerCase()), `UNREGISTERED_ACTION:${action}`)
  return {
    AZURE_ACTION: action,
    EXACT_SCOPE: scope,
    WHY_REQUIRED: reason,
    STATUS: 'PROPOSED_NOT_GRANTED',
  }
}
export function privilegeOptions() {
  const compute = ['read', 'write', 'delete'].map((verb) =>
    requirement(
      `Microsoft.Compute/virtualMachines/runCommands/${verb}`,
      vm,
      'Only owned G3 managed RunCommand child;parent VM scope is required to create a nonexistent child;guest command authority remains broad and cannot be repository-scoped by ARM RBAC',
    ),
  )
  compute.push(
    requirement(
      'Microsoft.Network/networkInterfaces/read',
      captured('vm').properties.networkProfile.networkInterfaces[0].id,
      'Recheck exact existing NIC/subnet in fail-closed ARM preflight;no NIC write',
    ),
    requirement(
      'Microsoft.ContainerRegistry/registries/read',
      registry,
      'Resolve exact private registry login contract for future short-lived operator authentication;repository data Writer is separate',
    ),
    requirement('Microsoft.Compute/virtualMachines/read', vm, 'Verify exact VM contract'),
    requirement(
      'Microsoft.Compute/virtualMachines/instanceView/read',
      vm,
      'Agent/power readiness;no guest execution',
    ),
    requirement(
      'Microsoft.Compute/disks/read',
      captured('vm-os-disk').id,
      'Verify owned existing disk SKU;no resize/create/delete',
    ),
  )
  const pool = ['read', 'write', 'delete'].map((verb) =>
    requirement(
      `Microsoft.ContainerRegistry/registries/agentPools/${verb}`,
      registry,
      'Named owned S1 agent pool lifecycle;existing registry parent scope needed before pool exists',
    ),
  )
  pool.push(
    requirement(
      'Microsoft.ContainerRegistry/registries/read',
      registry,
      'Verify Premium/private/ABAC registry before pool or source upload',
    ),
  )
  for (const [action, reason] of [
    [
      'Microsoft.ContainerRegistry/registries/scheduleRun/action',
      'Schedule only approved proof local context;task scheduling grants cannot be repository-conditioned by ABAC',
    ],
    [
      'Microsoft.ContainerRegistry/registries/listBuildSourceUploadUrl/action',
      'Obtain future bounded source-upload URI;not called now',
    ],
    ['Microsoft.ContainerRegistry/registries/runs/read', 'Read owned run terminal state'],
    [
      'Microsoft.ContainerRegistry/registries/runs/cancel/action',
      'Cancel owned proof run on failure/deadline',
    ],
    [
      'Microsoft.ContainerRegistry/registries/runs/listLogSasUrl/action',
      'Retain sanitized owned run logs;not called now',
    ],
  ])
    pool.push(requirement(action, registry, reason))
  return {
    PARENT_OPERATOR_PACKET_DIGEST: fileHash('G3R3_OPERATOR_PRIVILEGE_PACKET.json'),
    SELECTED_BUILDER: 'NONE',
    ADDITIONAL_ACTIONS: [],
    ADDITIONAL_SCOPES: [],
    candidateRequirements: { EXISTING_G2_BUILDER_VM: compute, ACR_DEDICATED_AGENT_POOL_S1: pool },
    ROLE_OPTIONS: [
      {
        builder: 'A',
        builtIn: 'Virtual Machine Contributor',
        disposition: 'REJECTED_OVERBROAD_VM_LIFECYCLE;custom child-command/read actions preferred',
      },
      {
        builder: 'B',
        builtIn: 'Container Registry Tasks Contributor',
        disposition:
          'TASK_CONTROL_ONLY_BUT_BROADER_THAN_SINGLE_PROOF;custom exact task surfaces preferred',
      },
    ],
    CUSTOM_PERMISSION_OPTION:
      'Candidate action lists only;no selected role definition or grant until selection;repository Writer remains separate conditioned data role from frozen core',
    documentedSingularAction: {
      value: 'Microsoft.Compute/virtualMachines/runCommand/write',
      status: 'NOT_IN_CURRENT_PROVIDER_CATALOG',
      resolution:
        'Managed child-resource contract uses plural runCommands/write;do not grant nonexistent singular spelling',
      source: document('managed-run-command'),
    },
    repository: {
      name: repository,
      scope: registry,
      writer: parentOperator.proposedAssignments.find(
        (entry) => entry.assignmentId === 'operator-repository-writer',
      ),
      REGISTRY_WIDE_ADMIN: 'NO',
    },
    candidateBSubnetJoin: {
      action: 'Microsoft.Network/virtualNetworks/subnets/join/action',
      scope: `${network.vnetId}/subnets/G3BuilderSubnet`,
      delta: 'ALREADY_IN_PROPOSED_CORE_RG_ROLE;NOT_ALREADY_GRANTED',
    },
    STATUS: 'PROPOSED_NOT_GRANTED',
    RENDERING_STATUS: 'NO_SELECTED_BUILDER_DELTA',
  }
}
const result = (status, fact) => ({ status, fact })
export function compareBuilders() {
  const vmState = captured('vm')
  const agent = captured('vm-instance-view')
  const disk = captured('vm-os-disk')
  const acr = captured('registry')
  assert.equal(vmState.id, vm)
  assert.equal(disk.sku.name, 'StandardSSD_LRS')
  assert.equal(disk.properties.diskSizeGB, 32)
  assert.equal(vmState.properties.storageProfile.osDisk.managedDisk.id, disk.id)
  assert.equal(acr.sku.name, 'Premium')
  assert.equal(acr.properties.publicNetworkAccess, 'Disabled')
  assert.equal(acr.properties.roleAssignmentMode, 'AbacRepositoryPermissions')
  const openapi = read(path.join(evidence, document('task-openapi').CAPTURE))
  const timeout = openapi.definitions.DockerBuildRequest.properties.timeout
  assert.equal(timeout.minimum, 300)
  assert.equal(timeout.maximum, 28800)
  assert(
    !Object.keys(openapi.definitions.AgentPoolProperties.properties).some((key) =>
      /expiry|ttl|timeout/i.test(key),
    ),
  )
  assert.equal(captured('agent-pools').value.length, 0)
  const source = sourceDelivery()
  const prices = priceFacts()
  const doc = text('agent-pools')
  assert(/Canada Central/.test(doc) && /preview/.test(doc) && /S1/.test(doc))
  assert(text('task-schema').includes('28800') && text('task-schema').includes('300'))
  const finiteHubDomains = [
    'auth.docker.io',
    'auth.docker.com',
    'registry-1.docker.io',
    'production.cloudfront.docker.com',
  ]
  for (const host of finiteHubDomains) assert(text('docker-domains').includes(host))
  const basePull = {
    immutableImage: qualification.BUILD_TOOLCHAIN.builder,
    FQDNS: finiteHubDomains,
    PORTS: [443],
    TEMPORARY_OR_PERSISTENT: 'TEMPORARY_PROOF_WINDOW',
    source: document('docker-domains'),
    rollback:
      'Remove only owned temporary allow rules after base pull;deny any unlisted redirect before fetching;no wildcard Internet/AzureCloud/0/0',
    limitation:
      'Finite documented pull/auth hosts;redirect destinations must be preflight inspected and allowlisted before build;no assumption that undocumented CDN destinations work',
  }
  const preflight = [
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
  ]
  const baselineLedger = read(path.join(evidence, 'G3R3_AZURE_READ_LEDGER.json'))
  const nicEntry = baselineLedger.find((entry) => entry.name === 'g2-builder-nic-page-1')
  assert(nicEntry?.status === 'SUCCEEDED')
  const nic = read(path.join(evidence, nicEntry.responseFile))
  assert.equal(vmState.properties.networkProfile.networkInterfaces[0].id, nic.id)
  const assignments = baselineLedger
    .filter((entry) => /^(assignments|inherited-assignments)-page-/.test(entry.name))
    .flatMap((entry) => read(path.join(evidence, entry.responseFile)).value)
  const identityAssignments = assignments.filter(
    (entry) => entry.properties.principalId === 'c59571aa-66ea-47c5-83d5-59946b318ae2',
  )
  assert(
    identityAssignments.some((entry) => entry.properties.condition?.includes('synthetic-health')),
  )
  const a = {
    model: 'EXISTING_G2_BUILDER_VM',
    invocation: 'VIA_MANAGED_RUN_COMMAND',
    disposition: 'BLOCKED_EXACT_FACT',
    resource: {
      id: vm,
      nic: vmState.properties.networkProfile.networkInterfaces[0].id,
      subnet: nic.properties.ipConfigurations.find((entry) => entry.properties.primary).properties
        .subnet.id,
      agent,
      disk: { id: disk.id, sku: disk.sku.name, sizeGiB: disk.properties.diskSizeGB },
      newVM: false,
    },
    preflight: preflight.map((check) => ({
      check,
      state: [
        'VM_EXISTS',
        'VM_AGENT_READY',
        'EXPECTED_VM_RESOURCE_ID',
        'EXPECTED_NETWORK_INTERFACE',
      ].includes(check)
        ? 'CAPTURED_CONTROL_PLANE;RECHECK_BEFORE_EXECUTION'
        : 'RUNTIME_PREFLIGHT_REQUIRED',
      onFailure: 'DENY_BEFORE_BUILD_OR_PUSH;NO_TOOL_INSTALLATION',
    })),
    sourceDelivery: source,
    requiredTooling: {
      policy:
        'Missing Docker/Podman,compatibleBuildKit,base64,sha256sum,timeout,flock or cleanup isolation => DENY;no package manager/Docker/Go installation',
      selfContained:
        'CONDITIONAL_ON_EXISTING_GUEST_PREFLIGHT;unknown guest state is not itself an authorization blocker',
    },
    credentialModel: {
      status: 'SUPPORTED_FUTURE_SHORT_LIVED_MODEL',
      authority: 'Recommended operator federation and frozen repository Writer ABAC',
      delivery:
        'protectedParameters;no public script URI,password in arguments,build args,stdout,stderr or retained resource properties',
      use: 'password-stdin with isolated tmpfs Docker config;no set-x/debug;unset credentials;delete config and revoke temporary grant at cleanup',
      validity:
        'ACR Entra login contract3h;future token must have enough remaining lifetime for bounded build,no refresh/long-lived key in VM',
      source: document('acr-authentication'),
      credentialAcquiredOrSent: false,
    },
    basePull,
    cleanup: {
      desired:
        'Lock unique owned staging namespace;timeout1800s;trap signals/errors;cancel owned engine operation;delete owned containers/images/temp files and credential config;delete owned RunCommand;verify no owned active processes;retain G2 VM/NIC/disk/UAMI and foreign artifacts',
      enforced: false,
      exactGap:
        'No qualified guest/independent cleanup contract currently binds daemon-side build cancellation,credential destruction and workload isolation after agent/controller failure;RunCommand timeout/deletion alone is not a Docker lifecycle or billed-operation fence',
      newVMWatchdogRequired: false,
      existingVMDeallocation: 'PROHIBITED_AS_SHARED_RESOURCE;not an ephemeral VM TTL requirement',
    },
    costs: {
      EXISTING_VM_BASE_COST: 'SHARED_PLATFORM_COST',
      G3_INCREMENTAL_COMPUTE_COST_CAD: 0,
      diskCapacityAndMount: 'EXISTING_SHARED_FIXED_CAPACITY;NO_NEW_DISK',
      diskTransactions: prices.disk,
      network: 'RATE_BOUND;BOUNDED_SCENARIO_ONLY_UNTIL_ENFORCEMENT',
      acrStorage: 'HEADROOM_CHECKED',
    },
    criteria: {
      PRIVATE_ACR_REACHABILITY: result(
        'PASS',
        'Existing private G2 network/ACR contract;actual guest DNS/TCP is fail-closed runtime preflight,not an unknown-guest blocker',
      ),
      SOURCE_DELIVERY: result(
        'PASS',
        'Supported measured inline script/protected parameter model;no external courier',
      ),
      NO_LONG_LIVED_CREDENTIALS: result(
        'PASS',
        'Short-lived operator Entra token delivery contract;no credential acquired',
      ),
      LEAST_PRIVILEGE: result(
        'BLOCKED_EXACT_FACT',
        'Existing guest UAMI has synthetic-health writer and g2-tooling reader grants;RunCommand executes guest commands with broad host authority. No bound isolation/IMDS fence proves builder can write only G3 repository',
      ),
      NO_GENERIC_PUBLIC_EGRESS: result(
        'PASS',
        'Finite documented Docker hosts443 and private ACR;unlisted redirects deny;future exact temporary firewall supplement required',
      ),
      DETERMINISTIC_ROLLBACK: result(
        'BLOCKED_EXACT_FACT',
        'Ownership-scoped desired cleanup is enumerated,but daemon/credential cleanup under failures is not authority-bound',
      ),
      CLEANUP_ENFORCEMENT: result(
        'BLOCKED_EXACT_FACT',
        'Server RunCommand timeout does not establish external engine/credential cleanup after agent/controller failure',
      ),
      COST_METER_COMPLETENESS: result(
        'PASS',
        'Existing compute/disk base shared;applicable LRS transaction CAD meter and network/ACR rates captured',
      ),
      COST_BOUNDABILITY: result(
        'BLOCKED_EXACT_FACT',
        'Disk hourly cap gives a conditional cost only;total billable transaction windows and byte limits require cleanup/enforcement',
      ),
      SOURCE_PROVENANCE: result(
        'PASS',
        'Accepted source hashes/pinned public compiler unchanged;future registry digest required',
      ),
      OPERATOR_PRIVILEGE_COMPLETENESS: result(
        'BLOCKED_EXACT_FACT',
        'Real plural child-command actions catalog-bound;identity-isolation/cleanup permission extension cannot be finalized without isolation contract',
      ),
    },
    standingGuestIdentityAssignments: identityAssignments.map(({ id, properties }) => ({
      id,
      ...properties,
    })),
    noStandingGrantRevoked: true,
    preferenceMetrics: {
      g2MutationSurface: null,
      cleanupStrength: null,
      operatorPrivilegeBreadth: null,
      boundedIncrementalCostCAD: null,
      preview: false,
    },
  }
  const b = {
    model: 'ACR_DEDICATED_AGENT_POOL_S1',
    disposition: 'BLOCKED_EXACT_FACT',
    FEATURE_STATUS: 'PREVIEW',
    USE_SCOPE: 'ONE_SYNTHETIC_G3_PROOF',
    PRODUCTION_RUNTIME_DEPENDENCY: 'NO',
    LONG_TERM_PRODUCTION_DEPENDENCY: 'NO',
    support: {
      CANADA_CENTRAL_SUPPORTED: true,
      PREMIUM_ACR_REQUIRED: true,
      CURRENT_G2_ACR_TIER_COMPATIBLE: true,
      VNET_AGENT_POOL_SUPPORTED: true,
      LOCAL_SOURCE_CONTEXT_SUPPORTED: true,
      PRIVATE_ACR_BUILD_PATH_SUPPORTED: true,
      sources: [document('agent-pools'), document('private-acr'), document('acr-build')],
    },
    pool: {
      resourceId: `${registry}/agentPools/g3-proof-s1`,
      tier: 'S1',
      cpus: 2,
      memoryGB: 3,
      location: 'canadacentral',
      subnet: `${network.vnetId}/subnets/G3BuilderSubnet`,
      AGENT_POOL_COUNT_BEFORE: 0,
      AGENT_POOL_COUNT_DURING: 1,
      AGENT_POOL_COUNT_AFTER: 0,
      currentlyCapturedPools: captured('agent-pools').value,
      existsNow: false,
    },
    sourceDelivery: {
      model:
        'az acr build --agent-pool g3-proof-s1 --source-acr-auth-id [caller] --timeout1800 <local qualified source context>',
      provenance: source,
      transport:
        'CLI packages local context;future authorized upload-URL action and bounded blob upload,not Git/public repository or courier VM',
      source: document('acr-build'),
      dynamicUriGate:
        'Inspect returned upload URI before uploading;require approved HTTPS Storage dependency,no arbitrary redirect;record payload digest and source deletion/retention contract',
    },
    credentialModel: {
      sourceLogin: '[caller]',
      authority:
        'Core repository-conditioned writer for recommended operator;task control role does not itself confer repository data access',
      noLongLivedCredential: true,
      noNewIdentity: true,
      source: document('acr-build'),
      residual:
        'Quick-task target push/source-upload retention and caller credential destruction contract must be bound without granting registry-wide data authority',
    },
    BUILD_TIMEOUT_SECONDS: 1800,
    TASK_API_MINIMUM: timeout.minimum,
    TASK_API_MAXIMUM: timeout.maximum,
    timeoutRationale:
      'Conservative30-minute engineering scheduling ceiling for stdlib-only qualified workload/two full compilations;not a measured remote SLA. Local qualification proves completion but does not record wall-clock timing;timeout aborts rather than extending.',
    FAIL_CLOSED_ON_TIMEOUT: 'YES',
    timeoutSource: document('task-openapi'),
    MAX_ALLOCATION_SECONDS_PROPOSED: 3600,
    cleanup: {
      desired:
        'Scale0->1 for owned single run;cancel on failure/deadline;scale1->0 then delete owned pool;read terminal deallocation/deletion;delete owned source staging and temporary roles',
      BUILDER_B_CLEANUP_ENFORCEMENT: 'UNBOUND',
      serverSidePoolTtl:
        'No allocation-expiry property in agent-pool schema;task timeout stops run,not allocation billing',
      exactGap:
        'No independent authority-bound scale-down/delete observer/controller failure path;one-hour allocation window is proposed,not a hard cap',
      sources: [document('agent-pool-api'), document('registry-pricing')],
    },
    network: {
      sourceCidr: '10.91.3.0/24',
      privateAcr: 'Existing G2 ACR PE over approved core peering;no public access',
      dependencies: [
        { destination: 'AzureKeyVault', ports: [443] },
        { destination: 'Storage', ports: [443] },
        { destination: 'EventHub', ports: [443] },
        { destination: 'AzureActiveDirectory', ports: [443] },
        { destination: 'AzureMonitor', ports: [443, 12000] },
      ],
      basePull,
      source: document('agent-pools'),
      delta:
        'Frozen G3 builder NSG denies traffic;separately governed G3 adjunct allowances and exact G2 firewall source10.91.3.0/24 dependency collections required;core collections are ACA-only,do not silently widen',
    },
    costs: prices.agentPool,
    preferenceMetrics: {
      g2MutationSurface: null,
      cleanupStrength: null,
      operatorPrivilegeBreadth: null,
      boundedIncrementalCostCAD: null,
      preview: true,
    },
    criteria: {
      PRIVATE_ACR_REACHABILITY: result(
        'PASS',
        'Current Microsoft dedicated-pool VNet/private-ACR service contract;Premium compatible',
      ),
      SOURCE_DELIVERY: result(
        'PASS',
        'Local context supported;future bounded Storage upload gates,no courier/Git workaround',
      ),
      NO_LONG_LIVED_CREDENTIALS: result(
        'PASS',
        'Explicit caller identity source-auth supported;no registry admin/password',
      ),
      LEAST_PRIVILEGE: result(
        'BLOCKED_EXACT_FACT',
        'Candidate task-control roles and core ABAC writer identified;target quick-task credential and cleanup contract incomplete',
      ),
      NO_GENERIC_PUBLIC_EGRESS: result(
        'PASS',
        'Documented five Azure service dependencies and finite Docker hosts;no Internet/AzureCloud/0/0;requires supplemental rules',
      ),
      DETERMINISTIC_ROLLBACK: result(
        'BLOCKED_EXACT_FACT',
        'Named pool/cancel/scale-zero/delete sequence defined;source staging disposal and allocation failure rollback not yet bound',
      ),
      CLEANUP_ENFORCEMENT: result(
        'BLOCKED_EXACT_FACT',
        'No server-side pool TTL;task timeout does not cap allocation when controller/credentials fail',
      ),
      COST_METER_COMPLETENESS: result(
        'BLOCKED_EXACT_FACT',
        'Dedicated allocation-second CAD applicability not established;Task vCPU Duration is not silently substituted',
      ),
      COST_BOUNDABILITY: result(
        'BLOCKED_EXACT_FACT',
        'Both applicable allocation tariff and enforceable maximum allocation window are unbound',
      ),
      SOURCE_PROVENANCE: result(
        'PASS',
        'Same qualified source/build context/digest-pinned compiler;no rebuild or mutable authority',
      ),
      OPERATOR_PRIVILEGE_COMPLETENESS: result(
        'BLOCKED_EXACT_FACT',
        'Candidate pool/run/upload actions catalog-bound;independent cleanup authority/scopes remain unbound',
      ),
    },
  }
  return {
    candidateUniverse: ['EXISTING_G2_BUILDER_VM', 'ACR_DEDICATED_AGENT_POOL_S1'],
    candidates: [a, b],
    evaluation:
      'Unknown guest tooling/DNS/free disk/conflicting-build checks are runtime deny gates,not standalone blockers;only material isolation/cleanup/allocation/cost gaps block selection',
    sourceAuthority: 'G3_SYNTHETIC_PROOF_V1;QUALIFIED_LOCAL_NOT_PUSHED',
    G3R2I_IMAGE_QUALIFICATION: 'PRESERVED',
    ROOT_1_REOPENED: 'NO',
    EPHEMERAL_B2S_OFFLINE_OCI_RECEIVER: 'SUPERSEDED_AS_DEFAULT_NOT_SELECTED',
    retiredReason:
      'Historical unbound courier/tooling/identity/disk/watchdog/TTL design preserved,not deleted',
    prices,
    schemaEvidence: [
      document('managed-run-command'),
      document('run-command-schema'),
      document('schedule-run-api'),
    ],
  }
}
export function choose(comparison) {
  assert.deepEqual(comparison.candidateUniverse, [
    'EXISTING_G2_BUILDER_VM',
    'ACR_DEDICATED_AGENT_POOL_S1',
  ])
  assert.equal(comparison.candidates.length, 2)
  for (const candidate of comparison.candidates) {
    assert.deepEqual(Object.keys(candidate.criteria).sort(), [...criteria].sort())
    assert(
      Object.values(candidate.criteria).every((entry) =>
        ['PASS', 'FAIL', 'BLOCKED_EXACT_FACT'].includes(entry.status),
      ),
    )
  }
  const qualified = comparison.candidates.filter((candidate) =>
    Object.values(candidate.criteria).every((entry) => entry.status === 'PASS'),
  )
  if (qualified.length > 1) {
    for (const candidate of qualified) {
      assert(candidate.preferenceMetrics, 'BOTH_PASS_REQUIRES_MEASURED_PREFERENCE_INPUTS')
      for (const key of [
        'g2MutationSurface',
        'cleanupStrength',
        'operatorPrivilegeBreadth',
        'boundedIncrementalCostCAD',
      ])
        assert(
          Number.isFinite(candidate.preferenceMetrics[key]) &&
            candidate.preferenceMetrics[key] >= 0,
          `UNBOUND_PREFERENCE:${key}`,
        )
      assert.equal(typeof candidate.preferenceMetrics.preview, 'boolean')
    }
    qualified.sort((a, b) => {
      const x = a.preferenceMetrics
      const y = b.preferenceMetrics
      return (
        x.g2MutationSurface - y.g2MutationSurface ||
        y.cleanupStrength - x.cleanupStrength ||
        x.operatorPrivilegeBreadth - y.operatorPrivilegeBreadth ||
        x.boundedIncrementalCostCAD - y.boundedIncrementalCostCAD ||
        Number(x.preview) - Number(y.preview) ||
        a.model.localeCompare(b.model)
      )
    })
  }
  return {
    SELECTED_PRIVATE_BUILD_MODEL: qualified[0]?.model ?? 'NONE',
    rationale: qualified.length
      ? 'Every material criterion passed;when both pass,measured G2 mutation surface,cleanup strength,privilege breadth,cost,then preview rank determine choice in that order'
      : 'Neither candidate meets every material criterion;no third model introduced and no convenience selection',
    score: comparison.candidates.map((candidate) => ({
      model: candidate.model,
      PASS: Object.values(candidate.criteria).filter((entry) => entry.status === 'PASS').length,
      FAIL: Object.values(candidate.criteria).filter((entry) => entry.status === 'FAIL').length,
      BLOCKED_EXACT_FACT: Object.values(candidate.criteria).filter(
        (entry) => entry.status === 'BLOCKED_EXACT_FACT',
      ).length,
      materialResiduals: Object.entries(candidate.criteria)
        .filter(([, value]) => value.status !== 'PASS')
        .map(([criterion, value]) => ({ criterion, ...value })),
    })),
    preferenceOrderIfBothPass: [
      'LOWEST_G2_MUTATION_SURFACE',
      'STRONGEST_DETERMINISTIC_CLEANUP',
      'NARROWEST_OPERATOR_PRIVILEGE',
      'MOST_COMPLETELY_BOUNDED_INCREMENTAL_COST',
      'NO_PREVIEW_DEPENDENCY',
    ],
    neitherProvenImpossible: true,
    newArchitectureAuthorized: false,
  }
}
export function supplement(selection) {
  assert.equal(
    selection.SELECTED_PRIVATE_BUILD_MODEL,
    'NONE',
    'SELECTED_MODEL_REQUIRES_EXACT_SUPPLEMENT_RENDERING',
  )
  const value = {
    PARENT_G2_PACKET_SHA256: coreDigest,
    PARENT_G2_FILE_SHA256: fileHash('G3R3_G2_MUTATION_PACKET.json'),
    SELECTED_BUILDER: 'NONE',
    SUPPLEMENT_CHANGE_COUNT: 0,
    BUILDER_CHANGE_IDS: [],
    changes: [],
    absenceMeaning:
      'No selected-builder changes rendered;NOT a claim either candidate needs zero G2 changes',
    candidateDeltasNotAuthorized: [
      {
        builder: 'A',
        surface:
          'Owned Managed RunCommand child plus owned guest staging/cleanup and temporary finite public-base firewall allowance;identity fence remains unbound',
        rollback:
          'Remove only owned command/guest files/images/credentials/firewall rules;retain G2 VM/NIC/disk/UAMI/foreign state;etag and guest ownership/conflict guards',
      },
      {
        builder: 'B',
        surface:
          'Owned S1 agent pool on existing G2 registry;bounded local-source staging;G2 firewall agent dependencies443/12000 plus finite Docker base hosts;G3 adjunct NSG rules outside G2',
        rollback:
          'Cancel owned task;scale owned pool0/delete;verify stopped allocation;delete source staging and owned collection entries only;etag/conflict guards',
      },
    ],
    ROLLBACK: 'NOT_COMPLETE_FOR_EITHER_CANDIDATE;CORE_G2_ROLLBACK_UNCHANGED',
    SECURITY_IMPACT:
      'No supplemental authorization issued;candidate surfaces disclosed only;public ACR stays disabled',
    STATUS: 'PROPOSED_NOT_AUTHORIZED',
    RENDERING_STATUS: 'INCOMPLETE_NO_SELECTED_BUILDER',
    digestMethod:
      'SHA256 sorted-key canonical JSON UTF-8 excluding SUPPLEMENT_DIGEST and appended composite linkage manifest',
  }
  return { ...value, SUPPLEMENT_DIGEST: digest(value) }
}
export function composite(supplement) {
  const value = {
    CORE_PACKET_DIGEST: coreDigest,
    CORE_PACKET_FILE_SHA256: fileHash('G3R3_G2_MUTATION_PACKET.json'),
    SUPPLEMENT_DIGEST: supplement.SUPPLEMENT_DIGEST,
    SELECTED_BUILDER: supplement.SELECTED_BUILDER,
    TOTAL_CHANGE_COUNT: 7 + supplement.SUPPLEMENT_CHANGE_COUNT,
    STATUS: 'DETERMINISTIC_LINKAGE_ONLY;NOT_COMPLETE_OR_APPROVABLE_WITH_NO_SELECTED_BUILDER',
    digestMethod: 'SHA256 sorted-key canonical JSON UTF-8 excluding COMPOSITE_AUTHORIZATION_DIGEST',
  }
  return { ...value, COMPOSITE_AUTHORIZATION_DIGEST: digest(value) }
}
export function traffic(model) {
  assert(['EXISTING_G2_BUILDER_VM', 'ACR_DEDICATED_AGENT_POOL_S1'].includes(model))
  const pool = model === 'ACR_DEDICATED_AGENT_POOL_S1'
  return [
    {
      id: 'SOURCE_CONTEXT',
      direction: pool
        ? 'Operator upload to task Storage then download into G3 pool'
        : 'Inline ARM/VM-agent delivery',
      aggregateGB: 0.001,
      firewallGB: pool ? 0.001 : 0,
      privateEndpointGB: 0,
      peeringGB: 0,
      azurePublicOutboundGB: 0,
      note: 'Operator upload is Azure inbound,not Azure public egress;VM agent/control-plane transfer not fictional ACR PE traffic',
    },
    {
      id: 'PINNED_PUBLIC_BASE',
      direction: 'Public builder download,inbound plus requests',
      aggregateGB: 2,
      firewallGB: 2,
      privateEndpointGB: 0,
      peeringGB: 0,
      azurePublicOutboundGB: 0.01,
      note: 'Inbound base-image bytes charged at firewall,not public outbound;outbound request/control budget separately included;no compilation-network dependency',
    },
    {
      id: 'FINAL_IMAGE_PUSH',
      direction: pool ? 'G3 pool->G2 ACR PE' : 'G2 VM->same-VNet G2 ACR PE',
      aggregateGB: 0.2,
      firewallGB: 0,
      privateEndpointGB: 0.2,
      peeringGB: pool ? 0.2 : 0,
      azurePublicOutboundGB: 0,
    },
    {
      id: 'ACA_IMAGE_PULL',
      direction: 'G2 ACR PE->G3 ACA',
      aggregateGB: 0.4,
      firewallGB: 0,
      privateEndpointGB: 0.4,
      peeringGB: 0.4,
      azurePublicOutboundGB: 0,
      note: 'Includes bounded initial/retry pulls;each crossing byte charged once per endpoint,not multiplied transfers',
    },
    {
      id: 'G3_LOCAL_KV',
      direction: 'ACA->G3 KV PE',
      aggregateGB: 0.02,
      firewallGB: 0,
      privateEndpointGB: 0.02,
      peeringGB: 0,
      azurePublicOutboundGB: 0,
    },
    {
      id: 'PLATFORM_PUBLIC',
      direction: 'Platform/control dependencies',
      aggregateGB: 1,
      firewallGB: 1,
      privateEndpointGB: 0,
      peeringGB: 0,
      azurePublicOutboundGB: 0.25,
    },
  ]
}
export function sumTraffic(rows) {
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length, 'DUPLICATED_TRAFFIC_PATH')
  for (const row of rows) {
    for (const key of [
      'aggregateGB',
      'firewallGB',
      'privateEndpointGB',
      'peeringGB',
      'azurePublicOutboundGB',
    ])
      assert(
        Number.isFinite(row[key]) && row[key] >= 0 && row[key] <= row.aggregateGB,
        `INVALID_TRAFFIC_SURFACE:${row.id}:${key}`,
      )
    if (['FINAL_IMAGE_PUSH', 'ACA_IMAGE_PULL', 'G3_LOCAL_KV'].includes(row.id))
      assert.equal(
        row.firewallGB + row.azurePublicOutboundGB,
        0,
        'PRIVATE_PATH_MISCHARGED_AS_PUBLIC',
      )
  }
  return Object.fromEntries(
    ['firewallGB', 'privateEndpointGB', 'peeringGB', 'azurePublicOutboundGB'].map((key) => [
      key,
      rows.reduce((sum, row) => sum + row[key], 0),
    ]),
  )
}
export function storageHeadroom(current, included, reserved) {
  assert(
    [current, included, reserved].every((value) => Number.isSafeInteger(value) && value >= 0),
    'INVALID_STORAGE_BYTES',
  )
  assert(current + reserved <= included, 'ACR_RESERVATION_EXCEEDS_INCLUDED;DENY_UNPRICED_EXCESS')
  return {
    CURRENT_BYTES_USED: current,
    INCLUDED_STORAGE_BYTES: included,
    G3_RESERVED_IMAGE_BYTES: reserved,
    RESULTING_MAXIMUM_BYTES: current + reserved,
    INCREMENTAL_STORAGE_COST_CAD: 0,
    prePushGate:
      'Fresh usage GET and bounded image size/reservation assertion required before push;headroom is captured evidence,not reservation or future guarantee',
  }
}
export function vaultBudget(meter) {
  const calls = {
    MAX_SECRET_CREATES: 1,
    MAX_SECRET_GETS: 40,
    MAX_SECRET_LISTS: 10,
    MAX_SECRET_DELETES: 1,
    MAX_SECRET_PURGES_IF_USED: 0,
    CONTROLLED_NEGATIVE_AUTHENTICATED_CALLS: 10,
    BOUNDED_RETRY_CONTINGENCY_CALLS: 38,
  }
  const total = Object.values(calls).reduce((sum, count) => sum + count, 0)
  assert.equal(total, 100)
  assert.equal(meter.unitOfMeasure, '10K')
  return {
    ...calls,
    MAX_AUTHENTICATED_REST_CALLS: total,
    MAX_SECRET_TRANSACTION_COST_CAD: (total / 10000) * meter.retailPrice,
    planDerivation:
      'Secret seeding1;one revision/replica injection/restart attempts up to40 gets;metadata/version audit up to10 calls;cleanup1 delete;ten authenticated negative controls;38 retries across these steps;all retries consume same shared100-call counter',
    hmacRequests: 'No per-HMAC Key Vault call;environment-injected synthetic key',
    purge:
      'Not used;purge protection remains enabled;secret values are never generated/read in G3R3B',
  }
}
export function conditionalCost(model, prices) {
  const quantities = sumTraffic(traffic(model))
  const lines = []
  function line(id, meter, quantity, divisor = 1, reason = '') {
    assert(Number.isFinite(quantity) && quantity >= 0 && divisor > 0)
    assert(Number.isFinite(meter.retailPrice) && meter.retailPrice >= 0)
    const sourceFile = meter.sourceFile
    assert(sourceFile, `METER_PROVENANCE_ABSENT:${id}`)
    lines.push({
      id,
      meter: { ...meter, sourceSha256: fileHash(sourceFile) },
      quantity,
      divisor,
      conditionalMaximumCAD: (quantity / divisor) * meter.retailPrice,
      reason,
    })
  }
  line('ACA_CPU', meters.activeCpu, 0.25 * 2 * 3600)
  line('ACA_MEMORY', meters.activeMemory, 0.5 * 2 * 3600)
  line('ACA_REQUESTS', meters.requests, 1000, 1000000)
  line('LOGS', meters.logIngestion, 0.25)
  line('KV_PE_HOURS', meters.vaultPrivateEndpoint, 2)
  line('KV_PE_INGRESS', meters.privateEndpointData, 0.01)
  line('KV_PE_EGRESS', meters.privateEndpointEgress, 0.01)
  line('ACR_PE_INGRESS', meters.privateEndpointData, 0.3)
  line('ACR_PE_EGRESS', meters.privateEndpointEgress, 0.3)
  line('PEERING_SOURCE', meters.intraRegionPeeringEgress, quantities.peeringGB)
  line('PEERING_DESTINATION', meters.intraRegionPeeringIngress, quantities.peeringGB)
  line('FIREWALL_PROCESSING', meters.firewallData, quantities.firewallGB)
  line(
    'DNS_ZONES',
    meters.privateDnsZone,
    2,
    1,
    'Conservative full catalog month unit for two new zones;existing G2 zone base not duplicated',
  )
  line('DNS_QUERIES', meters.privateDnsQueries, 10000, 1000000)
  line('LOAD_BALANCER_HOURS', meters.loadBalancer, 2)
  line('LOAD_BALANCER_DATA', meters.loadBalancerData, 0.02)
  line('PLATFORM_IP', meters.potentialPlatformEgressIp, 2)
  const egress = read(path.join(evidence, 'G3R3_PRICE_bandwidth-catalog.json')).items.find(
    (item) =>
      item.meterId === '9995d93a-7d35-4d3f-9c69-7a7fea447ef4' && item.tierMinimumUnits === 100,
  )
  assert(egress)
  line(
    'PUBLIC_OUTBOUND',
    { ...egress, sourceFile: 'G3R3_PRICE_bandwidth-catalog.json' },
    quantities.azurePublicOutboundGB,
    1,
    'Paid Global MGN rate;no free allowance;public download inbound is not outbound',
  )
  line('VAULT_OPERATIONS', prices.vault.meter, 100, 10000)
  if (model === 'EXISTING_G2_BUILDER_VM')
    line(
      'EXISTING_E4_DISK_TRANSACTIONS',
      prices.disk.meter,
      43400 * 2,
      10000,
      'One proposed hour can cross two billing-hour windows;charge both hourly caps conservatively;not a hard lifetime bound',
    )
  return {
    model,
    lines,
    conditionalSubtotalCAD: lines.reduce((sum, line) => sum + line.conditionalMaximumCAD, 0),
    selectedBuilderMaximumCAD: null,
    applicableAllocatedCpuSeconds: model === 'ACR_DEDICATED_AGENT_POOL_S1' ? 2 * 3600 : 0,
    excludedUnboundLines:
      model === 'ACR_DEDICATED_AGENT_POOL_S1'
        ? [
            'DEDICATED_POOL_ALLOCATION',
            'SOURCE_STAGING_RETENTION',
            'INDEPENDENT_CLEANUP_ENFORCEMENT',
          ]
        : ['IDENTITY_ISOLATION_AND_CLEANUP_ENFORCEMENT'],
    allIn: false,
    hardBound: false,
    parentSubtotalReused: false,
  }
}
export function costs(selection, prices) {
  const usage = captured('registry-usage').value.find((entry) => entry.name === 'Size')
  assert.equal(usage.unit, 'Bytes')
  const reserved = Math.ceil(0.2 * 1024 ** 3)
  const storage = storageHeadroom(usage.currentValue, usage.limit, reserved)
  const budget = vaultBudget(prices.vault.meter)
  return {
    SELECTED_BUILDER: selection.SELECTED_PRIVATE_BUILD_MODEL,
    status: 'PARTIAL_FACT_CLOSURE;NO_SELECTED_BUILDER_OR_ENFORCEABLE_ALL_IN_MAXIMUM',
    currency: 'CAD',
    priceFacts: prices,
    keyVault: { ...prices.vault, ...budget },
    acrStorage: storage,
    sharedCostsExcluded: [
      'Existing G2 VM compute',
      'Existing disk capacity/mount',
      'Existing Premium ACR base500GiB included',
      'Existing ACR PE hourly base',
      'Existing G2 firewall hourly base',
      'Existing G2 DNS zone base',
    ],
    logging: {
      MAX_LOG_INGESTION_GB: 0.25,
      PRICE_PER_GB: meters.logIngestion.retailPrice,
      MAX_LOG_COST_CAD_CONDITIONAL: 0.25 * meters.logIngestion.retailPrice,
      meter: meters.logIngestion,
      ENFORCEMENT: 'SOFT_WORKSPACE_QUOTA_DELAYED;NO_HARD_CAP',
      proposedDiagnosticContingencyGB: 0.25,
      contingencyCoversAllPossibleOverrun: false,
      missing:
        'Independent cleanup/diagnostic cutoff under controller failure;finite arbitrary contingency is not a hard guarantee',
    },
    candidateTraffic: selection.score.map(({ model }) => ({
      model,
      paths: traffic(model),
      surfaces: sumTraffic(traffic(model)),
    })),
    candidateConditionalReconstruction: selection.score.map(({ model }) =>
      conditionalCost(model, prices),
    ),
    SELECTED_BUILDER_MAX_COST_CAD: null,
    EXPECTED_PROOF_RUN_COST_CAD: null,
    BOUNDED_MAX_PROOF_RUN_COST_CAD: null,
    ROLLBACK_ALLOWANCE_CAD: null,
    DIAGNOSTIC_CONTINGENCY_CAD: null,
    UNCERTAINTY_BUFFER_CAD: null,
    RECOMMENDED_EXECUTION_CEILING_CAD: 'UNSUPPORTED',
    HUMAN_APPROVED_EXECUTION_CEILING_CAD: 'UNBOUND',
    numericCeilingRule: [
      'BUILDER',
      'KEY_VAULT_OPERATIONS',
      'ACR_STORAGE',
      'LOGGING',
      'NETWORK',
      'COMPUTE',
      'ROLLBACK',
    ].map((name) => ({
      name,
      status: ['KEY_VAULT_OPERATIONS', 'ACR_STORAGE'].includes(name)
        ? 'BOUND'
        : 'UNBOUND_MATERIAL_FACT',
    })),
    parentConditionalMaximum: '6.9849_RETIRED_AS_CURRENT_BASIS;NO_NEW_VM_OR_NEW_DISK_CHARGE',
    exactResiduals: [
      'No candidate meets every material criterion;see comparison',
      'B dedicated allocation-second CAD mapping absent',
      'Independent builder/credential/source and proof cleanup enforcement unbound',
      'Logging/network/proof-lived-resource quantities are conditional;soft quotas and alerts do not enforce lifetime ceilings',
    ],
  }
}
export function successorPlan(selection) {
  assert.equal(selection.SELECTED_PRIVATE_BUILD_MODEL, 'NONE')
  validateDag(parentPlan.steps)
  return {
    PARENT_EXECUTION_PLAN_DIGEST: fileHash('G3R3_EXECUTION_PLAN.json'),
    SELECTED_BUILDER: 'NONE',
    status: 'PARENT_ORDER_PRESERVED_NOT_NORMALIZED;NO_SELECTION_NO_EXECUTION',
    NEW_STEP_COUNT: parentPlan.steps.length,
    CYCLES: 0,
    steps: parentPlan.steps,
    graph: parentPlan.graph,
    rationale:
      'No selected builder changes execution ordering;preserve parent17-step plan as successor reference,do not invent a controller',
    postEnvironmentQuotaGate: parentPlan.postEnvironmentQuotaGate,
    imageAuthority: {
      PRIVATE_ACR_REGISTRY_MANIFEST_DIGEST: 'UNBOUND_UNTIL_AUTHORIZED_FUTURE_PUSH',
      MUTABLE_TAG_AUTHORITY: 'PROHIBITED',
      WORKLOAD_IMAGE: `${captured('registry').properties.loginServer}/${repository}@sha256:<FUTURE_ACTUAL_REGISTRY_MANIFEST_DIGEST>`,
      localConfigDigestIsRegistryAuthority: false,
      buildMustPrecedeActivation: true,
    },
    authorization: 'NOT_AUTHORIZED',
    allMutationFlagsRemainFalse: true,
  }
}
export const outputs = [
  'G3R3B_BUILDER_COMPARISON.json',
  'G3R3B_BUILDER_SELECTION.json',
  'G3R3B_BUILDER_PRIVILEGE_SUPPLEMENT.json',
  'G3R3B_G2_BUILDER_SUPPLEMENT.json',
  'G3R3B_COST_CLOSURE.json',
  'G3R3B_EXECUTION_PLAN.json',
  'G3R3B_FINAL_HUMAN_AUTHORIZATION_PACKET.md',
  'G3R3B_EXECUTION_READINESS.json',
  'G3R3B_EXECUTION_READINESS.md',
]
const config = await resolveConfig(path.join(root, '..', '..', 'package.json'))
async function write(name, value) {
  const json = name.endsWith('.json')
  writeFileSync(
    path.join(evidence, name),
    await format(json ? JSON.stringify(value) : value, {
      ...config,
      parser: json ? 'json' : 'markdown',
    }),
  )
}
export async function generate() {
  verify()
  checkReads()
  const comparison = compareBuilders()
  const selection = choose(comparison)
  assert.equal(selection.SELECTED_PRIVATE_BUILD_MODEL, 'NONE')
  const privilege = privilegeOptions()
  const g2Supplement = supplement(selection)
  const compositeManifest = composite(g2Supplement)
  const cost = costs(selection, comparison.prices)
  const plan = successorPlan(selection)
  const human = {
    A: {
      group: 'ACCOUNTABILITY',
      LIFECYCLE_OWNER: 'UNBOUND',
      EXECUTION_OPERATOR: 'RECOMMENDED_NOT_APPOINTED',
      recommendedPrincipal: principal,
      HUMAN_APPROVER: 'UNBOUND',
      constraint: 'EXECUTION_OPERATOR != HUMAN_APPROVER',
    },
    B: {
      group: 'COMPOSITE_G2_MUTATION_AUTHORIZATION',
      ...compositeManifest,
      ROLLBACK_STATUS: 'CORE_GUARDED;BUILDER_INCOMPLETE',
      HUMAN_APPROVAL: 'UNBOUND',
    },
    C: {
      group: 'EXECUTION_COST_CEILING',
      RECOMMENDED_EXECUTION_CEILING_CAD: 'UNSUPPORTED',
      HUMAN_APPROVED_EXECUTION_CEILING_CAD: 'UNBOUND',
    },
  }
  const readiness = {
    mission: 'NZ-20261008-INFRA-001',
    phase: 'G3R3B',
    G3R3B_GATE: 'BLOCKED',
    ROOT_1: 'CLOSED',
    ROOT_1_REOPENED: 'NO',
    G3_SYNTHETIC_PROOF_V1: 'QUALIFIED_LOCAL_NOT_PUSHED',
    G3R2I_IMAGE_QUALIFICATION: 'PRESERVED',
    SELECTED_PRIVATE_BUILD_MODEL: 'NONE',
    ROOT_2_TECHNICAL_PACKET: 'FROZEN_CORE_PLUS_CANDIDATE_OPTIONS;BUILDER_EXTENSION_INCOMPLETE',
    ROOT_2_HUMAN_AUTHORIZATION: 'PENDING',
    ROOT_3_TECHNICAL_PACKET: 'FROZEN_SEVEN_CHANGE_CORE;NO_SELECTED_SUPPLEMENT',
    ROOT_3_HUMAN_AUTHORIZATION: 'PENDING',
    ROOT_4_COST_MODEL: 'VAULT_AND_DISK_RATES_CLOSED;MATERIAL_BUILDER_AND_ENFORCEMENT_FACTS_UNBOUND',
    ROOT_4_HUMAN_AUTHORIZATION: 'PENDING',
    G3_EXECUTION_READINESS: 'BLOCKED',
    G3A: 'NOT_AUTHORIZED_PENDING_HUMAN_DECISIONS',
    G3B: 'NOT_AUTHORIZED',
    composite: compositeManifest,
    normalizedHumanSlots: human,
    FINAL_HUMAN_PACKET: 'NOT_ISSUED;G3R3B_PASS_REQUIRED_BEFORE_PRESENTATION',
    exactResiduals: selection.score.map(({ model, materialResiduals }) => ({
      model,
      materialResiduals,
    })),
    ceiling: { recommended: 'UNSUPPORTED', humanApproved: 'UNBOUND' },
    localValidation: existsSync(path.join(evidence, 'G3R3B_LOCAL_VALIDATION.json'))
      ? {
          file: 'G3R3B_LOCAL_VALIDATION.json',
          sha256: fileHash('G3R3B_LOCAL_VALIDATION.json'),
          scope: 'LOCAL_PACKETS_ONLY;NOT_FUTURE_EFFECTIVE_AUTHORIZATION_OR_LIVE_PROOF',
        }
      : null,
    preservation: {
      file: 'G3R3B_PRESERVATION.json',
      sha256: fileHash('G3R3B_PRESERVATION.json'),
      frozenCoreDigest: coreDigest,
    },
    readOnlyEvidence: {
      ledger: 'G3R3B_READ_LEDGER.json',
      sha256: fileHash('G3R3B_READ_LEDGER.json'),
      calls: ledger.length,
      succeeded: ledger.filter((entry) => entry.status === 'SUCCEEDED').length,
      failed: ledger.filter((entry) => entry.status === 'FAILED').length,
      failures: ledger
        .filter((entry) => entry.status === 'FAILED')
        .map(({ name, responseFile, error }) => ({ name, responseFile, error: error ?? null })),
      boundedRetries:
        'Unsupported stable agentPool GET version retained;server-supported preview retry succeeded. Obsolete task REST documentation404 and obsolete OpenAPI directory404 retained;current SDK/schema and discovered RegistryTasks OpenAPI contracts captured instead.',
    },
    boundaries: Object.fromEntries(
      [
        'AZURE_RESOURCE_MUTATIONS',
        'AZURE_RBAC_MUTATIONS',
        'AZURE_REGISTRY_MUTATIONS',
        'G2_MUTATIONS',
      ].map((key) => [key, 0]),
    ),
    executionBoundaries: Object.fromEntries(
      [
        'IMAGE_PUSHED',
        'PRIVATE_BUILD_EXECUTED',
        'RUN_COMMAND_EXECUTED',
        'AGENT_POOL_CREATED',
        'LIVE_PROOF_EXECUTED',
        'G3A_EXECUTED',
        'G3B_EXECUTED',
        'HUMANS_APPOINTED',
        'COST_CEILING_APPROVED',
      ].map((key) => [key, 'NO']),
    ),
  }
  const values = [
    comparison,
    selection,
    privilege,
    { ...g2Supplement, composite: compositeManifest },
    cost,
    plan,
  ]
  for (let i = 0; i < values.length; i++) await write(outputs[i], values[i])
  await write(
    outputs[6],
    `# G3R3B final human authorization packet - NOT ISSUED

G3R3B is **BLOCKED**. This file is a withholding notice,not a regenerated final authorization packet or an approval request.
The [frozen parent human packet](./G3R3_FINAL_HUMAN_AUTHORIZATION_PACKET.md) remains byte-identical.
No additional builder decision is introduced;architecture selection is technical and currently **NONE**.

The only reserved successor groups are:

## A - Accountability (reserved,not presented)

Lifecycle owner **UNBOUND**;execution operator **RECOMMENDED_NOT_APPOINTED** (${principal});human approver **UNBOUND**.
Execution operator must differ from approver.

## B - Composite G2 mutation authorization (reserved,not presented)

Core digest **${coreDigest}**.
Builder supplement digest **${g2Supplement.SUPPLEMENT_DIGEST}**.
Composite linkage digest **${compositeManifest.COMPOSITE_AUTHORIZATION_DIGEST}**.
Rendered change count **7 core +0 selected-builder**;zero supplement changes does not mean either candidate needs no changes.
Core rollback is guarded;builder rollback incomplete. This composite binds an incomplete empty supplement and **is not approvable**.
Human authority remains **UNBOUND**.

## C - Execution cost ceiling (reserved,not presented)

Applicable Standard-vault ordinary-operation CAD rate is bound,but no all-in numerical ceiling is supported.
Recommendation **UNSUPPORTED**;human-approved ceiling **UNBOUND**.

Issue/present the final exactly-three-decision packet only after every material technical criterion passes.
No people,roles,changes,costs,G3A or G3B are authorized by this notice.
`,
  )
  await write(outputs[7], readiness)
  await write(
    outputs[8],
    `# G3R3B execution readiness - BLOCKED

ROOT-1 remains **CLOSED**;qualified source/image and every frozen G3R3 core output are unchanged.
The unbound new B2s receiver is **SUPERSEDED_AS_DEFAULT_NOT_SELECTED**,not deleted from history.

- [Comparison](./G3R3B_BUILDER_COMPARISON.json) evaluates exactly two candidates. Existing G2 VM source delivery and short-lived protected-token contracts are supported;guest tooling/DNS/disk/conflict checks are runtime deny gates,not automatic blockers. Existing guest identity isolation and failure-safe daemon/credential cleanup remain unbound.
- ACR S1 is **PREVIEW,ONE_SYNTHETIC_PROOF_ONLY**,not a runtime dependency. CanadaCentral/Premium/VNet/local-source/private-ACR support is current. Proposed task timeout1800s lies within documented300-28800s task limits. Timeout does not scale the pool to zero. Dedicated allocation-second CAD applicability and independent allocation cleanup remain unbound.
- [Selection](./G3R3B_BUILDER_SELECTION.json): **NONE**;neither candidate satisfies all material criteria. No third architecture.
- [Privilege options](./G3R3B_BUILDER_PRIVILEGE_SUPPLEMENT.json) validate real provider actions,including plural managed **runCommands/write**;the singular spelling in the guidance is not in the live catalog. No selected delta or grant is issued.
- [G2 supplement](./G3R3B_G2_BUILDER_SUPPLEMENT.json): frozen core digest **${coreDigest}**;supplement digest **${g2Supplement.SUPPLEMENT_DIGEST}**;composite linkage **${compositeManifest.COMPOSITE_AUTHORIZATION_DIGEST}**. Seven core changes remain;selected supplement0 because selection is absent,not because either candidate needs zero changes. Composite is deterministic but incomplete/nonapprovable.
- [Cost closure](./G3R3B_COST_CLOSURE.json): Standard Global secret **Operations** meter **${comparison.prices.vault.meter.meterId}**,CAD${comparison.prices.vault.meter.retailPrice}/10K;Standard CanadaCentral row agrees. Non-primary rows were excluded by the parent query;no Premium/foreign substitution. Plan allowance100 authenticated calls costs **CAD${cost.keyVault.MAX_SECRET_TRANSACTION_COST_CAD}** conditionally. Purges0;HMAC requests add no vault calls.
- Actual existing32GiB **StandardSSD_LRS** disk transaction meter is bound at CAD${comparison.prices.disk.meter.retailPrice}/10K;E4 hourly paid cap43400 supports conditional transaction calculations,not an unbounded-duration total. Existing VM/disk fixed bases are shared,not new charges.
- ACR usage${cost.acrStorage.CURRENT_BYTES_USED}bytes,allowance${cost.acrStorage.INCLUDED_STORAGE_BYTES}bytes,reservation${cost.acrStorage.G3_RESERVED_IMAGE_BYTES}bytes fits;incremental storage0 conditional on refreshed headroom. Logging0.25GB and additional diagnostic0.25GB are soft scenarios,not guaranteed maximums.
- Costs are reconstructed by candidate from rate/quantity lines,not from parent6.9849. Public base downloads count at firewall,not outbound;G2-local push avoids peering while G3 pool push crosses it;PE ingress/egress split bytes and peering endpoint charges are distinct billing surfaces.
- Expected/all-in max,builder max,rollback,diagnostic and uncertainty costs remain **null**. Recommendation **UNSUPPORTED**;human approval **UNBOUND**.
- [Plan](./G3R3B_EXECUTION_PLAN.json): parent${parentPlan.steps.length}-step DAG retained;cycles0;environment creation->quota read->require>=250mCPU->activation remains intact. Future actual private registry manifest digest must precede workload activation;mutable tag/local config authority prohibited.
- [Human notice](./G3R3B_FINAL_HUMAN_AUTHORIZATION_PACKET.md):final packet **NOT_ISSUED** while blocked;only A accountability/B composite G2/C ceiling slots reserved,no fourth builder decision.

## Zero-mutation evidence

[Read ledger](./G3R3B_READ_LEDGER.json):${ledger.length} account/GET calls,${readiness.readOnlyEvidence.succeeded} succeeded,${readiness.readOnlyEvidence.failed} failed and retained.
No RunCommand,pool creation,ACR build/push,source upload,credential acquisition,RBAC/resource/G2 mutation,live proof,appointment or cost approval.
G3 execution **BLOCKED**;G3A **NOT_AUTHORIZED_PENDING_HUMAN_DECISIONS**;G3B **NOT_AUTHORIZED**.
${readiness.localValidation ? '\n[Local validation](./G3R3B_LOCAL_VALIDATION.json) records regression,formatting,syntax,preservation,determinism and documentation results;none establishes future guest/build operability or human authority.' : ''}
`,
  )
  const readFiles = readdirSync(evidence).filter((name) =>
    /^G3R3B_(READ_|PUBLIC_|PRICE_|PRESERVATION|LOCAL_VALIDATION)/.test(name),
  )
  await write('G3R3B_OUTPUT_BINDING.json', {
    scripts: ['g3r3b-read-evidence.mjs', 'g3r3b-builder-closure.mjs'].map((name) => ({
      name,
      sha256: hash(readFileSync(path.join(root, name))),
    })),
    files: [...outputs, ...readFiles].map((name) => ({ name, sha256: fileHash(name) })),
  })
  verify()
  return readiness
}
export function check() {
  verify()
  checkReads()
  const binding = read(path.join(evidence, 'G3R3B_OUTPUT_BINDING.json'))
  for (const entry of binding.scripts)
    assert.equal(hash(readFileSync(path.join(root, entry.name))), entry.sha256)
  for (const entry of binding.files)
    assert.equal(fileHash(entry.name), entry.sha256, `SUCCESSOR_CHANGED:${entry.name}`)
  const g2Supplement = read(path.join(evidence, outputs[3]))
  const { SUPPLEMENT_DIGEST, composite: compositeManifest, ...unsigned } = g2Supplement
  assert.equal(digest(unsigned), SUPPLEMENT_DIGEST)
  const { COMPOSITE_AUTHORIZATION_DIGEST, ...manifest } = compositeManifest
  assert.equal(digest(manifest), COMPOSITE_AUTHORIZATION_DIGEST)
  assert.equal(g2Supplement.PARENT_G2_PACKET_SHA256, coreDigest)
  assert.equal(
    read(path.join(evidence, outputs[4])).RECOMMENDED_EXECUTION_CEILING_CAD,
    'UNSUPPORTED',
  )
  validateDag(read(path.join(evidence, outputs[5])).steps)
  return { localPackets: 'PASS', G3R3B_GATE: 'BLOCKED', mutations: 0 }
}
export async function main(args) {
  assert(
    args.length === 1 && ['--write', '--check'].includes(args[0]),
    'LOCAL_PACKET_ONLY;NO_EXECUTION_FLAGS',
  )
  if (args[0] === '--write') await generate()
  else check()
  console.log('PASS local G3R3B packet/preservation checks;technical G3R3B BLOCKED;zero mutation')
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2))
