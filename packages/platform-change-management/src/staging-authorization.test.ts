import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { evaluateChangeRequirements, hasFounderOperatedStagingApproval, hasStagingMissionAuthorization } from './approvals'
import { isInFreezePeriod, loadCalendarPolicy } from './calendar'
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

function founderStaging(): ChangeRecord {
  return changeRecordSchema.parse(JSON.parse(readFileSync(new URL('../../../ops/change-records/CHG-2026-0114.json', import.meta.url), 'utf8'))) as ChangeRecord
}

describe('solo-founder Union Eyes V2 staging (CHG-2026-0114)', () => {
  it('accepts the real owner-directed staging record without claiming a second reviewer', () => {
    const change = founderStaging()
    expect(change.approved_by).toEqual(['anungis437'])
    expect(change.approvers_required).toEqual(['anungis437'])
    expect(change.founder_staging_authorization?.alternate_github_login).toBe('anungis')
    expect(change.founder_staging_authorization?.authority_origin).toBe('OWNER_DIRECTIVE_IN_CONVERSATION')
    expect(hasFounderOperatedStagingApproval(change)).toBe(true)
    expect(evaluateChangeRequirements(change)).toEqual({
      requiredApprovals: ['staging_mission_owner'],
      missingApprovals: [],
      cabRequired: false,
      approvalSatisfied: true,
    })
  })
  it('uses a bounded implementation window that does not overlap a staging freeze', () => {
    const change = founderStaging()
    expect(new Date(change.implementation_window_end).getTime()).toBeLessThan(
      new Date('2026-12-20T00:00:00.000Z').getTime(),
    )
    expect(isInFreezePeriod('STAGING', {
      start: change.implementation_window_start,
      end: change.implementation_window_end,
    }, loadCalendarPolicy())).toBeNull()
  })
  it.each([
    ['production', (c: ChangeRecord) => ({ ...c, environment: 'PROD' as const })],
    ['other change', (c: ChangeRecord) => ({ ...c, change_id: 'CHG-2026-0199' })],
    ['other service', (c: ChangeRecord) => ({ ...c, service: 'web' })],
    ['other candidate', (c: ChangeRecord) => ({ ...c, founder_staging_authorization: { ...c.founder_staging_authorization!, candidate_sha: 'f'.repeat(40) } })],
    ['superseded staging candidate', (c: ChangeRecord) => ({ ...c, founder_staging_authorization: { ...c.founder_staging_authorization!, candidate_sha: '8a0faf64cc67a8bfaef35e39f5acdda8a9ef4896' } })],
    ['other subscription', (c: ChangeRecord) => ({ ...c, founder_staging_authorization: { ...c.founder_staging_authorization!, subscription_id: '00000000-0000-0000-0000-000000000000' } })],
    ['missing owner approval', (c: ChangeRecord) => ({ ...c, approved_by: [] })],
    ['two accounts falsely treated as separate humans', (c: ChangeRecord) => ({ ...c, approved_by: ['anungis', 'anungis437'] })],
    ['pending', (c: ChangeRecord) => ({ ...c, approval_status: 'PENDING' as const })],
    ['no directive', (c: ChangeRecord) => ({ ...c, founder_staging_authorization: undefined })],
    ['unlinked source', (c: ChangeRecord) => ({ ...c, linked_commits: [] })],
    ['missing provenance', (c: ChangeRecord) => ({ ...c, test_evidence_refs: c.test_evidence_refs.filter(ref => ref !== c.founder_staging_authorization?.owner_authorization_ref) })],
  ])('refuses %s and uses ordinary approval requirements', (_name, mutate) => {
    const modified = mutate(founderStaging())
    expect(hasFounderOperatedStagingApproval(modified)).toBe(false)
    expect(evaluateChangeRequirements(modified).approvalSatisfied).toBe(false)
  })
  it('cannot waive production boundary or technical controls through schema', () => {
    const c = founderStaging()
    expect(changeRecordSchema.safeParse({ ...c, founder_staging_authorization: { ...c.founder_staging_authorization, production_authorized: true } }).success).toBe(false)
    expect(changeRecordSchema.safeParse({ ...c, founder_staging_authorization: { ...c.founder_staging_authorization, technical_gates_required: false } }).success).toBe(false)
  })
})
