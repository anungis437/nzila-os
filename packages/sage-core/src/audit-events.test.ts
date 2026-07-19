import { describe, it, expect } from 'vitest'
import {
  SAGE_AUDIT_ACTIONS,
  SAGE_AUDIT_ACTION_VALUES,
  SAGE_AUDIT_RESOURCES,
  SAGE_AUDIT_RESOURCE_VALUES,
  buildSageAuditPayload,
} from './audit-events'

describe('SAGE audit-event contract', () => {
  it('defines an action constant for every material SAGE action', () => {
    // Material actions the blueprint requires to be audited.
    const required = [
      'sage.workspace.created',
      'sage.member.added',
      'sage.role.assigned',
      'sage.role.revoked',
      'sage.evidence_authorization.granted',
      'sage.evidence_authorization.revoked',
      'sage.export_authority.set',
      'sage.evidence_source.created',
      'sage.source.classified',
      'sage.evidence_item.created',
      'sage.evidence.linked',
      'sage.boundary.flagged',
      'sage.review.noted',
      'sage.decision.recorded',
      'sage.export.requested',
      'sage.export.approved',
      'sage.export.denied',
    ]
    for (const action of required) {
      expect(SAGE_AUDIT_ACTION_VALUES).toContain(action)
    }
  })

  it('uses sage.* naming for all actions and sage_* for all resources', () => {
    for (const a of SAGE_AUDIT_ACTION_VALUES) expect(a.startsWith('sage.')).toBe(true)
    for (const r of SAGE_AUDIT_RESOURCE_VALUES) expect(r.startsWith('sage_')).toBe(true)
  })

  it('builds an @nzila/audit-compatible payload with required fields', () => {
    const payload = buildSageAuditPayload({
      actorId: 'actor_1',
      orgId: 'org_1',
      action: SAGE_AUDIT_ACTIONS.WORKSPACE_CREATED,
      resource: SAGE_AUDIT_RESOURCES.WORKSPACE,
      resourceId: 'ws_1',
      payload: { name: 'Example Workspace' },
    })
    expect(payload).toMatchObject({
      actorId: 'actor_1',
      orgId: 'org_1',
      action: 'sage.workspace.created',
      resource: 'sage_workspace',
      resourceId: 'ws_1',
    })
    expect(payload.payload).toEqual({ name: 'Example Workspace' })
  })

  it('rejects a payload missing actorId or orgId', () => {
    expect(() =>
      buildSageAuditPayload({
        actorId: '',
        orgId: 'org_1',
        action: SAGE_AUDIT_ACTIONS.MEMBER_ADDED,
        resource: SAGE_AUDIT_RESOURCES.WORKSPACE_MEMBER,
      }),
    ).toThrow(/actorId/)
    expect(() =>
      buildSageAuditPayload({
        actorId: 'a',
        orgId: '',
        action: SAGE_AUDIT_ACTIONS.MEMBER_ADDED,
        resource: SAGE_AUDIT_RESOURCES.WORKSPACE_MEMBER,
      }),
    ).toThrow(/orgId/)
  })

  it('rejects unknown action or resource values', () => {
    expect(() =>
      buildSageAuditPayload({
        actorId: 'a',
        orgId: 'o',
        action: 'sage.unknown.action' as never,
        resource: SAGE_AUDIT_RESOURCES.WORKSPACE,
      }),
    ).toThrow(/Unknown SAGE audit action/)
    expect(() =>
      buildSageAuditPayload({
        actorId: 'a',
        orgId: 'o',
        action: SAGE_AUDIT_ACTIONS.WORKSPACE_CREATED,
        resource: 'not_a_sage_resource' as never,
      }),
    ).toThrow(/Unknown SAGE audit resource/)
  })
})
