import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { evidence, files, hash, read, root } from './g3r2i-preservation.mjs'
import { check as checkParent } from './g3r3c-builder-closure.mjs'
import { subscription, vm } from './g3r3b-read-evidence.mjs'

export const tenant = '5082b8be-b04d-4a13-b61c-b6397670177b'
export const api = '2024-07-01'
const attachment =
  'C:\\Users\\AubertNungisa\\AppData\\Roaming\\Code\\agentSessionData\\fcf7d641-9398-4504-b7c9-e4ad7988498f\\attachments\\6c046ed2-a0ea-4a29-a45a-c819d6a7bea7\\Pasted text #1.txt'
const authorizationFile = path.join(evidence, 'G3R3D_LIVE_QUALIFICATION_AUTHORIZATION.json')
const ledgerFile = path.join(evidence, 'G3R3D_LIVE_LEDGER.json')
const output = (name) => path.join(evidence, `G3R3D_${name}.json`)
const write = (name, value) => writeFileSync(output(name), `${JSON.stringify(value, null, 2)}\n`)
const arm = (id, version = api) => `https://management.azure.com${id}?api-version=${version}`
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
export const requiredActions = [
  'Microsoft.Compute/virtualMachines/runCommands/read',
  'Microsoft.Compute/virtualMachines/runCommands/write',
  'Microsoft.Compute/virtualMachines/runCommands/delete',
]
export function capture() {
  checkParent()
  assert(!existsSync(authorizationFile), 'LIVE_AUTHORIZATION_EXISTS_NO_REPLAY')
  write('PRESERVATION', {
    evidence: files(evidence).filter((entry) => !entry.path.startsWith('G3R3D')),
    tools: readdirSync(root)
      .filter((name) => /^g3.*\.(mjs|sh)$/.test(name) && !name.startsWith('g3r3d-'))
      .map((name) => ({ name, sha256: hash(readFileSync(path.join(root, name))) })),
  })
  write('LIVE_QUALIFICATION_AUTHORIZATION', {
    mission: 'NZ-20261008-INFRA-001',
    phase: 'G3R3D',
    authorization:
      'Aubert explicitly authorizes bounded live Builder A qualification in the attached instruction;not G3A',
    instructionSha256: hash(readFileSync(attachment)),
    recordedAtUtc: new Date().toISOString(),
    runId: randomBytes(16).toString('hex'),
    target: vm,
    maxChildrenCreated: 3,
    maxChildrenDeleted: 3,
    allowedCommands: ['Q1_PREFLIGHT', 'Q2_FAULT_QUALIFICATION', 'Q3_POSTCHECK'],
    otherAzureMutations: 0,
    rbacChanges: 0,
    networkChanges: 0,
    realTokens: 0,
    builds: 0,
    pushes: 0,
    g3a: 'NOT_AUTHORIZED',
    g3b: 'NOT_AUTHORIZED',
    fakeCredential: 'Q2 only;locally generated,in memory,protectedParameters;only SHA256 retained',
  })
  write('LIVE_LEDGER', [])
}
export function preserve() {
  checkParent()
  const baseline = read(output('PRESERVATION'))
  for (const entry of baseline.evidence)
    assert.equal(
      hash(readFileSync(path.join(evidence, entry.path))),
      entry.sha256,
      `PARENT_CHANGED:${entry.path}`,
    )
  for (const entry of baseline.tools)
    assert.equal(
      hash(readFileSync(path.join(root, entry.name))),
      entry.sha256,
      `PARENT_TOOL_CHANGED:${entry.name}`,
    )
  return baseline
}
export function invoke(name, args, target, mutationClass = 'READ_ONLY') {
  preserve()
  const ledger = read(ledgerFile)
  assert(!ledger.some((entry) => entry.name === name), `NO_OPERATION_REPLAY:${name}`)
  const accountEntry = ledger.find((entry) => entry.name === 'account' && entry.responseFile)
  const operator = accountEntry
    ? read(path.join(evidence, accountEntry.responseFile)).user
    : 'CURRENT_SESSION_IDENTITY_PENDING_ACCOUNT_READ'
  const entry = {
    name,
    timestamp: new Date().toISOString(),
    operatorIdentity: operator,
    operation:
      args[0] === 'rest'
        ? args[args.indexOf('--method') + 1].toUpperCase()
        : args.slice(0, 2).join(' '),
    targetResourceId: target,
    cliAction: args,
    requestDigest: hash(JSON.stringify(args)),
    mutationClass,
    responseStatus: 'STARTED',
    responseFile: `G3R3D_READ_${ledger.length + 1}_${name}.json`,
  }
  ledger.push(entry)
  write('LIVE_LEDGER', ledger)
  const result = spawnSync(
    'C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\python.exe',
    ['-IBm', 'azure.cli', ...args, '--output', 'json', '--only-show-errors'],
    { encoding: 'utf8', timeout: 240000, maxBuffer: 1024 * 1024 },
  )
  Object.assign(entry, {
    completedAtUtc: new Date().toISOString(),
    exitCode: result.status,
    responseStatus: result.status === 0 && !result.error ? 'SUCCEEDED' : 'FAILED',
    error: result.error?.message ?? (result.stderr?.trim() || null),
  })
  if (result.stdout?.trim()) {
    writeFileSync(path.join(evidence, entry.responseFile), result.stdout)
    entry.responseSha256 = hash(result.stdout)
  } else delete entry.responseFile
  write('LIVE_LEDGER', ledger)
  assert.equal(entry.responseStatus, 'SUCCEEDED', `AZURE_OPERATION_FAILED:${name}:${entry.error}`)
  return result.stdout?.trim() ? JSON.parse(result.stdout) : null
}
export function matches(pattern, action) {
  const regex = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${regex}$`, 'i').test(action)
}
export function authority(permissions) {
  return requiredActions.map((action) => ({
    action,
    allowed: permissions.value.some(
      (entry) =>
        !entry.condition &&
        (entry.actions ?? []).some((pattern) => matches(pattern, action)) &&
        !(entry.notActions ?? []).some((pattern) => matches(pattern, action)),
    ),
  }))
}
export function validateTarget(account, target, view, nic) {
  const old = read(path.join(evidence, 'G3R3B_READ_4_vm-page-1.json'))
  const oldView = read(path.join(evidence, 'G3R3B_READ_5_vm-instance-view-page-1.json'))
  const oldNic = read(path.join(evidence, 'G3R3_READ_18_g2-builder-nic-page-1.json'))
  const same = (name, actual, expected) => ({
    name,
    actual,
    expected,
    matched: JSON.stringify(actual) === JSON.stringify(expected),
  })
  return [
    same('subscription', account.id, subscription),
    same('tenant', account.tenantId, tenant),
    same('accountState', account.state, 'Enabled'),
    same('vmId', target.id, old.id),
    same('vmName', target.name, old.name),
    same('location', target.location, old.location),
    same('vmSize', target.properties.hardwareProfile.vmSize, old.properties.hardwareProfile.vmSize),
    same('uniqueVmId', target.properties.vmId, old.properties.vmId),
    same(
      'NIC',
      target.properties.networkProfile.networkInterfaces.map((entry) => entry.id),
      old.properties.networkProfile.networkInterfaces.map((entry) => entry.id),
    ),
    same('NICResourceId', nic.id, oldNic.id),
    same(
      'subnets',
      nic.properties.ipConfigurations.map((entry) => entry.properties.subnet.id),
      oldNic.properties.ipConfigurations.map((entry) => entry.properties.subnet.id),
    ),
    same('agentVersion', view.vmAgent?.vmAgentVersion, oldView.vmAgent.vmAgentVersion),
    same(
      'agentHealthy',
      view.vmAgent?.statuses?.some(
        (entry) => entry.code === 'ProvisioningState/succeeded' && entry.displayStatus === 'Ready',
      ),
      true,
    ),
    same(
      'powerRunning',
      view.statuses?.some((entry) => entry.code === 'PowerState/running'),
      true,
    ),
    same('identity', target.identity, old.identity),
  ]
}
export function targetAuthority() {
  capture()
  const account = invoke(
    'account',
    ['account', 'show', '--query', '{id:id,tenantId:tenantId,state:state,user:user}'],
    subscription,
  )
  assert.equal(account.id, subscription, 'WRONG_SUBSCRIPTION_NO_MUTATION')
  assert.equal(account.tenantId, tenant, 'WRONG_TENANT_NO_MUTATION')
  const target = invoke('vm', ['rest', '--method', 'get', '--url', arm(vm)], vm)
  const view = invoke(
    'vm-instance-view',
    ['rest', '--method', 'get', '--url', arm(`${vm}/instanceView`)],
    vm,
  )
  const expectedNic = read(path.join(evidence, 'G3R3B_READ_4_vm-page-1.json')).properties
    .networkProfile.networkInterfaces[0].id
  const nic = invoke(
    'nic',
    ['rest', '--method', 'get', '--url', arm(expectedNic, '2024-05-01')],
    expectedNic,
  )
  const checks = validateTarget(account, target, view, nic)
  write('TARGET_VALIDATION', {
    result: checks.every((entry) => entry.matched) ? 'PASS' : 'FAIL_CLOSED',
    checks,
  })
  assert(
    checks.every((entry) => entry.matched),
    'TARGET_DRIFT_NO_RUN_COMMAND',
  )
  const permissions = invoke(
    'permissions',
    [
      'rest',
      '--method',
      'get',
      '--url',
      arm(`${vm}/providers/Microsoft.Authorization/permissions`, '2022-04-01'),
    ],
    vm,
  )
  assert(!permissions.nextLink, 'PAGINATED_PERMISSIONS_NOT_YET_BOUND')
  const actions = authority(permissions)
  write('OPERATOR_AUTHORITY', {
    currentOperator: account.user,
    actions,
    result: actions.every((entry) => entry.allowed)
      ? 'PASS_CURRENT_SESSION_UNCONDITIONED_PERMISSION_SURFACE'
      : 'BLOCKED_CURRENT_OPERATOR_PERMISSION',
    EXECUTION_AUTHORITY_SOURCE: 'LIVE_PROVIDER_OPERATION_CATALOG',
    source: 'G3R3C_BUILDER_PRIVILEGE_SUPPLEMENT.json',
    limitation:
      'Permission listing is a preflight observation,not exemption from live ARM deny assignments or authorization checks;no self-grant.',
  })
  console.log(
    `Target PASS;operator ${actions.every((entry) => entry.allowed) ? 'permission preflight PASS' : 'BLOCKED'};Azure mutations0`,
  )
}
export function q1Failures(guest) {
  if (guest.fatal) return [guest.fatal]
  const failures = []
  const require = (condition, reason) => {
    if (!condition) failures.push(reason)
  }
  require(guest.effectiveSupervisorUid === 0, 'RUN_COMMAND_SUPERVISOR_NOT_ROOT')
  require(guest.transientUnitSupport, 'SYSTEMD_TRANSIENT_UNITS_UNAVAILABLE')
  require(guest.cgroupMode === 'v2' &&
    ['memory', 'pids'].every((controller) =>
      guest.controllers.split(' ').includes(controller),
    ), 'CGROUP_MEMORY_OR_PIDS_UNAVAILABLE')
  require(guest.account.uid > 0, 'PRE_EXISTING_ROOTLESS_ACCOUNT_ABSENT')
  require(['/usr/sbin/nologin', '/bin/false'].includes(
    guest.account.shell,
  ), 'DEDICATED_ACCOUNT_NO_LOGIN_CONTRACT_NOT_MET')
  require(Object.values(guest.subordinateIds).every(Boolean), 'ROOTLESS_SUBUID_OR_SUBGID_ABSENT')
  for (const [name, present] of Object.entries(guest.tools))
    require(present, `PRE_EXISTING_TOOL_ABSENT:${name}`)
  require(guest.buildx.exit === 0, 'PRE_EXISTING_BUILDX_ABSENT')
  require(guest.systemdState.exit === 0, 'SYSTEMD_NOT_HEALTHY')
  require(guest.runMount.exit === 0 &&
    guest.runMount.value.startsWith('tmpfs'), 'RUN_NOT_VOLATILE_TMPFS')
  require(guest.swapEntries === 0, 'SWAP_PRESENT')
  require(guest.g3Units.exit === 0 && guest.g3Units.value === '', 'CONFLICTING_G3_UNITS')
  for (const [host, value] of Object.entries(guest.privateDns))
    require(JSON.stringify(value.addresses) ===
      JSON.stringify([value.expected]), `PRIVATE_ACR_DNS_MISMATCH:${host}`)
  for (const [host, value] of Object.entries(guest.privateTcp443))
    require(value === 'CONNECTED', `PRIVATE_ACR_TCP_UNAVAILABLE:${host}`)
  return failures
}
export function reconcileQ1() {
  preserve()
  const q1 = read(output('Q1_PREFLIGHT'))
  assert(q1.guest && q1.executionState === 'Succeeded', 'OBSERVED_GUEST_PREFLIGHT_REQUIRED')
  assert.equal(
    read(output('RUN_COMMAND_CLEANUP')).result,
    'PASS',
    'CHILD_DELETE_CONFIRMATION_REQUIRED',
  )
  assert(!existsSync(output('Q1_INITIAL_INTERPRETATION')), 'NO_RECONCILIATION_REPLAY')
  write('Q1_INITIAL_INTERPRETATION', q1)
  q1.failures = q1Failures(q1.guest)
  q1.processCensusLimitation =
    'One broad prefix process match may include the executing Q1 agent/script path. PID/context was not retained;not asserted as an unrelated conflict or a zero-residual proof. No conflicting systemd units were observed. Definitive missing account/tooling independently requires stopping before Q2.'
  q1.status = q1.failures.length
    ? 'FAIL_OBSERVED_PREREQUISITES'
    : 'PASS_INDISPENSABLE_PREREQUISITES'
  write('Q1_PREFLIGHT', q1)
}
export function bindLedgerRequests() {
  preserve()
  assert(!existsSync(output('LIVE_LEDGER_INITIAL_CAPTURE')), 'NO_LEDGER_NORMALIZATION_REPLAY')
  const ledger = read(ledgerFile)
  write('LIVE_LEDGER_INITIAL_CAPTURE', ledger)
  const operator = read(
    path.join(evidence, ledger.find((entry) => entry.name === 'account').responseFile),
  ).user
  for (const entry of ledger) {
    entry.cliArgumentsSha256 = entry.requestDigest
    entry.operatorIdentity = operator
    const bodyIndex = entry.cliAction.indexOf('--body')
    entry.requestBodySha256 =
      bodyIndex >= 0 ? hash(readFileSync(entry.cliAction[bodyIndex + 1].slice(1))) : null
    entry.requestDigest = hash(
      JSON.stringify({ cliAction: entry.cliAction, bodySha256: entry.requestBodySha256 }),
    )
    if (entry.operation === 'DELETE')
      entry.rollbackDeleteResult = {
        accepted: entry.responseStatus === 'SUCCEEDED',
        finalResult: 'OWNED_CHILD_ABSENT_CONFIRMED',
        evidence: 'G3R3D_RUN_COMMAND_CLEANUP.json',
      }
  }
  write('LIVE_LEDGER', ledger)
}
export function deriveLimits(guest) {
  if (!guest.memory || !Number.isSafeInteger(guest.runAvailableBytes))
    return { result: 'NOT_DERIVED_MISSING_Q1_MEMORY_OR_CAPACITY', limits: null }
  const mib = 1024 * 1024
  const qualificationMemory = Math.min(
    256 * mib,
    Math.floor(guest.memory.MemAvailableBytes / 8 / mib) * mib,
  )
  const qualificationWorkspace = Math.min(
    64 * mib,
    Math.floor(guest.runAvailableBytes / 16 / mib) * mib,
  )
  return {
    result:
      qualificationMemory >= 128 * mib && qualificationWorkspace >= 16 * mib
        ? 'BOUNDED_SYNTHETIC_LIMITS_DERIVED;FUTURE_BUILD_UNQUALIFIED'
        : 'INSUFFICIENT_SYNTHETIC_QUALIFICATION_CAPACITY',
    QUALIFICATION_MEMORY_LIMIT_BYTES: qualificationMemory,
    QUALIFICATION_WORKSPACE_LIMIT_BYTES: qualificationWorkspace,
    QUALIFICATION_TASKS_MAX: 64,
    FUTURE_BUILDER_MEMORY_LIMIT: null,
    FUTURE_WORKSPACE_MINIMUM: null,
    derivation:
      'Synthetic test uses at most1/8 observed available memory (cap256MiB),at most1/16 available/run (cap64MiB),minimum128MiB/16MiB. Future compiler/base-layer demand cannot be inferred from idle-host capacity and is not falsely qualified. Old8GiB/6G assumptions are not required for Q1/Q2.',
  }
}
export async function confirmDeletion(suffix = '') {
  const auth = read(authorizationFile)
  const child = `${vm}/runCommands/nzila-g3r3d-q1-${auth.runId}`
  const deadline = Date.now() + 180000
  let observations = 0
  for (;;) {
    const remaining = invoke(
      `children-deletion-confirm${suffix}-${observations++}`,
      ['rest', '--method', 'get', '--url', arm(`${vm}/runCommands`)],
      vm,
    )
    assert(!remaining.nextLink, 'CHILD_CLEANUP_PAGINATION_UNBOUND')
    const count = remaining.value.filter(
      (entry) => entry.id?.toLowerCase() === child.toLowerCase(),
    ).length
    const ledger = read(ledgerFile)
    write('RUN_COMMAND_CLEANUP', {
      childrenCreated: ledger.filter(
        (entry) =>
          entry.mutationClass === 'MANAGED_RUN_COMMAND_CHILD_CREATE' &&
          entry.responseStatus === 'SUCCEEDED',
      ).length,
      childrenDeleted: ledger.filter(
        (entry) =>
          entry.mutationClass === 'MANAGED_RUN_COMMAND_CHILD_DELETE' &&
          entry.responseStatus === 'SUCCEEDED',
      ).length,
      QUALIFICATION_RUN_COMMAND_CHILDREN_REMAINING: count,
      result: count === 0 ? 'PASS' : 'DELETE_ACCEPTED_PENDING_ASYNCHRONOUS_COMPLETION',
      targetVmMutated: false,
      finalEvidenceFile: ledger.at(-1).responseFile,
      rollbackDeleteResult: count === 0 ? 'OWNED_CHILD_ABSENT_CONFIRMED' : 'PENDING',
    })
    if (count === 0) return
    assert(Date.now() < deadline, 'QUALIFICATION_CHILD_DELETE_DEADLINE')
    await pause(5000)
  }
}
export async function q1(retry = false) {
  preserve()
  assert.equal(read(output('TARGET_VALIDATION')).result, 'PASS', 'TARGET_GATE_REQUIRED')
  assert.equal(
    read(output('OPERATOR_AUTHORITY')).result,
    'PASS_CURRENT_SESSION_UNCONDITIONED_PERMISSION_SURFACE',
    'CURRENT_OPERATOR_PERMISSION_GATE_REQUIRED',
  )
  const auth = read(authorizationFile)
  const suffix = retry ? '-lf-retry' : ''
  const key = (name) => `${name}${suffix}`
  if (retry) {
    assert.equal(
      read(output('RUN_COMMAND_CLEANUP')).QUALIFICATION_RUN_COMMAND_CHILDREN_REMAINING,
      0,
      'FIRST_CHILD_MUST_BE_ABSENT',
    )
    const first = read(
      path.join(
        evidence,
        read(ledgerFile).find((entry) => entry.name === 'q1-state-0').responseFile,
      ),
    )
    assert.equal(first.properties.instanceView.exitCode, 127, 'ONLY_UNEXECUTED_TRANSPORT_RETRY')
    assert(
      first.properties.instanceView.error.includes('cannot execute: required file not found'),
      'ONLY_UNEXECUTED_TRANSPORT_RETRY',
    )
    assert(
      read(output('Q1_REQUEST')).properties.source.script.includes('\r\n'),
      'CRLF_TRANSPORT_CAUSE_REQUIRED',
    )
    write('Q1_TRANSPORT_ATTEMPT_1', {
      executionState: first.properties.instanceView.executionState,
      exitCode: 127,
      error: first.properties.instanceView.error,
      cause:
        'Locally authored Windows CRLF shebang caused interpreter path rejection before observational script ran;successor transport normalizes LF. Not a VM tooling/capacity qualification result.',
      preservedRawResponse: read(ledgerFile).find((entry) => entry.name === 'q1-state-0')
        .responseFile,
      childDeletionConfirmed: true,
    })
    assert(
      read(ledgerFile).filter((entry) => entry.mutationClass === 'MANAGED_RUN_COMMAND_CHILD_CREATE')
        .length < 3,
      'CREATE_BUDGET_EXHAUSTED',
    )
  }
  const child = `${vm}/runCommands/nzila-g3r3d-q1-${auth.runId}`
  const previous = invoke(
    key('children-before-q1'),
    ['rest', '--method', 'get', '--url', arm(`${vm}/runCommands`)],
    vm,
  )
  assert(!previous.nextLink, 'CHILD_LIST_PAGINATION_NEEDS_EXPLICIT_HANDLING')
  assert(
    !previous.value.some((entry) => entry.id?.toLowerCase() === child.toLowerCase()),
    'OWNED_CHILD_ALREADY_EXISTS',
  )
  const script = readFileSync(path.join(root, 'g3r3d-q1-preflight.sh'), 'utf8').replace(
    /\r\n/g,
    '\n',
  )
  const body = {
    location: 'canadacentral',
    properties: {
      source: { script },
      asyncExecution: false,
      treatFailureAsDeploymentFailure: true,
      timeoutInSeconds: 120,
    },
  }
  write(retry ? 'Q1_REQUEST_LF_RETRY' : 'Q1_REQUEST', body)
  write('Q1_PREFLIGHT', {
    status: 'STARTED',
    childResourceId: child,
    scriptSha256: hash(script),
    timeoutInSeconds: 120,
    asyncExecution: false,
    treatFailureAsDeploymentFailure: true,
  })
  let guest
  try {
    invoke(
      key('q1-create'),
      [
        'rest',
        '--method',
        'put',
        '--url',
        arm(child),
        '--body',
        `@${output(retry ? 'Q1_REQUEST_LF_RETRY' : 'Q1_REQUEST')}`,
      ],
      child,
      'MANAGED_RUN_COMMAND_CHILD_CREATE',
    )
    const deadline = Date.now() + 300000
    for (let index = 0; ; index++) {
      const state = invoke(
        key(`q1-state-${index}`),
        ['rest', '--method', 'get', '--url', `${arm(child)}&$expand=instanceView`],
        child,
      )
      const view = state.properties?.instanceView
      if (
        view?.executionState &&
        ['Succeeded', 'Failed', 'TimedOut', 'Canceled'].includes(view.executionState)
      ) {
        const raw = view.output?.trim() ?? ''
        assert(raw.startsWith('{') && raw.endsWith('}'), 'Q1_OUTPUT_MISSING_TRUNCATED_OR_NOT_JSON')
        guest = JSON.parse(raw)
        const failures = q1Failures(guest)
        if (view.executionState !== 'Succeeded' || view.exitCode !== 0)
          failures.push(`Q1_EXECUTION:${view.executionState}:${view.exitCode}`)
        write('Q1_PREFLIGHT', {
          status: failures.length
            ? 'FAIL_OBSERVED_PREREQUISITES'
            : 'PASS_INDISPENSABLE_PREREQUISITES',
          childResourceId: child,
          scriptSha256: hash(script),
          timeoutInSeconds: 120,
          executionState: view.executionState,
          exitCode: view.exitCode,
          guest,
          failures,
          derivedLimits: deriveLimits(guest),
          rawEvidenceFile: read(ledgerFile).findLast(
            (entry) => entry.name === key(`q1-state-${index}`),
          ).responseFile,
        })
        break
      }
      assert(Date.now() < deadline, 'Q1_CONTROL_PLANE_OBSERVATION_DEADLINE;NO_Q2')
      await pause(5000)
    }
  } catch (error) {
    write('Q1_PREFLIGHT', {
      status: 'BLOCKED_COMMAND_OR_OBSERVATION',
      childResourceId: child,
      error: error.message,
      guestAttemptUnproven: true,
    })
    throw error
  } finally {
    const ledger = read(ledgerFile)
    if (ledger.some((entry) => entry.name === key('q1-create'))) {
      invoke(
        key('q1-delete'),
        ['rest', '--method', 'delete', '--url', arm(child)],
        child,
        'MANAGED_RUN_COMMAND_CHILD_DELETE',
      )
      await confirmDeletion(suffix)
    }
  }
  console.log(`Q1:${read(output('Q1_PREFLIGHT')).status};owned child deleted;Q2 not executed`)
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 3)
  assert(
    [
      '--target-authority',
      '--q1',
      '--q1-lf-retry',
      '--confirm-deletion',
      '--reconcile-q1',
      '--bind-ledger',
      '--check',
    ].includes(process.argv[2]),
    'BOUNDED_QUALIFICATION_FLAGS',
  )
  if (process.argv[2] === '--target-authority') targetAuthority()
  else if (process.argv[2] === '--q1') await q1()
  else if (process.argv[2] === '--q1-lf-retry') await q1(true)
  else if (process.argv[2] === '--confirm-deletion') await confirmDeletion('-first-transport')
  else if (process.argv[2] === '--reconcile-q1') reconcileQ1()
  else if (process.argv[2] === '--bind-ledger') bindLedgerRequests()
  else preserve()
}
