import { describe, expect, it } from 'vitest'
import { environmentConfigSchema, deploymentArtifactSchema, environmentNameSchema } from './schemas'
describe('Zod 4 environment boundary', () => {
  it('retains valid config and rejects invalid environment and type', () => {
    const config = { environment: 'STAGING', service: 'api', deployment_region: 'canadacentral', observability_namespace: 'staging', evidence_namespace: 'evidence', allow_ai_experimental: false, allow_debug_logging: false, protected_environment: true }
    expect(environmentConfigSchema.parse(config)).toEqual(config)
    expect(environmentNameSchema.safeParse('PROD').success).toBe(false)
    expect(environmentConfigSchema.safeParse({ ...config, protected_environment: 'yes' }).success).toBe(false)
  })
  it('rejects missing artifact evidence and invalid build time', () => {
    const artifact = { artifact_digest: 'sha256:abc', sbom_hash: 'hash', attestation_ref: 'ref', commit_sha: 'commit', built_at: '2026-11-02T00:00:00Z', source_workflow: 'build' }
    expect(deploymentArtifactSchema.safeParse(artifact).success).toBe(true)
    expect(deploymentArtifactSchema.safeParse({ ...artifact, artifact_digest: '' }).success).toBe(false)
    expect(deploymentArtifactSchema.safeParse({ ...artifact, built_at: 'invalid' }).success).toBe(false)
  })
})
