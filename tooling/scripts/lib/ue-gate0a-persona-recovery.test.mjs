import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FILES, ROOT, loadContext, validateGate0 } from './ue-gate0-scope-lock.mjs'
import { computePersonaSpecs, personaActionsFromSpecs } from './ue-gate0-persona-spec.mjs'
import { RECOVERY_FILE, isSolitary, loadRecovery } from './ue-gate0a-persona-recovery.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const matrixPath = join(here, '../../../', FILES.matrix)
const cloneJson = (value) => JSON.parse(JSON.stringify(value))
const matrix = () => cloneJson(JSON.parse(readFileSync(matrixPath, 'utf8')))
const recovery = () => cloneJson(loadRecovery(ROOT))
const base = loadContext()
const specsWith = (changed) => computePersonaSpecs(ROOT, { recovery: changed })
const runWith = (changed, edit = (item) => item) => {
  const personaSpecs = specsWith(changed)
  return validateGate0(edit(matrix()), { base, personaSpecs, personaActions: personaActionsFromSpecs(personaSpecs) })
}
const recoveryProblems = (changed) => specsWith(changed).recovery.problems

test('the recovered counts are exact and the three personas stay unresolved', () => {
  const specs = base.personaSpecs
  const counts = (persona) => [specs[persona].universe.length, specs[persona].individuallyDefined.length, specs[persona].groupedOnly.length, specs[persona].unspecified.length]
  assert.deepEqual(counts('steward'), [0, 0, 0, 0])
  assert.deepEqual(counts('representative'), [56, 39, 17, 0])
  assert.deepEqual(counts('financial-officer'), [38, 4, 6, 28])
  for (const persona of ['steward', 'representative', 'financial-officer']) assert.equal(specs[persona].resolved, false, persona)
  assert.deepEqual(specs.recovery.problems, [])
  assert.deepEqual(specs.representative.conflicts, ['R18'])
  const r01 = specs.representative.definitionSources.R01
  assert.equal(r01.class, 'FROZEN_DISPOSITION')
  assert.equal(r01.commit, '571784d58f93ed6939438422534c63b83d77c7ed')
  assert.equal(r01.title, 'identity/mandates')
  assert.equal(specs.steward.stewardEvidenceCount, 8)
  assert.equal(specs.steward.universe.length, 0)
  assert.deepEqual(runWith(recovery()).problems, [])
})

test('a missing persona specification cannot be marked resolved', () => {
  const steward = (item) => {
    item.personaCompleteness.find((entry) => entry.persona === 'steward').resolved = true
    return item
  }
  assert.ok(runWith(recovery(), steward).problems.some((problem) => /steward is marked resolved while its source specifications are unresolved/.test(problem)))
  const representative = (item) => {
    item.personaCompleteness.find((entry) => entry.persona === 'representative').resolved = true
    return item
  }
  assert.ok(runWith(recovery(), representative).problems.some((problem) => /representative is marked resolved while its source specifications are unresolved/.test(problem)))
  const gone = runWith(null)
  assert.ok(gone.problems.some((problem) => /persona source recovery file is missing or unreadable/.test(problem)))
  assert.ok(gone.problems.some((problem) => /personaCompleteness for representative does not match its source \(individuallyDefined\)/.test(problem)), 'losing the recovery file cannot leave the recovered definitions in the matrix')
  assert.equal(gone.summary.persona.representative.individuallyDefined, 32)
})

test('a grouped-only identifier cannot silently become individually defined', () => {
  const changed = recovery()
  changed.identifiers.push({ persona: 'representative', id: 'R07', level: 'INDIVIDUALLY_DEFINED', title: 'case lifecycle', sourceId: 'REP-DISPOSITION-V1', quote: '| R07/R08 case lifecycle, assignment | LIMITED |' })
  changed.identifiers.push({ persona: 'representative', id: 'R04', level: 'INDIVIDUALLY_DEFINED', title: 'assessment', sourceId: 'REP-DISPOSITION-V2', quote: 'R03–R06 (intake, assessment, triage, escalation)' })
  const specs = specsWith(changed)
  assert.ok(specs.recovery.problems.some((problem) => /representative\/R07 is joined to sibling identifiers/.test(problem)))
  assert.ok(specs.recovery.problems.some((problem) => /representative\/R04 is joined to sibling identifiers/.test(problem)))
  assert.ok(!specs.representative.individuallyDefined.includes('R07'))
  assert.ok(!specs.representative.individuallyDefined.includes('R04'))
  assert.ok(specs.representative.groupedOnly.includes('R07'))
  assert.ok(runWith(changed).problems.length > 0)
  assert.equal(isSolitary('| R01 identity/mandates | LIMITED |', 'R01'), true)
  assert.equal(isSolitary('| R11/R12 communications | LIMITED |', 'R12'), false)
})

test('an inferred or executable-only action cannot be presented as an original frozen requirement', () => {
  const executable = recovery()
  executable.identifiers.push({ persona: 'representative', id: 'R10', level: 'INDIVIDUALLY_DEFINED', title: 'Union Steward', sourceId: 'EXEC-ROLES', quote: 'STEWARD = "steward", // Union Steward' })
  assert.ok(recoveryProblems(executable).some((problem) => /representative\/R10 cites a EXISTING_EXECUTABLE_CONTRACT source, which cannot define an institutional requirement/.test(problem)))
  assert.ok(!specsWith(executable).representative.individuallyDefined.includes('R10'))
  const inferred = recovery()
  inferred.identifiers.push({ persona: 'representative', id: 'R16', level: 'INDIVIDUALLY_DEFINED', title: 'identity/mandates', basis: 'INFERENCE', sourceId: 'REP-DISPOSITION-V1', quote: '| R01 identity/mandates | LIMITED |' })
  assert.ok(recoveryProblems(inferred).some((problem) => /representative\/R16 is an inference and cannot be presented as an individually defined requirement/.test(problem)))
  const steward = recovery()
  steward.steward.evidence[0].definesAction = true
  steward.steward.authoritativeActions = 3
  const stewardProblems = recoveryProblems(steward)
  assert.ok(stewardProblems.some((problem) => /recovery steward evidence S1 is evidence only and cannot define a steward action/.test(problem)))
  assert.ok(stewardProblems.some((problem) => /claims authoritative steward actions but the steward universe is empty/.test(problem)))
  assert.equal(specsWith(steward).steward.universe.length, 0)
  const finance = recovery()
  finance.financialAuthoritySeparation[0].institutionallyRequired = true
  assert.ok(recoveryProblems(finance).some((problem) => /recovery financial separation viewing is presented as institutionally required without an authoritative source/.test(problem)))
})

test('the Financial Officer range cannot be completed by endpoint counting or by invented identifiers', () => {
  const specs = base.personaSpecs['financial-officer']
  assert.equal(specs.universe.length, 38)
  assert.ok(['F02', 'F03', 'F27', 'FJ05'].every((id) => specs.universe.includes(id) && specs.unspecified.includes(id)))
  const endpoints = matrix()
  const entry = endpoints.personaCompleteness.find((item) => item.persona === 'financial-officer')
  entry.universe = ['F01', 'F28', 'FJ01', 'FJ10', 'F08', 'F09', 'F10', 'F19', 'F11', 'F12', 'F13', 'F14', 'F17', 'F18']
  entry.unspecified = []
  entry.groupedOnly = ['F11', 'F12', 'F13', 'F14', 'F17', 'F18']
  entry.individuallyDefined = ['F01', 'F28', 'FJ01', 'FJ10', 'F08', 'F09', 'F10', 'F19']
  entry.resolved = true
  const problems = validateGate0(endpoints, { base }).problems
  assert.ok(problems.some((problem) => /personaCompleteness for financial-officer does not match its source \(universe\)/.test(problem)))
  assert.ok(problems.some((problem) => /financial-officer is marked resolved while its source specifications are unresolved/.test(problem)))
  const invented = recovery()
  invented.identifiers.push({ persona: 'financial-officer', id: 'F99', level: 'INDIVIDUALLY_DEFINED', title: 'invented', sourceId: 'FO-DISPOSITION-V2', quote: 'F10 (affiliate remittances) UNAVAILABLE' })
  assert.ok(recoveryProblems(invented).some((problem) => /financial-officer\/F99 is not in the financial-officer universe; recovery cannot add identifiers/.test(problem)))
  const promoted = recovery()
  promoted.identifiers.push({ persona: 'financial-officer', id: 'F01', level: 'INDIVIDUALLY_DEFINED', title: 'ledger', sourceId: 'FO-DISPOSITION-V2', quote: 'F01 ledger and accounts' })
  const promotedSpecs = specsWith(promoted)
  assert.ok(promotedSpecs.recovery.problems.some((problem) => /financial-officer\/F01 quote is not in FO-DISPOSITION-V2/.test(problem)))
  assert.ok(promotedSpecs['financial-officer'].unspecified.includes('F01'))
  const mismatch = recovery()
  mismatch.groups.find((group) => group.ids.includes('F11')).pairing = 'POSITIONAL_INFERENCE'
  assert.ok(recoveryProblems(mismatch).some((problem) => /3 labels for 4 identifiers and must record pairing NONE/.test(problem)))
})

test('conflicting historical sources stay a visible unresolved disposition', () => {
  const blocker = runWith(recovery()).blockers.find((item) => item.persona === 'representative')
  assert.equal(blocker.sourceConflicts, 1)
  assert.equal(blocker.code, 'PERSONA_SPEC_UNRESOLVED')
  const hidden = recovery()
  hidden.conflicts = []
  const hiddenSpecs = specsWith(hidden)
  assert.ok(hiddenSpecs.recovery.problems.some((problem) => /sources disagree about representative\/R18 \(BLOCKED vs MISSING\) and no unresolved conflict is recorded/.test(problem)))
  const settled = recovery()
  settled.conflicts[0].disposition = 'RESOLVED'
  assert.ok(recoveryProblems(settled).some((problem) => /recovery conflict representative\/R18 must stay UNRESOLVED/.test(problem)))
  const erased = matrix()
  erased.personaCompleteness.find((item) => item.persona === 'representative').conflicts = []
  assert.ok(validateGate0(erased, { base }).problems.some((problem) => /personaCompleteness for representative does not record the source conflicts \(R18\)/.test(problem)))
})

test('an absent action cannot disappear from the previously recorded universe', () => {
  const floor = base.personaFloor
  assert.equal(floor.representative.length, 56)
  assert.equal(floor['financial-officer'].length, 38)
  const trimmedMatrix = matrix()
  const entry = trimmedMatrix.personaCompleteness.find((item) => item.persona === 'representative')
  for (const field of ['universe', 'groupedOnly']) entry[field] = entry[field].filter((id) => id !== 'R05')
  trimmedMatrix.personaActions = trimmedMatrix.personaActions.filter((item) => item.actionId !== 'R05')
  const problems = validateGate0(trimmedMatrix, { base }).problems
  assert.ok(problems.some((problem) => /representative action R05 is missing from the matrix universe but was previously recorded/.test(problem)))
  const specs = cloneJson(base.personaSpecs)
  const shrunk = { ...specs, representative: { ...specs.representative, universe: specs.representative.universe.filter((id) => id !== 'R05'), groupedOnly: specs.representative.groupedOnly.filter((id) => id !== 'R05') } }
  Object.defineProperty(shrunk, 'recovery', { value: base.personaSpecs.recovery, enumerable: false })
  const fromSource = validateGate0(matrix(), { base, personaSpecs: shrunk, personaActions: personaActionsFromSpecs(shrunk) }).problems
  assert.ok(fromSource.some((problem) => /representative action R05 disappeared from the previously recorded universe/.test(problem)))
  const noAnchor = validateGate0(matrix(), { base, personaFloor: null }).problems
  assert.ok(noAnchor.some((problem) => /the persona universe floor cannot be read from its anchor commit/.test(problem)))
})

test('a recovered quote and blob are re-derived from git', () => {
  const quote = recovery()
  quote.identifiers.find((item) => item.id === 'R01').quote = '| R01 identity/mandates | FULLY OPERATIONAL |'
  assert.ok(recoveryProblems(quote).some((problem) => /recovery identifier representative\/R01 quote is not in REP-DISPOSITION-V1/.test(problem)))
  assert.ok(!specsWith(quote).representative.individuallyDefined.includes('R01'))
  const blob = recovery()
  blob.sources.find((item) => item.id === 'REP-DISPOSITION-V1').blob = '0'.repeat(40)
  assert.ok(recoveryProblems(blob).some((problem) => /recovery source REP-DISPOSITION-V1 blob hash does not match git/.test(problem)))
  const short = recovery()
  short.sources.find((item) => item.id === 'FO-DISPOSITION-V1').commit = '7ba993a'
  assert.ok(recoveryProblems(short).some((problem) => /recovery source FO-DISPOSITION-V1 needs a full commit SHA/.test(problem)))
  const consolidation = recovery()
  consolidation.kind = 'CANONICAL'
  assert.ok(recoveryProblems(consolidation).some((problem) => /must declare kind EVIDENCE_CONSOLIDATION/.test(problem)))
})

test('references without an identifier keep their persona unresolved and cannot be dropped silently', () => {
  const specs = base.personaSpecs
  assert.equal(specs.representative.unidentifiedReferences.length, 2)
  assert.equal(specs['financial-officer'].unidentifiedReferences.length, 3)
  const unblocking = recovery()
  unblocking.unidentifiedReferences[0].blocksResolution = false
  assert.ok(recoveryProblems(unblocking).some((problem) => /must block resolution; it has no identifier and no definition/.test(problem)))
  const dropped = matrix()
  dropped.personaCompleteness.find((item) => item.persona === 'financial-officer').unidentifiedReferences = []
  assert.ok(validateGate0(dropped, { base }).problems.some((problem) => /personaCompleteness for financial-officer does not record the references that have no identifier/.test(problem)))
  assert.ok(RECOVERY_FILE.endsWith('ue-gate0a-persona-source-recovery.json'))
})

test('a persona cannot claim a recovered canonical without a canonical-class source', () => {
  const changed = recovery()
  changed.canonicalSearch.find((item) => item.persona === 'representative').status = 'RECOVERED'
  assert.ok(recoveryProblems(changed).some((problem) => /claims a recovered canonical but no ORIGINAL_FROZEN_CANONICAL or HISTORICAL_CANONICAL_PREDECESSOR source is registered/.test(problem)))
})
