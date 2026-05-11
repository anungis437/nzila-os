import { describe, it, expect } from 'vitest'

import {
  DoctrineViolationError,
  UnknownReleaseStateError,
  assertAntiSurveillancePayload,
  assertExecutiveDensity,
  assertHumanAuthority,
  assertPilotIsolation,
  readReleaseIdentity,
  validateDeploymentLegitimacy,
  type DeploymentLegitimacyInput,
  type EnvironmentIdentity,
  type ReleaseIdentity,
} from '../index'

const release: ReleaseIdentity = {
  releaseId: 'UE-2026-05-09-001',
  commitSha: 'abcdef1234567',
  manifestHash: 'sha256-1111111111111111',
  builtAt: '2026-05-09T10:00:00.000Z',
}

const environment: EnvironmentIdentity = {
  environment: 'ue-pilot-2026q2',
  environmentClass: 'pilot',
  provenance: 'aca-environment-label/ue-pilot-2026q2',
}

describe('readReleaseIdentity', () => {
  it('returns identity when all fields present', () => {
    expect(readReleaseIdentity(release)).toEqual(release)
  })

  it('throws UnknownReleaseStateError on missing fields', () => {
    expect(() =>
      readReleaseIdentity({ releaseId: release.releaseId }),
    ).toThrow(UnknownReleaseStateError)
  })

  it('rejects non-hex commit sha', () => {
    expect(() =>
      readReleaseIdentity({ ...release, commitSha: 'not-hex' }),
    ).toThrow()
  })
})

describe('validateDeploymentLegitimacy', () => {
  const baseInput: DeploymentLegitimacyInput = {
    release,
    environment,
    expectedManifestHash: release.manifestHash,
    currentSchemaVersion: '42',
    manifestSchemaVersion: '42',
    isolationInvariantsHold: true,
    rollbackTargetAttested: true,
  }

  it('verifies a fully legitimate deployment', () => {
    const report = validateDeploymentLegitimacy(baseInput, {
      evaluatedAt: '2026-05-09T12:00:00.000Z',
    })
    expect(report.verdict).toBe('verified')
    expect(report.checks.every((c) => c.status === 'pass')).toBe(true)
  })

  it('rejects on manifest hash mismatch', () => {
    const report = validateDeploymentLegitimacy({
      ...baseInput,
      expectedManifestHash: 'sha256-different',
    })
    expect(report.verdict).toBe('rejected')
  })

  it('marks partial when only non-doctrine-critical checks fail', () => {
    const report = validateDeploymentLegitimacy({
      ...baseInput,
      rollbackTargetAttested: false,
    })
    expect(report.verdict).toBe('partial')
  })
})

describe('inline assertions', () => {
  it('assertPilotIsolation rejects pilot data on production paths', () => {
    expect(() =>
      assertPilotIsolation({
        subjectId: '/cases/list',
        currentEnvironmentClass: 'production',
        dataOriginEnvironmentClass: 'pilot',
      }),
    ).toThrow(DoctrineViolationError)
  })

  it('assertExecutiveDensity rejects density above budget', () => {
    expect(() =>
      assertExecutiveDensity({
        surfaceId: 'exec/dashboard',
        currentDensity: 50,
        densityBudget: 20,
      }),
    ).toThrow(DoctrineViolationError)
  })

  it('assertHumanAuthority rejects unapproved governance acts', () => {
    expect(() =>
      assertHumanAuthority({
        subjectId: 'case-123',
        act: 'close-case',
        humanApproved: false,
      }),
    ).toThrow(DoctrineViolationError)
  })

  it('assertAntiSurveillancePayload rejects forbidden payload keys', () => {
    expect(() =>
      assertAntiSurveillancePayload({
        subjectId: 'event',
        payloadKeys: ['count', 'userId'],
      }),
    ).toThrow(DoctrineViolationError)
  })

  it('assertions pass when constraints are honored', () => {
    expect(() =>
      assertPilotIsolation({
        subjectId: '/cases/list',
        currentEnvironmentClass: 'production',
        dataOriginEnvironmentClass: 'production',
      }),
    ).not.toThrow()
    expect(() =>
      assertExecutiveDensity({
        surfaceId: 'exec/dashboard',
        currentDensity: 5,
        densityBudget: 20,
      }),
    ).not.toThrow()
    expect(() =>
      assertHumanAuthority({
        subjectId: 'case-123',
        act: 'close-case',
        humanApproved: true,
      }),
    ).not.toThrow()
    expect(() =>
      assertAntiSurveillancePayload({
        subjectId: 'event',
        payloadKeys: ['count', 'window'],
      }),
    ).not.toThrow()
  })
})
