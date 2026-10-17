// Separate institutional vocabulary; commerce Product and legacy relations are unchanged.
export const institutionalKinds = [
  'Institution', 'Portfolio', 'InstitutionalProduct', 'Capability', 'Service',
  'SharedPlatformPrimitive', 'Integration', 'InfrastructureDependency', 'ExternalDependency',
  'HumanAssignment', 'Mission', 'OperationalChange', 'DeploymentChange', 'GovernanceRationale',
  'Raid', 'Incident', 'Problem', 'SpecialistEngagement', 'Benefit', 'Evidence',
] as const
export type InstitutionalKind = typeof institutionalKinds[number]
export const institutionalRelations = [
  'HAS', 'BELONGS_TO', 'CONSUMES', 'DEPENDS_ON', 'PROVIDES', 'OPERATES',
  'OWNS', 'AFFECTS', 'IMPLEMENTS', 'SUPPORTED_BY', 'REFERENCES',
] as const
export type InstitutionalRelation = typeof institutionalRelations[number]

const estate = ['InstitutionalProduct', 'Capability', 'Service', 'SharedPlatformPrimitive',
  'Integration', 'InfrastructureDependency', 'ExternalDependency']
const work = ['Mission', 'OperationalChange', 'DeploymentChange', 'GovernanceRationale', 'Raid', 'Benefit']
const consumption: Record<string, readonly string[]> = {
  InstitutionalProduct: ['Capability'],
  Capability: ['Service'],
  Service: ['Service', 'SharedPlatformPrimitive', 'Integration', 'InfrastructureDependency', 'ExternalDependency'],
}
export function institutionalRelationshipAllowed(from: string, relation: InstitutionalRelation, to: string): boolean {
  switch (relation) {
    case 'HAS': return (from === 'Institution' && to === 'Portfolio')
      || (from === 'Portfolio' && to === 'InstitutionalProduct') || (from === 'InstitutionalProduct' && to === 'Capability')
    case 'BELONGS_TO': return institutionalRelationshipAllowed(to, 'HAS', from)
    case 'CONSUMES': return consumption[from]?.includes(to) ?? false
    case 'DEPENDS_ON': return (consumption[from]?.includes(to) ?? false)
      || (work.includes(from) && to === 'Raid') || (from === 'Raid' && [...work, ...estate].includes(to))
    case 'PROVIDES': return (from === 'Service' && to === 'Capability')
      || (from === 'SharedPlatformPrimitive' && to === 'Service')
    case 'OPERATES': return from === 'Institution' && ['InstitutionalProduct', 'Service'].includes(to)
    case 'OWNS': return ['Institution', 'HumanAssignment'].includes(from) && [...estate, 'Portfolio'].includes(to)
    case 'AFFECTS': return ['OperationalChange', 'DeploymentChange', 'Incident', 'Raid'].includes(from)
      && [...estate, 'OperationalChange', 'DeploymentChange'].includes(to)
    case 'IMPLEMENTS': return ['Mission', 'OperationalChange'].includes(from) && ['Capability', 'GovernanceRationale'].includes(to)
    case 'SUPPORTED_BY': return work.includes(from) && ['Evidence', 'Recommendation', 'OutputAcceptance'].includes(to)
    case 'REFERENCES': return [...work, 'Incident', 'Problem', 'SpecialistEngagement'].includes(from)
      && [...work, ...estate, 'SpecialistEngagement', 'Incident', 'Problem'].includes(to)
  }
}
