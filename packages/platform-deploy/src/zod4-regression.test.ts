import { describe, expect, it } from 'vitest'
import { DeploymentProfileConfigSchema, validateDeploymentProfile } from './deploy-profile'
import { EgressAllowlistSchema } from './sovereign'

describe('Zod 4 deployment and egress boundary regression', () => {
  it('preserves defaults and refuses invalid deployment profiles', () => {
    const config = DeploymentProfileConfigSchema.parse({ profile: 'sovereign', environment: 'staging' })
    expect(config.selfHostedDb).toBe(false)
    expect(config.egressAllowlist).toEqual([])
    expect(validateDeploymentProfile(config, { DATABASE_URL: 'postgres://local', NODE_ENV: 'test' }).overallPassed).toBe(false)
    expect(DeploymentProfileConfigSchema.safeParse({ profile: 'untrusted', environment: 'production' }).success).toBe(false)
  })
  it('accepts valid egress rules and rejects invalid ports and flags', () => {
    const valid = { enforced: true, rules: [{ host: 'api.example.test', port: 443, reason: 'approved integration' }] }
    expect(EgressAllowlistSchema.parse(valid).rules).toHaveLength(1)
    expect(EgressAllowlistSchema.safeParse({ ...valid, rules: [{ ...valid.rules[0], port: -1 }] }).success).toBe(false)
    expect(EgressAllowlistSchema.safeParse({ ...valid, enforced: 'true' }).success).toBe(false)
  })
})
