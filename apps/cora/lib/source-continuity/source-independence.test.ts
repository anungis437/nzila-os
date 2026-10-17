import { describe, expect, it } from 'vitest'
import { acquisitionChannelSchema } from './contracts'
import { exportContinuityCapsule } from './export'
import { rehydrateContinuityCapsule } from './rehydrate'
import { createSourceCapture } from './capture'
import {
  buildSyntheticAdaptRights,
  ADAPT_SYNTHETIC_ORG_ID,
  ADAPT_SYNTHETIC_PURPOSE,
  ADAPT_SYNTHETIC_RECIPIENT_ID,
} from './adapters/adapt/fixture'
import {
  createNativeIndependenceCapsule,
  createStandardFileIndependenceCapsule,
  INDEPENDENCE_TIME,
  buildSyntheticIndependenceRoutes,
} from './fixtures/source-independence-routes'
import {
  evaluateSourceIndependence,
  FIDELITY_DIMENSIONS,
  type FidelityDimension,
  type SourceRouteEvidence,
} from './source-independence'
import { canonicalizeJson } from './integrity'
import { evaluateContinuityFidelity } from './continuity-fidelity'

const requiredDimensions = [
  'identity',
  'relationship',
  'unit',
  'measurement',
  'operational',
] as const

function compareRoutes(
  [left, right] = buildSyntheticIndependenceRoutes(),
  required: FidelityDimension[] = [...requiredDimensions],
) {
  return evaluateSourceIndependence({
    left,
    right,
    requiredDimensions: [...required],
    evaluatedAt: INDEPENDENCE_TIME,
  })
}

describe('synthetic source-independence proof', () => {
  it('proves only the bounded canonical slice and keeps route asymmetry visible', () => {
    const routes = buildSyntheticIndependenceRoutes()
    const report = compareRoutes(routes)

    expect(report.state).toBe('PROVEN_FOR_BOUNDED_SYNTHETIC_SLICE')
    expect(report.canonicalMeaningEquivalent).toBe(true)
    expect(report.syntheticOnly).toBe(true)
    expect(report.dimensions.find(({ dimension }) => dimension === 'spatial')?.status).toBe(
      'PARTIAL',
    )
    expect(report.dimensions.find(({ dimension }) => dimension === 'temporal')?.status).toBe(
      'PARTIAL',
    )
    expect(report.dimensions.find(({ dimension }) => dimension === 'provenance')?.status).toBe(
      'EQUIVALENT',
    )
  })

  it('reports either route as partial when only one route carries a dimension', () => {
    const routes = buildSyntheticIndependenceRoutes()
    const [native, standardFile] = routes
    const standardFileRich = {
      ...standardFile,
      claims: {
        ...standardFile.claims,
        spatial: {
          state: 'PRESENT' as const,
          value: 'adapt-geometry-normalized-by-explicit-fixture-rule',
          evidenceRef: 'synthetic-adapt-normalization-evidence',
          confidence: 0.8,
        },
      },
    }
    const nativeSparse = {
      ...native,
      claims: {
        ...native.claims,
        spatial: {
          state: 'UNRESOLVED' as const,
          evidenceRef: 'native-spatial-unavailable',
          confidence: 0,
        },
      },
    }

    expect(
      compareRoutes([native, standardFile], ['spatial']).dimensions.find(
        ({ dimension }) => dimension === 'spatial',
      )?.status,
    ).toBe('PARTIAL')
    expect(
      compareRoutes([nativeSparse, standardFileRich], ['spatial']).dimensions.find(
        ({ dimension }) => dimension === 'spatial',
      )?.status,
    ).toBe('PARTIAL')
  })

  it('records both materially conflicting claims and does not select a transport winner', () => {
    const routes = buildSyntheticIndependenceRoutes()
    const [native, standardFile] = routes
    const conflicting: SourceRouteEvidence = {
      ...standardFile,
      claims: {
        ...standardFile.claims,
        measurement: {
          state: 'PRESENT',
          value: 15,
          unit: 'kg/ha',
          evidenceRef: 'synthetic-conflicting-measurement',
          confidence: 0.7,
        },
      },
    }
    const report = compareRoutes([native, conflicting])

    expect(report.state).toBe('FAILED')
    expect(report.conflicts).toHaveLength(1)
    expect(report.conflicts[0]).toMatchObject({
      dimension: 'measurement',
      requiredResolutionAuthority: 'SOURCE_AUTHORITY_OR_OPERATOR_WITH_DOCUMENTED_BINDING',
      claims: [
        {
          routeId: 'native',
          providerId: 'synthetic-native-strategic-provider',
          acquisitionChannel: 'NATIVE_STRATEGIC_CONNECTOR',
          mappingVersion: '1.0.0',
          value: 12,
        },
        {
          routeId: 'standard-file',
          acquisitionChannel: 'STANDARD_FILE_CONNECTOR',
          mappingVersion: '1.0.0',
          value: 15,
        },
      ],
    })
  })

  it('keeps unknown upstream provider unknown while preserving usable canonical claims', () => {
    const routes = buildSyntheticIndependenceRoutes({ unknownStandardFileProvider: true })
    const [native, standardFile] = routes
    const report = compareRoutes(routes)

    expect(standardFile.capture.sourceRef.providerId).toBe('UNKNOWN')
    expect(standardFile.capture.sourceAuthority.authorityId).toBe('UNKNOWN')
    expect(report.canonicalMeaningEquivalent).toBe(true)
    expect(report.dimensions.find(({ dimension }) => dimension === 'sourceAuthority')?.status).toBe(
      'PARTIAL',
    )
    expect(report.limitations.join(' ')).toMatch(/unknown provider or source authority/i)
    expect(native.capture.sourceRef.providerId).not.toBe('UNKNOWN')
  })

  it('evaluates rights per capture and never transfers a permissive route right', () => {
    const nativeRights = buildSyntheticAdaptRights({
      persistence: 'ALLOWED',
      transformation: 'ALLOWED',
      export: 'DENIED',
      rehydration: 'ALLOWED',
    })
    const standardRights = buildSyntheticAdaptRights({
      persistence: 'DENIED',
      transformation: 'UNKNOWN',
      export: 'ALLOWED',
      rehydration: 'DENIED',
    })
    const [native, standardFile] = buildSyntheticIndependenceRoutes({
      nativeRights,
      standardFileRights: buildSyntheticAdaptRights({
        persistence: 'ALLOWED',
        transformation: 'ALLOWED',
        export: 'ALLOWED',
        rehydration: 'ALLOWED',
      }),
    })
    const { integritySha256: _integritySha256, ...draft } = standardFile.capture
    const deniedStandardFile: SourceRouteEvidence = {
      ...standardFile,
      capture: createSourceCapture(
        { ...draft, rights: standardRights },
        ADAPT_SYNTHETIC_ORG_ID,
        INDEPENDENCE_TIME,
      ),
    }
    const report = compareRoutes([native, deniedStandardFile])

    expect(report.state).toBe('PARTIAL')
    expect(report.dimensions.find(({ dimension }) => dimension === 'rights')?.status).toBe(
      'PARTIAL',
    )
    expect(report.rightsByRoute[0]?.actionResults.EXPORT?.allowed).toBe(false)
    expect(report.rightsByRoute[1]?.actionResults.PERSIST?.allowed).toBe(false)
    expect(report.rightsByRoute[1]?.actionResults.TRANSFORM?.allowed).toBe(false)
    expect(report.rightsByRoute[1]?.actionResults.REHYDRATE?.allowed).toBe(false)
    expect(report.limitations.join(' ')).toMatch(/rights do not transfer/i)
  })

  it('preserves source-local IDs and mapping-version changes without changing canonical identity', () => {
    const routes = buildSyntheticIndependenceRoutes({ nativeMappingVersion: '2.0.0' })
    const report = compareRoutes(routes)

    expect(routes[0].mapping.version).toBe('2.0.0')
    expect(routes[0].capture.mappingRefs[0]?.version).toBe('2.0.0')
    expect(routes[1].mapping.version).toBe('1.0.0')
    expect(report.dimensions.find(({ dimension }) => dimension === 'identity')?.status).toBe(
      'EQUIVALENT',
    )
    expect(
      routes[0].mappingResult.fields.find(
        ({ canonicalField }) => canonicalField === 'land.field.sourceLocalReferenceId',
      )?.canonicalValue,
    ).toBe('native-field-21')
    expect(
      routes[1].mappingResult.fields.find(
        ({ canonicalField }) => canonicalField === 'land.field.sourceLocalReferenceId',
      )?.canonicalValue,
    ).toBe(21)
  })

  it('retains unit-conversion evidence and keeps ambiguous time and geometry unresolved', () => {
    const [, standardFile] = buildSyntheticIndependenceRoutes()
    const area = standardFile.mappingResult.fields.find(
      ({ canonicalField }) => canonicalField === 'land.field.area',
    )

    expect(area).toMatchObject({
      sourceValue: 100,
      sourceUnit: 'ha',
      canonicalUnit: 'acre',
      transformationEvidence: {
        transformationId: 'hectare-to-acre',
        version: '1.0.0',
        sourceValue: 100,
        sourceUnit: 'ha',
        canonicalUnit: 'acre',
      },
    })
    expect(
      standardFile.mappingResult.fields.find(
        ({ sourcePath }) => sourcePath === 'operation.timeScope.timeStamp1',
      )?.losses,
    ).toContain('TEMPORAL_ROLE_UNSPECIFIED')
    expect(
      standardFile.mappingResult.fields.find(
        ({ sourcePath }) => sourcePath === 'boundary.spatialData',
      )?.losses,
    ).toContain('SEMANTIC_LOSS_SPATIAL_NORMALIZATION_NOT_IMPLEMENTED')
  })

  it('rehydrates either route capsule without loading that route implementation', () => {
    const [native, standardFile] = buildSyntheticIndependenceRoutes()
    const capsules = [
      createNativeIndependenceCapsule(native),
      createStandardFileIndependenceCapsule(standardFile),
    ]

    for (const capsule of capsules) {
      const serialized = exportContinuityCapsule(
        capsule,
        ADAPT_SYNTHETIC_RECIPIENT_ID,
        ADAPT_SYNTHETIC_PURPOSE,
        INDEPENDENCE_TIME,
      )
      const rehydrated = rehydrateContinuityCapsule(
        serialized,
        ADAPT_SYNTHETIC_ORG_ID,
        ADAPT_SYNTHETIC_RECIPIENT_ID,
        INDEPENDENCE_TIME,
      )

      expect(rehydrated.sourceProviderAvailable).toBe(false)
      expect(rehydrated.sourceCurrentness).toBe('NOT_VERIFIED')
      expect(rehydrated.capsule.captures).toHaveLength(1)
      expect(rehydrated.capsule.mappingResults).toHaveLength(1)
      expect(rehydrated.capsule.captures[0]?.rights.persistence).toBe('ALLOWED')
      expect(rehydrated.capsule.limitations.length).toBeGreaterThan(0)
    }

    expect(standardFile.capture.acquisitionRoute.channel).toBe('STANDARD_FILE_CONNECTOR')
  })

  it('produces deterministic capsule integrity and exposes an offline-readable manifest', () => {
    const [native] = buildSyntheticIndependenceRoutes()
    const first = createNativeIndependenceCapsule(native)
    const second = createNativeIndependenceCapsule(native)

    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second))
    expect(first.integrity.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(first.formatVersion).toBe('1.0')
    expect(first.captures[0]?.provenance[0]?.acquisitionChannel).toBe('NATIVE_STRATEGIC_CONNECTOR')
    expect(first.mappings[0]?.version).toBe('1.0.0')
    expect(first.mappingResults?.[0]?.fields).toBeDefined()
    expect(first.captures[0]?.rights).toBeDefined()
    expect(first.retentionManifest.entries[0]).toMatchObject({
      captureId: first.captures[0]?.captureId,
      rightsDecisionRef: first.captures[0]?.rights.decisionRef,
      retentionState: 'UNKNOWN',
      retentionDurationSeconds: null,
      retentionExpiresAt: null,
      retentionAfterDisconnect: first.captures[0]?.rights.retentionAfterDisconnect,
      deletion: first.captures[0]?.rights.deletion,
    })
  })

  it('keeps ADAPT out of canonical channel contracts and requires explicit evidence for metrics', () => {
    expect(acquisitionChannelSchema.options).not.toContain('ADAPT')
    const result = evaluateContinuityFidelity([
      {
        dimension: 'semanticCompleteness',
        state: 'ESTABLISHED',
        evidenceRefs: ['synthetic-semantic-evidence'],
        reasons: [],
      },
      {
        dimension: 'permissionCompleteness',
        state: 'PARTIAL',
        evidenceRefs: ['native-rights-allowed', 'file-rights-unknown'],
        reasons: ['Rights differ by route'],
      },
    ])

    expect(result.state).toBe('UNRESOLVED')
    expect(result.isPublicScore).toBe(false)
    expect(
      result.dimensions.find(({ dimension }) => dimension === 'sourceFreshnessCompleteness'),
    ).toMatchObject({ state: 'UNRESOLVED', evidenceRefs: [] })
    expect(FIDELITY_DIMENSIONS).toHaveLength(10)
  })
})
