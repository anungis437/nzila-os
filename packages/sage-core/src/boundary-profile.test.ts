import { describe, it, expect } from 'vitest'
import { deriveSageBoundaryProfile } from './boundary-profile.js'

describe('deriveSageBoundaryProfile', () => {
  it('always includes the baseline prohibitions, human review, and export gating', () => {
    const bp = deriveSageBoundaryProfile('department_ministry', 'general_governance')
    expect(bp.institutionType).toBe('department_ministry')
    expect(bp.riskSurface).toBe('general_governance')
    expect(bp.prohibitedUses).toEqual(
      expect.arrayContaining([
        'no automated decisions',
        'no scoring/ranking',
        'no certification',
        'no public availability/procurement claim',
      ]),
    )
    expect(bp.requiredReviewers).toContain('human review required')
    expect(bp.exportRestrictions).toContain('export gated')
    // General profile has no institution-specific source exclusions.
    expect(bp.excludedSourceClasses).toEqual([])
  })

  it('excludes regulatory case material for regulator + regulatory_boundary', () => {
    const bp = deriveSageBoundaryProfile('regulator', 'regulatory_boundary')
    expect(bp.excludedSourceClasses).toEqual(
      expect.arrayContaining([
        'investigation',
        'enforcement',
        'inspection',
        'licensing',
        'adjudicative',
        'regulated-entity case materials',
      ]),
    )
  })

  it('excludes tribunal/ombuds case material', () => {
    const bp = deriveSageBoundaryProfile(
      'tribunal_ombuds_accountability',
      'tribunal_ombuds_boundary',
    )
    expect(bp.excludedSourceClasses).toEqual(
      expect.arrayContaining([
        'complaint files',
        'investigation files',
        'protected disclosures',
        'findings',
        'reasons',
        'recommendations',
        'remedies',
        'case outcomes',
      ]),
    )
  })

  it('excludes editorial/journalistic material for public broadcaster', () => {
    const bp = deriveSageBoundaryProfile(
      'public_broadcaster_cultural',
      'public_broadcaster_boundary',
    )
    expect(bp.excludedSourceClasses).toEqual(
      expect.arrayContaining(['editorial', 'journalistic', 'source-protection', 'newsroom']),
    )
  })

  it('defers PHI/clinical material for health + health_phi_deferred', () => {
    const bp = deriveSageBoundaryProfile('health_public_health', 'health_phi_deferred')
    expect(bp.excludedSourceClasses).toEqual(
      expect.arrayContaining(['PHI', 'patient data', 'clinical records']),
    )
    expect(bp.prohibitedUses).toContain('no health-system readiness claim')
  })

  it('excludes student records for education', () => {
    const bp = deriveSageBoundaryProfile('education', 'student_records_boundary')
    expect(bp.excludedSourceClasses).toContain('individual student records')
  })

  it('excludes electoral/voter material for elections', () => {
    const bp = deriveSageBoundaryProfile('elections_democratic', 'elections_security_boundary')
    expect(bp.excludedSourceClasses).toEqual(
      expect.arrayContaining(['electoral decisions', 'voter records']),
    )
  })

  it('excludes operational/investigative material for police/enforcement', () => {
    const bp = deriveSageBoundaryProfile(
      'police_enforcement_corrections',
      'enforcement_corrections_boundary',
    )
    expect(bp.excludedSourceClasses).toEqual(
      expect.arrayContaining(['operational files', 'investigations', 'intelligence']),
    )
  })

  it('is relationship-led and protocol-respecting for Indigenous institutions', () => {
    const bp = deriveSageBoundaryProfile(
      'indigenous_government_or_service',
      'indigenous_protocol_boundary',
    )
    expect(bp.requiredReviewers).toEqual(
      expect.arrayContaining(['relationship lead', 'protocol lead']),
    )
    expect(bp.prohibitedUses).toEqual(
      expect.arrayContaining(['no assumption of authority', 'no assumption of data access']),
    )
  })

  it('returns a structured object, never a free-text string', () => {
    const bp = deriveSageBoundaryProfile('crown_corporation', 'implementation_continuity')
    expect(typeof bp).toBe('object')
    expect(Array.isArray(bp.prohibitedUses)).toBe(true)
    expect(Array.isArray(bp.excludedSourceClasses)).toBe(true)
  })
})
