import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {
  assets,
  check,
  failureBasis,
  generate,
  liveEvidence,
  mutationAccounting,
  passedObservations,
  phases,
  terminalFields,
  unexecutedProof,
  validateSchema,
  verifyObservations,
  verifyPreservation,
} from './g3-terminal-closure.mjs'
import { evidence, files, hash, read, root, source } from './g3r2i-preservation.mjs'

const terminal = read(path.join(evidence, 'G3_TERMINAL_DISPOSITION.json'))
const baseline = read(path.join(evidence, 'G3_TERMINAL_PRESERVATION.json'))
const input = (name) => read(path.join(evidence, name))

test('terminal schema accepts exactly the human-authorized terminal disposition', () => {
  assert(validateSchema(terminal))
  assert.equal(terminal.MISSION_ID, 'NZ-20261008-INFRA-001')
})
for (const [field, value] of Object.entries(terminalFields)) {
  test(`terminal field is frozen:${field}`, () => assert.equal(terminal[field], value))
  test(`terminal schema rejects missing or changed disposition:${field}`, () => {
    const missing = structuredClone(terminal)
    delete missing[field]
    assert.throws(() => validateSchema(missing), /TERMINAL_SCHEMA_KEYS/)
    const changed = structuredClone(terminal)
    changed[field] = 'UNAUTHORIZED_DRIFT'
    assert.throws(() => validateSchema(changed), /TERMINAL_FIELD/)
  })
}
test('phase chronology preserves prospective supersession and all blocked/failed successors', () => {
  assert.deepEqual(terminal.phaseDispositions, phases)
  assert.equal(terminal.phaseDispositions.G3R2, 'PASS_BY_PROSPECTIVE_SUPERSESSION')
  assert.equal(input('G3R2_SOURCE_AUTHORITY_CLOSURE.json').G3R2_GATE, 'BLOCKED')
  assert.equal(input('G3R3D_EXECUTION_READINESS.json').G3_EXECUTION_READINESS, 'BLOCKED')
  assert.equal(terminal.G3_EXECUTION_READINESS, 'NO_GO_CURRENT_ARCHITECTURE')
})
test('all twelve required live-failure files are bound by actual immutable SHA256', () => {
  assert.equal(liveEvidence.length, 12)
  assert.deepEqual(
    terminal.liveFailureBindings.map((entry) => entry.path),
    liveEvidence,
  )
  for (const entry of terminal.liveFailureBindings) {
    assert.equal(hash(readFileSync(path.join(evidence, entry.path))), entry.sha256)
    assert.equal(
      baseline.historicalEvidence.find((old) => old.path === entry.path).sha256,
      entry.sha256,
    )
  }
})
test('all historical evidence,tools and prospective sources/build/workload files remain byte-identical', () => {
  const verified = verifyPreservation()
  assert.deepEqual(verified, baseline)
  assert(baseline.historicalEvidence.length >= 520)
  assert(baseline.historicalTools.length >= 33)
  assert.deepEqual(files(source), baseline.prospectiveSource)
  assert.equal(
    terminal.preservation.sha256,
    hash(readFileSync(path.join(evidence, terminal.preservation.file))),
  )
})
test('terminal freeze binds preserved historical 806-test validation without turning it into runtime proof', () => {
  assert.equal(input('G3R3D_LOCAL_VALIDATION.json').regression.tests, 806)
  assert.equal(input('G3R3D_LOCAL_VALIDATION.json').regression.passed, 806)
  assert.equal(terminal.historicalQualification.evidenceIntegrityValidation.tests, 806)
  assert.equal(
    terminal.historicalQualification.evidenceIntegrityValidation.result,
    'PASS_OFFLINE_ONLY',
  )
  assert(terminal.proofLimitations.some((value) => value.includes('not missing runtime')))
})
for (const field of Object.keys(failureBasis))
  test(`indispensable prerequisite failure remains explicit:${field}`, () =>
    assert.equal(terminal.failureBasis[field], failureBasis[field]))
test('live observations support missing prerequisites,not network or source-authority failure', () => {
  const observed = verifyObservations()
  assert.equal(observed.q1.guest.account.exists, false)
  assert.equal(observed.q1.guest.tools.docker, false)
  assert.equal(observed.q1.guest.tools['dockerd-rootless.sh'], false)
  assert.equal(observed.q1.guest.tools.newuidmap, false)
  assert.equal(observed.q1.guest.tools.newgidmap, false)
  assert.equal(observed.q1.guest.systemdState.value, 'degraded')
  assert.equal(terminal.scope.networkFailure, false)
  assert.equal(terminal.scope.sourceAuthorityFailure, false)
  assert.equal(terminal.scope.broaderAzureArchitectureDisproven, false)
})
for (const field of Object.keys(passedObservations))
  test(`successful control observation preserved:${field}`, () =>
    assert.equal(terminal.passedObservations[field], passedObservations[field]))
test('validated target and private paths are historical observations,not new cloud reads', () => {
  const q1 = input('G3R3D_Q1_PREFLIGHT.json')
  assert(
    Object.values(q1.guest.privateDns).every(
      (entry) => JSON.stringify(entry.addresses) === JSON.stringify([entry.expected]),
    ),
  )
  assert(Object.values(q1.guest.privateTcp443).every((entry) => entry === 'CONNECTED'))
  const target = input('G3R3D_TARGET_VALIDATION.json')
  assert.equal(target.checks.length, 15)
  assert(target.checks.every((entry) => entry.matched))
  assert.equal(input('G3R3D_BUILDER_RUNTIME_QUALIFICATION.json').VM_AGENT_HEALTHY, true)
  assert.equal(terminal.closureOperations.azureCalls, 0)
})
for (const field of Object.keys(unexecutedProof))
  test(`no unexecuted runtime proof is promoted:${field}`, () =>
    assert.equal(terminal.unexecutedProof[field], unexecutedProof[field]))
test('no fake credential created;unexecuted Q3 does not claim measured zero matches', () => {
  assert.equal(input('G3R3D_Q2_FAULT_QUALIFICATION.json').fakeCredentialGenerated, false)
  assert.equal(input('G3R3D_Q3_POSTCHECK.json').BOUNDED_AGENT_GUEST_TOKEN_MATCHES, null)
  assert.equal(input('G3R3D_BUILDER_RUNTIME_QUALIFICATION.json').FAKE_CREDENTIAL_SHA256, null)
  assert.equal(terminal.unexecutedProof.FAKE_CREDENTIAL_CREATED, 'NO')
})
for (const [field, expected] of Object.entries(mutationAccounting))
  test(`terminal mutation accounting is exact:${field}`, () =>
    assert.equal(terminal.mutationAccounting[field], expected))
test('ledger counts both physical create/delete lifecycles,not only one unique child', () => {
  const ledger = input('G3R3D_LIVE_LEDGER.json')
  assert.equal(ledger.length, 17)
  const mutations = ledger.filter((entry) => entry.mutationClass !== 'READ_ONLY')
  assert.equal(mutations.length, 4)
  assert.equal(mutations.filter((entry) => entry.operation === 'PUT').length, 2)
  assert.equal(mutations.filter((entry) => entry.operation === 'DELETE').length, 2)
  assert.equal(new Set(mutations.map((entry) => entry.targetResourceId)).size, 1)
  assert(mutations.every((entry) => entry.responseStatus === 'SUCCEEDED'))
})
test('zero-child residual is asserted against exact captured final post-deletion evidence', () => {
  const cleanup = input('G3R3D_RUN_COMMAND_CLEANUP.json')
  const q1 = input('G3R3D_Q1_PREFLIGHT.json')
  assert.equal(cleanup.QUALIFICATION_RUN_COMMAND_CHILDREN_REMAINING, 0)
  assert.equal(cleanup.rollbackDeleteResult, 'OWNED_CHILD_ABSENT_CONFIRMED')
  assert(!input(cleanup.finalEvidenceFile).value.some((entry) => entry.id === q1.childResourceId))
  assert(terminal.proofLimitations.some((value) => value.includes('not a new Azure query')))
})
test('zero-other-mutations is derived from all ledger targets and mutation classes', () => {
  const ledger = input('G3R3D_LIVE_LEDGER.json')
  const q1 = input('G3R3D_Q1_PREFLIGHT.json')
  const allowed = new Set([
    'READ_ONLY',
    'MANAGED_RUN_COMMAND_CHILD_CREATE',
    'MANAGED_RUN_COMMAND_CHILD_DELETE',
  ])
  assert(ledger.every((entry) => allowed.has(entry.mutationClass)))
  assert(
    ledger
      .filter((entry) => entry.mutationClass !== 'READ_ONLY')
      .every((entry) => entry.targetResourceId === q1.childResourceId),
  )
  assert.equal(terminal.mutationAccounting.OTHER_AZURE_MUTATIONS, 0)
})
test('no cost recalculation,terminal estimate or financial authorization introduced', () => {
  assert.equal(terminal.closureOperations.costRecalculated, false)
  assert.equal(terminal.RECOMMENDED_EXECUTION_CEILING_CAD, 'UNSUPPORTED')
  assert.equal(terminal.HUMAN_APPROVED_EXECUTION_CEILING_CAD, 'UNBOUND')
  assert.equal(terminal.FINAL_THREE_DECISION_PACKET, 'NOT_ISSUED')
  assert.equal(input('G3R3D_COST_CLOSURE.json').BOUNDED_MAX_PROOF_RUN_COST_CAD, null)
})
test('all five reusable engineering assets are retained with exact file hashes and no authority', () => {
  assert.deepEqual(
    terminal.preservedAssets.map((asset) => asset.id),
    assets.map((asset) => asset.id),
  )
  for (const asset of terminal.preservedAssets) {
    assert.equal(asset.status, 'PRESERVED_NOT_AUTHORIZED_FOR_EXECUTION')
    assert(asset.bindings.length > 0)
    for (const entry of asset.bindings)
      assert.equal(hash(readFileSync(path.join(root, entry.path))), entry.sha256)
  }
  assert(
    terminal.preservedAssets
      .find((asset) => asset.id === 'G3_SYNTHETIC_PROOF_V1')
      .bindings.some((entry) => entry.path.endsWith('/main.go')),
  )
})
test('prospective source tree digest and local infrastructure qualification remain intact', () => {
  assert.equal(
    terminal.historicalQualification.sourceTreeSha256,
    '63851138029b8081b680f9e3b59e5a07d7ef8689fc308a19604ad78f13134958',
  )
  assert.equal(input('G3R2I_LOCAL_BUILD_EVIDENCE.json').status, 'PASS_LOCAL_ONLY_NOT_DEPLOYED')
  assert.equal(input('G3R2I_IMAGE_QUALIFICATION.json').IMAGE_AUTHORITY_ID, 'G3_SYNTHETIC_PROOF_V1')
  assert.equal(terminal.SOURCE_AUTHORITY, 'COMPLETE')
  assert.equal(terminal.QUALIFIED_SYNTHETIC_IMAGE, 'COMPLETE_LOCAL_NOT_PUSHED')
})
test('terminal status never authorizes G3A,G3B or another builder', () => {
  assert.equal(terminal.G3A, 'NOT_AUTHORIZED')
  assert.equal(terminal.G3B, 'NOT_AUTHORIZED')
  assert.equal(terminal.G3A_AUTHORIZED, 'NO')
  assert.equal(terminal.G3B_AUTHORIZED, 'NO')
  assert.equal(terminal.SELECTED_BUILDER, 'NONE')
})
test('all reopening examples require a new explicit human architecture charter,none authorized', () => {
  assert.equal(terminal.REOPEN_REQUIRES, 'NEW_HUMAN_ARCHITECTURE_AUTHORIZATION')
  assert.equal(terminal.reopenRule.newExplicitHumanArchitectureCharterRequired, true)
  assert.equal(terminal.reopenRule.noneAuthorizedByClosure, true)
  assert.equal(terminal.reopenRule.noFurtherEngineeringWithoutCharter, true)
  assert.equal(terminal.reopenRule.examples.length, 4)
  assert(terminal.reopenRule.examples.some((value) => value.includes('G2 VM')))
  assert(terminal.reopenRule.examples.some((value) => value.includes('agent-pool')))
})
test('mission registry absence is explicit;unrelated validator registries are not modified', () => {
  assert.equal(terminal.governanceRegistry.status, 'NO_CANONICAL_MISSION_STATUS_REGISTRY_FOUND')
  assert.equal(terminal.governanceRegistry.unrelatedRegistriesModified, false)
})
test('landing-zone entrypoint surfaces terminal ruling without erasing historical G1/G2 evidence', () => {
  const readme = readFileSync(path.join(root, 'README.md'), 'utf8')
  assert(readme.includes('CLOSED_NO_GO_CURRENT_PROOF_ARCHITECTURE'))
  assert(readme.includes('./g3-readiness-evidence/G3_TERMINAL_DISPOSITION.md'))
  assert(readme.includes('Mission: NZ-20261008-INFRA-001. Gate: G1_FOUNDATION.'))
  assert(readme.includes('not the broader Nzila Azure'))
})
for (const [section, field, value] of [
  ['scope', 'networkFailure', true],
  ['scope', 'broaderAzureArchitectureDisproven', true],
  ['closureOperations', 'azureCalls', 1],
  ['mutationAccounting', 'OTHER_AZURE_MUTATIONS', 1],
  ['passedObservations', 'PRIVATE_ACR_DNS', 'FAIL'],
  ['unexecutedProof', 'WATCHDOG_CLEANUP', 'PASS'],
  ['reopenRule', 'noneAuthorizedByClosure', false],
])
  test(`schema rejects erroneous or unauthorized terminal claim:${section}.${field}`, () => {
    const invalid = structuredClone(terminal)
    invalid[section][field] = value
    assert.throws(() => validateSchema(invalid))
  })
test('required bindings cannot be missing,reordered or malformed', () => {
  const missing = structuredClone(terminal)
  missing.liveFailureBindings.pop()
  assert.throws(() => validateSchema(missing))
  const corrupted = structuredClone(terminal)
  corrupted.liveFailureBindings[0].sha256 = 'not-a-digest'
  assert.throws(() => validateSchema(corrupted))
})
test('schema rejects additional execution authority and disabling the charter requirement', () => {
  const additional = structuredClone(terminal)
  additional.G3A_EXECUTE_NOW = true
  assert.throws(() => validateSchema(additional), /TERMINAL_SCHEMA_KEYS/)
  const bypass = structuredClone(terminal)
  bypass.reopenRule.newExplicitHumanArchitectureCharterRequired = false
  assert.throws(() => validateSchema(bypass))
})
test('terminal pure generation is deterministic and checker verifies all historical bindings', async () => {
  assert.deepEqual(generate().disposition, terminal)
  assert.deepEqual(generate(), generate())
  assert.deepEqual(await check(), {
    validation: 'PASS',
    missionDisposition: 'CLOSED_NO_GO_CURRENT_PROOF_ARCHITECTURE',
    azureCalls: 0,
  })
})
for (const flag of ['--collect', '--q1', '--q2', '--deploy', '--build', '--repair', '--approve'])
  test(`terminal CLI rejects execution/nonclosure flag:${flag}`, () => {
    const result = spawnSync(process.execPath, [path.join(root, 'g3-terminal-closure.mjs'), flag], {
      encoding: 'utf8',
      timeout: 10000,
    })
    assert.notEqual(result.status, 0)
    assert(result.stderr.includes('TERMINAL_LOCAL_FLAGS_ONLY'))
  })
