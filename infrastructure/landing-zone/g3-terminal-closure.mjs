import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format } from 'prettier'
import { evidence, files, hash, read, root, source } from './g3r2i-preservation.mjs'
import { check as checkLiveFailure } from './g3r3d-qualification-closure.mjs'

const file = (name, extension = 'json') => path.join(evidence, `G3_TERMINAL_${name}.${extension}`)
const input = (name) => read(path.join(evidence, name))
export const liveEvidence = [
  'G3R3D_LIVE_QUALIFICATION_AUTHORIZATION.json',
  'G3R3D_Q1_PREFLIGHT.json',
  'G3R3D_Q2_FAULT_QUALIFICATION.json',
  'G3R3D_Q3_POSTCHECK.json',
  'G3R3D_BUILDER_RUNTIME_QUALIFICATION.json',
  'G3R3D_LIVE_LEDGER.json',
  'G3R3D_RUN_COMMAND_CLEANUP.json',
  'G3R3D_COST_CLOSURE.json',
  'G3R3D_EXECUTION_PLAN.json',
  'G3R3D_EXECUTION_READINESS.json',
  'G3R3D_EXECUTION_READINESS.md',
  'G3R3D_LOCAL_VALIDATION.json',
]
export const assets = [
  { id: 'G3_SOURCE_AUTHORITY_V1', paths: ['g3-source/G3_SOURCE_AUTHORITY_MANIFEST.json'] },
  {
    id: 'G3_SYNTHETIC_PROOF_V1',
    paths: [
      'g3-source/workload/synthetic-proof',
      'g3-readiness-evidence/G3R2I_IMAGE_QUALIFICATION.json',
    ],
  },
  { id: 'G3R1_NETWORK_CONTRACT', paths: ['g3-readiness-evidence/G3R1_NETWORK_CONTRACT.json'] },
  {
    id: 'G3R3_OPERATOR_PRIVILEGE_PACKET',
    paths: ['g3-readiness-evidence/G3R3_OPERATOR_PRIVILEGE_PACKET.json'],
  },
  { id: 'G3R3_G2_MUTATION_PACKET', paths: ['g3-readiness-evidence/G3R3_G2_MUTATION_PACKET.json'] },
]
export const terminalFields = {
  MISSION_ID: 'NZ-20261008-INFRA-001',
  MISSION_DISPOSITION: 'CLOSED_NO_GO_CURRENT_PROOF_ARCHITECTURE',
  SOURCE_AUTHORITY: 'COMPLETE',
  LOCAL_INFRASTRUCTURE: 'COMPLETE_NOT_DEPLOYED',
  QUALIFIED_SYNTHETIC_IMAGE: 'COMPLETE_LOCAL_NOT_PUSHED',
  LIVE_BUILDER_QUALIFICATION: 'FAIL',
  SELECTED_BUILDER: 'NONE',
  G3A_AUTHORIZED: 'NO',
  G3B_AUTHORIZED: 'NO',
  G3_PRIVATE_CONTROL_PLANE_SOURCE_AUTHORITY: 'PASS',
  G3_LOCAL_INFRASTRUCTURE_BUILD: 'PASS',
  G3_SYNTHETIC_IMAGE_QUALIFICATION: 'PASS',
  ROOT_1_SOURCE_AUTHORITY: 'CLOSED',
  BUILDER_A: 'DISQUALIFIED_BY_LIVE_EVIDENCE',
  BUILDER_B: 'PARKED_NOT_SELECTED',
  SELECTED_PRIVATE_BUILD_MODEL: 'NONE',
  CURRENT_G3_PROOF_EXECUTION_ARCHITECTURE: 'EXHAUSTED',
  G3_EXECUTION_READINESS: 'NO_GO_CURRENT_ARCHITECTURE',
  G3A: 'NOT_AUTHORIZED',
  G3B: 'NOT_AUTHORIZED',
  RECOMMENDED_EXECUTION_CEILING_CAD: 'UNSUPPORTED',
  HUMAN_APPROVED_EXECUTION_CEILING_CAD: 'UNBOUND',
  FINAL_HUMAN_AUTHORIZATION_PACKET: 'NOT_ISSUED',
  FINAL_THREE_DECISION_PACKET: 'NOT_ISSUED',
  FURTHER_G3_BUILDER_ENGINEERING: 'PROHIBITED_WITHOUT_NEW_HUMAN_ARCHITECTURE_CHARTER',
  REOPEN_REQUIRES: 'NEW_HUMAN_ARCHITECTURE_AUTHORIZATION',
}
export const phases = {
  G3R1: 'PASS',
  G3R2: 'PASS_BY_PROSPECTIVE_SUPERSESSION',
  G3R2I: 'PASS',
  G3R3: 'BLOCKED',
  G3R3B: 'BLOCKED',
  G3R3C: 'BLOCKED',
  G3R3D: 'FAIL',
}
export const failureBasis = {
  DEDICATED_ROOTLESS_ACCOUNT: 'ABSENT',
  SUBORDINATE_UID_GID_RANGES: 'ABSENT',
  DOCKER: 'ABSENT',
  ROOTLESS_DOCKER_HELPERS: 'ABSENT',
  UID_MAPPING_TOOLS: 'ABSENT',
  BUILDX: 'ABSENT',
  SYSTEMD_STATE: 'DEGRADED',
}
export const passedObservations = {
  PRIVATE_ACR_DNS: 'PASS',
  PRIVATE_ACR_TCP_443: 'PASS',
  VM_AGENT: 'HEALTHY',
  TARGET_IDENTITY: '15 / 15 MATCH',
}
export const unexecutedProof = {
  Q2: 'NOT_EXECUTED',
  DESCENDANT_IMDS_DENIAL: 'NOT_PROVEN',
  ROOTLESS_RUNTIME: 'NOT_PROVEN',
  WATCHDOG_CLEANUP: 'NOT_PROVEN',
  RUN_COMMAND_TIMEOUT_CLEANUP: 'NOT_PROVEN',
  Q3: 'NOT_EXECUTED',
  FAKE_CREDENTIAL_CREATED: 'NO',
}
export const mutationAccounting = {
  MANAGED_RUN_COMMAND_CREATES: 2,
  MANAGED_RUN_COMMAND_DELETES: 2,
  QUALIFICATION_CHILDREN_REMAINING: 0,
  OTHER_AZURE_MUTATIONS: 0,
  RBAC_MUTATIONS: 0,
  G2_NETWORK_MUTATIONS: 0,
  IMAGE_PULLS: 0,
  IMAGE_BUILDS: 0,
  IMAGE_PUSHES: 0,
  G3A_EXECUTIONS: 0,
  G3B_EXECUTIONS: 0,
}
const jsonBytes = async (value) =>
  format(JSON.stringify(value), { parser: 'json', printWidth: 100 })
export async function capture() {
  checkLiveFailure()
  assert(!existsSync(file('PRESERVATION')), 'TERMINAL_BASELINE_ALREADY_EXISTS_NO_RECAPTURE')
  const baseline = {
    historicalEvidence: files(evidence).filter((entry) => !entry.path.startsWith('G3_TERMINAL_')),
    prospectiveSource: files(source),
    historicalTools: readdirSync(root)
      .filter((name) => /^g3.*\.(mjs|sh|ps1)$/.test(name) && !name.startsWith('g3-terminal-'))
      .sort()
      .map((name) => ({ path: name, sha256: hash(readFileSync(path.join(root, name))) })),
    scope:
      'All historical evidence,prospective source/build/workload assets and G3 tools frozen;no historical writer or collector rerun.',
  }
  writeFileSync(file('PRESERVATION'), await jsonBytes(baseline), { flag: 'wx' })
}
export function verifyPreservation() {
  const baseline = read(file('PRESERVATION'))
  for (const entry of baseline.historicalEvidence)
    assert.equal(
      hash(readFileSync(path.join(evidence, entry.path))),
      entry.sha256,
      `HISTORICAL_EVIDENCE_CHANGED:${entry.path}`,
    )
  assert.deepEqual(files(source), baseline.prospectiveSource, 'PROSPECTIVE_SOURCE_OR_BUILD_CHANGED')
  for (const entry of baseline.historicalTools)
    assert.equal(
      hash(readFileSync(path.join(root, entry.path))),
      entry.sha256,
      `HISTORICAL_TOOL_CHANGED:${entry.path}`,
    )
  return baseline
}
export function verifyObservations() {
  const q1 = input('G3R3D_Q1_PREFLIGHT.json')
  const guest = q1.guest
  const target = input('G3R3D_TARGET_VALIDATION.json')
  const runtime = input('G3R3D_BUILDER_RUNTIME_QUALIFICATION.json')
  const q2 = input('G3R3D_Q2_FAULT_QUALIFICATION.json')
  const q3 = input('G3R3D_Q3_POSTCHECK.json')
  const cleanup = input('G3R3D_RUN_COMMAND_CLEANUP.json')
  const ledger = input('G3R3D_LIVE_LEDGER.json')
  const accounting = input('G3R3D_LEDGER_ACCOUNTING.json')
  const cost = input('G3R3D_COST_CLOSURE.json')
  const readiness = input('G3R3D_EXECUTION_READINESS.json')
  const image = input('G3R2I_IMAGE_QUALIFICATION.json')
  assert.equal(q1.status, 'FAIL_OBSERVED_PREREQUISITES')
  assert.equal(q1.executionState, 'Succeeded')
  assert.equal(q1.exitCode, 0)
  assert.equal(guest.account.exists, false)
  assert(Object.values(guest.subordinateIds).every((value) => value === false))
  for (const name of [
    'docker',
    'dockerd-rootless.sh',
    'rootlesskit',
    'slirp4netns',
    'newuidmap',
    'newgidmap',
  ])
    assert.equal(guest.tools[name], false, `LIVE_TOOL_STATE_CHANGED:${name}`)
  assert.equal(guest.buildx.exit, -1)
  assert.equal(guest.systemdState.value, 'degraded')
  assert(
    Object.values(guest.privateDns).every(
      (entry) => JSON.stringify(entry.addresses) === JSON.stringify([entry.expected]),
    ),
  )
  assert(Object.values(guest.privateTcp443).every((value) => value === 'CONNECTED'))
  assert.equal(target.result, 'PASS')
  assert.equal(target.checks.length, 15)
  assert(target.checks.every((entry) => entry.matched))
  assert.equal(runtime.VM_AGENT_HEALTHY, true)
  assert.equal(runtime.BUILDER_A_LIVE_QUALIFICATION, 'FAIL')
  assert.equal(q2.status, 'NOT_EXECUTED_Q1_STOP')
  assert.equal(q3.status, 'NOT_EXECUTED_Q2_NOT_RUN')
  assert.equal(q2.fakeCredentialGenerated, false)
  assert.equal(q3.BOUNDED_AGENT_GUEST_TOKEN_MATCHES, null)
  assert.equal(runtime.DESCENDANT_IMDS_NETWORK_ACCESS, 'NOT_TESTED')
  assert.equal(runtime.PRIMARY_TRAP_CLEANUP, 'NOT_TESTED')
  assert.equal(runtime.INDEPENDENT_WATCHDOG_CLEANUP, 'NOT_TESTED')
  assert.equal(runtime.RUN_COMMAND_TIMEOUT_QUALIFICATION, 'NOT_EXECUTED_Q1_STOP')
  assert.equal(cleanup.result, 'PASS')
  assert.equal(cleanup.childrenCreated, 2)
  assert.equal(cleanup.childrenDeleted, 2)
  assert.equal(cleanup.QUALIFICATION_RUN_COMMAND_CHILDREN_REMAINING, 0)
  const finalList = input(cleanup.finalEvidenceFile)
  assert(
    !finalList.value.some((entry) => entry.id === q1.childResourceId),
    'RECORDED_CHILD_RESIDUAL',
  )
  assert.equal(ledger.length, 17)
  const creates = ledger.filter(
    (entry) => entry.mutationClass === 'MANAGED_RUN_COMMAND_CHILD_CREATE',
  )
  const deletes = ledger.filter(
    (entry) => entry.mutationClass === 'MANAGED_RUN_COMMAND_CHILD_DELETE',
  )
  const mutations = ledger.filter((entry) => entry.mutationClass !== 'READ_ONLY')
  assert.equal(creates.length, 2)
  assert.equal(deletes.length, 2)
  assert.equal(mutations.length, 4)
  assert(
    mutations.every(
      (entry) =>
        entry.targetResourceId === q1.childResourceId && entry.responseStatus === 'SUCCEEDED',
    ),
  )
  assert(creates.every((entry) => entry.operation === 'PUT'))
  assert(
    deletes.every(
      (entry) =>
        entry.operation === 'DELETE' &&
        entry.rollbackDeleteResult.finalResult === 'OWNED_CHILD_ABSENT_CONFIRMED',
    ),
  )
  for (const field of [
    'AZURE_MUTATIONS_OTHER_THAN_RUN_COMMAND_CHILDREN',
    'RBAC_MUTATIONS',
    'G2_NETWORK_MUTATIONS',
    'IMAGE_PULLS',
    'BUILDS',
    'IMAGE_PUSHES',
    'REAL_TOKEN_CREATIONS',
    'FAKE_CREDENTIAL_GENERATIONS',
  ])
    assert.equal(accounting[field], 0)
  assert.equal(accounting.G3A_EXECUTED, false)
  assert.equal(accounting.G3B_EXECUTED, false)
  assert.equal(cost.RECOMMENDED_EXECUTION_CEILING_CAD, 'UNSUPPORTED')
  assert.equal(cost.HUMAN_APPROVED_EXECUTION_CEILING_CAD, 'UNBOUND')
  assert.equal(readiness.G3A, 'NOT_AUTHORIZED')
  assert.equal(readiness.G3B, 'NOT_AUTHORIZED')
  assert(readiness.finalHumanPacket.startsWith('NOT_ISSUED'))
  assert.equal(image.IMAGE_AUTHORITY_ID, 'G3_SYNTHETIC_PROOF_V1')
  assert.equal(input('G3R2I_LOCAL_BUILD_EVIDENCE.json').status, 'PASS_LOCAL_ONLY_NOT_DEPLOYED')
  assert.equal(input('G3R3D_LOCAL_VALIDATION.json').regression.passed, 806)
  return { q1, runtime, readiness }
}
export function validateSchema(value) {
  assert.deepEqual(
    Object.keys(value).sort(),
    [
      'schemaVersion',
      ...Object.keys(terminalFields),
      'acceptance',
      'phaseDispositions',
      'failureBasis',
      'passedObservations',
      'unexecutedProof',
      'mutationAccounting',
      'scope',
      'proofLimitations',
      'liveFailureBindings',
      'preservedAssets',
      'preservation',
      'historicalQualification',
      'reopenRule',
      'governanceRegistry',
      'closureOperations',
      'terminalValidation',
    ].sort(),
    'TERMINAL_SCHEMA_KEYS',
  )
  assert.equal(value.schemaVersion, '1.0')
  for (const [field, expected] of Object.entries(terminalFields))
    assert.equal(value[field], expected, `TERMINAL_FIELD:${field}`)
  assert.deepEqual(value.phaseDispositions, phases)
  assert.deepEqual(value.failureBasis, failureBasis)
  assert.deepEqual(value.passedObservations, passedObservations)
  assert.deepEqual(value.unexecutedProof, unexecutedProof)
  assert.deepEqual(value.mutationAccounting, mutationAccounting)
  assert.equal(value.scope.broaderAzureArchitectureDisproven, false)
  assert.equal(value.scope.currentProofPathOnly, true)
  assert.equal(value.scope.networkFailure, false)
  assert.equal(value.scope.sourceAuthorityFailure, false)
  assert.equal(value.closureOperations.azureCalls, 0)
  assert.equal(value.closureOperations.azureMutations, 0)
  assert.equal(value.closureOperations.guestExecutions, 0)
  assert.equal(value.closureOperations.builds, 0)
  assert.equal(value.closureOperations.pushes, 0)
  assert.equal(value.closureOperations.costRecalculated, false)
  assert.equal(value.governanceRegistry.status, 'NO_CANONICAL_MISSION_STATUS_REGISTRY_FOUND')
  assert.equal(value.governanceRegistry.unrelatedRegistriesModified, false)
  assert.deepEqual(
    value.liveFailureBindings.map((entry) => entry.path),
    liveEvidence,
  )
  for (const entry of value.liveFailureBindings) assert.match(entry.sha256, /^[a-f0-9]{64}$/)
  assert.deepEqual(
    value.preservedAssets.map((entry) => entry.id),
    assets.map((entry) => entry.id),
  )
  for (const entry of value.preservedAssets) {
    assert.equal(entry.status, 'PRESERVED_NOT_AUTHORIZED_FOR_EXECUTION')
    assert(entry.bindings.length > 0)
    for (const binding of entry.bindings) assert.match(binding.sha256, /^[a-f0-9]{64}$/)
  }
  assert.equal(value.reopenRule.examples.length, 4)
  assert.equal(value.reopenRule.requirement, terminalFields.REOPEN_REQUIRES)
  assert.equal(value.reopenRule.newExplicitHumanArchitectureCharterRequired, true)
  assert.equal(value.reopenRule.noFurtherEngineeringWithoutCharter, true)
  assert.equal(value.reopenRule.noneAuthorizedByClosure, true)
  if (value.terminalValidation !== null) {
    assert.equal(value.terminalValidation.file, 'G3_TERMINAL_LOCAL_VALIDATION.json')
    assert.match(value.terminalValidation.sha256, /^[a-f0-9]{64}$/)
  }
  return true
}
export function generate() {
  const baseline = verifyPreservation()
  const observed = verifyObservations()
  const allBindings = [
    ...baseline.historicalEvidence.map((entry) => ({
      path: `g3-readiness-evidence/${entry.path}`,
      sha256: entry.sha256,
    })),
    ...baseline.prospectiveSource.map((entry) => ({
      path: `g3-source/${entry.path}`,
      sha256: entry.sha256,
    })),
  ]
  const disposition = {
    schemaVersion: '1.0',
    ...terminalFields,
    acceptance:
      'Human explicitly accepted G3R3D FAIL as terminal and authorized only this repository governance/documentation closure on2026-10-12.',
    phaseDispositions: phases,
    failureBasis,
    passedObservations,
    unexecutedProof,
    mutationAccounting,
    scope: {
      currentProofPathOnly: true,
      broaderAzureArchitectureDisproven: false,
      networkFailure: false,
      sourceAuthorityFailure: false,
      interpretation:
        'The available G2 execution substrate is not qualified for Builder A under the accepted governance constraints. This is a clean failed experiment,not a declaration that the broader Nzila Azure private-control-plane strategy failed.',
    },
    proofLimitations: [
      'Q1 observed indispensable guest prerequisites absent;private ACR DNS/TCP and VM Agent passed.',
      'Q2/Q3 were not executed;no inferred rootless,IMDS-denial,watchdog,timeout-cleanup or credential-remanence PASS.',
      'First Q1 CRLF transport failure and LF retry remain historical;both create/delete lifecycles count against the authorization budget.',
      'Zero-child assertion is bound to the recorded post-delete list,not a new Azure query or a VM-wide artifact-removal claim.',
      '806 prior offline tests support evidence integrity,not missing runtime qualification.',
      'Terminal status supersedes historical execution-readiness labels without rewriting any historical finding or cost.',
    ],
    liveFailureBindings: liveEvidence.map((name) => {
      const entry = baseline.historicalEvidence.find((item) => item.path === name)
      assert(entry, `REQUIRED_LIVE_EVIDENCE_MISSING:${name}`)
      return entry
    }),
    preservedAssets: assets.map((asset) => ({
      id: asset.id,
      status: 'PRESERVED_NOT_AUTHORIZED_FOR_EXECUTION',
      bindings: allBindings.filter((entry) =>
        asset.paths.some((name) => entry.path === name || entry.path.startsWith(`${name}/`)),
      ),
    })),
    preservation: {
      file: 'G3_TERMINAL_PRESERVATION.json',
      sha256: hash(readFileSync(file('PRESERVATION'))),
      historicalEvidenceFiles: baseline.historicalEvidence.length,
      prospectiveSourceFiles: baseline.prospectiveSource.length,
      historicalToolFiles: baseline.historicalTools.length,
    },
    historicalQualification: {
      sourceTreeSha256: input('G3R2I_IMAGE_QUALIFICATION.json').SOURCE_DIGESTS.SOURCE_TREE_SHA256,
      sourceAuthority: 'G3_SOURCE_AUTHORITY_V1',
      root1Status: observed.readiness.ROOT_1,
      evidenceIntegrityValidation: {
        file: 'G3R3D_LOCAL_VALIDATION.json',
        tests: 806,
        result: 'PASS_OFFLINE_ONLY',
      },
    },
    reopenRule: {
      requirement: terminalFields.REOPEN_REQUIRES,
      newExplicitHumanArchitectureCharterRequired: true,
      examples: [
        'Prepare/modify the G2 VM as a qualified builder',
        'Authorize a new dedicated builder resource',
        'Reopen an ACR dedicated agent-pool path',
        'Select a different artifact-production architecture',
      ],
      noneAuthorizedByClosure: true,
      noFurtherEngineeringWithoutCharter: true,
    },
    governanceRegistry: {
      status: 'NO_CANONICAL_MISSION_STATUS_REGISTRY_FOUND',
      searchScope:
        'Repository mission/status-registry filename searches and mission references in governance/docs/infrastructure;gate-authority-registry describes release validators,not this mission.',
      currentMissionAuthority: 'G3_TERMINAL_DISPOSITION.json;linked from landing-zone README',
      unrelatedRegistriesModified: false,
    },
    closureOperations: {
      azureCalls: 0,
      azureMutations: 0,
      guestExecutions: 0,
      builds: 0,
      pushes: 0,
      costRecalculated: false,
    },
    terminalValidation: existsSync(file('LOCAL_VALIDATION'))
      ? {
          file: 'G3_TERMINAL_LOCAL_VALIDATION.json',
          sha256: hash(readFileSync(file('LOCAL_VALIDATION'))),
        }
      : null,
  }
  validateSchema(disposition)
  const md = `# G3 terminal disposition

Mission **NZ-20261008-INFRA-001**: **CLOSED_NO_GO_CURRENT_PROOF_ARCHITECTURE**.
Human-accepted terminal governance ruling: **G3_EXECUTION_READINESS = NO_GO_CURRENT_ARCHITECTURE**.
This supersedes historical readiness labels;it does not rewrite historical findings.

## Accepted phase dispositions

| Phase | Disposition |
| --- | --- |
${Object.entries(phases)
  .map(([name, status]) => `| ${name} | ${status} |`)
  .join('\n')}

ROOT-1 source authority is CLOSED. Private-control-plane source authority,local infrastructure builds and synthetic-image qualification are PASS:
source authority COMPLETE,local infrastructure COMPLETE_NOT_DEPLOYED,image COMPLETE_LOCAL_NOT_PUSHED.

## Live failure basis

The [validated existing G2 VM](./G3R3D_TARGET_VALIDATION.json) matched15/15 identity checks with a healthy VM Agent.
[Q1 observed](./G3R3D_Q1_PREFLIGHT.json) the dedicated rootless account,subordinate UID/GID ranges,Docker,rootless Docker helpers,UID-mapping tools and Buildx **ABSENT**;systemd **DEGRADED**.
Private ACR DNS and TCP443 **PASS**. This is **not a networking or source-authority failure**.

[Builder A](./G3R3D_BUILDER_RUNTIME_QUALIFICATION.json) is **DISQUALIFIED_BY_LIVE_EVIDENCE**.
Builder B is **PARKED_NOT_SELECTED**;selected builder **NONE**;current G3 proof execution architecture **EXHAUSTED**.
The broader Nzila Azure private-control-plane architecture is **not disproven**.

## Unexecuted proof

[Q2](./G3R3D_Q2_FAULT_QUALIFICATION.json) and [Q3](./G3R3D_Q3_POSTCHECK.json) were **NOT_EXECUTED**.
Descendant IMDS denial,rootless runtime,watchdog cleanup and Run Command timeout cleanup are **NOT_PROVEN**.
Fake credential created: **NO**. No inferred PASS,no measured-zero remanence claim.

## Preserved mutation accounting

The [live ledger](./G3R3D_LIVE_LEDGER.json) records two Run Command creations and two deletions at one unique child ID.
[Child cleanup](./G3R3D_RUN_COMMAND_CLEANUP.json) confirms **zero qualification children remaining** in the recorded final list.
The initial CRLF rejection and LF retry both remain preserved and counted.
Other Azure mutations,RBAC mutations,G2 network mutations,image pulls/builds/pushes and G3A/G3B executions: **0**.
This closure performs **no Azure calls or guest execution**;zero-child preservation is not a fresh cloud observation.

## Cost and authorization

[Cost disposition](./G3R3D_COST_CLOSURE.json) remains **UNSUPPORTED** for a recommended execution ceiling;human-approved ceiling **UNBOUND**.
[Final three-decision packet](./G3R3D_FINAL_HUMAN_AUTHORIZATION_PACKET.md): **NOT_ISSUED**.
No terminal estimate or cost recalculation. **G3A NOT_AUTHORIZED;G3B NOT_AUTHORIZED**.

## Reusable engineering assets

All are **PRESERVED_NOT_AUTHORIZED_FOR_EXECUTION**:
- [G3_SOURCE_AUTHORITY_V1](../g3-source/G3_SOURCE_AUTHORITY_MANIFEST.json)
- [G3_SYNTHETIC_PROOF_V1](../g3-source/workload/synthetic-proof/README.md)
- [G3R1_NETWORK_CONTRACT](./G3R1_NETWORK_CONTRACT.json)
- [G3R3_OPERATOR_PRIVILEGE_PACKET](./G3R3_OPERATOR_PRIVILEGE_PACKET.json)
- [G3R3_G2_MUTATION_PACKET](./G3R3_G2_MUTATION_PACKET.json)

[Machine disposition](./G3_TERMINAL_DISPOSITION.json) binds the twelve required live-failure files by SHA256.
[Immutable preservation](./G3_TERMINAL_PRESERVATION.json) binds all historical evidence,prospective source/build/workload files and historical G3 tools.
The [806-test historical validation](./G3R3D_LOCAL_VALIDATION.json) supports integrity,not missing runtime proof.
No canonical mission/status registry was found;unrelated release-gate registries remain untouched.

## Reopening rule

**REOPEN_REQUIRES = NEW_HUMAN_ARCHITECTURE_AUTHORIZATION**.
**FURTHER_G3_BUILDER_ENGINEERING = PROHIBITED_WITHOUT_NEW_HUMAN_ARCHITECTURE_CHARTER**.
Preparing/modifying G2 as a builder,authorizing a new builder,reopening the ACR agent pool,or changing artifact-production architecture requires a new explicit human charter.
None is authorized by this closure. **Stop work on G3.**
${disposition.terminalValidation ? '\n[Terminal local validation](./G3_TERMINAL_LOCAL_VALIDATION.json) records schema,preservation,accounting,no-authorization,reopening,determinism,syntax,formatting and documentation checks.\n' : ''}`
  return { disposition, markdown: md }
}
export async function writeOutputs() {
  const values = generate()
  writeFileSync(file('DISPOSITION'), await jsonBytes(values.disposition))
  writeFileSync(
    file('DISPOSITION', 'md'),
    await format(values.markdown, { parser: 'markdown', printWidth: 100 }),
  )
}
export async function check() {
  checkLiveFailure()
  const expected = generate()
  const actual = read(file('DISPOSITION'))
  validateSchema(actual)
  assert.deepEqual(actual, expected.disposition, 'TERMINAL_DISPOSITION_DRIFT')
  assert.equal(
    readFileSync(file('DISPOSITION', 'md'), 'utf8'),
    await format(expected.markdown, { parser: 'markdown', printWidth: 100 }),
    'TERMINAL_MARKDOWN_DRIFT',
  )
  return {
    validation: 'PASS',
    missionDisposition: terminalFields.MISSION_DISPOSITION,
    azureCalls: 0,
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 3, 'TERMINAL_LOCAL_FLAGS_ONLY')
  assert(['--capture', '--write', '--check'].includes(process.argv[2]), 'TERMINAL_LOCAL_FLAGS_ONLY')
  if (process.argv[2] === '--capture') await capture()
  else {
    if (process.argv[2] === '--write') await writeOutputs()
    console.log(await check())
  }
}
