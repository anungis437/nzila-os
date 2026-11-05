/**
 * Gate 0B.10 consistency control between a HIGH defect's release disposition and the operation records that cite it.
 * Gate 0B.9 required the exposure flag only where a signed-in or unauthenticated caller reaches cross-tenant data.
 * Gate 0B.10 widens it to every reachable activation state: a defect whose recorded impact includes
 * CROSS_TENANT_DISCLOSURE and whose activation state is any REACHABLE_* state (including a role-restricted caller, who
 * is an administrator of some other organization) describes cross-tenant data that the route serves. Every operation
 * record that cites it must record crossTenantExposure true (never authorized) with an exposure contract.
 */
const REACHABLE = ['REACHABLE_ANY_AUTHENTICATED', 'REACHABLE_UNAUTHENTICATED', 'REACHABLE_ROLE_RESTRICTED', 'REACHABLE_ENTITLEMENT_GATED']

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
  if (record.crossTenantExposure === true && record.crossTenantAuthorized !== false) problems.push(`operation ${record.id} records a cross-tenant exposure that is not marked unauthorized`)
  return problems
}
