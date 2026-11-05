/**
 * Gate 0B.9 consistency control between a HIGH defect's release disposition and the operation records that cite it.
 * A defect whose recorded impact includes CROSS_TENANT_DISCLOSURE and whose activation state says an authenticated or
 * unauthenticated caller can reach it describes cross-tenant data that the route serves. Every operation record that
 * cites such a defect must therefore record crossTenantExposure true (never authorized) with an exposure contract,
 * instead of leaving the disposition and the record to disagree.
 */
const REACHABLE = ['REACHABLE_ANY_AUTHENTICATED', 'REACHABLE_UNAUTHENTICATED']

export const mustFlagCrossTenant = (defect) => {
  const disposition = defect?.releaseDisposition
  return Boolean(disposition?.potentialImpact?.classes?.includes('CROSS_TENANT_DISCLOSURE') && REACHABLE.includes(disposition.activationState))
}

/** Sets the exposure fields on a record from the dispositions of the defects it cites. */
export function applyCrossTenantExposure(record, defects) {
  const cited = defects.filter((defect) => (record.defects ?? []).includes(defect.id) && mustFlagCrossTenant(defect))
  if (cited.length === 0 || record.crossTenantExposure === true) return record
  record.crossTenantExposure = true
  record.crossTenantAuthorized = false
  record.exposureContract = `${cited[0].releaseDisposition.actualExposure} Reachable cross-tenant data is not authorized by being reachable.`
  return record
}

export function crossTenantFlagProblems(record, defectsById) {
  const problems = []
  for (const id of record.defects ?? []) {
    if (mustFlagCrossTenant(defectsById.get(id)) && record.crossTenantExposure !== true) {
      problems.push(`operation ${record.id} cites ${id}, whose disposition records CROSS_TENANT_DISCLOSURE reachable by a caller, but the record does not record crossTenantExposure`)
    }
  }
  return problems
}
