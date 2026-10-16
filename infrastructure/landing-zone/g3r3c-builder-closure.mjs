import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { evidence, files, hash, read, root, source } from './g3r2i-preservation.mjs'
import {
  digest,
  sourceDelivery,
  traffic,
  sumTraffic,
  vaultBudget,
} from './g3r3b-builder-closure.mjs'
import { coreDigest, registry, vm } from './g3r3b-read-evidence.mjs'
import { validateDag } from './g3r3-execution-envelope.mjs'
import { checkReads, verify } from './g3r3c-contract-evidence.mjs'

const principal = 'bfa4a851-696a-4d3f-927b-5fb1526f79f2'
export const repository = 'g3-synthetic-runtime'
const parent = read(path.join(evidence, 'G3R3B_BUILDER_COMPARISON.json')).candidates[0]
const parentCost = read(path.join(evidence, 'G3R3B_COST_CLOSURE.json'))
const parentPlan = read(path.join(evidence, 'G3R3_EXECUTION_PLAN.json'))
const writer = read(
  path.join(evidence, 'G3R3_OPERATOR_PRIVILEGE_PACKET.json'),
).proposedAssignments.find((entry) => entry.assignmentId === 'operator-repository-writer')
const ledger = read(path.join(evidence, 'G3R3C_READ_LEDGER.json'))
const fileHash = (name) => hash(readFileSync(path.join(evidence, name)))
const qualification = read(path.join(evidence, 'G3R2I_IMAGE_QUALIFICATION.json'))
export const actions = writer.ROLE.permissions.flatMap((entry) => entry.dataActions).sort()
export const condition = `((${actions.map((action) => `!(ActionMatches{'${action}'})`).join(' AND ')}) OR (@Request[Microsoft.ContainerRegistry/registries/repositories:name] StringEquals '${repository}'))`
export const limits = {
  BUILD_RUNTIME_LIMIT_SECONDS: 1800,
  CLEANUP_WATCHDOG_DEADLINE_SECONDS: 1900,
  CLEANUP_SERVICE_TIMEOUT_SECONDS: 60,
  RUN_COMMAND_TIMEOUT_SECONDS: 2100,
  TOKEN_MAX_LIFETIME_SECONDS: 10800,
  TOKEN_BUILD_SAFETY_MARGIN_SECONDS: 300,
  PROPOSED_DISK_TRANSACTION_CAP: 10000,
}
function document(name) {
  const entry = ledger.findLast((entry) => entry.name === name && entry.status === 'SUCCEEDED')
  assert(entry, `CONTRACT_REQUIRED:${name}`)
  return { url: entry.url, file: entry.responseFile, sha256: entry.responseSha256 }
}
function documentText(name) {
  return readFileSync(path.join(evidence, document(name).file), 'utf8')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}
export function tokenWindow(expiry, now, remainingMaximum = limits.TOKEN_MAX_LIFETIME_SECONDS) {
  assert([expiry, now, remainingMaximum].every(Number.isSafeInteger), 'TOKEN_TIME_NOT_INTEGER')
  const remaining = expiry - now
  return (
    remaining > limits.BUILD_RUNTIME_LIMIT_SECONDS + limits.TOKEN_BUILD_SAFETY_MARGIN_SECONDS &&
    remaining <= remainingMaximum
  )
}
export function abacAllows(grant, action, candidate) {
  assert(typeof action === 'string', 'INVALID_ACTION')
  if (
    typeof candidate !== 'string' ||
    !/^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*$/.test(candidate)
  )
    return { allowed: false, reason: 'INVALID_CANONICAL_REPOSITORY' }
  if (
    grant.principalId !== principal ||
    grant.scope !== registry ||
    grant.roleId !== writer.ROLE.id ||
    grant.conditionVersion !== '2.0' ||
    grant.condition !== condition
  )
    return { allowed: false, reason: 'NONEXACT_PRINCIPAL_SCOPE_ROLE_OR_CONDITION' }
  if (!actions.includes(action)) return { allowed: false, reason: 'ACTION_NOT_IN_WRITER_ROLE' }
  return candidate === repository
    ? { allowed: true, reason: 'EXACT_REQUEST_REPOSITORY' }
    : { allowed: false, reason: 'REPOSITORY_MISMATCH' }
}
export function abacContract() {
  assert(
    documentText('abac').includes(
      '@Request[Microsoft.ContainerRegistry/registries/repositories:name]',
    ),
  )
  return {
    result: 'PASS_STATIC_REQUEST_ATTRIBUTE_CONTRACT;NOT_A_LIVE_AUTHORIZATION_TEST',
    recommendedPrincipal: principal,
    principalAppointed: false,
    role: writer.ROLE,
    scope: registry,
    repository,
    conditionVersion: '2.0',
    condition,
    grant: {
      principalId: principal,
      scope: registry,
      roleId: writer.ROLE.id,
      conditionVersion: '2.0',
      condition,
    },
    frozenParentCondition: writer.CONDITION,
    normalization:
      'Frozen core uses@Resource. Current Microsoft ACR example uses@Request. Supplemental desired-state instruction replaces condition before future core grant;parent bytes/digest are not rewritten. This is a G2/RBAC-side supplement,not ROOT-1 source engineering.',
    source: document('abac'),
    REGISTRY_WIDE_WRITER: 'NO',
    CATALOG_LISTER: 'NO',
    EXISTING_VM_ACR_AUTHORITY_USED_FOR_G3_PUSH: 'NO',
    guestIsolation: 'BLOCKED_EFFECTIVE_FENCE_AND_ENGINE_LIFECYCLE_QUALIFICATION',
    tokenScope: `repository:${repository}:pull,push`,
    legacyAcrPush: 'REJECTED',
    actionRoleEvaluator: 'Exact proposed contract evaluator;not Azure token/deny/PIM simulation',
    applicableBoundary:
      'Exact G2 registry/repository only;unrelated staging assignment is not silently revoked and is not claimed globally absent',
  }
}
export function renderScript() {
  const original = sourceDelivery()
  assert.equal(original.SOURCE_FILE_COUNT, 6)
  assert.equal(original.SOURCE_TOTAL_BYTES, 14502)
  assert.equal(original.REPRESENTATIVE_REQUEST_BYTES, 20741)
  const directory = path.join(source, 'workload', 'synthetic-proof')
  const payload = files(directory).map((entry) => ({
    ...entry,
    base64: readFileSync(path.join(directory, entry.path)).toString('base64'),
  }))
  const encodedDigest = digest(payload.map(({ path, base64 }) => ({ path, base64 })))
  const manifest = JSON.stringify(payload.map(({ path, sha256 }) => ({ path, sha256 })))
  assert.equal(hash(manifest), original.SOURCE_TREE_SHA256)
  const script = readFileSync(path.join(root, 'g3r3c-builder-template.sh'), 'utf8').replace(
    /\r\n/g,
    '\n',
  )
  assert.equal(script.split('@@SOURCE_PAYLOAD@@').length, 2)
  const lines = payload.flatMap((entry) => [
    `printf '%s' '${entry.base64}' | base64 -d > "$workspace/source/${entry.path}"`,
    `[[ "$(sha256sum "$workspace/source/${entry.path}" | awk '{print $1}')" == ${entry.sha256} ]] || fail SOURCE_HASH`,
    `chmod 644 "$workspace/source/${entry.path}"`,
  ])
  lines.push(
    `[[ "$(find "$workspace/source" -mindepth 1 -maxdepth 1 -type f | wc -l)" == 6 ]] || fail SOURCE_COUNT`,
    `[[ "$(printf '%s' '${manifest}' | sha256sum | awk '{print $1}')" == ${original.SOURCE_TREE_SHA256} ]] || fail TREE_MANIFEST`,
  )
  const rendered = script.replace('@@SOURCE_PAYLOAD@@', lines.join('\n'))
  const request = {
    location: 'canadacentral',
    properties: {
      source: { script: rendered },
      asyncExecution: false,
      treatFailureAsDeploymentFailure: true,
      timeoutInSeconds: limits.RUN_COMMAND_TIMEOUT_SECONDS,
      protectedParameters: [
        { name: 'mode', value: 'build' },
        { name: 'runId', value: '<FUTURE_CANONICAL_RUN_ID>' },
        { name: 'tokenExpiryUnix', value: '<FUTURE_VALIDATED_TOKEN_EXPIRY>' },
        { name: 'acrToken', value: '<FUTURE_SHORT_LIVED_VALUE_NOT_CREATED>' },
      ],
    },
  }
  return {
    script: rendered,
    request,
    facts: {
      ...original,
      PARENT_REPRESENTATIVE_REQUEST_BYTES: original.REPRESENTATIVE_REQUEST_BYTES,
      ENCODED_SOURCE_SHA256: encodedDigest,
      EXPECTED_GUEST_TREE_SHA256: original.SOURCE_TREE_SHA256,
      BUILDER_SCRIPT_SHA256: hash(rendered),
      FULL_SUCCESSOR_REQUEST_BYTES: Buffer.byteLength(JSON.stringify(request)),
      schema: 'Microsoft.Compute/virtualMachines/runCommands@2024-07-01',
      digestBindsSourceAndGuardWorker: true,
      payloadHashMethod:
        'SHA256 sorted-key canonical JSON UTF-8 array of {path,base64};tree is accepted sorted{path,sha256} JSON byte hash',
      payloadSizeInterpretation:
        '20741 bytes remains parent representative source-only request;full guard/worker/source request is separately measured,no claim it remained20741',
    },
  }
}
export function scanScript(script) {
  const patterns = [
    ['IMDS_LITERAL', /169\.254\.169\.254/i],
    ['IDENTITY_ENDPOINT', /IDENTITY_ENDPOINT/i],
    ['MSI_ENDPOINT', /MSI_ENDPOINT/i],
    ['IDENTITY_LOGIN', /az\s+login\s+--identity/i],
    ['DEFAULT_CREDENTIAL_CHAIN', /DefaultAzureCredential/i],
    ['SHELL_XTRACE', /(?:^|\n)\s*set\s+-[^\n]*x/m],
    ['TOKEN_ECHO', /echo[^\n]*\$(?:\{)?(?:TOKEN|token)/],
    ['ENVIRONMENT_DUMP', /(?:^|\n)\s*(?:env|printenv)(?:\s|$)/m],
    ['PASSWORD_ARGUMENT', /docker[^\n]*login[^\n]*--password(?:\s|=)/],
    ['PERSISTENT_DOCKER_CONFIG', /\/root\/\.docker|~\/\.docker/],
    ['BROAD_PRUNE', /docker\s+(?:system\s+prune|builder\s+prune)|rm\s+-[^\n]*\s+\/(?:\s|$)/],
    ['HOST_DOCKER_FALLBACK', /DOCKER_HOST=.*\/var\/run\/docker\.sock/],
  ]
  return patterns.filter(([, pattern]) => pattern.test(script)).map(([id]) => id)
}
export const failureCases = [
  'source hash mismatch',
  'DNS failure',
  'ACR connection failure',
  'token failure',
  'base pull failure',
  'compile failure',
  'push failure',
  'Run Command timeout',
  'SIGTERM',
  'unexpected shell exit',
]
export function cleanupTrace(
  failure,
  { armed = true, systemdResponsive = true, fenceEffective = true } = {},
) {
  assert(failureCases.includes(failure), 'UNKNOWN_FAILURE_CASE')
  if (!systemdResponsive)
    return {
      failure,
      CLEANUP_EXPECTED: 'YES',
      outcome: 'BLOCKED',
      rawTokenResidual: null,
      steps: [
        'Parent shell can disappear',
        'Timer cannot execute while guest/systemd is unresponsive',
        'No successful cleanup receipt may be asserted',
      ],
    }
  const beforeMaterial = ['DNS failure', 'ACR connection failure', 'token failure'].includes(
    failure,
  )
  if (!beforeMaterial && !armed)
    return {
      failure,
      CLEANUP_EXPECTED: 'YES',
      outcome: 'DENY_BEFORE_TOKEN_OR_BUILD',
      rawTokenResidual: null,
      steps: ['Guard not armed => no credential staging or engine/build activation permitted'],
    }
  if (!fenceEffective)
    return {
      failure,
      CLEANUP_EXPECTED: 'YES',
      outcome: 'DENY_OR_UNPROVEN',
      rawTokenResidual: null,
      steps: ['Configured IPAddressDeny without effective BPF is not an isolation proof'],
    }
  return {
    failure,
    CLEANUP_EXPECTED: 'YES',
    outcome: 'PASS_MODEL_ONLY',
    rawTokenResidual: 0,
    scope:
      'Abstract transition proof under responsive systemd,armed timer/effective fence assumptions;no Bash/systemd/Docker execution',
    steps: beforeMaterial
      ? ['Preflight denied', 'No workspace credential/build exists']
      : [
          'Shell trap or independent timer fires',
          'Lock exact owned cleanup',
          'Stop exact build cgroup',
          'Logout exact registry through owned rootless socket',
          'Stop exact engine cgroup',
          'VerifyMainPID/ControlPID zero',
          'Delete only named volatile workspace',
          'ProveWorkspaceAbsent',
          'Write sanitized receipt',
          'Stop or expire timer',
        ],
  }
}
export function cleanupContract(rendered) {
  const systemdCaveat = documentText('systemd-resource-control')
  assert(/no effect in that case/.test(systemdCaveat))
  assert(documentText('systemd-timer').includes('AccuracySec='))
  return {
    status: 'STATIC_INDEPENDENT_GUARD_DESIGN;FAILURE_SAFE_PROOF_BLOCKED',
    BUILDER_SCRIPT_SHA256: rendered.facts.BUILDER_SCRIPT_SHA256,
    mainTrap: 'trap cleanup EXIT INT TERM HUP',
    independentGuard: {
      facility: 'Already-present systemd transient timer/service',
      beforeCredentialStaging: true,
      beforeBuild: true,
      deadlineSeconds: limits.CLEANUP_WATCHDOG_DEADLINE_SECONDS,
      accuracySec: 1,
      cleanupTimeoutSeconds: limits.CLEANUP_SERVICE_TIMEOUT_SECONDS,
      parentShellIndependent: true,
      service: 'nzila-g3-<32hexrun>-guard.service',
      timer: 'nzila-g3-<32hexrun>-guard.timer',
      daemonRuntimeSeconds: 1860,
      buildRuntimeSeconds: 1800,
      receipt: '/run/nzila-g3-receipts/<run-id>.json',
      G3_BUILD_RUN_ID:
        'Canonical32lowercasehex;workspace,engine/build/guard units,image tag and receipt all derive from same ID',
    },
    workspace: {
      path: '/run/nzila-g3-build/<run-id>',
      mustBeTmpfs: true,
      hostSwapMustBeAbsent: true,
      token:
        'Root-only temporary file;worker systemdLoadCredential copy;temporaryDOCKER_CONFIG in volatile runtime',
      existingGuestAccount:
        'nzila-g3-rootless;must already exist with subuid/subgid>=65536;no account or tooling installation',
      noPersistentHomeConfig: true,
      daemon:
        'Dedicated rootless engine with volatile data/exec roots;never host shared Docker socket',
      scopeDeviation:
        'Dedicated pre-existing rootless engine is an isolation requirement on same VM,not a new VM/agent pool;availability and kernel semantics are unproven and missing prerequisites deny',
    },
    removal: [
      'Stop only run-owned worker/daemon cgroups',
      'Exact-registry logout through temporary config',
      'Destroy source/config/token/owned daemon data in exact run tmpfs directory',
      'Prove named workspace absent before rawTokenResidualInWorkspace0 receipt',
      'Timer becomes inert;retain only sanitized receipt',
      'Retain pushed registry manifest;do not prune unrelated Docker or G2 resources',
    ],
    failurePaths: failureCases.map((failure) => cleanupTrace(failure)),
    missingIndependentGuarantees: [
      'Systemd documentation explicitly says IPAddressDeny may have no effect without BPF support. Script now denies absent ingress/egress attachments and mismatched link-local policy,but unqualified bpftool observations/source scans do not prove actual kernel/rootless-descendant enforcement.',
      'No offline guest/systemd/rootless engine qualification was authorized/performed;static traces cannot prove engine descendant termination and transient credential removal on real timeout/kill failures.',
      'Guest/systemd hang can delay monotonic timer and daemon RuntimeMax;host reboot stops tmpfs work but does not prove timed cleanup while stuck. Guard is not an independent Azure billed-lifetime or whole-G3 teardown controller.',
      'Protected RunCommand parameter storage/agent memory outside bounded workspace is not covered by workspace-zero receipt;no VM-wide credential-remanence claim.',
    ],
    sources: [
      'systemd-run',
      'systemd-exec',
      'systemd-resource-control',
      'systemd-timer',
      'systemd-service',
      'rootless-docker',
    ].map(document),
    RAW_TOKEN_RESIDUAL: 'REQUIRED_FUTURE_MEASURED_ZERO_IN_BOUNDED_WORKSPACE;NOT_OBSERVED_NOW',
    broadPrune: 'PROHIBITED',
    guestMutationsNow: 0,
  }
}
export function credentialContract(rendered) {
  const parentLedger = read(path.join(evidence, 'G3R3B_READ_LEDGER.json'))
  const authentication = parentLedger.find(
    (entry) => entry.name === 'doc-acr-authentication' && entry.status === 'SUCCEEDED',
  )
  assert(authentication, 'ACR_TOKEN_LIFETIME_SOURCE_REQUIRED')
  assert.equal(fileHash(authentication.responseFile), authentication.responseSha256)
  assert(readFileSync(path.join(evidence, authentication.responseFile), 'utf8').includes('3 hours'))
  return {
    status: 'SUPPORTED_FUTURE_PROTECTED_MODEL;NOT_MINTED_OR_DELIVERED',
    principal,
    appointed: false,
    LIVE_ACR_TOKEN_CREATED: 'NO',
    longLivedPassword: 'NO',
    adminAccount: 'NO',
    staticRegistrySecret: 'NO',
    sourceAuthority: 'Accepted G3R3B Microsoft ACR authentication contract:Entra login token3hours',
    lifetimeEvidence: {
      url: authentication.url,
      file: authentication.responseFile,
      sha256: authentication.responseSha256,
    },
    maxLifetimeSeconds: limits.TOKEN_MAX_LIFETIME_SECONDS,
    acceptedRemainingSeconds: { minExclusive: 2100, maxInclusive: 10800 },
    expiryVerification:
      'Controller validates issuer/audience/principal/repository and trusted UTC expiry before delivery;guest checks remaining time;decode-only untrustedJWTexp is not authority',
    delivery:
      'Only ManagedRunCommandprotectedParameters;do not put token in source/publicparameters/Environment/buildargs/console/stdout/stderr',
    apiParameters: rendered.request.properties.protectedParameters.map(({ name }) => name),
    worker:
      'SystemdLoadCredential non-command-line file->Dockerpassword-stdin;temporaryDOCKER_CONFIG;exactlogout;no Entra refresh or existing VM identity acquisition',
    dockerExchange:
      'Docker registry OAuth scope exchange is inherent login/push behavior;not an Entra refresh. No claim that guest performs zero registry-token exchanges.',
    lifetimeStop: 'No token renewal;expired/too-short/overlong token denies before staging/build',
    originalSourceCredentialObserver:
      'No real token/secret generated,transmitted or logged in this phase',
    caveat:
      'Protected API parameter masking does not prove VM-agent at-rest or shell-argument remanence;workspace receipt scope is bounded',
  }
}
export function g2Supplement(isolation) {
  const current = read(path.join(evidence, 'G3R3_G2_MUTATION_PACKET.json'))
  const beforeRole = current.changes.find(
    (entry) =>
      entry.RESOURCE_TYPE === 'Microsoft.Authorization/roleAssignments' &&
      JSON.stringify(entry.DESIRED_STATE).includes(principal),
  )
  assert(beforeRole, 'FROZEN_OPERATOR_ASSIGNMENT_REQUIRED')
  const fw = current.changes.find(
    (entry) =>
      entry.RESOURCE_TYPE === 'Microsoft.Network/azureFirewalls' &&
      entry.PROPERTY_PATH === 'properties.applicationRuleCollections',
  )
  assert(fw, 'CORE_FIREWALL_APP_CHANGE_REQUIRED')
  const value = {
    PARENT_G2_PACKET_SHA256: coreDigest,
    parentFileSha256: fileHash('G3R3_G2_MUTATION_PACKET.json'),
    parentG3R3BSupplement: fileHash('G3R3B_G2_BUILDER_SUPPLEMENT.json'),
    SELECTED_BUILDER: 'NONE',
    SUPPLEMENT_CHANGE_COUNT: 2,
    changes: [
      {
        id: 'g3r3c-request-abac-normalization',
        resourceId: beforeRole.RESOURCE_ID,
        action: 'Microsoft.Authorization/roleAssignments/write',
        kind: 'SUPERSEDES_CORE_DESIRED_CONDITION_ONLY_BEFORE_CREATION;NO_PARENT_REWRITE',
        principal,
        roleDefinitionId: writer.ROLE.id,
        scope: registry,
        parentCondition: writer.CONDITION,
        condition: isolation.condition,
        conditionVersion: '2.0',
        beforeGrant:
          'Execute composite desired-state resolution,not core@Resource grant followed by a permissive interval',
        rollback:
          'Delete only owned temporary proposed G3 repository Writer assignment;do not revoke standing unrelated grants',
      },
      {
        id: 'g3r3c-base-pull-egress',
        resourceId: fw.RESOURCE_ID,
        action: 'Microsoft.Network/azureFirewalls/write',
        property: 'properties.applicationRuleCollections',
        currentAfterCore: fw.DESIRED_STATE,
        appendCollection: {
          name: 'g3r3c-builder-base',
          priority: 230,
          action: { type: 'Allow' },
          rules: [
            {
              name: 'g3r3c-pinned-builder-pull',
              sourceAddresses: ['10.90.1.4/32'],
              targetFqdns: parent.basePull.FQDNS,
              protocols: [{ protocolType: 'Https', port: 443 }],
            },
          ],
        },
        destinationCatchall: 'NONE',
        sourceGuard:
          'Re-read exact G2 NIC privateIP10.90.1.4 and expected subnet;deny drift before authorization render',
        mutation:
          'GUARDED_WHOLE_FIREWALL_PUT_PRESERVE_CORE_AND_FOREIGN_PROPERTIES;freshETagReadRequired',
        rollback:
          'Remove only owned exact named collection with fresh etag and foreign-drift guards;never restore stale whole resource',
      },
    ],
    STATUS: 'PROPOSED_NOT_AUTHORIZED',
    builderQualification: 'INCOMPLETE;NO_EXECUTION',
    rollback: 'STATIC_OWNERSHIP_AND_ETAG_CONTRACT;GUEST_FAILURE_CLEANUP_NOT_PROVEN',
    unchanged: [
      'VM/NIC/disk/UAMI identity',
      'Existing NSG/route/DNS',
      'Frozen seven-change core bytes',
      'Public ACR Disabled',
    ],
    digestMethod: 'SHA256 sorted canonical JSON excluding SUPPLEMENT_DIGEST',
  }
  return { ...value, SUPPLEMENT_DIGEST: digest(value) }
}
export function composite(supplement) {
  const value = {
    CORE_PACKET_DIGEST: coreDigest,
    SUPPLEMENT_DIGEST: supplement.SUPPLEMENT_DIGEST,
    TOTAL_RECORDED_CHANGE_ENTRIES: 7 + supplement.SUPPLEMENT_CHANGE_COUNT,
    DISTINCT_FINAL_DESIRED_STATE_ENTRIES: 8,
    overlapResolution:
      'Core Writer condition is normalized before grant,not two sequential RBAC writes. Three firewall property/collection entries target one resource;physical PUT batching must be explicitly rendered/approved,not inferred from entry count.',
    PHYSICAL_MUTATION_COUNT: null,
    SELECTED_BUILDER: 'NONE',
    STATUS: 'INCOMPLETE_NOT_APPROVABLE;LINKAGE_ONLY',
    method: 'SHA256 sorted canonical JSON before COMPOSITE_G2_AUTHORIZATION_DIGEST',
  }
  return { ...value, COMPOSITE_G2_AUTHORIZATION_DIGEST: digest(value) }
}
export function privilegeSupplement() {
  const parentB = read(path.join(evidence, 'G3R3B_BUILDER_PRIVILEGE_SUPPLEMENT.json'))
  const a = parentB.candidateRequirements.EXISTING_G2_BUILDER_VM
  const core = read(path.join(evidence, 'G3R3_OPERATOR_PRIVILEGE_PACKET.json'))
  return {
    PARENT_G3R3_OPERATOR_PACKET: {
      file: 'G3R3_OPERATOR_PRIVILEGE_PACKET.json',
      sha256: fileHash('G3R3_OPERATOR_PRIVILEGE_PACKET.json'),
    },
    PARENT_G3R3B_SUPPLEMENT: {
      file: 'G3R3B_BUILDER_PRIVILEGE_SUPPLEMENT.json',
      sha256: fileHash('G3R3B_BUILDER_PRIVILEGE_SUPPLEMENT.json'),
    },
    selectedBuilder: 'NONE',
    recommendedPrincipal: principal,
    STATUS: 'PROPOSED_NOT_GRANTED',
    ADDITIONAL_REQUIREMENTS: a,
    inheritedProposedPermissions: core.proposedAssignments.filter((entry) =>
      ['operator-repository-writer', 'operator-g2-firewall'].includes(entry.assignmentId),
    ),
    exactConditionSupersession: condition,
    LIVE_PROVIDER_OPERATION: 'Microsoft.Compute/virtualMachines/runCommands/write',
    DOCUMENTATION_OPERATION_STRING: 'Microsoft.Compute/virtualMachines/runCommand/write',
    EXECUTION_AUTHORITY_SOURCE: 'LIVE_PROVIDER_OPERATION_CATALOG',
    providerCatalog: read(path.join(evidence, 'G3R3B_READ_LEDGER.json'))
      .filter((entry) => entry.name.startsWith('compute-operations-page-'))
      .map(({ responseFile, responseSha256 }) => ({ responseFile, responseSha256 })),
    noCatalogLister: true,
    noVmWriteDeleteDeallocateOrIdentityChange: true,
    customRole: {
      actions: [...new Set(a.map((entry) => entry.AZURE_ACTION))],
      noWildcard: true,
      noSubscriptionGrant: true,
    },
    guestPrivilege:
      'RunCommand supervisor is guest root;rootless worker is existing dedicated unprivileged account. Guest-root command authority is broader than repository data authority and must be separately accepted in DecisionA;not appointed here.',
  }
}
export function costClosure() {
  const meter = parentCost.priceFacts.disk.meter
  const vault = parentCost.priceFacts.vault.meter
  assert(limits.PROPOSED_DISK_TRANSACTION_CAP < parentCost.priceFacts.disk.hourlyPaidTransactionCap)
  const diskCost = (limits.PROPOSED_DISK_TRANSACTION_CAP / 10000) * meter.retailPrice
  const scenario = structuredClone(
    parentCost.candidateConditionalReconstruction.find(
      (entry) => entry.model === 'EXISTING_G2_BUILDER_VM',
    ),
  )
  const line = scenario.lines.find((entry) => entry.id === 'EXISTING_E4_DISK_TRANSACTIONS')
  line.quantity = limits.PROPOSED_DISK_TRANSACTION_CAP
  line.conditionalMaximumCAD = diskCost
  line.reason =
    'Proposed proof-specific10000transactions below capturedE4hourly43400paidcap;no proven enforcement =>conditional only'
  scenario.conditionalSubtotalCAD = scenario.lines.reduce(
    (sum, entry) => sum + entry.conditionalMaximumCAD,
    0,
  )
  return {
    status: 'RATE_BINDINGS_PRESERVED;UNBOUND_HARD_QUANTITIES_AND_FAILURE_CLEANUP',
    VM_FIXED_COST_INCREMENTAL_CAD: 0,
    DISK_FIXED_COST_INCREMENTAL_CAD: 0,
    accounting: 'Existing captured G2 VM/disk retained shared,no create/delete/resize charge',
    disk: {
      meter,
      PROPOSED_PROOF_TRANSACTION_CAP: limits.PROPOSED_DISK_TRANSACTION_CAP,
      SERVICE_HOURLY_MAXIMUM: parentCost.priceFacts.disk.hourlyPaidTransactionCap,
      MAX_INCREMENTAL_DISK_TRANSACTION_COST_CAD_CONDITIONAL: diskCost,
      capEnforcement:
        'UNPROVEN;volatile daemon data withswap0reducesguestwrites,butVMagent/systemd/controlwritesoutsideworkerarenotboundtothiscount',
    },
    keyVault: { meter: vault, ...vaultBudget(vault) },
    acrStorage: parentCost.acrStorage,
    logging: parentCost.logging,
    traffic: {
      model: 'EXISTING_G2_BUILDER_VM',
      paths: traffic('EXISTING_G2_BUILDER_VM'),
      surfaces: sumTraffic(traffic('EXISTING_G2_BUILDER_VM')),
    },
    reconstruction: scenario,
    BUILDER_A_MAX_INCREMENTAL_COST_CAD: null,
    EXPECTED_PROOF_RUN_COST_CAD: null,
    BOUNDED_MAX_PROOF_RUN_COST_CAD: null,
    ROLLBACK_ALLOWANCE_CAD: null,
    DIAGNOSTIC_CONTINGENCY_CAD: null,
    UNCERTAINTY_BUFFER_CAD: null,
    RECOMMENDED_EXECUTION_CEILING_CAD: 'UNSUPPORTED',
    HUMAN_APPROVED_EXECUTION_CEILING_CAD: 'UNBOUND',
    exactResiduals: [
      'Guest isolation/independent cleanup lacks executable qualification;do not claim static mock traces as runtime proof',
      '10000transactioncapisproposednotproved;servicehourlymaxdoesnotboundunlimitedcleanupduration',
      'GuestbuilderguarddoesnotteardownG3ACA/KV/PE/rolesandlogs;inheritedwholeprooflifetime/network/loghardboundsremainunbound',
    ],
    numericCeilingPolicy:
      'Onlycompleteenforcedlines+rollback+diagnostics+bufferallowceiling;knownsubtotalisnotrecommendation',
  }
}
export function executionPlan() {
  const steps = structuredClone(parentPlan.steps)
  const at = steps.findIndex((entry) => entry.id === 'private-production')
  const prototype = steps[at]
  const additions = [
    [
      'builder-host-preflight',
      'quota-gate',
      'ReadexactVM/NIC/subnet/privateACR/tooling/tmpfs/conflictandkernelguardcapability;noinstall',
    ],
    [
      'builder-isolation-qualification',
      'builder-host-preflight',
      'Denyuntilrootless/cgroupBPF/credentialcleanupqualificationproofisbound;notconfigurationproxy',
    ],
    [
      'builder-arm-independent-guard',
      'builder-isolation-qualification',
      'Createverifiedownedtimerbeforecredentialstagingorbuild;parentindependenceanddeadlines',
    ],
    [
      'builder-protected-credential',
      'builder-arm-independent-guard',
      'Deliverexactscopedshortlivedtokenprotectedonlyafterisolation/preflight;expiry>2100and<=10800',
    ],
  ].map(([id, dependency, action]) => ({
    ...prototype,
    id,
    dependsOn: [dependency],
    OWNER: 'GUEST_BUILDER',
    RESOURCE: vm,
    ACTION: action,
    PRECONDITIONS: [
      'Explicit human A/B/C and bounded downstream execution authority',
      'Every preceding step passed;no silent fallback',
    ],
    POSTCONDITIONS: [
      id === 'builder-isolation-qualification'
        ? 'Qualified effective sandbox and cleanup proof on file'
        : 'Exact step proof retained;failure denies next step',
    ],
    ROLLBACK:
      'Owned guest workspace/units only;retain existing G2 VM/NIC/disk/UAMI;revoke temporary scoped credential authority as separately approved',
  }))
  steps.splice(at, 0, ...additions)
  steps.find((entry) => entry.id === 'private-production').dependsOn = [
    'builder-protected-credential',
  ]
  Object.assign(
    steps.find((entry) => entry.id === 'private-production'),
    {
      OWNER: 'GUEST_BUILDER',
      RESOURCE: `${vm}/runCommands/g3-proof-<run-id>`,
      ACTION:
        'Execute only digest-bound qualified Builder A script;network-none compile and exact repository push;currently blocked',
      PRECONDITIONS: [
        'Qualified guest isolation/cleanup contract',
        'Verified timer/cgroup policy before worker release',
        'Repository-scoped short-lived protected token;no refresh',
        'All runtime preflight checks passed',
      ],
      POSTCONDITIONS: [
        'Owned run terminal push observation;no local-config authority substitution',
      ],
      ROLLBACK:
        'Stop exact run cgroups;destroy owned volatile credential/config/source/engine data;retain G2 VM/NIC/disk/UAMI and pushed manifest for separately authorized reconciliation',
    },
  )
  const digestStep = steps.find((entry) => entry.id === 'bind-registry-manifest')
  digestStep.G3R3C_REQUIREMENT =
    'ActualprivateACRmanifestdigestandfullyqualifiedrepositoryreference;notlocalconfig/mutabletag'
  const cleanupAt = steps.findIndex((entry) => entry.id === 'runtime-roles-and-secret')
  steps.splice(cleanupAt, 0, {
    ...prototype,
    id: 'builder-cleanup-receipt',
    dependsOn: ['bind-registry-manifest'],
    OWNER: 'GUEST_BUILDER',
    RESOURCE: vm,
    ACTION:
      'Verifyownedunitstopped,workspaceabsent,rawtokenresidual0inscope,receiptretained;failuredeniesworkload',
    PRECONDITIONS: ['Manifest digest retained', 'Main cleanup or independent guard completed'],
    POSTCONDITIONS: ['Sanitized actual cleanup receipt retained;not a mock/static trace'],
    ROLLBACK:
      'Deny activation and reconcile only owned units/workspace;never delete shared G2 VM/NIC/disk',
  })
  steps.find((entry) => entry.id === 'runtime-roles-and-secret').dependsOn = [
    'builder-cleanup-receipt',
  ]
  const teardown = steps.find((entry) => entry.id === 'teardown')
  teardown.ACTION =
    'By approved deadline teardown mission-owned G3 proof resources/temporary grants and exact composite G2 additions;retain existing G2 VM/NIC/disk/UAMI and sanitized evidence'
  teardown.POSTCONDITIONS = [
    'No owned guest cgroups/workspace/credentials remain;owned G3 proof resources and supplemental grants/rules reconciled without foreign deletion',
  ]
  for (let index = 0; index < steps.length; index++) steps[index].STEP = index + 1
  validateDag(steps)
  return {
    PARENT_EXECUTION_PLAN_DIGEST: fileHash('G3R3_EXECUTION_PLAN.json'),
    PARENT_G3R3B_PLAN_DIGEST: fileHash('G3R3B_EXECUTION_PLAN.json'),
    NEW_STEP_COUNT: steps.length,
    CYCLES: 0,
    SELECTED_BUILDER: 'NONE',
    steps,
    graph: steps.flatMap((entry) => entry.dependsOn.map((from) => ({ from, to: entry.id }))),
    postEnvironmentQuotaGate: parentPlan.postEnvironmentQuotaGate,
    missingQuota: 'DENY;NO_AUTOMATIC_REQUEST',
    privateRegistryAuthority: read(path.join(evidence, 'G3R3B_EXECUTION_PLAN.json')).imageAuthority,
    status: 'NORMALIZED_CONTRACT_DAG_NOT_AUTHORIZED;QUALIFICATION_STEP_BLOCKED',
  }
}
export const outputs = [
  'G3R3C_REPOSITORY_ISOLATION.json',
  'G3R3C_CREDENTIAL_DELIVERY.json',
  'G3R3C_BUILDER_SCRIPT_CONTRACT.json',
  'G3R3C_CLEANUP_CONTRACT.json',
  'G3R3C_BUILDER_PRIVILEGE_SUPPLEMENT.json',
  'G3R3C_G2_BUILDER_SUPPLEMENT.json',
  'G3R3C_COST_CLOSURE.json',
  'G3R3C_EXECUTION_PLAN.json',
  'G3R3C_FINAL_HUMAN_AUTHORIZATION_PACKET.md',
  'G3R3C_EXECUTION_READINESS.json',
  'G3R3C_EXECUTION_READINESS.md',
]
const config = await resolveConfig(path.join(root, '..', '..', 'package.json'))
async function write(name, value) {
  const isJson = name.endsWith('.json')
  writeFileSync(
    path.join(evidence, name),
    await format(isJson ? JSON.stringify(value) : value, {
      ...config,
      parser: isJson ? 'json' : 'markdown',
    }),
  )
}
export async function generate() {
  verify()
  checkReads()
  const rendered = renderScript()
  assert.deepEqual(scanScript(rendered.script), [], 'FORBIDDEN_BUILDER_SOURCE')
  writeFileSync(path.join(evidence, 'G3R3C_BUILDER_SCRIPT.sh'), rendered.script)
  const isolation = abacContract()
  const cleanup = cleanupContract(rendered)
  const credentials = credentialContract(rendered)
  const supplement = g2Supplement(isolation)
  const linkage = composite(supplement)
  const cost = costClosure()
  const plan = executionPlan()
  const scriptContract = {
    ...rendered.facts,
    request: rendered.request,
    limits,
    EXECUTED: 'NO',
    qualification: 'UNQUALIFIED_FUTURE_SCRIPT;NO_EXECUTION_AUTHORITY',
    requiredPreflight: parent.preflight,
    additionalPreflight: [
      'Existingdedicatedrootlessaccountandnewuidmap/newgidmap>=65536subuids',
      'SystemdLoadCredential/rootlessusernamespaces/cgroupBPF/ProtectProcactuallyeffective',
      'Rootownedtmpfs/nohostswap/sufficient8GiBvolatilecapacity',
      'NohostDockerfallback/noactiveconflictingbuild',
    ],
    runtimeGateMeaning: 'Missingtooling/space/dedicatedaccountdenies;noinstallationornewVMassumed',
    effectiveFenceProof:
      'UNBOUND;scriptsetslink-localdenialbutsystemddocumentssilentineffectivenessonunsupportedhosts',
    tokenInvocationCaveat:
      'Linuxprotectedparameterposition/VMagentstorageandguestargvexposuremustbequalifiedwithnonsecretfixtures;noenvironmentdumporcredentialecho',
  }
  const slots = {
    A: {
      LIFECYCLE_OWNER: 'UNBOUND',
      EXECUTION_OPERATOR: 'RECOMMENDED_NOT_APPOINTED',
      HUMAN_APPROVER: 'UNBOUND',
      constraint: 'EXECUTION_OPERATOR != HUMAN_APPROVER',
    },
    B: { ...linkage, HUMAN_AUTHORIZATION: 'UNBOUND' },
    C: {
      RECOMMENDED_EXECUTION_CEILING_CAD: 'UNSUPPORTED',
      HUMAN_APPROVED_EXECUTION_CEILING_CAD: 'UNBOUND',
    },
  }
  const readiness = {
    mission: 'NZ-20261008-INFRA-001',
    phase: 'G3R3C',
    G3R3C_GATE: 'BLOCKED',
    ROOT_1: 'CLOSED',
    ROOT_1_REOPENED: 'NO',
    BUILDER_B_STATUS: 'PARKED_NOT_SELECTED',
    BUILDER_B_REOPENED: 'NO',
    SELECTED_PRIVATE_BUILD_MODEL: 'NONE',
    BUILDER_A_REPOSITORY_ISOLATION: 'STATIC_ABAC_PASS;EFFECTIVE_GUEST_FENCE_UNQUALIFIED',
    BUILDER_A_INDEPENDENT_CLEANUP: 'STATIC_TIMER/TRAP_DESIGN;REAL_FAILURE_SAFE_PROOF_UNQUALIFIED',
    ROOT_2_TECHNICAL_PACKET: 'SUPPLEMENT_DEFINED;NOT_COMPLETE',
    ROOT_2_HUMAN_AUTHORIZATION: 'PENDING',
    ROOT_3_TECHNICAL_PACKET: 'FROZEN_CORE_PLUS_TWO_PROPOSED_ENTRIES;GUEST_ROLLBACK_PROOF_UNBOUND',
    ROOT_3_HUMAN_AUTHORIZATION: 'PENDING',
    ROOT_4_COST_MODEL: 'UNBOUND_ENFORCEMENT',
    ROOT_4_HUMAN_AUTHORIZATION: 'PENDING',
    G3_EXECUTION_READINESS: 'BLOCKED',
    G3A: 'NOT_AUTHORIZED_PENDING_HUMAN_DECISIONS',
    G3B: 'NOT_AUTHORIZED',
    CURRENT_G3_PROOF_EXECUTION_ARCHITECTURE:
      'EXHAUSTED_WITHIN_CURRENT_NO_GUEST_EXECUTION_AND_NO_WEAKENING_AUTHORITY;NO_FOURTH_PATH',
    qualificationNotInvented: true,
    scriptSha256: rendered.facts.BUILDER_SCRIPT_SHA256,
    composite: linkage,
    finalHumanPacket: 'NOT_ISSUED;PASS_REQUIRED',
    reservedDecisionSlots: slots,
    exactResiduals: [...cleanup.missingIndependentGuarantees, ...cost.exactResiduals],
    preservation: { file: 'G3R3C_PRESERVATION.json', sha256: fileHash('G3R3C_PRESERVATION.json') },
    readOnlyEvidence: {
      ledger: 'G3R3C_READ_LEDGER.json',
      sha256: fileHash('G3R3C_READ_LEDGER.json'),
      publicGetCalls: ledger.length,
      succeeded: ledger.filter((entry) => entry.status === 'SUCCEEDED').length,
      failed: ledger.filter((entry) => entry.status === 'FAILED').length,
      newAzureCalls: 0,
      newGuestCalls: 0,
      builderBResearchCalls: 0,
    },
    boundaries: {
      RUN_COMMAND_EXECUTED: 'NO',
      ROLE_ASSIGNMENTS_CREATED: 0,
      ACR_TOKEN_CREATED: 'NO',
      IMAGE_PUSHED: 'NO',
      AZURE_RESOURCE_MUTATIONS: 0,
      G2_MUTATIONS: 0,
      LIVE_PROOF_EXECUTED: 'NO',
      G3A_EXECUTED: 'NO',
      G3B_EXECUTED: 'NO',
      PRIVATE_BUILD_EXECUTED: 'NO',
      HUMANS_APPOINTED: 'NO',
      CEILING_APPROVED: 'NO',
    },
    localValidation: existsSync(path.join(evidence, 'G3R3C_LOCAL_VALIDATION.json'))
      ? { file: 'G3R3C_LOCAL_VALIDATION.json', sha256: fileHash('G3R3C_LOCAL_VALIDATION.json') }
      : null,
  }
  const values = [
    isolation,
    credentials,
    scriptContract,
    cleanup,
    privilegeSupplement(),
    { ...supplement, composite: linkage },
    cost,
    plan,
  ]
  for (let i = 0; i < values.length; i++) await write(outputs[i], values[i])
  await write(
    outputs[8],
    `# G3R3C final human packet - NOT ISSUED

G3R3C **BLOCKED**;this is a withholding notice,not an approval request. Parent packets remain byte-identical.
Only three reserved decisions;Builder A selection is technical,not a fourth decision.

## A - Accountability (reserved)

Lifecycle owner **UNBOUND**;operator **RECOMMENDED_NOT_APPOINTED** (${principal});human approver **UNBOUND**.
Operator must differ from approver.

## B - Core + Builder A supplement (reserved)

Core **${coreDigest}**;supplement **${supplement.SUPPLEMENT_DIGEST}**;composite **${linkage.COMPOSITE_G2_AUTHORIZATION_DIGEST}**.
Seven core +two supplemental entries;the Writer condition normalization supersedes its desired condition before grant,so eight nonduplicated desired-state entries,not a permissive intermediate role.
The physical PUT count is not implied by that count:firewall entries share one resource and require exact approved batching.
Proposed finite G2 firewall base-pull allowance and current documented request-attribute ABAC only.
Human authority **UNBOUND**. Guest cleanup/isolation proof incomplete;composite **NOT APPROVABLE**.

## C - Numeric execution ceiling (reserved)

Recommendation **UNSUPPORTED**;human ceiling **UNBOUND**;all-in/builder maxima remain null.
Do not authorize from conditional subtotals or static cleanup traces.

Issue final packet only after PASS. Current architecture is exhausted under this phase's no-guest-execution/no-weakening limits;
no alternative builder research or fourth path is started.
`,
  )
  await write(outputs[9], readiness)
  await write(
    outputs[10],
    `# G3R3C execution readiness - BLOCKED

ROOT-1 closed;all G3R3/G3R3B/G3R2I parent bytes and tools unchanged. Builder B **PARKED_NOT_SELECTED**,not reopened.

- [Repository isolation](./G3R3C_REPOSITORY_ISOLATION.json):exact recommended principal/G2 ACR/Repository Writer/request repository condition;negative contracts deny other,prefix,case,encoding,missing-condition and legacyAcrPush requests. This is static contract proof,not effective guest/token authorization.
- Frozen core@Resource condition is not rewritten. [G2 supplement](./G3R3C_G2_BUILDER_SUPPLEMENT.json) proposes desired-condition normalization to current documented@Request before grant plus finite G2 VM10.90.1.4/32 Docker-auth/base HTTPS443 allowance. Core digest **${coreDigest}**;supplement **${supplement.SUPPLEMENT_DIGEST}**;composite **${linkage.COMPOSITE_G2_AUTHORIZATION_DIGEST}**. No standing VM/UAMI grants,NSG,DNS,VM identity or core bytes changed.
- [Credential contract](./G3R3C_CREDENTIAL_DELIVERY.json):protected-only short-lived recommended-principal path;accepted remaining life>2100s and<=10800s;no long-lived password,admin,staticsecret,VMidentity or Entra refresh. No credential minted/sent.
- [Fixed future script](./G3R3C_BUILDER_SCRIPT.sh) SHA256 **${rendered.facts.BUILDER_SCRIPT_SHA256}** includes six accepted source files,volatileworkspace,rootlessowneddaemon,temporaryDockerconfig,network-none compile and exactdigestpinnedbase. Original source14502bytes/parentrequest20741 preserved;full guarded request separately measured${rendered.facts.FULL_SUCCESSOR_REQUEST_BYTES}bytes. It is **UNQUALIFIED**,not executable authority.
- [Cleanup contract](./G3R3C_CLEANUP_CONTRACT.json):main EXIT/INT/TERM/HUP trap plus independent transient systemdguard armed before token staging/build. Build1800s<watchdog1900s<RunCommand2100s;cleanup60s. Exact owned cgroups/workspace only,no broad Docker prune or shared G2 resource deletion.
- **No fabricated failure-safe proof:**systemd documents IPAddressDeny may have no effect without kernelBPF;staticconfiguration/sourcechecks do not qualify actual rootlessdescendantisolation. Guest/systemd hangs can delay timers;static failure transition tests do not establish runtimecredential/daemoncleanup. Agent parameter storage outside bounded workspace is not covered by workspace-zero receipt.
- [Cost closure](./G3R3C_COST_CLOSURE.json):existingVM/disk fixedincrement0;proposed10000disktransactions<43400E4hourlycap costCAD${cost.disk.MAX_INCREMENTAL_DISK_TRANSACTION_COST_CAD_CONDITIONAL},but count enforcement unproved. Applicablevault100operations costCAD${cost.keyVault.MAX_SECRET_TRANSACTION_COST_CAD};ACRheadroom/storage0 preserved. Conditional proof component reconstructionCAD${cost.reconstruction.conditionalSubtotalCAD.toFixed(8)} is **not all-in or ceiling**. Logging/network/fullG3teardown bounds remain unbound;guestbuilderguard does not delete billed G3 proof resources.
- [Operator supplement](./G3R3C_BUILDER_PRIVILEGE_SUPPLEMENT.json):live **runCommands/write** authority,not prose singular spelling;only exact candidate reads/ownedchildcommandactions plus inheritedcoreconditionalwriter/firewall authority;no grant or catalog-lister.
- [Normalized plan](./G3R3C_EXECUTION_PLAN.json):${plan.NEW_STEP_COUNT}steps,cycles0,parent17-stepdigestbound. Environmentcreate->quotaquery->require>=250mCPU preserved;guard/credential/build/push/actualregistrydigest/cleanupreceipt precede workloadactivation. Qualification step remains blocked.
- [Human notice](./G3R3C_FINAL_HUMAN_AUTHORIZATION_PACKET.md):final packet **NOT_ISSUED**;only A accountability/B composite/C ceiling reserved.

## Evidence and stop state

${ledger.length}ledgeredpublicGETs,0newAzurecalls,0guestcalls,0BuilderBresearchcalls.
No RunCommand,role,token,image,resource,G2,proof,G3A/G3B,appointment or ceiling execution.
G3R3C **BLOCKED**;selectedbuilder **NONE**;G3execution **BLOCKED**;G3A **NOT_AUTHORIZED_PENDING_HUMAN_DECISIONS**;G3B **NOT_AUTHORIZED**.
Current execution architecture **EXHAUSTED_WITHIN_CURRENT_AUTHORITY** rather than weakening isolation/cleanup or inventing another builder.
${readiness.localValidation ? '\n[Local validation](./G3R3C_LOCAL_VALIDATION.json) binds regressions,static contracts,syntax,formatting,preservation and determinism;not guest/runtime proof.' : ''}
`,
  )
  const names = readdirSync(evidence).filter(
    (name) => name.startsWith('G3R3C') && name !== 'G3R3C_OUTPUT_BINDING.json',
  )
  await write('G3R3C_OUTPUT_BINDING.json', {
    files: names.map((name) => ({ name, sha256: fileHash(name) })),
    tools: [
      'g3r3c-contract-evidence.mjs',
      'g3r3c-builder-template.sh',
      'g3r3c-builder-closure.mjs',
    ].map((name) => ({ name, sha256: hash(readFileSync(path.join(root, name))) })),
  })
  verify()
  return readiness
}
export function check() {
  verify()
  checkReads()
  const binding = read(path.join(evidence, 'G3R3C_OUTPUT_BINDING.json'))
  for (const entry of binding.files)
    assert.equal(fileHash(entry.name), entry.sha256, `SUCCESSOR_CHANGED:${entry.name}`)
  for (const entry of binding.tools)
    assert.equal(hash(readFileSync(path.join(root, entry.name))), entry.sha256)
  const supplement = read(path.join(evidence, outputs[5]))
  const { SUPPLEMENT_DIGEST, composite: linkage, ...unsigned } = supplement
  assert.equal(digest(unsigned), SUPPLEMENT_DIGEST)
  const { COMPOSITE_G2_AUTHORIZATION_DIGEST, ...manifest } = linkage
  assert.equal(digest(manifest), COMPOSITE_G2_AUTHORIZATION_DIGEST)
  assert.deepEqual(
    scanScript(readFileSync(path.join(evidence, 'G3R3C_BUILDER_SCRIPT.sh'), 'utf8')),
    [],
  )
  validateDag(read(path.join(evidence, outputs[7])).steps)
  assert.equal(read(path.join(evidence, outputs[9])).G3R3C_GATE, 'BLOCKED')
  return { localValidation: 'PASS', gate: 'BLOCKED', mutations: 0 }
}
export async function main(args) {
  assert(
    args.length === 1 && ['--write', '--check'].includes(args[0]),
    'LOCAL_ONLY_NO_EXECUTION_FLAGS',
  )
  if (args[0] === '--write') await generate()
  else check()
  console.log('PASS G3R3C local contract/hash checks;G3R3C BLOCKED;no guest/Azure/build execution')
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2))
