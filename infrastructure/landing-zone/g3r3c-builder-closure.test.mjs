import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { evidence, files, hash, read, root, source } from './g3r2i-preservation.mjs'
import { digest } from './g3r3b-builder-closure.mjs'
import { coreDigest, registry, vm } from './g3r3b-read-evidence.mjs'
import { checkReads, documents, verify } from './g3r3c-contract-evidence.mjs'
import {
  abacAllows,
  abacContract,
  actions,
  check,
  cleanupContract,
  cleanupTrace,
  condition,
  costClosure,
  executionPlan,
  failureCases,
  limits,
  main,
  outputs,
  renderScript,
  repository,
  scanScript,
  tokenWindow,
} from './g3r3c-builder-closure.mjs'
import { validateDag } from './g3r3-execution-envelope.mjs'

const output = (index) => read(path.join(evidence, outputs[index]))
const isolation = output(0)
const credentials = output(1)
const scriptContract = output(2)
const cleanup = output(3)
const privileges = output(4)
const supplement = output(5)
const costs = output(6)
const plan = output(7)
const readiness = output(9)
const script = readFileSync(path.join(evidence, 'G3R3C_BUILDER_SCRIPT.sh'), 'utf8')
const ledger = read(path.join(evidence, 'G3R3C_READ_LEDGER.json'))

test('every parent evidence/tool/source/image/candidate/G2 hash remains frozen', () => {
  const baseline = verify()
  assert(baseline.evidence.some((entry) => entry.path === 'G3R3_G2_MUTATION_PACKET.json'))
  assert(baseline.evidence.some((entry) => entry.path === 'G3R3B_EXECUTION_READINESS.json'))
  assert(baseline.evidence.some((entry) => entry.path === 'G3R2I_IMAGE_QUALIFICATION.json'))
  assert(baseline.tools.some((entry) => entry.name === 'g3r3b-builder-closure.mjs'))
  assert.equal(readiness.ROOT_1, 'CLOSED')
  assert.equal(readiness.ROOT_1_REOPENED, 'NO')
})
test('Builder B is parked with no new Azure/guest/agent-pool/pricing work', () => {
  assert.equal(readiness.BUILDER_B_STATUS, 'PARKED_NOT_SELECTED')
  assert.equal(readiness.BUILDER_B_REOPENED, 'NO')
  assert.equal(readiness.readOnlyEvidence.builderBResearchCalls, 0)
  assert.equal(readiness.readOnlyEvidence.newAzureCalls, 0)
  assert.equal(readiness.readOnlyEvidence.newGuestCalls, 0)
  assert.equal(documents.length, 7)
  assert(documents.every(([, url]) => !/agent.?pool|pricing|prices.azure/.test(url)))
})
test('fixed future script includes source/worker/guard and binds exact digest without execution', () => {
  const rendered = renderScript()
  assert.equal(script, rendered.script)
  assert.equal(hash(script), scriptContract.BUILDER_SCRIPT_SHA256)
  assert.equal(hash(script), readiness.scriptSha256)
  assert(script.includes("<<'G3_CLEANUP'"))
  assert(script.includes("<<'G3_WORKER'"))
  assert.equal(scriptContract.EXECUTED, 'NO')
  assert(scriptContract.qualification.startsWith('UNQUALIFIED'))
})
test('Bash syntax validation only parses script;no program in it runs', () => {
  const result = spawnSync(
    'C:\\Program Files\\Git\\bin\\bash.exe',
    ['-n', path.join(evidence, 'G3R3C_BUILDER_SCRIPT.sh')],
    { encoding: 'utf8', timeout: 30000 },
  )
  assert.equal(result.status, 0, result.stderr)
})
test('source count/byte/hash/base64/source-only parent request stay accepted', () => {
  const accepted = read(path.join(evidence, 'G3R2I_IMAGE_QUALIFICATION.json')).SOURCE_DIGESTS
  const entries = files(path.join(source, 'workload', 'synthetic-proof'))
  assert.deepEqual(entries, accepted.files)
  assert.equal(scriptContract.SOURCE_FILE_COUNT, 6)
  assert.equal(scriptContract.SOURCE_TOTAL_BYTES, 14502)
  assert.equal(scriptContract.PARENT_REPRESENTATIVE_REQUEST_BYTES, 20741)
  assert.equal(scriptContract.SOURCE_TREE_SHA256, accepted.SOURCE_TREE_SHA256)
  assert.equal(scriptContract.EXPECTED_GUEST_TREE_SHA256, accepted.SOURCE_TREE_SHA256)
  const payload = entries.map(({ path: name }) => ({
    path: name,
    base64: readFileSync(path.join(source, 'workload', 'synthetic-proof', name)).toString('base64'),
  }))
  assert.equal(digest(payload), scriptContract.ENCODED_SOURCE_SHA256)
  for (const entry of payload) {
    assert(script.includes(`'${entry.base64}' | base64 -d`))
    assert.equal(
      hash(Buffer.from(entry.base64, 'base64')),
      entries.find((file) => file.path === entry.path).sha256,
    )
  }
  assert(script.includes('fail SOURCE_HASH'))
  assert(script.includes('fail SOURCE_COUNT'))
  assert(script.includes('fail TREE_MANIFEST'))
  assert(!script.includes('@@SOURCE_PAYLOAD@@'))
})
test('full request has separately measured size and explicit failure/timeout/protected-only values', () => {
  const request = scriptContract.request
  assert.equal(
    Buffer.byteLength(JSON.stringify(request)),
    scriptContract.FULL_SUCCESSOR_REQUEST_BYTES,
  )
  assert(scriptContract.FULL_SUCCESSOR_REQUEST_BYTES > 20741)
  assert(scriptContract.FULL_SUCCESSOR_REQUEST_BYTES < 4 * 1024 * 1024)
  assert.equal(request.properties.source.script, script)
  assert.equal(request.properties.treatFailureAsDeploymentFailure, true)
  assert.equal(request.properties.asyncExecution, false)
  assert.equal(request.properties.timeoutInSeconds, 2100)
  assert.equal(request.properties.parameters, undefined)
  assert.deepEqual(
    request.properties.protectedParameters.map((entry) => entry.name),
    ['mode', 'runId', 'tokenExpiryUnix', 'acrToken'],
  )
  assert(request.properties.protectedParameters.at(-1).value.includes('NOT_CREATED'))
})
test('request source/property contract matches preserved Compute schema', () => {
  const ledger = read(path.join(evidence, 'G3R3B_READ_LEDGER.json'))
  const entry = ledger.find(
    (item) => item.name === 'doc-run-command-schema' && item.status === 'SUCCEEDED',
  )
  const schema = readFileSync(path.join(evidence, entry.responseFile), 'utf8')
  for (const property of [
    'protectedParameters',
    'timeoutInSeconds',
    'treatFailureAsDeploymentFailure',
    'script',
  ])
    assert(schema.includes(property), property)
  assert(scriptContract.tokenInvocationCaveat.includes('mustbequalified'))
})
test('exact ABAC contract uses current documented request attribute without parent rewrite', () => {
  assert.equal(isolation.recommendedPrincipal, 'bfa4a851-696a-4d3f-927b-5fb1526f79f2')
  assert.equal(isolation.scope, registry)
  assert.equal(isolation.repository, repository)
  assert.equal(isolation.role.name, 'Container Registry Repository Writer')
  assert.equal(isolation.conditionVersion, '2.0')
  assert.equal(isolation.condition, condition)
  assert(
    condition.includes(
      "@Request[Microsoft.ContainerRegistry/registries/repositories:name] StringEquals 'g3-synthetic-runtime'",
    ),
  )
  assert(isolation.frozenParentCondition.expression.includes('@Resource['))
  assert(isolation.normalization.includes('parent bytes/digest are not rewritten'))
  assert.equal(isolation.CATALOG_LISTER, 'NO')
  assert.equal(isolation.REGISTRY_WIDE_WRITER, 'NO')
  assert.equal(isolation.EXISTING_VM_ACR_AUTHORITY_USED_FOR_G3_PUSH, 'NO')
})
for (const action of actions)
  test(`proposed ABAC writer permits only exact canonical repository:${action}`, () => {
    assert.equal(abacAllows(isolation.grant, action, repository).allowed, true)
  })
for (const candidate of [
  'arbitrary',
  'staging',
  'synthetic-health',
  'g2-tooling',
  'g3-synthetic-runtime-extra',
  'prefix/g3-synthetic-runtime',
  'g3-synthetic-runtime/child',
  'G3-SYNTHETIC-RUNTIME',
  'g3-synthetic-runtime%2Fchild',
  'g3-synthetic-runtime%00',
  '%67%33-synthetic-runtime',
  'g3-synthetic-runtime ',
  ' g3-synthetic-runtime',
  'g3-synthetic-runtime\n',
  'g3-synthetic-runtime:latest',
  '',
  null,
  undefined,
])
  test(`static exact-repository contract denies bypass:${String(candidate)}`, () => {
    for (const action of actions) {
      const decision = abacAllows(isolation.grant, action, candidate)
      assert.equal(decision.allowed, false)
      assert(decision.reason)
    }
  })
for (const [field, value] of [
  ['condition', null],
  ['condition', ''],
  ['condition', condition.replace('StringEquals', 'StringEqualsIgnoreCase')],
  ['condition', condition.replace('@Request', '@Resource')],
  ['conditionVersion', '1.0'],
  ['roleId', '8311e382-0749-4cb8-b61a-304f252e45ec'],
  ['scope', registry + '/repositories'],
  ['principalId', 'c59571aa-66ea-47c5-83d5-59946b318ae2'],
])
  test(`condition-free/legacy/foreign grant denied:${field}:${String(value)}`, () =>
    assert.equal(
      abacAllows({ ...isolation.grant, [field]: value }, actions[0], repository).allowed,
      false,
    ))
for (const action of [
  'Microsoft.ContainerRegistry/registries/repositories/content/delete',
  'Microsoft.ContainerRegistry/registries/repositories/metadata/delete',
  'Microsoft.ContainerRegistry/registries/catalog/read',
  'Microsoft.ContainerRegistry/registries/push/write',
])
  test(`out-of-role action denied:${action}`, () =>
    assert.equal(abacAllows(isolation.grant, action, repository).allowed, false))
test('short-lived credential is not existing VM authority,not minted,not globally oversold', () => {
  assert.equal(credentials.principal, isolation.recommendedPrincipal)
  assert.equal(credentials.LIVE_ACR_TOKEN_CREATED, 'NO')
  assert.equal(credentials.longLivedPassword, 'NO')
  assert.equal(credentials.adminAccount, 'NO')
  assert.equal(credentials.staticRegistrySecret, 'NO')
  assert.equal(credentials.maxLifetimeSeconds, 10800)
  assert(credentials.worker.includes('no Entra refresh'))
  assert(credentials.dockerExchange.includes('not an Entra refresh'))
  assert(isolation.applicableBoundary.includes('unrelated staging'))
  assert(credentials.caveat.includes('workspace receipt scope is bounded'))
})
for (const remaining of [-1, 0, 1800, 2099, 2100, 10801, 20000])
  test(`token window denies expired/insufficient/overlong remaining seconds:${remaining}`, () =>
    assert.equal(tokenWindow(1700000000 + remaining, 1700000000), false))
for (const remaining of [2101, 3600, 10800])
  test(`token window accepts strictly sufficient bounded remaining seconds:${remaining}`, () =>
    assert.equal(tokenWindow(1700000000 + remaining, 1700000000), true))
for (const bad of [NaN, Infinity, 0.5, undefined, '1700000000'])
  test(`token expiry rejects invalid type/value:${String(bad)}`, () =>
    assert.throws(() => tokenWindow(bad, 1700000000)))
test('volatile paths and root-only workspace reject symlinks,shared state and host swap', () => {
  assert(script.includes('workspace="/run/nzila-g3-build/$run"'))
  assert(script.includes('findmnt -n -o FSTYPE --target /run'))
  assert(script.includes('fail VOLATILE_RUN_REQUIRED'))
  assert(script.includes('fail SWAP_PRESENT'))
  assert(script.includes('! -L /run/nzila-g3-build'))
  assert(script.includes('root:711'))
  assert(script.includes('root:700'))
  assert(script.includes('DOCKER_CONFIG="$workspace/runtime/docker"'))
  assert(!script.includes('/root/.docker'))
  assert(!script.includes('~/.docker'))
  assert(script.includes('--data-root="$workspace/runtime/engine"'))
  assert(script.includes('--exec-root="$workspace/runtime/exec"'))
  assert(script.includes('InaccessiblePaths=-/run/docker.sock -/var/run/docker.sock'))
})
for (const tool of [
  'docker',
  'dockerd-rootless.sh',
  'rootlesskit',
  'systemd-run',
  'systemctl',
  'bpftool',
  'sha256sum',
  'base64',
  'curl',
  'newuidmap',
  'newgidmap',
])
  test(`runtime preflight denies missing tool without installation:${tool}`, () => {
    assert(script.includes(` ${tool} `) || script.includes(`for tool in ${tool} `))
    assert(script.includes('command -v "$tool" >/dev/null 2>&1 || fail TOOLING'))
    assert(!/(?:apt-get|apt install|yum install|dnf install|curl.*\|\s*(?:sh|bash))/.test(script))
  })
test('dedicated existing rootless account cannot silently create user/install packages or use existing busy account', () => {
  assert(script.includes("account='nzila-g3-rootless'"))
  assert(script.includes('fail EXISTING_ROOTLESS_ACCOUNT_REQUIRED'))
  assert(script.includes('$3>=65536'))
  assert(script.includes('fail ACCOUNT_LOGIN'))
  assert(script.includes('fail ROOTLESS_ACCOUNT_BUSY'))
  assert(!/\b(?:useradd|adduser|usermod)\b/.test(script))
})
test('private registry and data addresses are checked before credential staging/build', () => {
  assert(script.includes('"$registry=10.90.2.5" "$data_host=10.90.2.4"'))
  assert(script.includes('[[ "$addresses" == "$expected" ]] || fail PRIVATE_DNS_ADDRESS'))
  assert(script.includes('--resolve "$host:443:$expected"'))
  assert(script.indexOf('fail PRIVATE_TCP_TLS') < script.indexOf('expiry='))
  assert(script.indexOf('fail GUARD_NOT_ARMED') < script.indexOf('> "$workspace/acr-token"'))
})
test('source verification precedes daemon/worker start;compile network none and pinned Dockerfile unchanged', () => {
  assert(script.indexOf('fail SOURCE_HASH') < script.indexOf('--unit="$prefix-engine"'))
  assert(script.includes('build --network none --pull=false --no-cache'))
  assert(
    script.includes(
      'golang@sha256:bcef992b77b1e2031aaaa51da75cebc32da8e9c182e12e633ea79023c79d9eff',
    ),
  )
  assert.equal(
    hash(readFileSync(path.join(source, 'workload', 'synthetic-proof', 'Dockerfile'))),
    '96eb04f564a60154c11e16793afe5f4a73af0d904d7c98b69e666cce48cd32c8',
  )
})
test('no raw token console/shelltrace/environmentdump/argv-password/host identity path in fixed script', () => {
  assert.deepEqual(scanScript(script), [])
  assert(script.includes('--password-stdin < "$CREDENTIALS_DIRECTORY/acr-token"'))
  assert(script.includes('unset token'))
  assert(script.includes('set --'))
  assert(script.includes('StandardOutput=null --property=StandardError=null'))
})
for (const [id, bad] of [
  ['IMDS_LITERAL', 'curl http://169.254.169.254/token'],
  ['IDENTITY_ENDPOINT', 'x=$IDENTITY_ENDPOINT'],
  ['MSI_ENDPOINT', 'x=$MSI_ENDPOINT'],
  ['IDENTITY_LOGIN', 'az login --identity'],
  ['DEFAULT_CREDENTIAL_CHAIN', 'DefaultAzureCredential()'],
  ['SHELL_XTRACE', 'set -x'],
  ['TOKEN_ECHO', 'echo $TOKEN'],
  ['ENVIRONMENT_DUMP', 'printenv'],
  ['ENVIRONMENT_DUMP', 'env'],
  ['PASSWORD_ARGUMENT', 'docker login x --password secret'],
  ['PERSISTENT_DOCKER_CONFIG', 'DOCKER_CONFIG=/root/.docker'],
  ['BROAD_PRUNE', 'docker system prune'],
  ['BROAD_PRUNE', 'docker builder prune --all'],
  ['HOST_DOCKER_FALLBACK', 'DOCKER_HOST=unix:///var/run/docker.sock'],
])
  test(`script rejection detects credential/isolation/destructive regression:${id}:${bad}`, () =>
    assert(scanScript(`${script}\n${bad}\n`).includes(id)))
test('independent timer is armed before volatile credentials and build,not only shell trap', () => {
  assert(script.includes('trap cleanup EXIT INT TERM HUP'))
  assert(script.includes('--on-active=1900s'))
  assert(script.includes('--timer-property=AccuracySec=1s'))
  assert(script.includes('--timer-property=RemainAfterElapse=no'))
  assert(script.indexOf('--unit="$prefix-guard"') < script.indexOf('--unit="$prefix-engine"'))
  assert(script.indexOf('fail GUARD_NOT_ARMED') < script.indexOf('> "$workspace/acr-token"'))
  assert.equal(cleanup.independentGuard.parentShellIndependent, true)
  assert.equal(cleanup.independentGuard.beforeBuild, true)
})
test('build/watchdog/cleanup/RunCommand ordering is explicit and conservative', () => {
  assert(limits.BUILD_RUNTIME_LIMIT_SECONDS < limits.CLEANUP_WATCHDOG_DEADLINE_SECONDS)
  assert(
    limits.CLEANUP_WATCHDOG_DEADLINE_SECONDS + 1 + limits.CLEANUP_SERVICE_TIMEOUT_SECONDS <
      limits.RUN_COMMAND_TIMEOUT_SECONDS,
  )
  assert(script.includes('RuntimeMaxSec=1800s'))
  assert(script.includes('RuntimeMaxSec=1860s'))
  assert(script.includes('TimeoutStartSec=60s'))
  assert.equal(
    scriptContract.request.properties.timeoutInSeconds,
    limits.RUN_COMMAND_TIMEOUT_SECONDS,
  )
})
test('BPF query and policy gates reject silent unsupported cgroup fallback before worker release', () => {
  assert(script.includes('bpftool cgroup show'))
  for (const failure of [
    'OWNED_CGROUP',
    'METADATA_POLICY',
    'BPF_QUERY',
    'BPF_INGRESS',
    'BPF_EGRESS',
  ])
    assert(script.includes(`fail ${failure}`))
  assert(script.includes('verify_fence "$prefix-engine.service"'))
  assert(script.includes('verify_fence "$prefix-build.service"'))
  assert(
    script.indexOf('verify_fence "$prefix-build.service"') <
      script.indexOf('> "$workspace/fence-ready"'),
  )
  assert(
    script.indexOf('[[ -f "$workspace/fence-ready" ]] || exit 81') <
      script.indexOf('docker --host "$DOCKER_HOST" pull'),
  )
  assert.equal(
    isolation.guestIsolation,
    'BLOCKED_EFFECTIVE_FENCE_AND_ENGINE_LIFECYCLE_QUALIFICATION',
  )
})
test('cleanup is run-owned,idempotent,exact-target,stops cgroups before deletion and leaves manifest', () => {
  assert(script.includes('[[ "$run" =~ ^[a-f0-9]{32}$ ]]'))
  assert(script.includes('[[ "$(cat "$workspace/owner")" == "$run" ]]'))
  assert(script.includes('flock -x 8'))
  assert(script.includes('[[ -f "$receipt" && ! -e "$workspace" ]] && exit 0'))
  const stop = script.indexOf('systemctl stop "$prefix-engine.service"')
  const remove = script.indexOf('rm -rf --one-file-system -- "$workspace"')
  const absent = script.indexOf('[[ ! -e "$workspace" ]] || exit 99')
  const receipt = script.indexOf('rawTokenResidualInWorkspace')
  assert(stop < remove && remove < absent && absent < receipt)
  assert(script.includes('MainPID'))
  assert(script.includes('ControlPID'))
  assert(script.includes('docker logout "$registry"'))
  assert(cleanup.removal.some((entry) => entry.includes('Retain pushed registry manifest')))
  assert.equal(cleanup.broadPrune, 'PROHIBITED')
})
for (const failure of failureCases)
  test(`failure cleanup logical transition model:${failure}`, () => {
    const trace = cleanupTrace(failure)
    assert.equal(trace.CLEANUP_EXPECTED, 'YES')
    assert.equal(trace.outcome, 'PASS_MODEL_ONLY')
    assert.equal(trace.rawTokenResidual, 0)
    assert(trace.scope.includes('no Bash/systemd/Docker execution'))
    if (!['DNS failure', 'ACR connection failure', 'token failure'].includes(failure))
      assert(
        trace.steps.indexOf('Stop exact engine cgroup') <
          trace.steps.indexOf('Delete only named volatile workspace'),
      )
  })
test('failure model never invents cleanup receipt when systemd hangs,guard absent or fence ineffective', () => {
  const hung = cleanupTrace('Run Command timeout', { systemdResponsive: false })
  assert.equal(hung.outcome, 'BLOCKED')
  assert.equal(hung.rawTokenResidual, null)
  const absent = cleanupTrace('compile failure', { armed: false })
  assert.equal(absent.outcome, 'DENY_BEFORE_TOKEN_OR_BUILD')
  assert.equal(absent.rawTokenResidual, null)
  const fence = cleanupTrace('push failure', { fenceEffective: false })
  assert.equal(fence.outcome, 'DENY_OR_UNPROVEN')
  assert.equal(fence.rawTokenResidual, null)
  assert.throws(() => cleanupTrace('unknown'))
  assert.equal(
    cleanup.RAW_TOKEN_RESIDUAL,
    'REQUIRED_FUTURE_MEASURED_ZERO_IN_BOUNDED_WORKSPACE;NOT_OBSERVED_NOW',
  )
})
test('incremental privilege supplement binds real plural provider action and parent byte digests', () => {
  assert.equal(
    privileges.LIVE_PROVIDER_OPERATION,
    'Microsoft.Compute/virtualMachines/runCommands/write',
  )
  assert.equal(
    privileges.DOCUMENTATION_OPERATION_STRING,
    'Microsoft.Compute/virtualMachines/runCommand/write',
  )
  assert.equal(privileges.EXECUTION_AUTHORITY_SOURCE, 'LIVE_PROVIDER_OPERATION_CATALOG')
  assert.equal(privileges.STATUS, 'PROPOSED_NOT_GRANTED')
  assert.equal(privileges.noCatalogLister, true)
  assert.equal(privileges.noVmWriteDeleteDeallocateOrIdentityChange, true)
  for (const entry of [privileges.PARENT_G3R3_OPERATOR_PACKET, privileges.PARENT_G3R3B_SUPPLEMENT])
    assert.equal(entry.sha256, hash(readFileSync(path.join(evidence, entry.file))))
  assert(
    privileges.ADDITIONAL_REQUIREMENTS.some(
      (entry) => entry.AZURE_ACTION.endsWith('/runCommands/write') && entry.EXACT_SCOPE === vm,
    ),
  )
})
test('current Compute operation catalog contains child command write and not prose singular write', () => {
  let names = []
  function visit(value) {
    if (!value || typeof value !== 'object') return
    if (typeof value.name === 'string') names.push(value.name)
    for (const child of Object.values(value))
      if (Array.isArray(child)) child.forEach(visit)
      else if (child && typeof child === 'object') visit(child)
  }
  for (const entry of privileges.providerCatalog) {
    assert.equal(hash(readFileSync(path.join(evidence, entry.responseFile))), entry.responseSha256)
    visit(read(path.join(evidence, entry.responseFile)))
  }
  assert(names.includes(privileges.LIVE_PROVIDER_OPERATION))
  assert(!names.includes(privileges.DOCUMENTATION_OPERATION_STRING))
})
test('core digest stays frozen;two supplemental entries resolve request ABAC before grant and finite base egress', () => {
  assert.equal(supplement.PARENT_G2_PACKET_SHA256, coreDigest)
  const core = read(path.join(evidence, 'G3R3_G2_MUTATION_PACKET.json'))
  delete core.digestMethod
  delete core.approval.G2_MUTATION_PACKET_DIGEST
  assert.equal(hash(JSON.stringify(core)), coreDigest)
  assert.equal(supplement.SUPPLEMENT_CHANGE_COUNT, 2)
  assert.equal(supplement.STATUS, 'PROPOSED_NOT_AUTHORIZED')
  assert.equal(supplement.changes[0].condition, condition)
  assert(supplement.changes[0].beforeGrant.includes('not core@Resource grant'))
  const collection = supplement.changes[1].appendCollection
  assert.deepEqual(collection.rules[0].sourceAddresses, ['10.90.1.4/32'])
  assert.equal(collection.rules[0].targetFqdns.length, 4)
  assert(collection.rules[0].targetFqdns.every((host) => !host.includes('*')))
  assert.deepEqual(collection.rules[0].protocols, [{ protocolType: 'Https', port: 443 }])
  assert(supplement.changes[1].rollback.includes('fresh etag'))
  assert(supplement.changes[1].rollback.includes('never restore stale'))
})
test('supplement/composite digest rejects field drift and separates entry counts from physical mutations', () => {
  const { SUPPLEMENT_DIGEST, composite, ...unsigned } = supplement
  assert.equal(digest(unsigned), SUPPLEMENT_DIGEST)
  assert.notEqual(digest({ ...unsigned, SUPPLEMENT_CHANGE_COUNT: 0 }), SUPPLEMENT_DIGEST)
  const { COMPOSITE_G2_AUTHORIZATION_DIGEST, ...manifest } = composite
  assert.equal(digest(manifest), COMPOSITE_G2_AUTHORIZATION_DIGEST)
  assert.equal(composite.TOTAL_RECORDED_CHANGE_ENTRIES, 9)
  assert.equal(composite.DISTINCT_FINAL_DESIRED_STATE_ENTRIES, 8)
  assert.equal(composite.PHYSICAL_MUTATION_COUNT, null)
  assert(composite.overlapResolution.includes('not two sequential RBAC writes'))
  assert(composite.STATUS.includes('NOT_APPROVABLE'))
})
test('incremental disk cap arithmetic binds actual rate but no enforcement/numeric ceiling is fabricated', () => {
  assert.equal(costs.VM_FIXED_COST_INCREMENTAL_CAD, 0)
  assert.equal(costs.DISK_FIXED_COST_INCREMENTAL_CAD, 0)
  assert.equal(costs.disk.PROPOSED_PROOF_TRANSACTION_CAP, 10000)
  assert(costs.disk.PROPOSED_PROOF_TRANSACTION_CAP < costs.disk.SERVICE_HOURLY_MAXIMUM)
  assert.equal(costs.disk.MAX_INCREMENTAL_DISK_TRANSACTION_COST_CAD_CONDITIONAL, 0.0034)
  assert(costs.disk.capEnforcement.startsWith('UNPROVEN'))
  assert.equal(costs.keyVault.MAX_SECRET_TRANSACTION_COST_CAD, 0.00042497)
  assert.equal(costs.keyVault.meter.meterId, '0f824807-2376-435c-95c9-f992b67a07b0')
  assert.equal(costs.keyVault.meter.retailPrice, 0.042497)
  assert.equal(costs.keyVault.meter.isPrimaryMeterRegion, false)
  assert.equal(costs.disk.meter.meterId, 'df249cf3-71c9-5327-8738-56f65fa3fcda')
  assert.notEqual(costs.keyVault.meter.meterId, costs.disk.meter.meterId)
  assert.equal(costs.acrStorage.INCREMENTAL_STORAGE_COST_CAD, 0)
  assert.equal(costs.logging.contingencyCoversAllPossibleOverrun, false)
})
test('full conditional reconstruction counts each bound rate once,not old subtotal/VMfixedcost', () => {
  assert.equal(costs.reconstruction.parentSubtotalReused, false)
  assert.equal(costs.reconstruction.allIn, false)
  assert.equal(
    costs.reconstruction.conditionalSubtotalCAD,
    costs.reconstruction.lines.reduce(
      (sum, row) => sum + (row.quantity / row.divisor) * row.meter.retailPrice,
      0,
    ),
  )
  for (const row of costs.reconstruction.lines) {
    assert.equal(
      row.meter.sourceSha256,
      hash(readFileSync(path.join(evidence, row.meter.sourceFile))),
    )
    assert.equal(row.conditionalMaximumCAD, (row.quantity / row.divisor) * row.meter.retailPrice)
  }
  assert.equal(costs.traffic.paths.find((row) => row.id === 'FINAL_IMAGE_PUSH').peeringGB, 0)
  assert.equal(costs.traffic.paths.find((row) => row.id === 'ACA_IMAGE_PULL').peeringGB, 0.4)
})
for (const key of [
  'BUILDER_A_MAX_INCREMENTAL_COST_CAD',
  'EXPECTED_PROOF_RUN_COST_CAD',
  'BOUNDED_MAX_PROOF_RUN_COST_CAD',
  'ROLLBACK_ALLOWANCE_CAD',
  'DIAGNOSTIC_CONTINGENCY_CAD',
  'UNCERTAINTY_BUFFER_CAD',
])
  test(`unbound all-in/allowance value stays null:${key}`, () => assert.equal(costs[key], null))
test('numeric recommendation is unsupported while actual hard caps/cleanup proof missing', () => {
  assert.equal(costs.RECOMMENDED_EXECUTION_CEILING_CAD, 'UNSUPPORTED')
  assert.equal(costs.HUMAN_APPROVED_EXECUTION_CEILING_CAD, 'UNBOUND')
  assert(
    costs.exactResiduals.some((entry) => entry.includes('wholeproof') || entry.includes('whole')),
  )
})
test('normalized22stepDAG properly renumbers/actions/resources and never deletes shared G2 VM', () => {
  assert.equal(plan.NEW_STEP_COUNT, 22)
  assert.equal(plan.CYCLES, 0)
  assert.equal(
    plan.PARENT_EXECUTION_PLAN_DIGEST,
    hash(readFileSync(path.join(evidence, 'G3R3_EXECUTION_PLAN.json'))),
  )
  validateDag(plan.steps)
  for (let i = 0; i < plan.steps.length; i++) {
    assert.equal(plan.steps[i].STEP, i + 1)
    assert.equal(plan.steps[i].execution, 'NOT_EXECUTED')
    assert(plan.steps[i].ACTION)
    assert(plan.steps[i].PRECONDITIONS.length)
    assert(plan.steps[i].POSTCONDITIONS.length)
    assert(plan.steps[i].ROLLBACK)
  }
  assert(!JSON.stringify(plan).includes('nzila-g3-proof-builder-95086e2f'))
  assert.equal(
    plan.steps.find((entry) => entry.id === 'private-production').RESOURCE,
    `${vm}/runCommands/g3-proof-<run-id>`,
  )
  assert(
    plan.steps
      .find((entry) => entry.id === 'teardown')
      .ACTION.includes('retain existing G2 VM/NIC/disk/UAMI'),
  )
  assert.deepEqual(plan.postEnvironmentQuotaGate, [
    'ENVIRONMENT_CREATE',
    'QUERY_MANAGED_ENVIRONMENT_CONSUMPTION_CORE_QUOTA',
    'VERIFY_AVAILABLE_MILLICORES>=250',
    'WORKLOAD_ACTIVATION',
  ])
  assert.equal(plan.privateRegistryAuthority.MUTABLE_TAG_AUTHORITY, 'PROHIBITED')
  const cleanupStep = plan.steps.find((entry) => entry.id === 'builder-cleanup-receipt')
  assert.deepEqual(cleanupStep.dependsOn, ['bind-registry-manifest'])
  assert.deepEqual(plan.steps.find((entry) => entry.id === 'runtime-roles-and-secret').dependsOn, [
    'builder-cleanup-receipt',
  ])
  const cycle = structuredClone(plan.steps)
  cycle[0].dependsOn = [cycle.at(-1).id]
  assert.throws(() => validateDag(cycle))
})
test('exact-three reserved slots withheld;no fourth builder approval or people appointed', () => {
  assert.deepEqual(Object.keys(readiness.reservedDecisionSlots), ['A', 'B', 'C'])
  assert.equal(readiness.reservedDecisionSlots.A.LIFECYCLE_OWNER, 'UNBOUND')
  assert.equal(readiness.reservedDecisionSlots.A.EXECUTION_OPERATOR, 'RECOMMENDED_NOT_APPOINTED')
  assert.equal(readiness.reservedDecisionSlots.A.HUMAN_APPROVER, 'UNBOUND')
  assert.equal(readiness.finalHumanPacket, 'NOT_ISSUED;PASS_REQUIRED')
  const notice = readFileSync(path.join(evidence, outputs[8]), 'utf8')
  assert.equal([...notice.matchAll(/^## [ABC] -/gm)].length, 3)
  assert(notice.includes('NOT ISSUED'))
  assert(!notice.includes('## D -'))
})
test('gate is BLOCKED not proxy PASS;current architecture exhausted without inventing path or reopening source', () => {
  assert.equal(readiness.G3R3C_GATE, 'BLOCKED')
  assert.equal(readiness.G3_EXECUTION_READINESS, 'BLOCKED')
  assert.equal(readiness.SELECTED_PRIVATE_BUILD_MODEL, 'NONE')
  assert.equal(readiness.G3A, 'NOT_AUTHORIZED_PENDING_HUMAN_DECISIONS')
  assert.equal(readiness.G3B, 'NOT_AUTHORIZED')
  assert(readiness.CURRENT_G3_PROOF_EXECUTION_ARCHITECTURE.includes('EXHAUSTED_WITHIN_CURRENT'))
  assert(
    readiness.exactResiduals.some((entry) => entry.includes('IPAd') || entry.includes('Systemd')),
  )
  assert(Object.values(readiness.boundaries).every((value) => value === 0 || value === 'NO'))
})
test('bounded publicGETledger has zeroAzure/guest mutations and no parkedBreads', () => {
  checkReads()
  assert.equal(ledger.length, 7)
  assert(
    ledger.every(
      (entry) => entry.status === 'SUCCEEDED' && entry.method === 'GET' && entry.mutation === false,
    ),
  )
  for (const entry of ledger) {
    assert.equal(hash(readFileSync(path.join(evidence, entry.responseFile))), entry.responseSha256)
    assert(documents.some(([name, url]) => entry.name === name && entry.url === url))
  }
})
test('pure script/ABAC/cleanup/cost/DAG outputs repeat exactly and checker validates binding', () => {
  assert.equal(renderScript().script, renderScript().script)
  assert.deepEqual(abacContract(), isolation)
  assert.deepEqual(cleanupContract(renderScript()), cleanup)
  assert.deepEqual(costClosure(), costs)
  assert.deepEqual(executionPlan(), plan)
  assert.equal(check().gate, 'BLOCKED')
})
for (const flag of [
  '--execute',
  '--run-command',
  '--grant',
  '--build',
  '--token',
  '--push',
  '--connect',
  '--approve',
  '--appoint',
  '--deploy',
])
  test(`local writer refuses execution:${flag}`, async () =>
    assert.rejects(main([flag]), /LOCAL_ONLY_NO_EXECUTION_FLAGS/))
