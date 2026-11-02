import { describe, expect, it } from 'vitest'
import { changeRecordSchema, environmentSchema } from './schemas'
describe('Zod 4 change management boundary', () => {
  const change = { change_id: 'CHG-1', title: 'Change', description: 'Description', service: 'api', environment: 'STAGING', change_type: 'NORMAL', risk_level: 'HIGH', impact_summary: 'Impact', requested_by: 'requester', approvers_required: ['owner'], approved_by: [], approval_status: 'PENDING', implementation_window_start: '2026-11-02T00:00:00Z', implementation_window_end: '2026-11-02T01:00:00Z', rollback_plan: 'Revert', test_evidence_refs: [], linked_prs: [], linked_commits: [], status: 'PROPOSED', created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' }
  it('retains change validation and timestamp checks', () => {
    expect(changeRecordSchema.safeParse(change).success).toBe(true)
    expect(environmentSchema.safeParse('PROD').success).toBe(true)
    expect(changeRecordSchema.safeParse({ ...change, environment: 'PRODUCTION' }).success).toBe(false)
    expect(changeRecordSchema.safeParse({ ...change, implementation_window_start: 'invalid' }).success).toBe(false)
  })
  it('refuses forged production authorization or unknown fields', () => {
    const authorization = { mission: 'mission', owner_github_login: 'owner', owner_instruction_sha256: 'a'.repeat(64), owner_instruction_ref: 'ref', delegate: { name: 'delegate', authenticated_github_login: 'delegate', azure_identity: 'azure' }, resources: { subscription_id: 'sub', tenant_id: 'tenant', container_app: 'app', container_app_resource_group: 'rg', postgres_server: 'pg', postgres_resource_group: 'rg', database: 'db', key_vault: 'kv', clone_name_prefix: 'clone', region: 'canadacentral' }, production_authorized: false, security_proof_required: true, signed_release_required: true }
    expect(changeRecordSchema.safeParse({ ...change, staging_authorization: authorization }).success).toBe(true)
    expect(changeRecordSchema.safeParse({ ...change, staging_authorization: { ...authorization, production_authorized: true } }).success).toBe(false)
    expect(changeRecordSchema.safeParse({ ...change, staging_authorization: { ...authorization, unexpected: true } }).success).toBe(false)
  })
})
