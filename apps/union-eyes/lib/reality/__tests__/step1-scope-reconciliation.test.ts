import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CAPABILITY_REGISTRY } from '../capability-registry'

const root = resolve(__dirname, '../../../../..')
const read = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8'))
const base = 'docs/union-eyes/staging/'
const census = read(`${base}UE_V2_BASE_PRODUCT_SCOPE_RECONCILIATION.json`)
const semantic = read(`${base}UE_V2_BASE_PRODUCT_SCOPE_SEMANTIC_REVIEW_20261117.json`)
const ledger = read(`${base}UE_V2_BASE_ACTION_COVERAGE.json`)
const decisions = read('docs/union-eyes/convergence/register/ue-decision-index-0c3.json')

// Historical corpus rows intentionally retain different record shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
function rows(value: unknown): Row[] {
  if (Array.isArray(value)) return value.flatMap(rows)
  if (value && typeof value === 'object')
    return [value as Row, ...Object.values(value).flatMap(rows)]
  return []
}

describe('current base scope and canonical action coverage', () => {
  it('resolves the complete 314-record conditional universe without rewriting historical scope or granting adoption', () => {
    const classified = rows(census).filter((row) => row.historicalScope === 'CONDITIONAL')
    expect(classified).toHaveLength(314)
    expect(rows(census).filter((row) => row.scope === 'CONDITIONAL')).toEqual([])
    for (const row of classified) {
      expect(['REQUIRED', 'DEFERRED', 'EXCLUDED']).toContain(row.scope)
      expect(row.scopeResolution.disposition).toBe(row.scope)
      expect(row.scopeResolution.baseActionIds.length).toBeGreaterThan(0)
      expect(row.scopeResolution.boundary.length).toBeGreaterThan(10)
      expect(row.scopeResolution.mandatoryDenials).toBe(true)
      expect(row.scopeResolution.historicalAdoptionChanged).toBe(false)
      expect(row.scopeResolution.institutionalAuthorityGranted).toBe(false)
      expect(row.scopeResolution.evidenceState).toBe('SCOPE_RECONCILED_RUNTIME_UNVERIFIED')
      expect(row.scopeResolution.sourceRefs.length).toBeGreaterThan(0)
    }
    expect(census.historicalCounts.base.CONDITIONAL).toBe(4)
    expect(semantic.conditionalReview).toHaveLength(170)
    expect(semantic.conditionalReview.every((row: Row) => row.scopeResolution)).toBe(true)
  })

  it('joins every canonical decision once and preserves adoption, family and source state', () => {
    const original = new Map(decisions.decisions.map((row: Row) => [row.decisionId, row]))
    const reviewed = census.canonicalDecisionCoverage.scopeApplicability
    expect(reviewed).toHaveLength(138)
    expect(new Set(reviewed.map((row: Row) => row.id))).toEqual(new Set(original.keys()))
    expect(new Set(semantic.decisionRows.map((row: Row) => row.id))).toEqual(
      new Set(original.keys()),
    )
    for (const row of reviewed) {
      const source = original.get(row.id) as Row
      expect(row.family).toBe(source.family)
      expect(row.historicalState).toBe(source.currentState)
      expect(row.adoptedInHistoricalIndex).toBe(source.adopted)
    }
    expect(
      semantic.decisionRows.every((row: Row) => row.institutionalAuthorityGranted === false),
    ).toBe(true)
  })

  it('binds all 35 stakeholders to existing action ids, lifecycle and mandatory denials, including recipients and machines', () => {
    const ids = new Set([...ledger.actions, ...ledger.operations].map((row: Row) => row.id))
    const actors = ledger.step1ScopeReconciliation.stakeholderActionCoverage
    expect(actors).toHaveLength(35)
    expect(new Set(actors.map((row: Row) => row.id)).size).toBe(35)
    for (const actor of actors) {
      expect(actor.baseActionIds.every((id: string) => ids.has(id))).toBe(true)
      expect(actor.lifecycleIds.length).toBeGreaterThan(0)
      expect(actor.negative.length).toBeGreaterThan(0)
      expect(actor.authorityBoundary).toContain('No automatic entitlement')
      expect(actor.runtimeQualified).toBe(false)
    }
    expect(actors.find((row: Row) => row.id === 'SA18').participation).toBe(
      'RECIPIENT_OR_EXPLICIT_SCOPED_GRANT_ONLY',
    )
    expect(actors.find((row: Row) => row.id === 'SA28').baseActionIds).toContain('O06')
    expect(census.operatingModelScope.presets.every((row: Row) => row.scope === 'REQUIRED')).toBe(
      true,
    )
  })

  it('accounts for every current registry id and required corpus atom in the existing action ledger', () => {
    expect(new Set(census.registryCapabilities.map((row: Row) => row.id))).toEqual(
      new Set(CAPABILITY_REGISTRY.map((row) => row.id)),
    )
    expect(census.registryCapabilities).toHaveLength(CAPABILITY_REGISTRY.length)
    expect(census.currentReleaseResolution.baselineRegistryCount).toBe(141)
    const actions = new Map(
      [...ledger.actions, ...ledger.operations].map((row: Row) => [row.id, row]),
    )
    for (const inventory of [
      'historicalCapabilities',
      'registryCapabilities',
      'historicalPersonaIdentifiers',
      'reconstructedPersonaContracts',
      'authorityActionIndex',
      'historicalStoryIndex',
    ]) {
      const required = census[inventory].filter((row: Row) => row.scope === 'REQUIRED')
      expect(required.length).toBe(
        census.currentReleaseResolution.requiredRequirementDenominators[inventory],
      )
      for (const requirement of required) {
        expect(requirement.baseActionIds.length).toBeGreaterThan(0)
        const key = `${inventory}:${inventory === 'reconstructedPersonaContracts' ? `${requirement.persona}:` : ''}${requirement.id}`
        for (const id of requirement.baseActionIds) {
          const action = actions.get(id) as Row
          expect(action.productRequirementIds).toContain(key)
          expect(action.qualificationContract.testSources.length).toBeGreaterThan(0)
          expect(
            action.qualificationContract.testSources.every((path: string) =>
              existsSync(resolve(root, path)),
            ),
          ).toBe(true)
        }
      }
    }
    expect(ledger.step1ScopeReconciliation.orphanRequiredRequirements).toEqual([])
  })

  it('joins all 654 required scope nodes including protocols, lifecycle, roles, commercial and pilot crosscuts', () => {
    const actions = new Map(
      [...ledger.actions, ...ledger.operations].map((row: Row) => [row.id, row]),
    )
    const counts: Record<string, number> = {}
    const keys = new Set<string>()
    const visit = (value: unknown, path: (string | number)[] = []) => {
      if (Array.isArray(value)) return value.forEach((item, index) => visit(item, [...path, index]))
      if (!value || typeof value !== 'object') return
      const row = value as Row
      if (row.scope === 'REQUIRED') {
        const category = path.filter((part) => typeof part === 'string').join('.')
        counts[category] = (counts[category] ?? 0) + 1
        const key = `${category}:${category === 'reconstructedPersonaContracts' ? `${row.persona}:` : ''}${row.id}`
        expect(keys.has(key), key).toBe(false)
        keys.add(key)
        expect(row.baseActionIds.length, key).toBeGreaterThan(0)
        for (const id of row.baseActionIds) {
          const action = actions.get(id) as Row
          expect(action, key).toBeDefined()
          expect(action.productRequirementIds, key).toContain(key)
          expect(action.qualificationContract.testSources.length, key).toBeGreaterThan(0)
        }
      }
      for (const [name, item] of Object.entries(row)) visit(item, [...path, name])
    }
    visit(census)
    expect(keys.size).toBe(654)
    expect(counts).toEqual(census.currentReleaseResolution.allRequiredScopeNodeDenominators)
    expect(counts).toEqual(ledger.step1ScopeReconciliation.allRequiredScopeNodeDenominators)
    expect(counts['operatingModelScope.presets']).toBe(4)
    expect(counts['operatingModelScope.crossCuttingVariants']).toBe(6)
    expect(counts['stakeholderLifecycle.stages']).toBe(16)
    expect(counts['commercialCommitmentMatrix.rows']).toBe(15)
    expect(ledger.step1ScopeReconciliation.orphanRequiredScopeNodes).toEqual([])
    for (const action of actions.values() as Iterable<Row>) {
      expect(action.state).toBe('CURRENT_STEP_1_CANDIDATE_UNQUALIFIED')
      expect(action.step1Evidence).toBeNull()
    }
  })

  it('keeps action-chain obligations separate from unexecuted exact-candidate proof and original 777 closure', () => {
    for (const action of ledger.actions) {
      const contract = action.qualificationContract
      for (const field of [
        'productRequirement',
        'stakeholderResponsibility',
        'resourceScope',
        'authorizationDecision',
        'downstreamExecution',
        'persistenceBoundary',
        'auditObligation',
      ]) {
        expect(contract[field].length).toBeGreaterThan(10)
      }
      expect(
        contract.runtimeEntryPoints.every((entry: Row) => existsSync(resolve(root, entry.path))),
      ).toBe(true)
      expect(contract.proofState).toBe('REQUIRED_NOT_INFERRED')
      expect(contract.exactCandidateEvidence).toBeNull()
    }
    const original = read(
      'docs/union-eyes/convergence/remediation/ue-all-777-remediation-register.json',
    )
    expect(original.records).toHaveLength(777)
    expect(new Set(original.records.map((row: Row) => row.defectId)).size).toBe(777)
    expect(original.records.filter((row: Row) => row.closed)).toEqual([])
    expect(ledger.step1ScopeReconciliation.original777HistoricalClosureChanged).toBe(false)
    expect(ledger.step1EngineeringContinuation.heldStep2).toBe(true)
    expect(ledger.step1EngineeringContinuation.noStagingOrProductionPromotion).toBe(true)
  })
})
