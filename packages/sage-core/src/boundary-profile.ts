// ─── @nzila/sage-core — boundary-profile derivation ──────────────────────────
// deriveSageBoundaryProfile(institutionType, riskSurface) returns a structured
// boundary profile (not free text). The default/general profile always applies;
// institution-type + risk-surface pairs layer on additional exclusions.
// Source doctrine: docs/public-service/public-institution-adaptation-framework.md.

import type { SageBoundaryProfile, SageInstitutionType, SageRiskSurface } from './types.js'

// Baseline prohibitions that apply to every SAGE workspace regardless of type.
const BASE_PROHIBITED_USES: readonly string[] = [
  'no automated decisions',
  'no scoring/ranking',
  'no certification',
  'no public availability/procurement claim',
]

const BASE_REQUIRED_REVIEWERS: readonly string[] = ['human review required']

const BASE_EXPORT_RESTRICTIONS: readonly string[] = ['export gated']

type BoundaryExtension = {
  excludedSourceClasses?: string[]
  prohibitedUses?: string[]
  requiredReviewers?: string[]
  exportRestrictions?: string[]
  notes?: string[]
}

// Institution-type + risk-surface specific extensions.
const EXTENSIONS: Partial<Record<`${SageInstitutionType}:${SageRiskSurface}`, BoundaryExtension>> = {
  'regulator:regulatory_boundary': {
    excludedSourceClasses: [
      'investigation',
      'enforcement',
      'inspection',
      'licensing',
      'adjudicative',
      'regulated-entity case materials',
    ],
    notes: ['regulatory independence must be preserved'],
  },
  'tribunal_ombuds_accountability:tribunal_ombuds_boundary': {
    excludedSourceClasses: [
      'complaint files',
      'investigation files',
      'protected disclosures',
      'evidence records',
      'findings',
      'reasons',
      'recommendations',
      'remedies',
      'case outcomes',
    ],
    notes: ['adjudicative independence must be preserved'],
  },
  'public_broadcaster_cultural:public_broadcaster_boundary': {
    excludedSourceClasses: [
      'editorial',
      'journalistic',
      'creative',
      'programming',
      'source-protection',
      'newsroom',
      'ombudsman-process materials',
    ],
    notes: ['editorial/journalistic independence excluded unless separately authorized and reviewed'],
  },
  'health_public_health:health_phi_deferred': {
    excludedSourceClasses: ['PHI', 'patient data', 'clinical records'],
    prohibitedUses: ['no health-system readiness claim'],
    notes: ['deferred: no PHI/clinical material without separate approved phase'],
  },
  'education:student_records_boundary': {
    excludedSourceClasses: [
      'individual student records',
      'adjudicative/disciplinary materials',
    ],
    notes: ['student records excluded unless separately authorized'],
  },
  'elections_democratic:elections_security_boundary': {
    excludedSourceClasses: [
      'electoral decisions',
      'voter records',
      'enforcement',
      'investigations',
      'operationally sensitive security material',
    ],
    notes: ['electoral integrity and independence must be preserved'],
  },
  'police_enforcement_corrections:enforcement_corrections_boundary': {
    excludedSourceClasses: [
      'operational files',
      'investigations',
      'intelligence',
      'enforcement decisions',
      'detention/parole/case materials',
    ],
    notes: ['operational and investigative materials excluded'],
  },
  'indigenous_government_or_service:indigenous_protocol_boundary': {
    requiredReviewers: ['relationship lead', 'protocol lead'],
    prohibitedUses: [
      'no assumption of authority',
      'no assumption of data access',
      'no standard institutional framing',
    ],
    notes: ['relationship-led, protocol-respecting access'],
  },
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

export function deriveSageBoundaryProfile(
  institutionType: SageInstitutionType,
  riskSurface: SageRiskSurface,
): SageBoundaryProfile {
  const ext = EXTENSIONS[`${institutionType}:${riskSurface}`] ?? {}
  return {
    institutionType,
    riskSurface,
    excludedSourceClasses: unique([...(ext.excludedSourceClasses ?? [])]),
    prohibitedUses: unique([...BASE_PROHIBITED_USES, ...(ext.prohibitedUses ?? [])]),
    requiredReviewers: unique([...BASE_REQUIRED_REVIEWERS, ...(ext.requiredReviewers ?? [])]),
    exportRestrictions: unique([...BASE_EXPORT_RESTRICTIONS, ...(ext.exportRestrictions ?? [])]),
    notes: unique([...(ext.notes ?? [])]),
  }
}
