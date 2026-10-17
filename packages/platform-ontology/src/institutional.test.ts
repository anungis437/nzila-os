import { describe, expect, it } from 'vitest'
import { institutionalKinds, institutionalRelationshipAllowed } from './institutional'

describe('separate institutional ontology vocabulary', () => {
  it('does not cast commerce Product to InstitutionalProduct', () => {
    expect(institutionalKinds).toContain('InstitutionalProduct')
    expect(institutionalRelationshipAllowed('Product', 'DEPENDS_ON', 'Capability')).toBe(false)
  })
  it('allows directed consumption/dependency without granting inverse causation', () => {
    expect(institutionalRelationshipAllowed('InstitutionalProduct', 'CONSUMES', 'Capability')).toBe(true)
    expect(institutionalRelationshipAllowed('Capability', 'DEPENDS_ON', 'Service')).toBe(true)
    expect(institutionalRelationshipAllowed('Service', 'DEPENDS_ON', 'ExternalDependency')).toBe(true)
    expect(institutionalRelationshipAllowed('ExternalDependency', 'AFFECTS', 'InstitutionalProduct')).toBe(false)
  })
  it('distinguishes ownership, evidence, intended implementation and non-authoritative references', () => {
    expect(institutionalRelationshipAllowed('HumanAssignment', 'OWNS', 'Service')).toBe(true)
    expect(institutionalRelationshipAllowed('Mission', 'IMPLEMENTS', 'Capability')).toBe(true)
    expect(institutionalRelationshipAllowed('GovernanceRationale', 'SUPPORTED_BY', 'Evidence')).toBe(true)
    expect(institutionalRelationshipAllowed('OperationalChange', 'REFERENCES', 'DeploymentChange')).toBe(true)
    expect(institutionalRelationshipAllowed('SpecialistEngagement', 'OWNS', 'Service')).toBe(false)
  })
})
