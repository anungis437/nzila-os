import { describe, expect, it } from 'vitest'
import {
  buildCanonicalSidebar,
  cadenceFor,
  CANONICAL_GROUPS,
  CANONICAL_REVIEW_WORKFLOWS,
  CANONICAL_ROLES,
  containsRefusedVocabulary,
  defineTerm,
  executiveSurfaceContract,
  getCanonicalIATree,
  getCanonicalOperatorPathway,
  getGovernanceEmbodimentChecklist,
  getRoleExperience,
  isCanonicalGroupLabel,
  workflowContract,
} from '../index'

describe('canonical IA', () => {
  it('exposes the eight canonical groups in declaration order', () => {
    expect(CANONICAL_GROUPS).toEqual([
      'work',
      'priority',
      'outcomes',
      'intelligence',
      'governance',
      'rollout',
      'evidence',
      'attestations',
    ])
    expect(getCanonicalIATree()).toHaveLength(8)
  })

  it('returns a non-empty operator pathway entirely under governance', () => {
    const pathway = getCanonicalOperatorPathway()
    expect(pathway.length).toBeGreaterThan(0)
    for (const step of pathway) expect(step.group).toBe('governance')
  })
})

describe('glossary', () => {
  it('resolves canonical terms', () => {
    expect(defineTerm('governance').meaning).toMatch(/cited authority/i)
  })
  it('refuses non-canonical terms', () => {
    expect(() => defineTerm('vibes')).toThrowError(/non_canonical_term/)
  })
  it('flags refused vocabulary', () => {
    expect(containsRefusedVocabulary('the productivity score')).toBe(true)
    expect(containsRefusedVocabulary('the calm posture reading')).toBe(false)
  })
})

describe('roles', () => {
  it('exposes a stable role registry', () => {
    expect(CANONICAL_ROLES).toContain('executive')
    expect(CANONICAL_ROLES).toContain('procurement-observer')
  })
  it('returns a bounded experience for each role', () => {
    for (const role of CANONICAL_ROLES) {
      const xp = getRoleExperience(role)
      expect(xp.visibleGroups.length).toBeGreaterThan(0)
      expect(xp.refusedContent.length).toBeGreaterThan(0)
    }
  })
})

describe('workflows', () => {
  it('lists all eight canonical workflows', () => {
    expect(CANONICAL_REVIEW_WORKFLOWS).toHaveLength(8)
  })
  it('returns a contract with at least one decision shape and a cited doctrine', () => {
    for (const w of CANONICAL_REVIEW_WORKFLOWS) {
      const c = workflowContract(w)
      expect(c.decisions.length).toBeGreaterThan(0)
      expect(c.requiredCitation).toMatch(/^docs\//)
    }
  })
})

describe('cadence', () => {
  it('refuses sub-minute governance refresh', () => {
    expect(cadenceFor('governance-posture-refresh').minIntervalMs).toBeGreaterThanOrEqual(60_000)
  })
  it('refuses auto-refresh on review sessions', () => {
    expect(cadenceFor('review-session').autoRefresh).toBe(false)
  })
})

describe('navigation', () => {
  it('builds a sidebar bounded by the role visible groups', () => {
    const sidebar = buildCanonicalSidebar('executive')
    const groups = sidebar.map((s) => s.group)
    expect(groups).toEqual(['priority', 'outcomes', 'intelligence', 'governance'])
  })
  it('inserts product overlay children inside canonical groups', () => {
    const sidebar = buildCanonicalSidebar('governance-operator', {
      governance: [{ label: 'Pilot governance', href: '/governance/pilot' }],
    })
    const governance = sidebar.find((g) => g.group === 'governance')
    expect(governance?.children.some((c) => c.href === '/governance/pilot')).toBe(true)
  })
  it('classifies canonical group labels case-insensitively', () => {
    expect(isCanonicalGroupLabel('Governance')).toBe(true)
    expect(isCanonicalGroupLabel('Action Center')).toBe(false)
  })
})

describe('embodiment', () => {
  it('returns the governance embodiment checklist', () => {
    const list = getGovernanceEmbodimentChecklist()
    expect(list.length).toBeGreaterThan(5)
    expect(list.every((r) => r.id && r.description)).toBe(true)
  })
})

describe('executive', () => {
  it('returns the executive briefing contract with bounded reading', () => {
    const c = executiveSurfaceContract('executive-briefing')
    expect(c.maxCards).toBeLessThanOrEqual(6)
    expect(c.maxDecisionsPerSession).toBe(1)
    expect(c.autoRefresh).toBe(false)
  })
  it('falls back to a bounded default contract for unknown surfaces', () => {
    const c = executiveSurfaceContract('unknown-surface-xyz')
    expect(c.maxDecisionsPerSession).toBe(1)
    expect(c.autoRefresh).toBe(false)
  })
})
