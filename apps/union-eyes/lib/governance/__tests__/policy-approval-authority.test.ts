import { describe, expect, it } from 'vitest'
import {
  actorOwnsPolicyScope,
  countEffectiveApprovals,
  evaluateApprovalAction,
  evaluateChainCreation,
  isChainSatisfied,
  mayTransitionToApprovedState,
  type ApprovalActor,
  type ApprovalChain,
  type ApprovalPolicy,
  type ApprovalActionRecord,
} from '../policy-approval-authority'

const ORG = 'org-a'
const policy = (over: Partial<ApprovalPolicy> = {}): ApprovalPolicy => ({
  id: 'pol-1',
  orgId: ORG,
  authorId: 'author',
  lifecycleStatus: 'approval_required',
  riskClassification: 'medium',
  ...over,
})
const actor = (id: string, role: ApprovalActor['role'], organizationId: string | null = ORG): ApprovalActor => ({
  id,
  role,
  organizationId,
})
const chain = (over: Partial<ApprovalChain> = {}): ApprovalChain => ({
  id: 'ch-1',
  governedPolicyId: 'pol-1',
  chainType: 'multi',
  requiredApprovals: 2,
  requiresNamedApprovers: false,
  approverRoles: ['president', 'vice_president'],
  namedApproverIds: [],
  delegatable: false,
  ...over,
})
const act = (approverUserId: string, action: ApprovalActionRecord['action'], extra: Partial<ApprovalActionRecord> = {}): ApprovalActionRecord => ({
  chainId: 'ch-1',
  approverUserId,
  action,
  ...extra,
})

describe('policy approval authority — scope', () => {
  it('platform policies are governed only by platform principals', () => {
    const platformPolicy = policy({ orgId: null })
    expect(actorOwnsPolicyScope(actor('u', 'system_admin', null), platformPolicy)).toBe(true)
    expect(actorOwnsPolicyScope(actor('u', 'compliance_manager', null), platformPolicy)).toBe(true)
    // union president / admin of any org must not gain platform policy authority
    expect(actorOwnsPolicyScope(actor('u', 'president'), platformPolicy)).toBe(false)
    expect(actorOwnsPolicyScope(actor('u', 'admin'), platformPolicy)).toBe(false)
  })

  it('organization policies are governed only inside their own organization', () => {
    expect(actorOwnsPolicyScope(actor('u', 'admin'), policy())).toBe(true)
    expect(actorOwnsPolicyScope(actor('u', 'admin', 'org-b'), policy())).toBe(false)
    // platform staff do not implicitly govern customer-union policy
    expect(actorOwnsPolicyScope(actor('u', 'system_admin', null), policy())).toBe(false)
  })
})

describe('policy approval authority — chain creation', () => {
  it('rejects chain creation out of scope (indistinguishable from not found)', () => {
    const d = evaluateChainCreation(actor('u', 'admin', 'org-b'), policy(), { approverRoles: ['president'] }, [])
    expect(d).toMatchObject({ allowed: false, code: 'OUT_OF_SCOPE', status: 404 })
  })

  it('rejects an empty (permissive) chain', () => {
    const d = evaluateChainCreation(actor('u', 'admin'), policy(), {}, [])
    expect(d).toMatchObject({ allowed: false, code: 'INVALID_CHAIN' })
  })

  it('rejects a second chain once one exists', () => {
    const d = evaluateChainCreation(actor('u', 'admin'), policy(), { approverRoles: ['president'] }, [{ id: 'existing' }])
    expect(d).toMatchObject({ allowed: false, code: 'CHAIN_ALREADY_EXISTS' })
  })

  it('rejects a chain for a policy that is not awaiting approval', () => {
    const d = evaluateChainCreation(actor('u', 'admin'), policy({ lifecycleStatus: 'active' }), { approverRoles: ['president'] }, [])
    expect(d).toMatchObject({ allowed: false, code: 'POLICY_NOT_OPEN_FOR_APPROVAL' })
  })

  it('rejects low-privilege approver roles such as member', () => {
    const d = evaluateChainCreation(actor('u', 'admin'), policy(), { approverRoles: ['member'] }, [])
    expect(d).toMatchObject({ allowed: false, code: 'INVALID_CHAIN' })
  })

  it('rejects platform roles as approvers of an organization policy', () => {
    const d = evaluateChainCreation(actor('u', 'admin'), policy(), { approverRoles: ['system_admin'] }, [])
    expect(d).toMatchObject({ allowed: false, code: 'INVALID_CHAIN' })
  })

  it('high-risk policies need >=2 approvals and named approvers, and cannot be delegatable', () => {
    const hi = policy({ riskClassification: 'high' })
    const u = actor('u', 'admin')
    expect(evaluateChainCreation(u, hi, { approverRoles: ['president'], requiredApprovals: 1, namedApproverIds: ['a', 'b'] }, []))
      .toMatchObject({ allowed: false })
    expect(evaluateChainCreation(u, hi, { approverRoles: ['president'], requiredApprovals: 2 }, []))
      .toMatchObject({ allowed: false })
    expect(evaluateChainCreation(u, hi, { approverRoles: ['president'], requiredApprovals: 2, namedApproverIds: ['a', 'b'], delegatable: true }, []))
      .toMatchObject({ allowed: false })
    expect(evaluateChainCreation(u, hi, { approverRoles: ['president'], requiredApprovals: 2, namedApproverIds: ['a', 'b'] }, []))
      .toEqual({ allowed: true })
  })

  it('the policy author cannot name themselves as approver', () => {
    const d = evaluateChainCreation(actor('u', 'admin'), policy(), { approverRoles: ['president'], namedApproverIds: ['author'] }, [])
    expect(d).toMatchObject({ allowed: false, code: 'SELF_APPROVAL' })
  })

  it('emergency chains are reserved to platform governance', () => {
    const d = evaluateChainCreation(actor('u', 'admin'), policy(), { chainType: 'emergency', approverRoles: ['president'] }, [])
    expect(d).toMatchObject({ allowed: false, status: 403 })
  })
})

describe('policy approval authority — recording actions', () => {
  it('denies an actor whose server-derived role is not in the chain (client role strings are irrelevant)', () => {
    const d = evaluateApprovalAction(actor('u1', 'steward'), policy(), chain(), [], { action: 'approved' })
    expect(d).toMatchObject({ allowed: false, code: 'NOT_AN_ELIGIBLE_APPROVER' })
  })

  it('allows an eligible approver', () => {
    expect(evaluateApprovalAction(actor('u1', 'president'), policy(), chain(), [], { action: 'approved' })).toEqual({ allowed: true })
  })

  it('denies the policy author approving their own policy', () => {
    const d = evaluateApprovalAction(actor('author', 'president'), policy(), chain(), [], { action: 'approved' })
    expect(d).toMatchObject({ allowed: false, code: 'SELF_APPROVAL' })
  })

  it('denies actors outside the policy organization', () => {
    const d = evaluateApprovalAction(actor('u1', 'president', 'org-b'), policy(), chain(), [], { action: 'approved' })
    expect(d).toMatchObject({ allowed: false, code: 'OUT_OF_SCOPE', status: 404 })
  })

  it('denies a chain that belongs to a different policy', () => {
    const d = evaluateApprovalAction(actor('u1', 'president'), policy(), chain({ governedPolicyId: 'other' }), [], { action: 'approved' })
    expect(d).toMatchObject({ allowed: false, code: 'CHAIN_POLICY_MISMATCH' })
  })

  it('denies actions on a policy that is not awaiting approval', () => {
    const d = evaluateApprovalAction(actor('u1', 'president'), policy({ lifecycleStatus: 'draft' }), chain(), [], { action: 'approved' })
    expect(d).toMatchObject({ allowed: false, code: 'POLICY_NOT_OPEN_FOR_APPROVAL' })
  })

  it('denies a repeat approval by the same approver (no double counting)', () => {
    const d = evaluateApprovalAction(actor('u1', 'president'), policy(), chain(), [act('u1', 'approved')], { action: 'approved' })
    expect(d).toMatchObject({ allowed: false, code: 'ALREADY_APPROVED' })
    expect(countEffectiveApprovals([act('u1', 'approved'), act('u1', 'approved')])).toBe(1)
  })

  it('enforces named approvers when the chain requires them', () => {
    const c = chain({ requiresNamedApprovers: true, namedApproverIds: ['named-1', 'named-2'] })
    expect(evaluateApprovalAction(actor('imposter', 'president'), policy(), c, [], { action: 'approved' }))
      .toMatchObject({ allowed: false, code: 'NOT_AN_ELIGIBLE_APPROVER' })
    expect(evaluateApprovalAction(actor('named-1', 'president'), policy(), c, [], { action: 'approved' })).toEqual({ allowed: true })
  })

  it('a named approver must still hold an eligible role', () => {
    const c = chain({ requiresNamedApprovers: true, namedApproverIds: ['named-1'], approverRoles: ['president'] })
    expect(evaluateApprovalAction(actor('named-1', 'steward'), policy(), c, [], { action: 'approved' }))
      .toMatchObject({ allowed: false, code: 'NOT_AN_ELIGIBLE_APPROVER' })
  })

  it('delegation: only on delegatable chains, by a named approver, never to the author or self', () => {
    const c = chain({ requiresNamedApprovers: true, namedApproverIds: ['named-1'], delegatable: true, approverRoles: ['president', 'vice_president'] })
    const d = (id: string, role: ApprovalActor['role'], to?: string, ch = c) =>
      evaluateApprovalAction(actor(id, role), policy(), ch, [], { action: 'delegated', delegatedToUserId: to })
    expect(d('named-1', 'president', 'delegate-1')).toEqual({ allowed: true })
    expect(d('named-1', 'president', 'named-1')).toMatchObject({ allowed: false, code: 'DELEGATION_NOT_PERMITTED' })
    expect(d('named-1', 'president', 'author')).toMatchObject({ allowed: false, code: 'DELEGATION_NOT_PERMITTED' })
    expect(d('named-1', 'president', undefined)).toMatchObject({ allowed: false, code: 'DELEGATION_NOT_PERMITTED' })
    expect(d('named-1', 'president', 'delegate-1', { ...c, delegatable: false })).toMatchObject({ allowed: false, code: 'DELEGATION_NOT_PERMITTED' })
  })

  it('a delegate may approve only after a named approver has delegated to them', () => {
    const c = chain({ requiresNamedApprovers: true, namedApproverIds: ['named-1'], delegatable: true, approverRoles: ['president', 'vice_president'] })
    expect(evaluateApprovalAction(actor('delegate-1', 'vice_president'), policy(), c, [], { action: 'approved' }))
      .toMatchObject({ allowed: false, code: 'NOT_AN_ELIGIBLE_APPROVER' })
    const history = [act('named-1', 'delegated', { delegatedToUserId: 'delegate-1' })]
    expect(evaluateApprovalAction(actor('delegate-1', 'vice_president'), policy(), c, history, { action: 'approved' }))
      .toEqual({ allowed: true })
  })

  it('withdrawal requires a standing approval by the same actor', () => {
    expect(evaluateApprovalAction(actor('u1', 'president'), policy(), chain(), [], { action: 'withdrawn' }))
      .toMatchObject({ allowed: false, code: 'NOTHING_TO_WITHDRAW' })
    expect(evaluateApprovalAction(actor('u1', 'president'), policy(), chain(), [act('u1', 'approved')], { action: 'withdrawn' }))
      .toEqual({ allowed: true })
  })

  it('closes the chain once satisfied or rejected', () => {
    const satisfied = [act('u1', 'approved'), act('u2', 'approved')]
    expect(isChainSatisfied(chain(), satisfied)).toBe(true)
    expect(evaluateApprovalAction(actor('u3', 'president'), policy(), chain(), satisfied, { action: 'approved' }))
      .toMatchObject({ allowed: false, code: 'CHAIN_CLOSED' })
    expect(evaluateApprovalAction(actor('u3', 'president'), policy(), chain(), [act('u1', 'rejected')], { action: 'approved' }))
      .toMatchObject({ allowed: false, code: 'CHAIN_CLOSED' })
  })

  it('a withdrawn approval no longer counts toward satisfaction', () => {
    const history = [act('u1', 'approved'), act('u2', 'approved'), act('u1', 'withdrawn')]
    expect(isChainSatisfied(chain(), history)).toBe(false)
  })
})

describe('policy approval authority — lifecycle gating', () => {
  it('only a satisfied chain permits transition to approved state', () => {
    const c = chain()
    const none = new Map<string, ApprovalActionRecord[]>()
    expect(mayTransitionToApprovedState([], none)).toBe(false)
    expect(mayTransitionToApprovedState([c], none)).toBe(false)
    expect(mayTransitionToApprovedState([c], new Map([['ch-1', [act('u1', 'approved')]]]))).toBe(false)
    expect(mayTransitionToApprovedState([c], new Map([['ch-1', [act('u1', 'approved'), act('u2', 'approved')]]]))).toBe(true)
  })
})
