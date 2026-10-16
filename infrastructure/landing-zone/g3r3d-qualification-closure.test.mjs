import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { evidence, hash, read, root } from './g3r2i-preservation.mjs'
import { accounting, acyclic, check, generate, outputs } from './g3r3d-qualification-closure.mjs'
import {
  authority,
  deriveLimits,
  matches,
  preserve,
  q1Failures,
  requiredActions,
  validateTarget,
} from './g3r3d-live-qualification.mjs'
import { vm, subscription } from './g3r3b-read-evidence.mjs'

const get = (name) => read(path.join(evidence, `G3R3D_${name}.json`))
const auth = get('LIVE_QUALIFICATION_AUTHORIZATION')
const ledger = get('LIVE_LEDGER')
const q1 = get('Q1_PREFLIGHT')
const guest = q1.guest
const values = generate()
const [q2, q3, runtime, costs, plan, notice, readiness, markdown, counts] = values
const record = (name) =>
  read(path.join(evidence, ledger.find((entry) => entry.name === name).responseFile))

test('all frozen parent evidence/tools and ROOT1 source preservation remain byte identical', () => {
  const baseline = preserve()
  assert(baseline.evidence.length >= 482)
  assert(baseline.tools.length >= 25)
})
test('bounded human authorization is instruction-digest bound and not G3A', () => {
  assert.equal(auth.phase, 'G3R3D')
  assert.match(auth.instructionSha256, /^[a-f0-9]{64}$/)
  assert.match(auth.runId, /^[a-f0-9]{32}$/)
  assert.equal(auth.target, vm)
  assert.equal(auth.maxChildrenCreated, 3)
  assert.equal(auth.maxChildrenDeleted, 3)
  assert.deepEqual(auth.allowedCommands, ['Q1_PREFLIGHT', 'Q2_FAULT_QUALIFICATION', 'Q3_POSTCHECK'])
  assert.equal(auth.g3a, 'NOT_AUTHORIZED')
  assert.equal(auth.g3b, 'NOT_AUTHORIZED')
})
test('15 live target comparisons match frozen parent including NIC/subnet/agent/identity', () => {
  const target = get('TARGET_VALIDATION')
  assert.equal(target.result, 'PASS')
  assert.equal(target.checks.length, 15)
  assert(target.checks.every((entry) => entry.matched))
  const checks = validateTarget(
    record('account'),
    record('vm'),
    record('vm-instance-view'),
    record('nic'),
  )
  assert.deepEqual(checks, target.checks)
})
for (const [field, mutate] of [
  [
    'subscription',
    (a) => {
      a.id = 'wrong'
    },
  ],
  [
    'vmSize',
    (_, v) => {
      v.properties.hardwareProfile.vmSize = 'Standard_B4ms'
    },
  ],
  [
    'identity',
    (_, v) => {
      v.identity = null
    },
  ],
  [
    'subnets',
    (_, __, ___, n) => {
      n.properties.ipConfigurations[0].properties.subnet.id += '-drift'
    },
  ],
  [
    'agentHealthy',
    (_, __, v) => {
      v.vmAgent.statuses = []
    },
  ],
])
  test(`target drift fails closed:${field}`, () => {
    const args = ['account', 'vm', 'vm-instance-view', 'nic'].map(record)
    mutate(...args)
    assert.equal(validateTarget(...args).find((entry) => entry.name === field).matched, false)
  })
test('actual current user permission surface has exact plural RunCommand operations without self-grant', () => {
  const permissions = record('permissions')
  assert(authority(permissions).every((entry) => entry.allowed))
  assert.deepEqual(
    get('OPERATOR_AUTHORITY').actions.map((entry) => entry.action),
    requiredActions,
  )
  assert.equal(get('OPERATOR_AUTHORITY').currentOperator.type, 'user')
  assert.equal(
    get('OPERATOR_AUTHORITY').EXECUTION_AUTHORITY_SOURCE,
    'LIVE_PROVIDER_OPERATION_CATALOG',
  )
})
for (const permission of [
  { actions: [], notActions: [] },
  { actions: ['Microsoft.Compute/virtualMachines/runCommand/write'], notActions: [] },
  { actions: ['*'], notActions: ['Microsoft.Compute/virtualMachines/runCommands/*'] },
  { actions: ['*'], notActions: [], condition: 'unqualifiedCondition' },
])
  test(`authority rejects missing/singular/excluded/conditioned permission:${JSON.stringify(permission)}`, () => {
    assert(authority({ value: [permission] }).every((entry) => !entry.allowed))
  })
test('Azure action wildcard matching is anchored and case-insensitive,not prefix-broad', () => {
  assert(matches('Microsoft.Compute/*', requiredActions[1]))
  assert(matches(requiredActions[1].toLowerCase(), requiredActions[1]))
  assert(!matches(requiredActions[1], requiredActions[1] + '/extra'))
})
test('Q1 transport CRLF failure is preserved and never interpreted as observed VM prerequisite failure', () => {
  const first = get('Q1_TRANSPORT_ATTEMPT_1')
  assert.equal(first.exitCode, 127)
  assert(first.cause.includes('before observational script ran'))
  assert(get('Q1_REQUEST').properties.source.script.includes('\r\n'))
  assert(!get('Q1_REQUEST_LF_RETRY').properties.source.script.includes('\r'))
  assert.equal(record('q1-state-0').properties.instanceView.output, '')
  assert.equal(q1.executionState, 'Succeeded')
  assert.equal(q1.exitCode, 0)
})
for (const name of ['Q1_REQUEST', 'Q1_REQUEST_LF_RETRY'])
  test(`managed command settings and no ordinary/protected secret inputs:${name}`, () => {
    const request = get(name)
    assert.equal(request.location, 'canadacentral')
    assert.equal(request.properties.asyncExecution, false)
    assert.equal(request.properties.treatFailureAsDeploymentFailure, true)
    assert.equal(request.properties.timeoutInSeconds, 120)
    for (const field of [
      'parameters',
      'protectedParameters',
      'outputBlobUri',
      'errorBlobUri',
      'scriptUri',
    ])
      assert.equal(request.properties[field], undefined)
  })
test('Q1 raw output is complete bounded structured observation with exact normalized source digest', () => {
  const raw = read(path.join(evidence, q1.rawEvidenceFile))
  assert.deepEqual(JSON.parse(raw.properties.instanceView.output), guest)
  assert(Buffer.byteLength(raw.properties.instanceView.output) <= 3900)
  assert.equal(q1.scriptSha256, hash(get('Q1_REQUEST_LF_RETRY').properties.source.script))
  assert.equal(guest.schemaVersion, 1)
  assert.equal(guest.phase, 'Q1_PREFLIGHT')
  assert.equal(guest.effectiveSupervisorUid, 0)
})
test('actual guest cgroup/systemd/capacity facts are observations,not effective fence/runtime proof', () => {
  assert.equal(guest.cgroupMode, 'v2')
  assert(guest.controllers.includes('memory'))
  assert(guest.controllers.includes('pids'))
  assert.equal(guest.transientUnitSupport, true)
  assert.equal(guest.systemdState.value, 'degraded')
  assert.equal(guest.swapEntries, 0)
  assert(guest.runMount.value.startsWith('tmpfs'))
  assert(guest.runAvailableBytes < 1024 ** 3)
  assert(guest.memory.MemTotalBytes < 6 * 1024 ** 3)
})
test('existing account and subordinate IDs are definitively absent', () => {
  assert.equal(guest.account.exists, false)
  assert.equal(guest.subordinateIds['/etc/subuid'], false)
  assert.equal(guest.subordinateIds['/etc/subgid'], false)
  assert(q1.failures.includes('PRE_EXISTING_ROOTLESS_ACCOUNT_ABSENT'))
})
for (const tool of [
  'docker',
  'dockerd-rootless.sh',
  'rootlesskit',
  'slirp4netns',
  'newuidmap',
  'newgidmap',
])
  test(`live observed missing rootless prerequisite:${tool}`, () => {
    assert.equal(guest.tools[tool], false)
    assert(q1.failures.includes(`PRE_EXISTING_TOOL_ABSENT:${tool}`))
  })
test('private ACR DNS/TCP pass;IMDS outside control connects without metadata requests', () => {
  for (const value of Object.values(guest.privateDns))
    assert.deepEqual(value.addresses, [value.expected])
  assert(Object.values(guest.privateTcp443).every((value) => value === 'CONNECTED'))
  assert.equal(guest.outsideImdsTcp80, 'CONNECTED')
  assert.equal(guest.metadataRequests, 0)
  assert.equal(runtime.DESCENDANT_IMDS_NETWORK_ACCESS, 'NOT_TESTED')
})
test('broad process census cannot assert a foreign conflict or zero-residual proof', () => {
  assert.equal(guest.g3ProcessCount, 1)
  assert.equal(guest.g3Units.value, '')
  assert(!q1.failures.includes('CONFLICTING_G3_UNITS_OR_PROCESSES'))
  assert(q1.processCensusLimitation.includes('may include'))
  assert.equal(get('Q1_INITIAL_INTERPRETATION').guest.g3ProcessCount, 1)
  assert.deepEqual(q1Failures(guest), q1.failures)
})
test('smaller synthetic limits derive from actual capacity,not old8GiB/6G requirements', () => {
  const limits = deriveLimits(guest)
  assert.deepEqual(limits, q1.derivedLimits)
  assert.equal(limits.QUALIFICATION_MEMORY_LIMIT_BYTES, 256 * 1024 ** 2)
  assert.equal(limits.QUALIFICATION_WORKSPACE_LIMIT_BYTES, 48 * 1024 ** 2)
  assert(limits.QUALIFICATION_MEMORY_LIMIT_BYTES <= guest.memory.MemAvailableBytes / 8)
  assert(limits.QUALIFICATION_WORKSPACE_LIMIT_BYTES <= guest.runAvailableBytes / 16)
  assert.equal(limits.QUALIFICATION_TASKS_MAX, 64)
  assert.equal(limits.FUTURE_BUILDER_MEMORY_LIMIT, null)
  assert.equal(limits.FUTURE_WORKSPACE_MINIMUM, null)
})
test('insufficient or missing observed capacity never produces qualified safe limits', () => {
  assert(deriveLimits({}).result.startsWith('NOT_DERIVED'))
  assert.equal(
    deriveLimits({ memory: { MemAvailableBytes: 64 * 1024 ** 2 }, runAvailableBytes: 1024 ** 2 })
      .result,
    'INSUFFICIENT_SYNTHETIC_QUALIFICATION_CAPACITY',
  )
})
test('live Q1 prerequisite failure forces FAIL,not blocked-for-permission or speculative PASS', () => {
  assert.equal(runtime.BUILDER_A_LIVE_QUALIFICATION, 'FAIL')
  assert.equal(runtime.BUILDER_A, 'DISQUALIFIED')
  assert.equal(runtime.qualificationPass, false)
  assert(runtime.observedFailures.length > 0)
  assert.equal(readiness.G3R3D, 'FAIL')
  assert.equal(readiness.CURRENT_G3_PROOF_EXECUTION_ARCHITECTURE, 'EXHAUSTED')
})
for (const [field, expected] of [
  ['ROOTLESS_EXECUTION', 'NOT_EXECUTED_PREREQUISITES_ABSENT'],
  ['DESCENDANT_IMDS_NETWORK_ACCESS', 'NOT_TESTED'],
  ['PRIMARY_TRAP_CLEANUP', 'NOT_TESTED'],
  ['INDEPENDENT_WATCHDOG_CLEANUP', 'NOT_TESTED'],
  ['TERM_RESISTANT_DESCENDANT', 'NOT_CREATED'],
  ['RUN_COMMAND_TIMEOUT_QUALIFICATION', 'NOT_EXECUTED_Q1_STOP'],
])
  test(`unexecuted fault capability is not claimed proven:${field}`, () =>
    assert.equal(runtime[field], expected))
test('Q2 mandatory stop and Q3 after-Q2-only semantics have explicit non-executed schemas', () => {
  assert.equal(q2.status, 'NOT_EXECUTED_Q1_STOP')
  assert.equal(q2.transientObjectsCreated, 0)
  assert.equal(q2.childResourceId, null)
  assert.equal(q3.status, 'NOT_EXECUTED_Q2_NOT_RUN')
  assert.equal(q3.childResourceId, null)
  assert.equal(q3.RUN_OWNED_PROCESSES, null)
  assert.equal(q3.RUN_OWNED_ACTIVE_UNITS, null)
  assert.equal(q3.RUN_OWNED_TIMERS, null)
})
test('no fake credential generated;nonpersistence is not a measured remanence zero', () => {
  assert.equal(q2.fakeCredentialGenerated, false)
  assert.equal(counts.FAKE_CREDENTIAL_GENERATIONS, 0)
  assert.equal(runtime.FAKE_CREDENTIAL_SHA256, null)
  assert.equal(q3.BOUNDED_AGENT_GUEST_TOKEN_MATCHES, null)
  assert.equal(runtime.BOUNDED_AGENT_GUEST_TOKEN_MATCHES, null)
  assert(runtime.remanenceResult.includes('NO_VM_WIDE_ZERO_RESIDUAL_CLAIM'))
})
test('Q1 observational guest contract never installs/enables/stops shared processes or network', () => {
  assert.equal(guest.persistentGuestChanges, 0)
  assert.equal(guest.containerPulls, 0)
  assert.equal(guest.builds, 0)
  assert.equal(guest.acrAuthentication, 0)
  const script = get('Q1_REQUEST_LF_RETRY').properties.source.script
  for (const forbidden of [
    'apt-get',
    'docker login',
    'docker pull',
    'docker build ',
    'systemctl enable',
    'systemctl stop',
    'rm -rf',
    'pkill',
    'killall',
    '/metadata/identity/oauth2/token',
  ])
    assert(!script.includes(forbidden), forbidden)
  for (const [key, value] of Object.entries(runtime.guestCleanliness))
    if (key.startsWith('NO_')) assert.equal(value, true)
})
test('every ledger entry binds timestamp/operator/target,CLI arguments,actual body,and raw response hashes', () => {
  for (const entry of ledger) {
    assert(!Number.isNaN(Date.parse(entry.timestamp)))
    assert.equal(entry.operatorIdentity.type, 'user')
    assert(entry.operatorIdentity.name)
    assert(
      entry.targetResourceId.startsWith('/subscriptions/' + subscription) ||
        entry.name === 'account',
    )
    assert.equal(entry.cliArgumentsSha256, hash(JSON.stringify(entry.cliAction)))
    assert.equal(
      entry.requestDigest,
      hash(JSON.stringify({ cliAction: entry.cliAction, bodySha256: entry.requestBodySha256 })),
    )
    if (entry.responseFile)
      assert.equal(
        hash(readFileSync(path.join(evidence, entry.responseFile))),
        entry.responseSha256,
      )
  }
})
test('original ledger remains preserved separately from request-body/identity binding enrichment', () => {
  const initial = get('LIVE_LEDGER_INITIAL_CAPTURE')
  assert.equal(initial.length, ledger.length)
  for (let index = 0; index < initial.length; index++) {
    assert.equal(initial[index].requestDigest, ledger[index].cliArgumentsSha256)
    assert.equal(initial[index].timestamp, ledger[index].timestamp)
    assert.equal(initial[index].responseSha256, ledger[index].responseSha256)
  }
})
test('mutation accounting counts all physical retries,not only one unique child', () => {
  assert.deepEqual(accounting(ledger), counts)
  assert.equal(counts.totalOperations, 17)
  assert.equal(counts.readOnlyOperations, 13)
  assert.equal(counts.childCreationRequests, 2)
  assert.equal(counts.childDeletionRequests, 2)
  assert.equal(counts.uniqueChildResourceIds.length, 1)
  assert(counts.childCreationRequests <= auth.maxChildrenCreated)
  assert(counts.childDeletionRequests <= auth.maxChildrenDeleted)
  assert.equal(counts.successfulCliOperations, 17)
})
test('owned child deletion observed asynchronously before zero remaining confirmation', () => {
  const cleanup = get('RUN_COMMAND_CLEANUP')
  assert.equal(cleanup.childrenCreated, 2)
  assert.equal(cleanup.childrenDeleted, 2)
  assert.equal(cleanup.result, 'PASS')
  assert.equal(cleanup.QUALIFICATION_RUN_COMMAND_CHILDREN_REMAINING, 0)
  assert.equal(cleanup.rollbackDeleteResult, 'OWNED_CHILD_ABSENT_CONFIRMED')
  const final = read(path.join(evidence, cleanup.finalEvidenceFile))
  assert(!final.value.some((entry) => entry.id === q1.childResourceId))
  assert(
    record('children-after-q1-delete').value.some(
      (entry) => entry.properties.provisioningState === 'Deleting',
    ),
  )
  assert(
    ledger
      .filter((entry) => entry.operation === 'DELETE')
      .every((entry) => entry.rollbackDeleteResult.finalResult === 'OWNED_CHILD_ABSENT_CONFIRMED'),
  )
})
for (const field of [
  'AZURE_MUTATIONS_OTHER_THAN_RUN_COMMAND_CHILDREN',
  'RBAC_MUTATIONS',
  'G2_NETWORK_MUTATIONS',
  'IMAGE_PUSHES',
  'IMAGE_PULLS',
  'BUILDS',
  'REAL_TOKEN_CREATIONS',
])
  test(`prohibited operation count remains zero:${field}`, () => assert.equal(counts[field], 0))
test('actual mutation targets/methods are only exact run-owned Q1 child,no foreign/VM changes', () => {
  for (const entry of ledger.filter((row) => row.mutationClass !== 'READ_ONLY')) {
    assert.equal(entry.targetResourceId, q1.childResourceId)
    assert.equal(entry.targetResourceId, `${vm}/runCommands/nzila-g3r3d-q1-${auth.runId}`)
    assert(['PUT', 'DELETE'].includes(entry.operation))
  }
})
test('cost is not recomputed after runtime FAIL;correct frozen meter bindings retained', () => {
  assert.equal(costs.status, 'NOT_RECOMPUTED_RUNTIME_QUALIFICATION_FAIL')
  assert.equal(costs.capturedRateBindings.keyVaultMeterId, '0f824807-2376-435c-95c9-f992b67a07b0')
  assert.equal(costs.capturedRateBindings.diskMeterId, 'df249cf3-71c9-5327-8738-56f65fa3fcda')
  assert.equal(costs.inheritedConditionalSubtotalCAD, 2.95388107)
  assert.equal(costs.inheritedSubtotalIsAllIn, false)
  assert.equal(costs.TECHNICAL_HARD_LOG_CAP, 'NO')
  assert(costs.ceilingSemantics.includes('HUMAN_FINANCIAL_AUTHORIZATION_ENVELOPE'))
})
for (const field of [
  'LIVE_QUALIFICATION_COST_CAD',
  'BUILDER_A_MAX_INCREMENTAL_COST_CAD',
  'EXPECTED_PROOF_RUN_COST_CAD',
  'BOUNDED_MAX_PROOF_RUN_COST_CAD',
  'ROLLBACK_ALLOWANCE_CAD',
  'DIAGNOSTIC_CONTINGENCY_CAD',
  'UNCERTAINTY_BUFFER_CAD',
])
  test(`unqualified cost remains null:${field}`, () => assert.equal(costs[field], null))
test('ceiling unsupported,never human-approved or guaranteed financial hard stop', () => {
  assert.equal(costs.RECOMMENDED_EXECUTION_CEILING_CAD, 'UNSUPPORTED')
  assert.equal(costs.HUMAN_APPROVED_EXECUTION_CEILING_CAD, 'UNBOUND')
})
test('22-step frozen blocked DAG preserves all original steps and quota/manifest activation ordering', () => {
  const parent = read(path.join(evidence, 'G3R3C_EXECUTION_PLAN.json'))
  assert.deepEqual(plan.steps, parent.steps)
  assert.equal(plan.steps.length, 22)
  assert(acyclic(plan.steps))
  assert.equal(plan.runtimeGate, 'FAIL')
  assert(plan.steps.find((step) => step.id === 'quota-gate').ACTION.includes('>=250'))
  assert(
    plan.steps.some((step) => step.G3R3C_REQUIREMENT?.includes('ActualprivateACRmanifestdigest')),
  )
})
for (const steps of [
  [{ id: 'a', dependsOn: ['a'] }],
  [{ id: 'a', dependsOn: ['b'] }],
  [
    { id: 'a', dependsOn: [] },
    { id: 'a', dependsOn: [] },
  ],
])
  test(`DAG validation denies cycle/missing/duplicate:${JSON.stringify(steps)}`, () =>
    assert.throws(() => acyclic(steps)))
test('no eligible final human packet;only original three reserved groups,operator unappointed', () => {
  assert.equal(readiness.finalHumanPacket, 'NOT_ISSUED;RUNTIME_PASS_AND_NUMERIC_CEILING_REQUIRED')
  assert.deepEqual(Object.keys(readiness.reservedHumanDecisions), ['A', 'B', 'C'])
  assert.equal(readiness.recommendedExecutionOperator, 'bfa4a851-696a-4d3f-927b-5fb1526f79f2')
  assert.equal(readiness.recommendedOperatorStatus, 'NOT_APPOINTED')
  assert(notice.includes('withholding notice'))
  assert(!notice.includes('[x]'))
})
test('frozen exact core/supplement/composite authority never rewrites parent or grants', () => {
  assert.equal(
    readiness.composite.CORE_PACKET_DIGEST,
    '9cfcda0c4bced61e302128d8455867214f7b64c8b5b101bf5e52f632e8984198',
  )
  assert.equal(
    readiness.composite.SUPPLEMENT_DIGEST,
    '51fe60768d6042c765828ca01382a25f95cec408fcc8229fabda7f5a9ef0076b',
  )
  assert.equal(
    readiness.composite.COMPOSITE_G2_AUTHORIZATION_DIGEST,
    '9e8af91b43633a4b2a500038f5c3bd2d3626db47af1b33f4e230793f7b97c128',
  )
  assert.equal(
    readiness.builderScript.sha256,
    '6a05455e5f3bd3e5992697106c696e6e645b0d54c258beb069add379ba3e06b8',
  )
})
test('selection NONE,Builder B parked,G3 blocked,ROOT1 closed and no G3A/G3B authority', () => {
  assert.equal(readiness.SELECTED_PRIVATE_BUILD_MODEL, 'NONE')
  assert.equal(readiness.BUILDER_B, 'PARKED_NOT_SELECTED')
  assert.equal(readiness.G3_EXECUTION_READINESS, 'BLOCKED')
  assert.equal(readiness.ROOT_1, 'CLOSED')
  assert.equal(readiness.G3A, 'NOT_AUTHORIZED')
  assert.equal(readiness.G3B, 'NOT_AUTHORIZED')
  assert.equal(counts.G3A_EXECUTED, false)
  assert.equal(counts.G3B_EXECUTED, false)
})
test('all requested successor outputs exist and deterministic local generation/checkers bind exact bytes', () => {
  assert.equal(outputs.length, 9)
  assert.deepEqual(generate(), values)
  assert.deepEqual(check(), {
    offlineValidation: 'PASS',
    liveQualification: 'FAIL',
    otherAzureMutations: 0,
  })
  assert(markdown.includes('Builder A DISQUALIFIED'))
  assert(readdirSync(evidence).includes('G3R3D_LIVE_QUALIFICATION_AUTHORIZATION.json'))
})
test('Q1 shell parser is syntax-only;no guest replay in tests', () => {
  const result = spawnSync(
    'C:\\Program Files\\Git\\bin\\bash.exe',
    ['-n', path.join(root, 'g3r3d-q1-preflight.sh')],
    { encoding: 'utf8', timeout: 10000 },
  )
  assert.equal(result.status, 0, result.stderr)
})
