import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { FILES, ROOT, loadContext, validateGate0 } from './ue-gate0-scope-lock.mjs'
import { BASELINE_DATA, BASELINE_DOCS } from './ue-gate0a2-baseline-facts.mjs'
import { loadBaselines, sha256File, validateBaselines } from './ue-gate0a2-validate-baselines.mjs'

const clone = (value) => JSON.parse(JSON.stringify(value))
const data = () => clone(loadBaselines(ROOT))
const matrix = () => JSON.parse(readFileSync(`${ROOT}/${FILES.matrix}`, 'utf8'))
const run = (edit) => {
  const baselines = data()
  edit(baselines)
  return validateBaselines(ROOT, { data: baselines }).problems
}
const has = (problems, code) => problems.some((problem) => problem.startsWith(`${code}:`))
const contract = (baselines, persona, id) => baselines[persona].contracts.find((c) => c.id === id)
const base = loadContext()

test('the three proposed baselines pass and measure three separate things', () => {
  const result = validateBaselines(ROOT)
  assert.deepEqual(result.problems, [])
  const { personas, decisions, historicalVersusProposed } = result.summary
  assert.equal(personas.steward.stewardActionCount, 40)
  assert.deepEqual([personas.representative.identifierCoverage.universe, personas.representative.identifierCoverage.covered.length ?? personas.representative.identifierCoverage.covered], [56, 56])
  assert.equal(personas['financial-officer'].identifierCoverage.universe, 38)
  assert.equal(personas['financial-officer'].identifierCoverage.covered, 38)
  for (const persona of Object.values(personas)) {
    assert.ok('identifierCoverage' in persona && 'behavioralSpecification' in persona && 'implementedFunctionality' in persona)
    assert.equal(persona.behavioralSpecification.withAllRequiredFields, persona.behavioralSpecification.contracts)
  }
  assert.equal(decisions.outstanding, decisions.productDesign + decisions.institutionalAuthority)
  assert.equal(historicalVersusProposed.steward.historicallyEvidenced, 0)
  assert.equal(historicalVersusProposed.steward.newDesignOnly, historicalVersusProposed.steward.contracts)
})

test('every baseline is proposed, not adopted, frozen, or recovered, and creates no live authority', () => {
  const baselines = data()
  for (const key of Object.keys(BASELINE_DATA)) {
    assert.equal(baselines[key].status, 'PROPOSED_NOT_ADOPTED', key)
    assert.equal(baselines[key].adopted, false)
    assert.equal(baselines[key].frozen, false)
    assert.equal(baselines[key].originalRecovered, false)
  }
  for (const persona of ['steward', 'representative', 'financial-officer']) {
    const all = [...baselines[persona].contracts, ...(baselines[persona].journeys ?? []), ...(baselines[persona].scenarios ?? [])]
    for (const item of all) {
      assert.equal(item.liveAuthorityCreated, false, item.id)
      assert.ok(item.labels.includes('PROPOSED_NEW_BASELINE'), item.id)
    }
  }
})

test('a missing Financial Officer identifier is reported', () => {
  const problems = run((b) => {
    b['financial-officer'].contracts = b['financial-officer'].contracts.filter((c) => c.id !== 'F11')
  })
  assert.ok(problems.some((p) => /F11/.test(p) && /^(FO-|DOC-)/.test(p)), problems.join('\n'))
})

test('a missing Representative identifier is reported', () => {
  const problems = run((b) => {
    b.representative.contracts = b.representative.contracts.filter((c) => c.id !== 'R07')
  })
  assert.ok(problems.some((p) => /R07/.test(p)), problems.join('\n'))
})

test('a Steward action without a stable identity or an evidence class is reported', () => {
  assert.ok(has(run((b) => { contract(b, 'steward', 'STW-ACT-03').id = 'ACT-3' }), 'STEWARD-ID'))
  assert.ok(has(run((b) => { delete contract(b, 'steward', 'STW-ACT-03').id }), 'STEWARD-ID'))
  const noEvidence = run((b) => { delete contract(b, 'steward', 'STW-ACT-03').provenance.evidenceClass })
  assert.ok(has(noEvidence, 'STEWARD-EVIDENCE') && has(noEvidence, 'EVIDENCE-CLASS'), noEvidence.join('\n'))
})

test('historical and proposed meaning cannot be silently interchanged', () => {
  const problems = run((b) => {
    const r01 = contract(b, 'representative', 'R01')
    r01.proposedMeaning = r01.historical.quote
  })
  assert.ok(has(problems, 'MEANING-INTERCHANGED'), problems.join('\n'))
  const flipped = run((b) => {
    const f = contract(b, 'financial-officer', 'F05')
    f.meaningOrigin = 'NEW_DESIGN'
  })
  assert.ok(has(flipped, 'MEANING-ORIGIN'), flipped.join('\n'))
})

test('an action without an authorization boundary is reported', () => {
  const problems = run((b) => { delete contract(b, 'steward', 'STW-ACT-05').authorization })
  assert.ok(has(problems, 'AUTH-BASIS') && has(problems, 'STEWARD-BOUNDARY'), problems.join('\n'))
  const noBasis = run((b) => { contract(b, 'steward', 'STW-ACT-05').authorization.basisId = 'ANY_STEWARD' })
  assert.ok(has(noBasis, 'AUTH-BASIS'), noBasis.join('\n'))
})

test('a proposed action that creates live authority is reported', () => {
  const problems = run((b) => { contract(b, 'steward', 'STW-ACT-05').liveAuthorityCreated = true })
  assert.ok(has(problems, 'LIVE-AUTHORITY'), problems.join('\n'))
  const activated = run((b) => { contract(b, 'steward', 'STW-ACT-05').activation = 'ACTIVE' })
  assert.ok(has(activated, 'LIVE-AUTHORITY'), activated.join('\n'))
})

test('a grouped identifier that shares a title and specification is reported', () => {
  const problems = run((b) => {
    const r03 = contract(b, 'representative', 'R03')
    const r04 = contract(b, 'representative', 'R04')
    r04.title = r03.title
  })
  assert.ok(has(problems, 'REP-GROUPED'), problems.join('\n'))
})

test('a Steward contract cannot claim a historical source', () => {
  const problems = run((b) => {
    contract(b, 'steward', 'STW-ACT-05').historical = { sourceId: 'REP-DISPOSITION-V1', quote: '| R01 identity/mandates | PARTIAL |', kind: 'ROW', individuallyEvidenced: true, note: null }
  })
  assert.ok(has(problems, 'STEWARD-FALSE-HISTORY'), problems.join('\n'))
})

test('a false historical quote is reported', () => {
  const problems = run((b) => { contract(b, 'representative', 'R01').historical.quote = '| R01 invented text | DONE |' })
  assert.ok(has(problems, 'HISTORICAL-QUOTE'), problems.join('\n'))
})

test('a removed institutional decision is reported', () => {
  const problems = run((b) => {
    b.decisions.decisions = b.decisions.decisions.filter((d) => d.id !== 'DEC-IA-07')
  })
  assert.ok(has(problems, 'DECISION-UNKNOWN'), problems.join('\n'))
})

test('a settled or owner-named institutional decision is reported', () => {
  const settled = run((b) => { b.decisions.decisions.find((d) => d.type === 'INSTITUTIONAL_AUTHORITY').status = 'ADOPTED' })
  assert.ok(has(settled, 'DECISION-STATUS'), settled.join('\n'))
  const owner = run((b) => { b.decisions.decisions.find((d) => d.type === 'INSTITUTIONAL_AUTHORITY').decisionOwner = 'Local President' })
  assert.ok(has(owner, 'DECISION-OWNER'), owner.join('\n'))
})

test('R18 keeps both historical dispositions', () => {
  const problems = run((b) => { b.representative.r18VersionedRecord = null })
  assert.ok(has(problems, 'R18-VERSIONED'), problems.join('\n'))
})

test('an implementation status the cited source cannot support is reported', () => {
  const problems = run((b) => {
    const c = contract(b, 'steward', 'STW-ACT-25')
    c.implementation.status = 'SOURCE_PRESENT'
  })
  assert.ok(has(problems, 'IMPL-OVERCLAIM'), problems.join('\n'))
  const conformance = run((b) => { contract(b, 'steward', 'STW-ACT-06').implementation.conformanceChecked = true })
  assert.ok(has(conformance, 'IMPL-CONFORMANCE'), conformance.join('\n'))
})

test('institutional scenarios cannot be merged or made interchangeable', () => {
  const problems = run((b) => {
    const [first, second] = b.representative.scenarios
    second.operatingModel = first.operatingModel
    second.behavior = first.behavior
  })
  assert.ok(problems.some((p) => /^SCENARIO-/.test(p)), problems.join('\n'))
})

test('Financial Officer duties stay separate and a role title never issues a mandate', () => {
  const duties = run((b) => {
    for (const c of b['financial-officer'].contracts) {
      if (c.kind === 'DOMAIN') c.authorization.kernelActions = (c.authorization.kernelActions ?? []).filter((a) => a !== 'finance:approve')
    }
  })
  assert.ok(has(duties, 'FO-DUTIES'), duties.join('\n'))
  const title = run((b) => {
    contract(b, 'financial-officer', 'F05').financial.requiredFinancialAuthority.derivedFromRoleTitle = true
  })
  assert.ok(has(title, 'FO-ROLE-TITLE'), title.join('\n'))
})

test('a Financial Officer navigation destination that claims to be recovered is reported', () => {
  const problems = run((b) => {
    const nav = b['financial-officer'].contracts.find((c) => c.kind === 'NAVIGATION' && c.navigationNameOrigin === 'PROPOSED_NEW_NAME')
    nav.navigationNameOrigin = 'RECOVERED_HISTORICAL_NAME'
  })
  assert.ok(problems.some((p) => /^FO-NAV/.test(p)), problems.join('\n'))
})

test('Gate 0 records the proposed baselines as available for review and not adopted', () => {
  const record = matrix().proposedPersonaBaselines
  assert.equal(record.status, 'READY_FOR_PRODUCT_SPECIFICATION_REVIEW')
  assert.equal(record.adopted, false)
  for (const [key, file] of Object.entries(BASELINE_DATA)) assert.equal(record.data[key].sha256, sha256File(ROOT, file))
  assert.deepEqual(record.documents, BASELINE_DOCS)
  const result = validateGate0(matrix(), { base })
  assert.deepEqual(result.problems, [])
  assert.equal(result.summary.verdict, 'IN_PROGRESS')
  for (const persona of ['steward', 'representative', 'financial-officer']) assert.equal(result.summary.persona[persona].resolved, false, persona)
  assert.equal(result.summary.persona.steward.identifiers, 0)
  assert.equal(result.summary.persona.representative.identifiers, 56)
  assert.equal(result.summary.persona['financial-officer'].identifiers, 38)
})

test('Gate 0 fails when a baseline file changes after the matrix recorded its hash', () => {
  const stale = matrix()
  stale.proposedPersonaBaselines.data.steward.sha256 = '0'.repeat(64)
  assert.ok(validateGate0(stale, { base }).problems.some((p) => p.startsWith('PROPOSED-BASELINES-HASH:')))
})

test('Gate 0 fails when a baseline is recorded as adopted or a persona as resolved', () => {
  const adopted = matrix()
  adopted.proposedPersonaBaselines.adopted = true
  assert.ok(validateGate0(adopted, { base }).problems.some((p) => p.startsWith('PROPOSED-BASELINES-ADOPTED:')))
  const resolved = matrix()
  resolved.personaCompleteness.find((p) => p.persona === 'steward').resolved = true
  assert.ok(validateGate0(resolved, { base }).problems.some((p) => p.startsWith('PROPOSED-BASELINES-RESOLVED:')))
  const absent = matrix()
  delete absent.proposedPersonaBaselines
  assert.ok(validateGate0(absent, { base }).problems.some((p) => p.startsWith('PROPOSED-BASELINES-ABSENT:')))
})
