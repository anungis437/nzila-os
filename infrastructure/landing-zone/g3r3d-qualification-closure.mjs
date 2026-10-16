import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { evidence, hash, read, root } from './g3r2i-preservation.mjs'
import { preserve, q1Failures, requiredActions } from './g3r3d-live-qualification.mjs'
import { vm } from './g3r3b-read-evidence.mjs'
import { format } from 'prettier'

const file = (name, extension = 'json') => path.join(evidence, `G3R3D_${name}.${extension}`)
const parent = (name) => read(path.join(evidence, `G3R3C_${name}.json`))
export const outputs = [
  'G3R3D_Q2_FAULT_QUALIFICATION.json',
  'G3R3D_Q3_POSTCHECK.json',
  'G3R3D_BUILDER_RUNTIME_QUALIFICATION.json',
  'G3R3D_COST_CLOSURE.json',
  'G3R3D_EXECUTION_PLAN.json',
  'G3R3D_FINAL_HUMAN_AUTHORIZATION_PACKET.md',
  'G3R3D_EXECUTION_READINESS.json',
  'G3R3D_EXECUTION_READINESS.md',
  'G3R3D_LEDGER_ACCOUNTING.json',
]
export function accounting(ledger) {
  const creates = ledger.filter(
    (entry) => entry.mutationClass === 'MANAGED_RUN_COMMAND_CHILD_CREATE',
  )
  const deletes = ledger.filter(
    (entry) => entry.mutationClass === 'MANAGED_RUN_COMMAND_CHILD_DELETE',
  )
  const mutations = ledger.filter((entry) => entry.mutationClass !== 'READ_ONLY')
  return {
    totalOperations: ledger.length,
    readOnlyOperations: ledger.length - mutations.length,
    successfulCliOperations: ledger.filter((entry) => entry.responseStatus === 'SUCCEEDED').length,
    failedCliOperations: ledger.filter((entry) => entry.responseStatus === 'FAILED').length,
    childCreationRequests: creates.length,
    childDeletionRequests: deletes.length,
    successfulChildCreations: creates.filter((entry) => entry.responseStatus === 'SUCCEEDED')
      .length,
    successfulChildDeletions: deletes.filter((entry) => entry.responseStatus === 'SUCCEEDED')
      .length,
    uniqueChildResourceIds: [...new Set(creates.map((entry) => entry.targetResourceId))],
    guestExecutions: {
      q1TransportAttempt: 'FAILED_BEFORE_SCRIPT_EXECUTION_EXIT_127;WINDOWS_CRLF_CAUSE_PRESERVED',
      q1LfRetry: 'SUCCEEDED_EXIT_0;OBSERVED_GUEST_PREREQUISITES_FAIL',
      q2: 'NOT_EXECUTED',
      q3: 'NOT_EXECUTED',
    },
    AZURE_MUTATIONS_OTHER_THAN_RUN_COMMAND_CHILDREN: mutations.filter(
      (entry) =>
        !['MANAGED_RUN_COMMAND_CHILD_CREATE', 'MANAGED_RUN_COMMAND_CHILD_DELETE'].includes(
          entry.mutationClass,
        ),
    ).length,
    RBAC_MUTATIONS: 0,
    G2_NETWORK_MUTATIONS: 0,
    IMAGE_PUSHES: 0,
    IMAGE_PULLS: 0,
    BUILDS: 0,
    REAL_TOKEN_CREATIONS: 0,
    FAKE_CREDENTIAL_GENERATIONS: 0,
    fakeCredentialSha256: null,
    FAKE_CREDENTIAL_PERSISTENCE: 'NOT_APPLICABLE_NOT_GENERATED;Q2_STOPPED',
    G3A_EXECUTED: false,
    G3B_EXECUTED: false,
    rollbackDeleteResult: read(file('RUN_COMMAND_CLEANUP')).rollbackDeleteResult,
    semantics:
      'Two Q1 create/delete lifecycles at one unique child ID;both count against the3-create/3-delete budget. Control-plane CLI success is not guest qualification success. DELETE completion is verified separately after asynchronous Deleting observations.',
  }
}
export function acyclic(steps) {
  const byId = new Map(steps.map((step) => [step.id, step]))
  assert.equal(byId.size, steps.length, 'DAG_DUPLICATE_STEP')
  const visited = new Set()
  const visiting = new Set()
  function visit(id) {
    assert(byId.has(id), `DAG_MISSING_DEPENDENCY:${id}`)
    assert(!visiting.has(id), `DAG_CYCLE:${id}`)
    if (visited.has(id)) return
    visiting.add(id)
    for (const dependency of byId.get(id).dependsOn) visit(dependency)
    visiting.delete(id)
    visited.add(id)
  }
  for (const id of byId.keys()) visit(id)
  return true
}
export function generate() {
  preserve()
  const q1 = read(file('Q1_PREFLIGHT'))
  const authorization = read(file('LIVE_QUALIFICATION_AUTHORIZATION'))
  const target = read(file('TARGET_VALIDATION'))
  const ledger = read(file('LIVE_LEDGER'))
  const cleanup = read(file('RUN_COMMAND_CLEANUP'))
  assert.equal(target.result, 'PASS')
  assert.equal(
    q1.status,
    'FAIL_OBSERVED_PREREQUISITES',
    'THIS_SUCCESSOR_ONLY_CLOSES_OBSERVED_Q1_FAIL;NO_SPECULATIVE_PASS',
  )
  assert.equal(q1.executionState, 'Succeeded')
  assert.equal(q1.exitCode, 0)
  assert.deepEqual(q1.failures, q1Failures(q1.guest))
  assert.equal(cleanup.result, 'PASS')
  assert.equal(cleanup.QUALIFICATION_RUN_COMMAND_CHILDREN_REMAINING, 0)
  const counts = accounting(ledger)
  assert(counts.childCreationRequests <= authorization.maxChildrenCreated)
  assert(counts.childDeletionRequests <= authorization.maxChildrenDeleted)
  assert.equal(counts.AZURE_MUTATIONS_OTHER_THAN_RUN_COMMAND_CHILDREN, 0)
  const runtime = {
    BUILDER_A_LIVE_QUALIFICATION: 'FAIL',
    BUILDER_A: 'DISQUALIFIED',
    reason:
      'Observed existing VM lacks the required pre-existing dedicated rootless account and container tooling. User Q1 stop conditions prohibit installation or proceeding to Q2.',
    target: vm,
    runId: authorization.runId,
    targetValidation: 'PASS',
    VM_AGENT_HEALTHY: true,
    observedFailures: q1.failures,
    evidence: 'G3R3D_Q1_PREFLIGHT.json',
    processCensusLimitation: q1.processCensusLimitation,
    ROOTLESS_EXECUTION: 'NOT_EXECUTED_PREREQUISITES_ABSENT',
    DESCENDANT_IMDS_NETWORK_ACCESS: 'NOT_TESTED',
    OUTSIDE_IMDS_TCP80: q1.guest.outsideImdsTcp80,
    METADATA_OR_TOKEN_REQUESTS: 0,
    PRIMARY_TRAP_CLEANUP: 'NOT_TESTED',
    INDEPENDENT_WATCHDOG_CLEANUP: 'NOT_TESTED',
    TERM_RESISTANT_DESCENDANT: 'NOT_CREATED',
    RUN_COMMAND_TIMEOUT_QUALIFICATION: 'NOT_EXECUTED_Q1_STOP',
    FAKE_CREDENTIAL_SHA256: null,
    BOUNDED_AGENT_GUEST_TOKEN_MATCHES: null,
    remanenceResult:
      'NOT_EXECUTED_NOT_APPLICABLE;NO_FAKE_CREDENTIAL_GENERATED;NO_VM_WIDE_ZERO_RESIDUAL_CLAIM',
    guestCleanliness: {
      basis:
        'Q1 observational script only;Q2 transient objects never created. No Q3 residual observation is claimed.',
      NO_PERSISTENT_PACKAGE_CHANGE: true,
      NO_SERVICE_ENABLEMENT: true,
      NO_VM_RESTART: true,
      NO_SHARED_DOCKER_STATE_DELETION: true,
      NO_NON_G3_PROCESS_TERMINATION: true,
      NO_PERSISTENT_FIREWALL_CHANGE: true,
      NO_PERSISTENT_NETWORK_CHANGE: true,
      agentManagedArtifacts:
        'Managed Run Command handler logs/download artifacts are outside the project-workspace contract;not asserted absent.',
    },
    derivedLimits: q1.derivedLimits,
    childCleanup: cleanup,
    qualificationPass: false,
  }
  const q2 = {
    schemaVersion: 1,
    phase: 'Q2_FAULT_QUALIFICATION',
    status: 'NOT_EXECUTED_Q1_STOP',
    reason: runtime.reason,
    childResourceId: null,
    transientObjectsCreated: 0,
    fakeCredentialGenerated: false,
    FAKE_CREDENTIAL_SHA256: null,
    rootlessExecution: 'NOT_TESTED',
    descendantImdsDenial: 'NOT_TESTED',
    normalCleanup: 'NOT_TESTED',
    watchdogCleanup: 'NOT_TESTED',
    RUN_COMMAND_TIMEOUT_QUALIFICATION:
      'NOT_EXECUTED_WITH_REASON:Q1_INDISPENSABLE_PREREQUISITES_ABSENT',
  }
  const q3 = {
    schemaVersion: 1,
    phase: 'Q3_POSTCHECK',
    status: 'NOT_EXECUTED_Q2_NOT_RUN',
    reason:
      'Q3 is permitted only after Q2 terminates or times out;Q2 was stopped by Q1. No guest postcheck results are fabricated.',
    childResourceId: null,
    RUN_OWNED_PROCESSES: null,
    RUN_OWNED_ACTIVE_UNITS: null,
    RUN_OWNED_TIMERS: null,
    RUN_OWNED_WORKSPACE_EXISTS: 'NOT_OBSERVED;Q2_WORKSPACE_NOT_CREATED',
    FAKE_CREDENTIAL_FILE_EXISTS: 'NOT_CREATED',
    TEMP_DOCKER_CONFIG_EXISTS: 'NOT_CREATED',
    TEMP_DAEMON_EXISTS: 'NOT_CREATED',
    BOUNDED_AGENT_GUEST_TOKEN_MATCHES: null,
    boundedRemanenceSearch: 'NOT_EXECUTED_NO_FAKE_CREDENTIAL',
    remediation: 'NOT_NEEDED;NO_Q2_TRANSIENT_STATE',
    azureChildCleanup: cleanup,
  }
  const costs = {
    status: 'NOT_RECOMPUTED_RUNTIME_QUALIFICATION_FAIL',
    reason:
      'G3R3D cost closure is allowed only after runtime PASS;Builder A is disqualified. No new proof ceiling is justified.',
    capturedRateBindings: {
      source: 'G3R3C_COST_CLOSURE.json',
      sha256: hash(readFileSync(path.join(evidence, 'G3R3C_COST_CLOSURE.json'))),
      keyVaultMeterId: parent('COST_CLOSURE').keyVault.meter.meterId,
      diskMeterId: parent('COST_CLOSURE').disk.meter.meterId,
    },
    inheritedConditionalSubtotalCAD: parent('COST_CLOSURE').reconstruction.conditionalSubtotalCAD,
    inheritedSubtotalIsAllIn: false,
    LIVE_QUALIFICATION_COST_CAD: null,
    liveQualificationCostReason:
      'No invoice/usage cost measurement;existing VM remains shared. Do not equate zero non-child mutations with zero billing.',
    BUILDER_A_MAX_INCREMENTAL_COST_CAD: null,
    EXPECTED_PROOF_RUN_COST_CAD: null,
    BOUNDED_MAX_PROOF_RUN_COST_CAD: null,
    ROLLBACK_ALLOWANCE_CAD: null,
    DIAGNOSTIC_CONTINGENCY_CAD: null,
    UNCERTAINTY_BUFFER_CAD: null,
    RECOMMENDED_EXECUTION_CEILING_CAD: 'UNSUPPORTED',
    HUMAN_APPROVED_EXECUTION_CEILING_CAD: 'UNBOUND',
    ceilingSemantics: 'HUMAN_FINANCIAL_AUTHORIZATION_ENVELOPE;not guaranteed Azure billing stop',
    TECHNICAL_HARD_LOG_CAP: 'NO',
    serviceTransactionMaximumAlternative:
      'Allowed prospective modeling method after runtime PASS;not modeled for disqualified Builder A',
  }
  const plan = structuredClone(parent('EXECUTION_PLAN'))
  acyclic(plan.steps)
  Object.assign(plan, {
    phase: 'G3R3D',
    status: 'BLOCKED_BUILDER_A_DISQUALIFIED',
    SELECTED_PRIVATE_BUILD_MODEL: 'NONE',
    authorization: 'NO_G3_EXECUTION;FROZEN_22_STEP_DAG_PRESERVED_NOT_ENABLED',
    preservation:
      'G3R3C plan copied as prospective blocked design;no builder selection or executable authority added',
    runtimeGate: 'FAIL',
  })
  const readiness = {
    mission: 'NZ-20261008-INFRA-001',
    phase: 'G3R3D',
    G3R3D: 'FAIL',
    ROOT_1: 'CLOSED',
    BUILDER_A_LIVE_QUALIFICATION: 'FAIL',
    BUILDER_A: 'DISQUALIFIED',
    BUILDER_B: 'PARKED_NOT_SELECTED',
    SELECTED_PRIVATE_BUILD_MODEL: 'NONE',
    CURRENT_G3_PROOF_EXECUTION_ARCHITECTURE: 'EXHAUSTED',
    G3_EXECUTION_READINESS: 'BLOCKED',
    G3A: 'NOT_AUTHORIZED',
    G3B: 'NOT_AUTHORIZED',
    targetValidation: 'PASS',
    currentOperatorAuthority: 'EXISTING_SESSION;NO_GRANT',
    observedFailures: runtime.observedFailures,
    composite: parent('EXECUTION_READINESS').composite,
    repositoryAbac: 'PARENT_STATIC_CONTRACT_PRESERVED;NO_GRANT',
    builderScript: {
      sha256: parent('EXECUTION_READINESS').scriptSha256,
      state: 'PARENT_FROZEN_UNQUALIFIED;NOT_EXECUTED',
    },
    recommendedExecutionOperator: 'bfa4a851-696a-4d3f-927b-5fb1526f79f2',
    recommendedOperatorStatus: 'NOT_APPOINTED',
    RECOMMENDED_EXECUTION_CEILING_CAD: 'UNSUPPORTED',
    HUMAN_APPROVED_EXECUTION_CEILING_CAD: 'UNBOUND',
    finalHumanPacket: 'NOT_ISSUED;RUNTIME_PASS_AND_NUMERIC_CEILING_REQUIRED',
    reservedHumanDecisions: {
      A: 'ACCOUNTABILITY;owner/operator/separate approver unbound',
      B: 'COMPOSITE G2 MUTATION AUTHORIZATION;unbound',
      C: 'EXECUTION COST CEILING;unsupported/unbound',
    },
    accounting: counts,
    localValidation: existsSync(file('LOCAL_VALIDATION'))
      ? {
          file: 'G3R3D_LOCAL_VALIDATION.json',
          sha256: hash(readFileSync(file('LOCAL_VALIDATION'))),
        }
      : null,
  }
  const notice = `# G3R3D final human authorization packet: NOT ISSUED

Builder A live qualification **FAIL**;recommended numerical ceiling **UNSUPPORTED**.
This is a withholding notice,not an approval packet. No G3A/G3B execution is authorized.

Only the original three groups remain reserved:

- A - ACCOUNTABILITY: lifecycle owner,recommended operator (not appointed),separate human approver.
- B - COMPOSITE G2 MUTATION AUTHORIZATION: frozen current composite;not authorized.
- C - EXECUTION COST CEILING: recommendation unsupported,human ceiling unbound.

[Observed qualification](./G3R3D_BUILDER_RUNTIME_QUALIFICATION.json)

[Readiness](./G3R3D_EXECUTION_READINESS.json)
`
  const markdown = `# G3R3D - Live Builder A qualification: FAIL

The authorized observational Q1 ran on the exact frozen G2 VM. Current-session permission and target checks passed.
The VM lacks the pre-existing dedicated rootless account,Docker,rootless daemon/helpers,UID-mapping tools,subordinate-ID ranges and Buildx. Systemd reports degraded.
**Builder A DISQUALIFIED;Builder B PARKED;selection NONE;current G3 proof architecture EXHAUSTED.**

- [Authorization](./G3R3D_LIVE_QUALIFICATION_AUTHORIZATION.json): maximum3 child creations/deletions,no other Azure mutations.
- [Target](./G3R3D_TARGET_VALIDATION.json): all comparisons matched.
- [Q1](./G3R3D_Q1_PREFLIGHT.json): guest observation succeeded,indispensable prerequisites failed.
- [Transport attempt](./G3R3D_Q1_TRANSPORT_ATTEMPT_1.json): first CRLF shebang rejected before script execution;corrected LF retry counted separately.
- Observed memory ${q1.guest.memory.MemTotalBytes} bytes,available ${q1.guest.memory.MemAvailableBytes};volatile/run available ${q1.guest.runAvailableBytes}.
- Synthetic limits only: memory ${q1.derivedLimits.QUALIFICATION_MEMORY_LIMIT_BYTES},workspace ${q1.derivedLimits.QUALIFICATION_WORKSPACE_LIMIT_BYTES},TasksMax64. Future builder/workspace limits remain unqualified/null;old8GiB/6G assumptions not forced.
- [Q2](./G3R3D_Q2_FAULT_QUALIFICATION.json): NOT EXECUTED,required Q1 stop. No rootless/fault/descendant IMDS/normal-cleanup/watchdog/timeout proof.
- [Q3](./G3R3D_Q3_POSTCHECK.json): NOT EXECUTED,Q2 not run. No fake credential generated;bounded remanence search not applicable,not zero measured matches. No VM-wide cleanliness claim.
- [Child cleanup](./G3R3D_RUN_COMMAND_CLEANUP.json): ${counts.childCreationRequests} creates,${counts.childDeletionRequests} deletes at one unique Q1 child;zero remaining confirmed after asynchronous deletion.
- [Ledger](./G3R3D_LIVE_LEDGER.json) and [accounting](./G3R3D_LEDGER_ACCOUNTING.json): ${counts.totalOperations} operations,${counts.readOnlyOperations} reads,only4 child lifecycle mutations;no RBAC/network mutation,token,pull,build,push or G3 execution.
- [Cost](./G3R3D_COST_CLOSURE.json): not recomputed without runtime PASS;inherited conditional CAD${costs.inheritedConditionalSubtotalCAD} is not all-in. Recommendation UNSUPPORTED,human ceiling UNBOUND;financial envelope is not a guaranteed Azure spend stop.
- [Plan](./G3R3D_EXECUTION_PLAN.json): frozen22-step DAG retained blocked;environment -> fresh ACA quota >=250mCPU -> private production -> immutable private manifest digest -> activation remains intact.
- [Three-decision notice](./G3R3D_FINAL_HUMAN_AUTHORIZATION_PACKET.md): NOT ISSUED;A/B/C remain human decisions.

G3R3D **FAIL**;G3 execution **BLOCKED**;G3A **NOT AUTHORIZED**;G3B **NOT AUTHORIZED**. No alternate builder research or installation.
${readiness.localValidation ? '\n[Local validation](./G3R3D_LOCAL_VALIDATION.json) binds offline tests,preservation,syntax,formatting and documentation;does not turn unexecuted Q2/Q3 into live proof.\n' : ''}`
  return [q2, q3, runtime, costs, plan, notice, readiness, markdown, counts]
}
export async function writeOutputs() {
  const values = generate()
  for (const [index, name] of outputs.entries())
    writeFileSync(
      path.join(evidence, name),
      typeof values[index] === 'string'
        ? values[index]
        : await format(JSON.stringify(values[index]), { parser: 'json', printWidth: 100 }),
    )
  const bound = [
    ...outputs,
    'G3R3D_LIVE_LEDGER.json',
    'G3R3D_Q1_PREFLIGHT.json',
    'G3R3D_TARGET_VALIDATION.json',
    'G3R3D_LIVE_QUALIFICATION_AUTHORIZATION.json',
    'G3R3D_RUN_COMMAND_CLEANUP.json',
  ]
  if (existsSync(file('LOCAL_VALIDATION'))) bound.push('G3R3D_LOCAL_VALIDATION.json')
  writeFileSync(
    file('OUTPUT_BINDING'),
    `${JSON.stringify(
      {
        outputs: bound.map((name) => ({
          name,
          sha256: hash(readFileSync(path.join(evidence, name))),
        })),
        tools: [
          'g3r3d-live-qualification.mjs',
          'g3r3d-qualification-closure.mjs',
          'g3r3d-q1-preflight.sh',
        ].map((name) => ({ name, sha256: hash(readFileSync(path.join(root, name))) })),
        runtimeResult: 'FAIL',
        parentFrozen: true,
      },
      null,
      2,
    )}\n`,
  )
}
export function check() {
  preserve()
  const values = generate()
  outputs.forEach((name, index) => {
    const actual = readFileSync(path.join(evidence, name), 'utf8')
    if (typeof values[index] === 'string')
      assert.equal(actual, values[index], `OUTPUT_DRIFT:${name}`)
    else assert.deepEqual(JSON.parse(actual), values[index], `OUTPUT_DRIFT:${name}`)
  })
  const binding = read(file('OUTPUT_BINDING'))
  for (const entry of binding.outputs)
    assert.equal(hash(readFileSync(path.join(evidence, entry.name))), entry.sha256)
  for (const entry of binding.tools)
    assert.equal(hash(readFileSync(path.join(root, entry.name))), entry.sha256)
  const auth = read(file('LIVE_QUALIFICATION_AUTHORIZATION'))
  const ledger = read(file('LIVE_LEDGER'))
  const operations = read(
    path.join(evidence, 'G3R3C_BUILDER_PRIVILEGE_SUPPLEMENT.json'),
  ).ADDITIONAL_REQUIREMENTS
  assert(
    requiredActions.every((action) => operations.some((entry) => entry.AZURE_ACTION === action)),
    'EXACT_LIVE_PROVIDER_ACTION_BINDING_REQUIRED',
  )
  for (const entry of ledger) {
    assert.equal(entry.responseStatus, 'SUCCEEDED')
    assert.equal(hash(JSON.stringify(entry.cliAction)), entry.cliArgumentsSha256)
    const bodyIndex = entry.cliAction.indexOf('--body')
    const bodySha256 =
      bodyIndex >= 0 ? hash(readFileSync(entry.cliAction[bodyIndex + 1].slice(1))) : null
    assert.equal(bodySha256, entry.requestBodySha256)
    assert.equal(
      hash(JSON.stringify({ cliAction: entry.cliAction, bodySha256 })),
      entry.requestDigest,
    )
    if (entry.responseFile)
      assert.equal(
        hash(readFileSync(path.join(evidence, entry.responseFile))),
        entry.responseSha256,
      )
    if (entry.mutationClass !== 'READ_ONLY') {
      assert.equal(entry.targetResourceId, `${vm}/runCommands/nzila-g3r3d-q1-${auth.runId}`)
      assert(['PUT', 'DELETE'].includes(entry.operation))
      assert(entry.cliAction.every((arg) => !/token|assignment|identity\/oauth/i.test(arg)))
    }
  }
  assert(read(file('OPERATOR_AUTHORITY')).actions.every((entry) => entry.allowed))
  assert.equal(read(file('RUN_COMMAND_CLEANUP')).QUALIFICATION_RUN_COMMAND_CHILDREN_REMAINING, 0)
  return { offlineValidation: 'PASS', liveQualification: 'FAIL', otherAzureMutations: 0 }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 3)
  assert(['--write', '--check'].includes(process.argv[2]), 'LOCAL_CLOSURE_FLAGS_ONLY')
  if (process.argv[2] === '--write') await writeOutputs()
  console.log(check())
}
