/**
 * Personal-data work stays closed until tenancy, authorization, encryption,
 * audit, retention, secrets, logging, backups, export, deletion, provenance,
 * and least privilege have been evaluated for that purpose.
 * This phase does not perform that evaluation and does not store personal data.
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
  readonly status: 'NOT_EVALUATED_FOR_PERSONAL_DATA'
}

export const PERSONAL_DATA_GATE = {
  personalDataWorkPermitted: false,
  evaluationStatus: 'NOT_PERFORMED',
  controls: PERSONAL_DATA_CONTROLS.map(
    (control): ControlEvaluation => ({
      control,
      status: 'NOT_EVALUATED_FOR_PERSONAL_DATA',
    }),
  ),
} as const

export function personalDataWorkAllowed(): false {
  return PERSONAL_DATA_GATE.personalDataWorkPermitted
}
