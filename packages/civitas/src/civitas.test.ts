import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  CIVITAS_IDENTITY,
  DOCTRINE_RULES,
  EXPOSURE_DIMENSIONS,
  AUTONOMY_BENEFIT_DIMENSIONS,
  FLEET_INTERACTION,
  FUTURE_DOMAIN_CONCEPTS,
  LEVEL_8_TARGET,
  analyze,
  exerciseAuthorities,
  grantPeerPermission,
  isCanonicalDoctrine,
  personalDataWorkAllowed,
  proposeDoctrine,
  scoreCannotOverrideProhibition,
  supportForProposition,
  suppressRedTeamChallenge,
  treatScoutDiscovery,
} from './index'
import type { AnalysisInput, CivitasEvidence } from './index'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..')

const AS_OF = '2026-10-16T00:00:00.000Z'

function evidence(tier: CivitasEvidence['tier'], currentness: CivitasEvidence['temporal']['currentness']): CivitasEvidence {
  return {
    ref: {
      type: tier <= 2 ? 'policy' : 'artifact',
      ref_id: `synthetic-source-tier-${tier}`,
      summary: 'Synthetic source. No personal record.',
    },
    tier,
    propositionId: 'prop-synthetic',
    temporal: {
      lawAsOf: '2026-01-01',
      verifiedAsOf: currentness === 'CURRENTLY_VERIFIED' ? '2026-02-01' : null,
      currentness,
    },
  }
}

function input(overrides: Partial<AnalysisInput> = {}): AnalysisInput {
  return {
    orgId: 'org-synthetic-civitas',
    decisionId: 'decision-synthetic-1',
    asOf: AS_OF,
    objective: 'Choose a lawful way to organize a synthetic record.',
    facts: ['A synthetic organization exists on paper and in its register.'],
    jurisdiction: 'CA-QC',
    authority: 'Advisory analysis under the statutes and civil code that apply. No filing authority.',
    mandatoryLayer: ['Registered particulars must match the substance of the organization.'],
    discretionaryLayer: ['The organizer may choose the order in which lawful options are documented.'],
    options: ['Document the existing register entry.', 'Leave the record unchanged.'],
    effects: {
      control: 'The organizer keeps the choice among disclosed options.',
      privacy: 'No personal record is stored.',
      tax: 'No tax position is taken.',
      liability: 'No liability is transferred.',
      continuity: 'The register entry remains available.',
    },
    reversibility: 'The choice can be revisited before any filing.',
    evidence: [evidence(1, 'CURRENTLY_VERIFIED')],
    propositionId: 'prop-synthetic',
    uncertainty: ['No dispute is pending in this synthetic matter.'],
    professionalGate: [],
    recommendation: 'Document the existing register entry and make no filing.',
    matterKind: 'record_organization',
    ...overrides,
  }
}

describe('fleet registration', () => {
  it('recognizes CIVITAS as a specialist in the platform registry', () => {
    const registry = JSON.parse(
      readFileSync(join(REPO_ROOT, 'platform/registry/platform-registry.json'), 'utf8'),
    ) as { shared_packages: Array<{ name: string }> }
    expect(registry.shared_packages.some((entry) => entry.name === 'civitas')).toBe(true)
    expect(CIVITAS_IDENTITY.name).toBe('CIVITAS')
    expect(CIVITAS_IDENTITY.role).toBe('Lawful Autonomy, Jurisdiction & Continuity')
    expect(CIVITAS_IDENTITY.agentClass).toBe('Specialist')
    expect(CIVITAS_IDENTITY.defaultJurisdiction).toBe('CA-QC')
    expect(CIVITAS_IDENTITY.authority).toBe('advisory-and-analytical')
    expect(CIVITAS_IDENTITY.executionAuthority).toBe('none')
  })

  it('does not introduce a deployment capability', () => {
    const pkg = JSON.parse(readFileSync(join(HERE, '../package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(CIVITAS_IDENTITY.deploymentCapability).toBe(false)
    expect(Object.keys(pkg.scripts).join(' ')).not.toMatch(/deploy|ship|migrate/)
    expect(Object.values(pkg.scripts).join(' ')).not.toMatch(/deploy|ship/)
  })
})

describe('authority', () => {
  it('refuses execution even when an advisory act is requested with it', () => {
    const result = exerciseAuthorities(['advise', 'deploy', 'merge', 'financial_transaction', 'filing', 'signing'])
    expect(result.ok).toBe(false)
    expect(result.code).toBe('AUTHORITY_EXCEEDED')
    expect(result.executionAuthority).toBe('none')
    expect(result.granted).toEqual([])
  })

  it('records advisory analysis without execution', () => {
    const result = exerciseAuthorities(['advise', 'analyze'])
    expect(result.ok).toBe(true)
    expect(result.executionAuthority).toBe('none')
  })
})

describe('doctrine and pseudolaw', () => {
  it('keeps the fifteen doctrine rules closed', () => {
    expect(DOCTRINE_RULES).toHaveLength(15)
    expect(isCanonicalDoctrine('Law before folklore.')).toBe(true)
    const recognized = proposeDoctrine('CIVITAS never represents itself as counsel of record.')
    expect(recognized.accepted).toBe(true)
    const novel = proposeDoctrine('A new custom should bind as if it were a statute.')
    expect(novel.accepted).toBe(false)
    if (!novel.accepted && novel.decisionClass === null) {
      expect(novel.code).toBe('DOCTRINE_CLOSED')
    }
  })

  it('rejects pseudolaw so it cannot become doctrine', () => {
    const rejected = proposeDoctrine('I am a sovereign citizen and I withdraw from statutory jurisdiction.')
    expect(rejected.accepted).toBe(false)
    if (!rejected.accepted && rejected.decisionClass === 'BLACK') {
      expect(rejected.faultyDoctrine).toMatch(/Sovereign-citizen/)
      expect(rejected.whyItFails.length).toBeGreaterThan(0)
      expect(rejected.legitimateUnderlyingIssue.length).toBeGreaterThan(0)
      expect(rejected.lawfulMechanism.length).toBeGreaterThan(0)
    } else {
      throw new Error('pseudolaw was not rejected as BLACK')
    }
  })

  it('rejects a prohibited mechanism inside an analysis and offers a lawful pathway', () => {
    const result = analyze(input({
      recommendation: 'Transfer the asset to defeat creditors.',
      mechanismText: 'This is a fraudulent conveyance.',
    }))
    expect(result.ok).toBe(false)
    expect(result.decisionClass).toBe('BLACK')
    expect(result.executionAuthority).toBe('none')
    expect(result.counselOfRecord).toBe(false)
    expect(result.lawfulPathway).toMatch(/disclosed/)
    expect(result.projection).toBeNull()
  })
})

describe('evidence hierarchy', () => {
  it('does not let unverified tier 4 establish a material proposition', () => {
    const support = supportForProposition([evidence(4, 'UNVERIFIED')], 'prop-synthetic')
    expect(support.established).toBe(false)
    expect(support.reason).toBe('TIER_4_CANNOT_ESTABLISH')
    expect(support.advisoryOnly).toBe(true)

    const concluded = analyze(input({ evidence: [evidence(4, 'UNVERIFIED')] }))
    expect(concluded.ok).toBe(false)
    expect(concluded.code).toBe('TIER_4_CANNOT_ESTABLISH')
    expect(concluded.epistemicLabel).toBe('UNRESOLVED')
  })

  it('keeps provenance and distinguishes law on a date from current verification', () => {
    const dated = supportForProposition([evidence(1, 'LAW_ON_DATE')], 'prop-synthetic')
    expect(dated.established).toBe(true)
    expect(dated.currentlyVerified).toBe(false)
    expect(dated.provenance[0]?.ref_id).toBe('synthetic-source-tier-1')
    expect(dated.epistemicLabel).toBe('INFERENCE')

    const missingVerification = supportForProposition(
      [{ ...evidence(2, 'LAW_ON_DATE'), temporal: { lawAsOf: '2026-01-01', verifiedAsOf: null, currentness: 'CURRENTLY_VERIFIED' } }],
      'prop-synthetic',
    )
    expect(missingVerification.established).toBe(false)
    expect(missingVerification.reason).toBe('CURRENTNESS_UNPROVEN')
  })
})

describe('professional gate and governance', () => {
  it('requires the professional gate and VERIFIER review for a RED matter', () => {
    const missing = analyze(input({ matterKind: 'tax_restructuring', professionalGate: [] }))
    expect(missing.ok).toBe(false)
    expect(missing.code).toBe('PROFESSIONAL_GATE_REQUIRED')
    expect(missing.professionalGate).toEqual(['tax_specialist', 'cpa'])
    expect(missing.verifierReviewRequired).toBe(true)

    const handedOff = analyze(input({
      matterKind: 'tax_restructuring',
      professionalGate: ['tax_specialist', 'cpa'],
      objective: 'Prepare a handoff for a synthetic tax question.',
    }))
    expect(handedOff.ok).toBe(true)
    expect(handedOff.decisionClass).toBe('RED')
    expect(handedOff.epistemicLabel).toBe('PROFESSIONAL_DETERMINATION_REQUIRED')
    expect(handedOff.projection?.status).toBe('PENDING_REVIEW')
    expect(handedOff.projection?.policy_context.execution_allowed).toBe(false)
    expect(handedOff.projection?.review_required).toBe(true)
    expect(handedOff.projection?.required_approvals).toEqual(['tax_specialist', 'cpa'])
  })

  it('keeps execution disabled on a GREEN advisory choice', () => {
    const result = analyze(input())
    expect(result.ok).toBe(true)
    expect(result.decisionClass).toBe('GREEN')
    expect(result.executionAuthority).toBe('none')
    expect(result.counselOfRecord).toBe(false)
    expect(result.projection?.policy_context.execution_allowed).toBe(false)
    expect(result.projection?.status).not.toBe('EXECUTED')
    expect(result.projection?.domain).toBe('legal')
  })

  it('does not apply a default jurisdiction in silence', () => {
    const missing = analyze(input({ jurisdiction: undefined, useDefaultJurisdiction: false }))
    expect(missing.ok).toBe(false)
    expect(missing.code).toBe('JURISDICTION_BEFORE_CONCLUSION')
    const explicitDefault = analyze(input({ jurisdiction: undefined, useDefaultJurisdiction: true }))
    expect(explicitDefault.ok).toBe(true)
    expect(explicitDefault.jurisdiction).toBe('CA-QC')
  })

  it('leaves the sovereignty-proving gate in place', () => {
    const gates = JSON.parse(
      readFileSync(join(REPO_ROOT, 'governance/gates/gate-authority-registry.json'), 'utf8'),
    ) as { gates?: Array<{ id: string }> }
    const ids = (gates.gates ?? []).map((gate) => gate.id)
    expect(ids).toContain('validate-sovereignty-proving')
    expect(CIVITAS_IDENTITY.inheritsGovernanceControls).toContain('execution-allowed-false')
    expect(CIVITAS_IDENTITY.inheritsGovernanceControls).toContain('human-review-authoritative')
  })
})

describe('fleet obligations', () => {
  it('does not grant permissions to any other member', () => {
    expect(grantPeerPermission('BUILDER', 'deploy').ok).toBe(false)
    expect(grantPeerPermission('FORGE', 'legal_decision').ok).toBe(false)
    for (const peer of FLEET_INTERACTION) {
      expect(peer.permissionsGrantedByCivitas).toEqual([])
      expect(peer.legalDecisionAuthorityGranted).toBe(false)
    }
    expect(suppressRedTeamChallenge().suppressed).toBe(false)
  })

  it('keeps SCOUT discovery unverified until acceptance', () => {
    expect(treatScoutDiscovery({ verifiedByScout: true, acceptedBy: null }).verified).toBe(false)
    expect(treatScoutDiscovery({ verifiedByScout: false, acceptedBy: 'VERIFIER' }).verified).toBe(true)
  })

  it('does not change the executive-os agent key set', () => {
    const expected = [
      'audit',
      'chief-of-staff',
      'chief-of-staff-v2',
      'collections',
      'controller',
      'coo',
      'cross-domain-synthesis',
      'cs-renewal',
      'finops',
      'fpa',
      'grants',
      'hiring',
      'internal-cfo',
      'knowledge-steward',
      'legal',
      'partnerships',
      'pmo',
      'portfolio-allocator',
      'product-strategy',
      'release-guard',
      'reliability',
      'revops',
      'security',
      'tax',
      'treasury',
    ]
    const agentsDir = join(REPO_ROOT, 'packages/executive-os/src/agents')
    const keys = readdirSync(agentsDir)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .flatMap((name) => {
        const source = readFileSync(join(agentsDir, name), 'utf8')
        return [...source.matchAll(/key: '([^']+)'/g)].map((match) => match[1] ?? '')
      })
      .filter((key) => key.length > 0)
      .sort()
    expect(keys).toEqual(expected)
    expect(keys).not.toContain('civitas')
  })
})

describe('future path without new primitives', () => {
  it('maps later concepts onto existing primitives or leaves them target-only', () => {
    expect(FUTURE_DOMAIN_CONCEPTS.every((concept) => concept.introducesPrimitive === false)).toBe(true)
    expect(FUTURE_DOMAIN_CONCEPTS.every((concept) => concept.standingRegister === false)).toBe(true)
    expect(LEVEL_8_TARGET.implemented).toBe(false)
    expect(personalDataWorkAllowed()).toBe(false)
    expect(scoreCannotOverrideProhibition({ autonomy: 1 }, true)).toBe(true)
    expect(AUTONOMY_BENEFIT_DIMENSIONS.length).toBeGreaterThan(0)
    expect(EXPOSURE_DIMENSIONS.length).toBeGreaterThan(0)
  })

  it('uses synthetic identifiers only', () => {
    const files = readdirSync(HERE).filter((name) => name.endsWith('.ts'))
    const corpus = files.map((name) => readFileSync(join(HERE, name), 'utf8')).join('\n')
    expect(corpus).not.toMatch(/@[a-z0-9.-]+\.(com|ca|net|org)\b/i)
    expect(corpus).toContain('org-synthetic-civitas')
  })
})
