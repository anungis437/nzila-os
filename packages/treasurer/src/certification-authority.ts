/**
 * Certification authority for TREASURER.
 * This module emits an implementer assessment only.
 * It cannot set TREASURER_CERTIFIED or FLEET_CERTIFIED to YES.
 */

export type ImplementerAssessment = 'IMPLEMENTER_PASS' | 'IMPLEMENTER_FAIL'

export interface CertificationSpoof {
  readonly TREASURER_CERTIFIED?: string
  readonly FLEET_CERTIFIED?: string
  readonly IMPLEMENTER_ASSESSMENT?: string
}

export interface SpoofRejection {
  readonly accepted: false
  readonly TREASURER_CERTIFIED: 'NO'
  readonly FLEET_CERTIFIED: 'NO'
  readonly code: 'CERT_SPOOF_REJECTED' | 'CERT_NOT_ISSUABLE'
}

/** An implementer pass is not fleet certification. */
export function fleetCertifiedFromImplementerAssessment(_assessment: ImplementerAssessment): 'NO' {
  return 'NO'
}

/** A local red-team pass is not fleet certification. */
export function fleetCertifiedFromLocalRedTeam(_localPass: boolean): 'NO' {
  return 'NO'
}

/** Package tests passing is not fleet certification. */
export function fleetCertifiedFromPackageTests(_packagePass: boolean): 'NO' {
  return 'NO'
}

/**
 * Independent VERIFIER NO forces certified NO.
 * This function does not accept a YES verdict. The package cannot record one.
 */
export function certifiedFromVerifierVerdict(verdict: 'NO'): 'NO' {
  if (verdict === 'NO') return 'NO'
  return 'NO'
}

/** A submitted YES is discarded. The returned record stays NO. */
export function rejectCertificationSpoof(candidate: CertificationSpoof): SpoofRejection {
  const spoofed = candidate.TREASURER_CERTIFIED === 'YES' || candidate.FLEET_CERTIFIED === 'YES'
  return {
    accepted: false,
    TREASURER_CERTIFIED: 'NO',
    FLEET_CERTIFIED: 'NO',
    code: spoofed ? 'CERT_SPOOF_REJECTED' : 'CERT_NOT_ISSUABLE',
  }
}

/** True when canonical text assigns fleet certification to YES. */
export function canonicalCertificationHasStaleYes(text: string): boolean {
  return /TREASURER_CERTIFIED"\s*:\s*"YES"|FLEET_CERTIFIED"\s*:\s*"YES"|TREASURER_CERTIFIED:\s*YES|FLEET_CERTIFIED:\s*YES/.test(
    text,
  )
}
