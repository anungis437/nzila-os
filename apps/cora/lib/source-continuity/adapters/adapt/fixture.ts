import type { RightsSnapshot } from '../../contracts'
import type { AdaptSyntheticDocument } from './contracts'

export const ADAPT_SYNTHETIC_TIME = '2026-10-09T12:00:00.000Z'
export const ADAPT_SYNTHETIC_ORG_ID = 'synthetic-adapt-org'
export const ADAPT_SYNTHETIC_PURPOSE = 'synthetic-adapt-standard-file-qualification'
export const ADAPT_SYNTHETIC_RECIPIENT_ID = 'synthetic-adapt-reader'

export const SYNTHETIC_ADAPT_DOCUMENT: AdaptSyntheticDocument = {
  standardVersion: '3.1.0',
  dataSetId: 'synthetic-adapt-dataset-001',
  farm: {
    id: { referenceId: 11 },
    description: 'Synthetic farm',
  },
  field: {
    id: { referenceId: 21 },
    farmId: 11,
    area: {
      value: 100,
      unit: { code: 'ha' },
    },
  },
  boundary: {
    id: { referenceId: 31 },
    fieldId: 21,
    spatialData: {
      type: 'MultiPolygon',
      polygons: [],
    },
    originalEpsgCode: 'EPSG:4326',
  },
  operation: {
    id: { referenceId: 41 },
    operationType: 'SEEDING',
    measurement: {
      value: 12,
      unit: 'kg/ha',
    },
    timeScope: {
      dateContext: 'UNSPECIFIED',
      timeStamp1: '2026-04-15T10:30:00.000Z',
    },
  },
}

export function buildSyntheticAdaptRights(overrides: Partial<RightsSnapshot> = {}): RightsSnapshot {
  return {
    decisionRef: 'synthetic-adapt-rights-001',
    decidedAt: ADAPT_SYNTHETIC_TIME,
    permittedPurposes: [ADAPT_SYNTHETIC_PURPOSE],
    permittedRecipients: [ADAPT_SYNTHETIC_RECIPIENT_ID],
    revocationAuthorityIds: ['synthetic-adapt-operator'],
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
