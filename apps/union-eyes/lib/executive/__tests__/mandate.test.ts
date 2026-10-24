import { describe, expect, it } from 'vitest';
import {
  evaluateExecutiveAction,
  loadVerifiedMandates,
  type ExecutiveDelegation,
  type ExecutiveMandate,
  type ExecutiveOffice,
  type MandateRequest,
} from '../mandate';

const ORG = 'org-a';
const NOW = new Date('2026-10-23T12:00:00Z');
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

function delegation(over: Partial<ExecutiveDelegation> = {}): ExecutiveDelegation {
  return { action: 'expenditure.approve', organizationId: ORG, effectiveFrom: day(-10), expiresAt: day(10), limit: 500, ...over };
}

function mandate(office: ExecutiveOffice, over: Partial<ExecutiveMandate> = {}): ExecutiveMandate {
  return {
    userId: 'u1', organizationId: ORG, office, capacity: 'elected',
    termStart: day(-100), termEnd: day(100), verified: true, delegations: [delegation()], ...over,
  };
}

function request(over: Partial<MandateRequest> = {}): MandateRequest {
  return {
    userId: 'u1', organizationId: ORG, action: 'expenditure.approve', now: NOW,
    mandates: [mandate('secretary_treasurer')], activeOffice: 'secretary_treasurer',
    amount: 100, requesterUserId: 'u2', ...over,
  };
}

const reason = (r: MandateRequest) => {
  const d = evaluateExecutiveAction(r);
  return d.allowed ? 'allowed' : d.reason;
};

describe('executive mandate evaluation', () => {
  it('allows only when verified office, term, delegation, limit and independence all hold', () => {
    expect(reason(request())).toBe('allowed');
  });

  it('fails closed when no authoritative mandate exists (the current production state)', async () => {
    await expect(loadVerifiedMandates('u1', ORG)).resolves.toEqual([]);
    expect(reason(request({ mandates: [] }))).toBe('NO_VERIFIED_MANDATE');
  });

  it('does not let a title stand in for a delegation (president without delegation)', () => {
    const president = mandate('president', { delegations: [] });
    expect(reason(request({ mandates: [president], activeOffice: 'president' }))).toBe('NO_DELEGATION');
    expect(reason(request({ mandates: [president], activeOffice: 'president', action: 'correspondence.sign' }))).toBe('NO_DELEGATION');
  });

  it('keeps a vice-president from exercising presidential delegations they do not hold', () => {
    const vp = mandate('vice_president', { delegations: [delegation({ action: 'correspondence.sign' })] });
    expect(reason(request({ mandates: [vp], activeOffice: 'vice_president', action: 'correspondence.sign' }))).toBe('allowed');
    expect(reason(request({ mandates: [vp], activeOffice: 'vice_president', action: 'agreement.sign' }))).toBe('NO_DELEGATION');
  });

  it('denies acting authority after the delegation expires, and before it starts', () => {
    const acting = mandate('acting_officer', { capacity: 'acting', delegations: [delegation({ action: 'agreement.sign', expiresAt: day(-1) })] });
    expect(reason(request({ mandates: [acting], activeOffice: 'acting_officer', action: 'agreement.sign' }))).toBe('NO_DELEGATION');
    const future = mandate('acting_officer', { capacity: 'acting', delegations: [delegation({ action: 'agreement.sign', effectiveFrom: day(1) })] });
    expect(reason(request({ mandates: [future], activeOffice: 'acting_officer', action: 'agreement.sign' }))).toBe('NO_DELEGATION');
  });

  it('re-evaluates authority at term end and on revocation (former officer)', () => {
    expect(reason(request({ mandates: [mandate('secretary_treasurer', { termEnd: day(-1) })] }))).toBe('OUTSIDE_TERM');
    expect(reason(request({ mandates: [mandate('secretary_treasurer', { termStart: day(1) })] }))).toBe('OUTSIDE_TERM');
    expect(reason(request({ mandates: [mandate('secretary_treasurer', { revokedAt: day(-1) })] }))).toBe('OUTSIDE_TERM');
  });

  it('rejects an unverified mandate and a mandate for another organization', () => {
    expect(reason(request({ mandates: [mandate('secretary_treasurer', { verified: false })] }))).toBe('MANDATE_UNVERIFIED');
    expect(reason(request({ organizationId: 'org-b' }))).toBe('WRONG_ORGANIZATION');
  });

  it('applies the monetary limit and requires an amount', () => {
    expect(reason(request({ amount: 500 }))).toBe('allowed');
    expect(reason(request({ amount: 500.01 }))).toBe('LIMIT_EXCEEDED');
    expect(reason(request({ amount: undefined }))).toBe('AMOUNT_REQUIRED');
    expect(reason(request({ amount: Number.NaN }))).toBe('AMOUNT_REQUIRED');
    expect(reason(request({ mandates: [mandate('secretary_treasurer', { delegations: [delegation({ limit: undefined })] })] }))).toBe('LIMIT_EXCEEDED');
  });

  it('denies a treasurer approving their own expenditure, and an unknown requester', () => {
    expect(reason(request({ requesterUserId: 'u1' }))).toBe('SELF_APPROVAL');
    expect(reason(request({ requesterUserId: undefined }))).toBe('REQUESTER_REQUIRED');
  });

  it('denies a recused officer', () => {
    expect(reason(request({ recusedUserIds: ['u1'] }))).toBe('RECUSED');
  });

  it('never lets one officer adopt a decision or certify an election, whatever their office', () => {
    for (const office of ['president', 'vice_president', 'secretary_treasurer', 'board_member', 'executive_director'] as const) {
      const m = mandate(office, { delegations: [delegation({ action: 'decision.adopt' }), delegation({ action: 'election.certify' })] });
      expect(reason(request({ mandates: [m], activeOffice: office, action: 'decision.adopt' }))).toBe('COLLECTIVE_BODY_REQUIRED');
      expect(reason(request({ mandates: [m], activeOffice: office, action: 'election.certify' }))).toBe('INDEPENDENT_ELECTION_AUTHORITY_REQUIRED');
    }
  });

  it('requires a matter-level grant for confidential matters, regardless of seniority', () => {
    const president = mandate('president');
    expect(reason(request({ mandates: [president], activeOffice: 'president', action: 'matter.view' }))).toBe('MATTER_GRANT_REQUIRED');
    expect(reason(request({ mandates: [president], activeOffice: 'president', action: 'matter.view', matterGrantActive: true }))).toBe('allowed');
  });

  it('requires a declared capacity for multi-office holders and does not merge their powers', () => {
    const treasurer = mandate('secretary_treasurer');
    const president = mandate('president', { delegations: [] });
    const both = [treasurer, president];
    expect(reason(request({ mandates: both, activeOffice: 'secretary_treasurer' }))).toBe('allowed');
    expect(reason(request({ mandates: both, activeOffice: 'president' }))).toBe('NO_DELEGATION');
    expect(reason(request({ mandates: both, activeOffice: null }))).toBe('NOT_ACTING_IN_THAT_CAPACITY');
    expect(reason(request({ mandates: both, activeOffice: 'vice_president' }))).toBe('NOT_ACTING_IN_THAT_CAPACITY');
  });

  it("ignores another person's mandate", () => {
    expect(reason(request({ mandates: [mandate('secretary_treasurer', { userId: 'someone-else' })] }))).toBe('NO_VERIFIED_MANDATE');
  });
});
