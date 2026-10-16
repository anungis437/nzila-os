/**
 * Personal-data work stays closed. Phase 2.5 evaluated the platform controls
 * and recorded HOLD. The evaluation does not open Phase 3 and does not store
 * personal data. Findings live in privacy-readiness.ts and the doctrine docs.
 */

export const PERSONAL_DATA_CONTROLS = [
  'tenancy',
  'authorization',
  'encryption',
  'audit',
  'retention',
  'secrets',
  'logging',
  'backups',
  'export',
  'deletion',
  'provenance',
  'least-privilege',
] as const

export type PersonalDataControl = (typeof PERSONAL_DATA_CONTROLS)[number]

export interface ControlEvaluation {
  readonly control: PersonalDataControl
  readonly status: 'EVALUATED_INSUFFICIENT_FOR_PHASE_3'
}

export const PERSONAL_DATA_GATE = {
  personalDataWorkPermitted: false,
  evaluationStatus: 'EVALUATED_HOLD',
  phase3: 'CLOSED',
  disposition: 'HOLD',
  controls: PERSONAL_DATA_CONTROLS.map(
    (control): ControlEvaluation => ({
      control,
      status: 'EVALUATED_INSUFFICIENT_FOR_PHASE_3',
    }),
  ),
} as const

export function personalDataWorkAllowed(): false {
  return PERSONAL_DATA_GATE.personalDataWorkPermitted
}
