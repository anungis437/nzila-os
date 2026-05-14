import { describe, expect, it } from 'vitest'

import {
  OntologyEntityTypes,
  RelationshipTypes,
} from '@nzila/platform-ontology'

import {
  ABSOLUTE_DENY_LIST,
  FORBIDDEN_SEMANTIC_TOKENS,
  HOLD_FOR_DEMAND,
  IGG_NEVER_CANONICALIZE_GAP_FILL,
  assertCanonicalizationAllowed,
  classifyCanonicalizationProposal,
  findCanonicalizationViolations,
  hasForbiddenSemanticShape,
  isHoldForDemand,
  isProtectedCanonicalization,
} from './canonicalization.js'
import {
  IGG_PROTECTED_DECISION_CATEGORIES,
  IGG_PROTECTED_ENTITY_KINDS,
  IGG_PROTECTED_EVENT_KINDS,
  IGG_PROTECTED_RELATIONSHIP_KINDS,
} from '../governance/protected.js'
import {
  IggEntityKinds,
  IggRelationshipKinds,
} from './kinds.js'

describe('Workstream I — canonicalization deny-list (Tier 1)', () => {
  it('absolute deny-list is the union of all protected-semantics fences plus the WS-I gap-fill', () => {
    expect(new Set(ABSOLUTE_DENY_LIST)).toEqual(
      new Set([
        ...IGG_PROTECTED_ENTITY_KINDS,
        ...IGG_PROTECTED_RELATIONSHIP_KINDS,
        ...IGG_PROTECTED_EVENT_KINDS,
        ...IGG_PROTECTED_DECISION_CATEGORIES,
        ...IGG_NEVER_CANONICALIZE_GAP_FILL,
      ]),
    )
  })

  it('UMRC is included in the WS-I gap-fill and rejected by isProtectedCanonicalization', () => {
    expect(IGG_NEVER_CANONICALIZE_GAP_FILL).toContain(IggEntityKinds.UMRC)
    expect(isProtectedCanonicalization(IggEntityKinds.UMRC)).toBe(true)
    expect(() => assertCanonicalizationAllowed(IggEntityKinds.UMRC)).toThrow(
      /protected governance metadata/i,
    )
  })

  it('every protected entity / relationship / event kind is rejected by isProtectedCanonicalization', () => {
    for (const kind of IGG_PROTECTED_ENTITY_KINDS) {
      expect(isProtectedCanonicalization(kind)).toBe(true)
    }
    for (const kind of IGG_PROTECTED_RELATIONSHIP_KINDS) {
      expect(isProtectedCanonicalization(kind)).toBe(true)
    }
    for (const kind of IGG_PROTECTED_EVENT_KINDS) {
      expect(isProtectedCanonicalization(kind)).toBe(true)
    }
    for (const cat of IGG_PROTECTED_DECISION_CATEGORIES) {
      expect(isProtectedCanonicalization(cat)).toBe(true)
    }
  })

  it('classifyCanonicalizationProposal denies protected metadata with reason=protected-metadata', () => {
    const verdict = classifyCanonicalizationProposal(
      IggEntityKinds.CLASS_B_SPECIAL_VOTING_SHARE,
    )
    expect(verdict.allowed).toBe(false)
    expect(verdict).toMatchObject({ reason: 'protected-metadata' })
  })

  it('assertCanonicalizationAllowed throws for protected kinds', () => {
    expect(() =>
      assertCanonicalizationAllowed(IggRelationshipKinds.VETOES),
    ).toThrow(/protected governance metadata/i)
  })
})

describe('Workstream I — forbidden semantic shapes (Tier 2)', () => {
  it.each([
    'InstitutionalScore',
    'institutional_score',
    'institutional-score',
    'institutional scoring',
    'GovernanceForecast',
    'GovernancePrediction',
    'InfluenceTopology',
    'OrganizationalIntelligence',
    'TrustScore',
    'BehaviouralGovernance',
    'GovernanceCommandSystem',
    'PredictiveGovernance',
    'CaucusAnalytics',
    'EfficiencyRating',
    'StabilityIndex',
    'WeightedDecision',
    'AverageCompliance',
  ])('rejects forbidden semantic shape: %s', (name) => {
    const shape = hasForbiddenSemanticShape(name)
    expect(shape.matched).toBe(true)
    expect(shape.token).toBeDefined()

    const verdict = classifyCanonicalizationProposal(name)
    expect(verdict.allowed).toBe(false)
    expect(verdict).toMatchObject({ reason: 'forbidden-semantic-shape' })
  })

  it.each([
    'Congress',
    'Federation',
    'BargainingUnit',
    'Committee',
    'Motion',
    'AFFILIATED_WITH',
    'REPRESENTS',
    'GOVERNED_BY',
    'Bylaw',
    'CBA',
  ])('does not flag legitimate hold-for-demand name as forbidden shape: %s', (name) => {
    expect(hasForbiddenSemanticShape(name).matched).toBe(false)
  })

  it('assertCanonicalizationAllowed reports the matched token', () => {
    expect(() => assertCanonicalizationAllowed('GovernanceScore')).toThrow(
      /score/i,
    )
  })
})

describe('Workstream I — hold-for-demand (Tier 3)', () => {
  it('IGG structural kinds are hold-for-demand, not absolutely denied', () => {
    expect(isHoldForDemand(IggEntityKinds.CONGRESS)).toBe(true)
    expect(isHoldForDemand(IggEntityKinds.FEDERATION)).toBe(true)
    expect(isHoldForDemand(IggRelationshipKinds.REPRESENTS)).toBe(true)
    expect(isProtectedCanonicalization(IggEntityKinds.CONGRESS)).toBe(false)
  })

  it('UMRC is never hold-for-demand (gap-fill keeps it in absolute deny-list)', () => {
    expect(isHoldForDemand(IggEntityKinds.UMRC)).toBe(false)
  })

  it('hold-for-demand verdict is reported and asserts loudly', () => {
    const verdict = classifyCanonicalizationProposal(IggEntityKinds.CONGRESS)
    expect(verdict).toMatchObject({
      allowed: false,
      reason: 'hold-for-demand',
    })
    expect(() => assertCanonicalizationAllowed(IggEntityKinds.CONGRESS)).toThrow(
      /substrate RFC/i,
    )
  })
})

describe('Workstream I — current canonical registry is clean', () => {
  it('no canonical OntologyEntityTypes value matches the absolute deny-list or a forbidden semantic shape', () => {
    const violations = findCanonicalizationViolations(
      Object.values(OntologyEntityTypes),
    )
    expect(violations).toEqual([])
  })

  it('no canonical RelationshipTypes value matches the absolute deny-list or a forbidden semantic shape', () => {
    const violations = findCanonicalizationViolations(
      Object.values(RelationshipTypes),
    )
    expect(violations).toEqual([])
  })

  it('canonical registry contains no IGG-namespaced kinds', () => {
    for (const v of Object.values(OntologyEntityTypes)) {
      expect(v.startsWith('igg:')).toBe(false)
    }
    for (const v of Object.values(RelationshipTypes)) {
      expect(v.startsWith('igg:')).toBe(false)
    }
  })
})

describe('Workstream I — duplication & semantic discipline', () => {
  it('no IGG entity kind is duplicated against the canonical registry by string', () => {
    const canonical = new Set<string>(Object.values(OntologyEntityTypes))
    for (const v of Object.values(IggEntityKinds)) {
      // IGG kinds are namespaced; if any ever drops the namespace and
      // collides with a canonical kind, this fails loudly.
      expect(canonical.has(v)).toBe(false)
    }
  })

  it('FORBIDDEN_SEMANTIC_TOKENS are non-empty, lower-case, and unique', () => {
    expect(FORBIDDEN_SEMANTIC_TOKENS.length).toBeGreaterThan(10)
    for (const token of FORBIDDEN_SEMANTIC_TOKENS) {
      expect(token).toBe(token.toLowerCase())
    }
    expect(new Set(FORBIDDEN_SEMANTIC_TOKENS).size).toBe(
      FORBIDDEN_SEMANTIC_TOKENS.length,
    )
  })

  it('HOLD_FOR_DEMAND list does not contain any protected kind', () => {
    for (const name of HOLD_FOR_DEMAND) {
      expect(isProtectedCanonicalization(name)).toBe(false)
    }
  })
})
