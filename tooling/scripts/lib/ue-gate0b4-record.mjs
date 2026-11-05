/**
 * Shared record construction for the Gate 0B.4 fact modules. The fact modules state the classification in short keys;
 * this module expands them into the record fields the validator checks. Nothing here adds a claim: each field is
 * either stated by the fact module or the neutral default for an empty list.
 */

export const SESSION = 'Entra session resolved by the route wrapper'

/** Expands the short keys into the validator's record fields. */
export function mk(s) {
  const out = {
    persona: s.persona,
    serviceOwner: s.service,
    authenticationMechanism: s.authn,
    authorizationCategory: s.cat ?? 'ROLE_FLOOR',
    kernelAuthorization: false,
    authorizationDetail: s.authz,
    tenantScope: s.tenant,
    dataOwnership: s.owner,
    dataSensitivity: s.sens,
    privacyDisclosure: s.priv,
    mutationAudit: s.mut ?? 'NOT_MUTATING',
    auditDetail: s.auditDetail,
    requiredAudit: s.reqAudit,
    implementedBehavior: s.does,
    implementationStatus: s.status ?? 'IMPLEMENTED_IN_SOURCE',
    requiredGate: s.gate,
    dependencyGates: s.deps ?? [],
    requiredFutureGuard: s.future,
    institutionalDecisions: s.dec ?? [],
    evidence: s.ev,
    inferences: s.inf ?? [],
    defects: [...new Set(s.def ?? [])],
    manifestCorrections: s.corr ?? [],
  }
  if (s.nonMutationReason) out.nonMutationReason = s.nonMutationReason
  if (s.crudTable) {
    out.crudTable = s.crudTable
    out.crudGovernanceClass = s.crudClass
  }
  if (s.cross) {
    out.crossTenantExposure = true
    out.crossTenantAuthorized = false
    out.exposureContract = s.cross
  }
  return out
}

export const evKinds = (items) => items.filter(Boolean)
