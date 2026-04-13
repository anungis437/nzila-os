import { describe, it, expect } from 'vitest'
import {
  environmentNameSchema,
  environmentConfigSchema,
  deploymentArtifactSchema,
  environmentHealthCheckSchema,
  environmentHealthReportSchema,
  governanceSnapshotSchema,
  featureFlagSchema,
} from '../schemas'

describe('environmentNameSchema', () => {
  it('accepts valid names', () => {
    expect(environmentNameSchema.parse('LOCAL')).toBe('LOCAL')
    expect(environmentNameSchema.parse('PREVIEW')).toBe('PREVIEW')
    expect(environmentNameSchema.parse('STAGING')).toBe('STAGING')
    expect(environmentNameSchema.parse('PRODUCTION')).toBe('PRODUCTION')
  })

  it('rejects invalid names', () => {
    expect(() => environmentNameSchema.parse('DEV')).toThrow()
  })
})

describe('environmentConfigSchema', () => {
  it('validates a full config', () => {
    const config = {
      environment: 'STAGING',
      service: 'web',
      deployment_region: 'eastus',
      observability_namespace: 'nzila.staging',
      evidence_namespace: 'nzila-staging-evidence',
      allow_ai_experimental: true,
      allow_debug_logging: true,
      protected_environment: true,
    }
    expect(environmentConfigSchema.parse(config)).toEqual(config)
  })
})

describe('deploymentArtifactSchema', () => {
  it('validates an artifact', () => {
    const artifact = {
      artifact_digest: 'sha256:abc',
      sbom_hash: 'sha256:def',
      attestation_ref: 'sigstore://ref',
      commit_sha: 'abc1234',
      built_at: '2025-01-01T00:00:00Z',
      source_workflow: 'deploy-staging',
    }
    expect(deploymentArtifactSchema.parse(artifact)).toEqual(artifact)
  })
})

describe('governanceSnapshotSchema', () => {
  it('validates a snapshot', () => {
    const snapshot = {
      environment: 'PRODUCTION',
      commit: 'abc1234',
      artifact_digest: 'sha256:abc',
      sbom_hash: 'sha256:def',
      policy_engine_status: 'pass',
      change_record_ref: 'CHG-001',
      timestamp: '2025-01-01T00:00:00Z',
    }
    expect(governanceSnapshotSchema.parse(snapshot)).toEqual(snapshot)
  })
})

describe('featureFlagSchema', () => {
  it('validates a flag', () => {
    const flag = {
      name: 'test_flag',
      enabled: true,
      environments: ['LOCAL', 'STAGING'],
    }
    expect(featureFlagSchema.parse(flag)).toEqual(flag)
  })

  it('rejects flag with invalid environment', () => {
    expect(() =>
      featureFlagSchema.parse({ name: 'f', enabled: true, environments: ['INVALID'] }),
    ).toThrow()
  })
})

describe('environmentHealthCheckSchema', () => {
  it('validates a health check', () => {
    const check = {
      check: 'database',
      status: 'healthy',
      detail: 'Connected',
      timestamp: '2025-01-01T00:00:00Z',
    }
    expect(environmentHealthCheckSchema.parse(check)).toEqual(check)
  })

  it('accepts degraded and unhealthy statuses', () => {
    const base = { check: 'api', detail: 'ok', timestamp: '2025-01-01T00:00:00Z' }
    expect(environmentHealthCheckSchema.parse({ ...base, status: 'degraded' }).status).toBe('degraded')
    expect(environmentHealthCheckSchema.parse({ ...base, status: 'unhealthy' }).status).toBe('unhealthy')
  })

  it('rejects invalid status', () => {
    expect(() =>
      environmentHealthCheckSchema.parse({ check: 'x', status: 'broken', detail: 'y', timestamp: 'z' }),
    ).toThrow()
  })
})

describe('environmentHealthReportSchema', () => {
  it('validates a health report', () => {
    const report = {
      environment: 'STAGING',
      overall: 'healthy',
      checks: [
        { check: 'db', status: 'healthy', detail: 'ok', timestamp: '2025-01-01T00:00:00Z' },
      ],
      timestamp: '2025-01-01T00:00:00Z',
    }
    expect(environmentHealthReportSchema.parse(report)).toEqual(report)
  })

  it('rejects report with invalid overall status', () => {
    expect(() =>
      environmentHealthReportSchema.parse({
        environment: 'LOCAL',
        overall: 'unknown',
        checks: [],
        timestamp: 'ts',
      }),
    ).toThrow()
  })
})

describe('deploymentArtifactSchema edge cases', () => {
  it('rejects artifact with invalid built_at date', () => {
    expect(() =>
      deploymentArtifactSchema.parse({
        artifact_digest: 'x',
        sbom_hash: 'y',
        attestation_ref: 'z',
        commit_sha: 'a',
        built_at: 'not-a-date',
        source_workflow: 'w',
      }),
    ).toThrow()
  })

  it('rejects artifact with empty fields', () => {
    expect(() =>
      deploymentArtifactSchema.parse({
        artifact_digest: '',
        sbom_hash: '',
        attestation_ref: '',
        commit_sha: '',
        built_at: '2025-01-01T00:00:00Z',
        source_workflow: '',
      }),
    ).toThrow()
  })
})

describe('environmentConfigSchema edge cases', () => {
  it('rejects config with missing fields', () => {
    expect(() => environmentConfigSchema.parse({})).toThrow()
  })

  it('rejects config with invalid environment', () => {
    expect(() =>
      environmentConfigSchema.parse({
        environment: 'DEV',
        service: 'x',
        deployment_region: 'r',
        observability_namespace: 'n',
        evidence_namespace: 'e',
        allow_ai_experimental: true,
        allow_debug_logging: true,
        protected_environment: false,
      }),
    ).toThrow()
  })
})
