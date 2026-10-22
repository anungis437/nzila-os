import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { evaluateChangeRequirements, hasStagingMissionAuthorization } from './approvals'
import { changeRecordSchema } from './schemas'
import type { ChangeRecord } from './types'

function mission(): ChangeRecord {
  return changeRecordSchema.parse(JSON.parse(readFileSync(new URL('../../../ops/change-records/CHG-2026-0112.json', import.meta.url), 'utf8'))) as ChangeRecord
}

describe('specific Union Eyes sole-owner staging delegation', () => {
  it('publishes the exact independently hashable owner instruction bytes', () => {
    const artifact = JSON.parse(readFileSync(new URL('../../../ops/change-records/CHG-2026-0112.owner-instruction.json', import.meta.url), 'utf8'))
    expect(artifact.encoding).toBe('base64')
    expect(createHash('sha256').update(Buffer.from(artifact.bytes, 'base64')).digest('hex')).toBe(mission().staging_authorization?.owner_instruction_sha256)
    expect(artifact.sha256).toBe(mission().staging_authorization?.owner_instruction_sha256)
  })
  it('retains attribution after schema loading without inventing organizational approvals', () => {
    const change = mission()
    expect(change.approved_by).toEqual(['anungis437'])
    expect(change.staging_authorization?.delegate.name).toBe('Codex')
    expect(change.staging_authorization?.delegate.azure_identity).toBe('user:fcb34d85-3e87-4213-9fc4-435656b17f44')
    expect(hasStagingMissionAuthorization(change)).toBe(true)
    expect(evaluateChangeRequirements(change)).toEqual({ requiredApprovals: ['staging_mission_owner'], missingApprovals: [], cabRequired: false, approvalSatisfied: true })
  })

  it.each([
    ['production', (c: ChangeRecord) => ({ ...c, environment: 'PROD' as const })],
    ['different change', (c: ChangeRecord) => ({ ...c, change_id: 'CHG-2026-0113' })],
    ['different service', (c: ChangeRecord) => ({ ...c, service: 'web' })],
    ['missing attribution', (c: ChangeRecord) => ({ ...c, staging_authorization: undefined })],
    ['wrong mission', (c: ChangeRecord) => ({ ...c, staging_authorization: { ...c.staging_authorization!, mission: 'OTHER' } })],
    ['wrong instruction', (c: ChangeRecord) => ({ ...c, staging_authorization: { ...c.staging_authorization!, owner_instruction_sha256: '0'.repeat(64) } })],
    ['wrong delegate mapping', (c: ChangeRecord) => ({ ...c, staging_authorization: { ...c.staging_authorization!, delegate: { ...c.staging_authorization!.delegate, authenticated_github_login: 'github-actions[bot]' } } })],
    ['future workflow identity attributed to current operations', (c: ChangeRecord) => ({ ...c, staging_authorization: { ...c.staging_authorization!, delegate: { ...c.staging_authorization!.delegate, azure_identity: 'environment:staging/AZURE_CLIENT_ID' } } })],
    ['wrong resource', (c: ChangeRecord) => ({ ...c, staging_authorization: { ...c.staging_authorization!, resources: { ...c.staging_authorization!.resources, postgres_server: 'production-server' } } })],
    ['pending owner authorization', (c: ChangeRecord) => ({ ...c, approval_status: 'PENDING' as const })],
    ['unattributed actual owner', (c: ChangeRecord) => ({ ...c, approved_by: [] })],
  ])('retains normal requirements for %s', (_name, mutate) => {
    const change = mutate(mission())
    expect(hasStagingMissionAuthorization(change)).toBe(false)
    const evaluated = evaluateChangeRequirements(change)
    expect(evaluated.approvalSatisfied).toBe(false)
    expect(evaluated.requiredApprovals).toEqual(['service_owner', 'change_manager'])
  })

  it('preserves production high-risk security approval and CAB rules', () => {
    const change = { ...mission(), environment: 'PROD' as const, risk_level: 'HIGH' as const }
    const evaluated = evaluateChangeRequirements(change)
    expect(evaluated.cabRequired).toBe(true)
    expect(evaluated.requiredApprovals).toEqual(['service_owner', 'change_manager', 'security_approver'])
    expect(evaluated.approvalSatisfied).toBe(false)
  })

  it.each(['HIGH', 'CRITICAL'] as const)('retains security approval and CAB after staging risk escalates to %s', (risk_level) => {
    const change = { ...mission(), risk_level }
    expect(hasStagingMissionAuthorization(change)).toBe(false)
    const evaluated = evaluateChangeRequirements(change)
    expect(evaluated.cabRequired).toBe(true)
    expect(evaluated.requiredApprovals).toContain('security_approver')
    expect(evaluated.approvalSatisfied).toBe(false)
  })

  it('rejects claims that production or security proof requirements were waived', () => {
    const c = mission()
    expect(changeRecordSchema.safeParse({ ...c, staging_authorization: { ...c.staging_authorization, production_authorized: true } }).success).toBe(false)
    expect(changeRecordSchema.safeParse({ ...c, staging_authorization: { ...c.staging_authorization, security_proof_required: false } }).success).toBe(false)
    expect(changeRecordSchema.safeParse({ ...c, staging_authorization: { ...c.staging_authorization, signed_release_required: false } }).success).toBe(false)
  })
})
