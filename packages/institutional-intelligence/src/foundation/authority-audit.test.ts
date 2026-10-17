import { describe, expect, it } from 'vitest'
import { syntheticFoundation, fictionalScope, fictionalOrg } from './synthetic.fixture'

describe('Checkpoint 3 Gate C authority and durable audit intent', () => {
  it.each(['stale', 'revoked', 'deployment-substitute'])('rejects %s authorization despite a real decision ID', mode => {
    const fixture = syntheticFoundation()
    try {
      fixture.controls.decisionMode = mode
      expect(() => fixture.authority.resolve('fictional-H1', 'deployment.authorize',
        fixture.command(fixture.target('DeploymentChange', 'P')))).toThrow('INVALID_OR_STALE_AUTHORIZATION')
    } finally { fixture.store.close() }
  })

  it('rejects caller actor/classification/scope/approval/authority injection and membership escalation', () => {
    const f = syntheticFoundation()
    try {
      const command = f.command(f.target('Mission', 'M'))
      for (const extra of [
        { actorClassification: 'INTERNAL_HUMAN' }, { actingScope: fictionalScope }, { targetScope: fictionalScope },
        { authorityRef: 'supplied-uuid' }, { approved: true }, { internalAffiliation: true },
      ]) expect(() => f.authority.resolve('fictional-H1', 'mission.create', { ...command, ...extra })).toThrow()
      f.sessions.set('org-member', {
        authenticated: true, actor: { id: 'org-member', classification: 'INTERNAL_HUMAN', internalAffiliation: true },
        actingScope: { type: 'ORGANIZATION', id: fictionalOrg }, roles: ['org_admin'],
      })
      expect(() => f.authority.resolve('org-member', 'mission.create', command)).toThrow('CROSS_SCOPE_DENIED')
      f.sessions.set('wildcard-system', {
        authenticated: true, actor: { id: 'wildcard-system', classification: 'SYSTEM', internalAffiliation: false },
        actingScope: { type: 'SYSTEM', id: 'fixture-system' }, roles: ['system'],
      })
      expect(() => f.authority.resolve('wildcard-system', 'mission.create', command)).toThrow('CROSS_SCOPE_DENIED')
      f.controls.entitled = false
      expect(() => f.authority.resolve('fictional-H1', 'mission.create', command)).toThrow('NOT_ENTITLED')
    } finally { f.store.close() }
  })

  it('atomically rolls back a source mutation when intent fails', () => {
    const f = syntheticFoundation()
    try {
      const { context } = f.authority.resolve('fictional-H1', 'mission.create', f.command(f.target('Mission', 'M')))
      f.controls.intentFailure = true
      expect(() => f.boundary.commit(context, 0, () => f.store.append(fictionalScope, 'Mission', 'M', 0, {})))
        .toThrow('FIXTURE_INTENT_FAILURE')
      expect(f.store.get(fictionalScope, 'Mission', 'M')).toBeUndefined()
      expect(f.store.get(fictionalScope, 'AuditIntent', context.requestId)).toBeUndefined()
    } finally { f.store.close() }
  })

  it('keeps finality blocked while proof is PENDING and retries using the original NAR event identity', async () => {
    const f = syntheticFoundation()
    try {
      const { context } = f.authority.resolve('fictional-H1', 'mission.create', f.command(f.target('Mission', 'M')))
      f.boundary.commit(context, 0, () => f.store.append(fictionalScope, 'Mission', 'M', 0, {}))
      f.controls.auditUnavailable = true
      await expect(f.boundary.deliver(fictionalScope, context.requestId)).rejects.toThrow('FIXTURE_NAR_UNAVAILABLE')
      expect(() => f.boundary.requireRecorded(fictionalScope, context.requestId)).toThrow('AUDIT_PROOF_PENDING')
      expect(f.failures).toContain('AUDIT_DELIVERY_PENDING')
      f.controls.auditUnavailable = false
      await f.boundary.deliver(fictionalScope, context.requestId)
      await f.boundary.deliver(fictionalScope, context.requestId)
      expect(f.store.list(fictionalScope, 'NarRecord')).toHaveLength(1)
      expect(() => f.boundary.requireRecorded(fictionalScope, context.requestId)).not.toThrow()
    } finally { f.store.close() }
  })

  it('rechecks revocation and mutable approvals at commit and rejects fabricated context', () => {
    const f = syntheticFoundation()
    try {
      const { context } = f.authority.resolve('fictional-H1', 'mission.create', f.command(f.target('Mission', 'M')))
      expect(() => f.authority.revalidate({ ...context })).toThrow('UNTRUSTED_CONTEXT')
      f.controls.approvals = false
      expect(() => f.boundary.commit(context, 0, () => f.store.append(fictionalScope, 'Mission', 'M', 0, {})))
        .toThrow('HUMAN_GATE_REQUIRED')
    } finally { f.store.close() }
  })
})
