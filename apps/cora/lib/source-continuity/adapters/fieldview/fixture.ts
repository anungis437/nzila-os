import type { RightsSnapshot } from '../../contracts'
import type { FieldViewSyntheticDocument } from './contracts'

export const FIELDVIEW_SYNTHETIC_TIME = '2026-10-09T12:00:00.000Z'
export const FIELDVIEW_SYNTHETIC_ORG_ID = 'synthetic-fieldview-org'
export const FIELDVIEW_SYNTHETIC_PURPOSE = 'synthetic-fieldview-provider-neutrality-proof'
export const FIELDVIEW_SYNTHETIC_RECIPIENT_ID = 'synthetic-fieldview-reader'

export const SYNTHETIC_FIELDVIEW_DOCUMENT: FieldViewSyntheticDocument = {
  standardVersion: '4.0.11',
  documentId: 'synthetic-fieldview-document-001',
  sourceOrigin: {
    providerId: 'synthetic-fieldview-provider',
    authorityId: 'synthetic-fieldview-source-authority',
  },
  farm: {
    guid: 'fv-farm-guid-001',
    displayName: 'Synthetic FieldView Farm',
  },
  field: {
    guid: 'fv-field-guid-001',
    farmGuid: 'fv-farm-guid-001',
    displayName: 'Synthetic FieldView Field',
    area: {
      value: 247.1053814671653,
      unit: 'acre',
    },
  },
  boundary: {
    guid: 'fv-boundary-guid-001',
    fieldGuid: 'fv-field-guid-001',
    geometry: {
      type: 'Polygon',
      crs: 'EPSG:4326',
      coordinates: [
        [
          [-93.0, 45.0],
          [-92.99, 45.0],
          [-92.99, 45.01],
          [-93.0, 45.01],
          [-93.0, 45.0],
        ],
      ],
    },
  },
  activity: {
    guid: 'fv-activity-guid-001',
    fieldGuid: 'fv-field-guid-001',
    boundaryGuid: 'fv-boundary-guid-001',
    activityType: 'SEEDING',
    measuredRate: {
      value: 12,
      unit: 'kg/ha',
    },
    effectiveAt: '2026-04-15T10:30:00.000Z',
    observedAt: '2026-04-15T10:31:00.000Z',
    lastModifiedTime: '2026-04-15T10:35:00.000Z',
  },
}

export function buildSyntheticFieldViewRights(
  overrides: Partial<RightsSnapshot> = {},
): RightsSnapshot {
  return {
    decisionRef: 'synthetic-fieldview-rights-001',
    decidedAt: FIELDVIEW_SYNTHETIC_TIME,
    permittedPurposes: [FIELDVIEW_SYNTHETIC_PURPOSE],
    permittedRecipients: [FIELDVIEW_SYNTHETIC_RECIPIENT_ID],
    revocationAuthorityIds: ['synthetic-fieldview-operator'],
    sourceAccess: 'ALLOWED',
    transientProcessing: 'ALLOWED',
    persistence: 'ALLOWED',
    transformation: 'ALLOWED',
    disclosure: 'ALLOWED',
    export: 'ALLOWED',
    rehydration: 'ALLOWED',
    deletion: 'ALLOWED',
    retentionAfterDisconnect: 'ALLOWED',
    ...overrides,
  }
}
