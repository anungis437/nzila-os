import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const q: unknown[] = [];
  const num = (n: number) => ({ toNumber: () => n });
  const processor = {
    type: 'cpp',
    getCapabilities: vi.fn(() => ({
      minimumAge: 18,
      maximumAge: 71,
      supportsBuyBack: true,
      supportsEarlyRetirement: false,
    })),
    getContributionRates: vi.fn(async () => ({
      taxYear: 2024,
      employeeRate: num(0.0595),
      employerRate: num(0.0595),
      yearlyMaximumPensionableEarnings: num(68500),
      basicExemptAmount: num(3500),
      yearlyMaximumContribution: num(3867),
    })),
    calculateContribution: vi.fn(async () => ({
      employeeContribution: num(100),
      employerContribution: num(100),
      totalContribution: num(200),
      pensionableEarnings: num(5000),
      grossEarnings: num(5000),
      basicExemptAmount: num(291),
      planType: 'CPP',
      contributionPeriod: 'MONTHLY',
      employeeRate: 0.0595,
      employerRate: 0.0595,
    })),
    createRemittance: vi.fn(async () => ({
      id: 'rem1',
      planType: 'CPP',
      remittanceYear: 2024,
      remittanceMonth: 3,
      totalEmployeeContributions: num(100),
      totalEmployerContributions: num(100),
      totalContributions: num(200),
      numberOfMembers: 1,
    })),
    submitRemittance: vi.fn(async () => ({
      planType: 'CPP',
      remittanceYear: 2024,
      remittanceMonth: 3,
      totalEmployeeContributions: num(100),
      totalEmployerContributions: num(100),
      totalContributions: num(200),
      numberOfMembers: 1,
      confirmationNumber: 'CONF-1',
      remittanceDate: new Date(),
    })),
  };
  const factory = {
    getInstance: vi.fn(),
    getAvailableProcessors: vi.fn(() => ['cpp']),
    getProcessor: vi.fn(() => processor),
    getDefaultProcessor: vi.fn(() => processor),
  };
  factory.getInstance.mockReturnValue(factory);
  const adapter = { sync: vi.fn(async () => ({ recordsCreated: 3, recordsUpdated: 2 })) };
  const integrationFactory = {
    getInstance: vi.fn(),
    getIntegration: vi.fn(async () => adapter),
  };
  integrationFactory.getInstance.mockReturnValue(integrationFactory);
  return { q, num, processor, factory, adapter, integrationFactory, getSystemStatus: vi.fn(async () => ({ status: 'ok' })) };
});

function makeChain() {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'from', 'where', 'limit', 'offset', 'orderBy', 'groupBy', 'values', 'returning', 'set']) {
    chain[m] = () => chain;
  }
  chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
    const v = h.q.length ? h.q.shift() : [];
    return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
  };
  return chain;
}

vi.mock('@/db', () => ({
  db: {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
  },
}));
vi.mock('@/db/schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
  count: vi.fn(() => ({})),
}));
vi.mock('@/lib/monitoring/status-page', () => ({ getSystemStatus: h.getSystemStatus }));
vi.mock('@/lib/pension-processor', () => ({ PensionProcessorFactory: h.factory }));
vi.mock('@/lib/pension-processor/types', () => ({
  EmploymentStatus: { FULL_TIME: 'full_time' },
  PensionPlanType: { CPP: 'cpp' },
  ContributionPeriod: { MONTHLY: 'monthly' },
}));
vi.mock('@/lib/integrations/factory', () => ({ IntegrationFactory: h.integrationFactory }));
vi.mock('@/lib/integrations/types', () => ({
  IntegrationProvider: {
    SUN_LIFE: 'sun_life',
    MANULIFE: 'manulife',
    GREEN_SHIELD_CANADA: 'green_shield_canada',
    CANADA_LIFE: 'canada_life',
    INDUSTRIAL_ALLIANCE: 'industrial_alliance',
  },
  SyncType: { FULL: 'full' },
}));

import { resolvers } from '../resolvers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Q = resolvers.Query as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const M = resolvers.Mutation as any;
const ctx = {} as never;

const remRow = {
  id: 'r1',
  remittanceYear: 2024,
  remittanceMonth: 3,
  totalAmount: '1500.50',
  totalMembers: 12,
  status: 'pending',
  paymentReference: 'PAY-1',
  submittedDate: '2024-03-15',
  createdAt: '2024-03-01',
};

beforeEach(() => {
  h.q.length = 0;
  vi.clearAllMocks();
  h.factory.getInstance.mockReturnValue(h.factory);
  h.factory.getAvailableProcessors.mockReturnValue(['cpp']);
  h.factory.getProcessor.mockReturnValue(h.processor);
  h.factory.getDefaultProcessor.mockReturnValue(h.processor);
  h.integrationFactory.getInstance.mockReturnValue(h.integrationFactory);
  h.integrationFactory.getIntegration.mockResolvedValue(h.adapter);
});

describe('Query resolvers', () => {
  it('claim returns the row or null', async () => {
    h.q.push([{ claimId: 'c1' }]);
    expect(await Q.claim(null, { id: 'c1' }, ctx)).toEqual({ claimId: 'c1' });
    h.q.push([]);
    expect(await Q.claim(null, { id: 'x' }, ctx)).toBeNull();
  });

  it('claims returns a connection (with and without status filter)', async () => {
    h.q.push([{ claimId: 'c1' }, { claimId: 'c2' }]);
    const withFilter = await Q.claims(null, { filters: { status: 'open' }, pagination: { first: 2 } }, ctx);
    expect(withFilter.totalCount).toBe(2);
    expect(withFilter.edges).toHaveLength(2);
    expect(withFilter.pageInfo.hasNextPage).toBe(true);

    h.q.push([]);
    const empty = await Q.claims(null, {}, ctx);
    expect(empty.totalCount).toBe(0);
    expect(empty.pageInfo.startCursor).toBeNull();
  });

  it('member returns the row or null', async () => {
    h.q.push([{ userId: 'u1' }]);
    expect(await Q.member(null, { id: 'u1' }, ctx)).toEqual({ userId: 'u1' });
    h.q.push([]);
    expect(await Q.member(null, { id: 'x' }, ctx)).toBeNull();
  });

  it('members returns a connection (with and without status)', async () => {
    h.q.push([{ userId: 'u1' }]);
    const r = await Q.members(null, { status: 'active', pagination: { first: 1 } }, ctx);
    expect(r.totalCount).toBe(1);
    expect(r.pageInfo.hasNextPage).toBe(true);
    h.q.push([]);
    const r2 = await Q.members(null, {}, ctx);
    expect(r2.totalCount).toBe(0);
  });

  it('pensionProcessors lists available processors', async () => {
    const r = await Q.pensionProcessors();
    expect(r).toHaveLength(1);
    expect(r[0].supportsBuyBack).toBe(true);
  });

  it('pensionProcessor returns one processor', async () => {
    const r = await Q.pensionProcessor(null, { planType: 'cpp' });
    expect(r.type).toBe('cpp');
  });

  it('contributionRates returns numeric rates', async () => {
    const r = await Q.contributionRates(null, { planType: 'cpp', year: 2024 });
    expect(r.employeeRate).toBeCloseTo(0.0595);
    expect(r.maximumPensionableEarnings).toBe(68500);
  });

  it('remittance returns mapped row or null', async () => {
    h.q.push([remRow]);
    const r = await Q.remittance(null, { id: 'r1' });
    expect(r.planType).toBe('PER_CAPITA');
    expect(r.totalContributions).toBeCloseTo(1500.5);
    expect(r.status).toBe('PENDING');
    h.q.push([]);
    expect(await Q.remittance(null, { id: 'x' })).toBeNull();
  });

  it('remittances returns mapped rows (with and without status)', async () => {
    h.q.push([remRow]);
    const r = await Q.remittances(null, { status: 'PENDING' });
    expect(r).toHaveLength(1);
    h.q.push([{ ...remRow, totalAmount: null, status: null, submittedDate: null, createdAt: null }]);
    const r2 = await Q.remittances(null, {});
    expect(r2[0].status).toBe('PENDING');
    expect(r2[0].totalContributions).toBe(0);
  });

  it('insuranceClaims maps rows (all filters and none)', async () => {
    h.q.push([{
      id: 'ic1', claimNumber: 'IC-1', externalProvider: 'sun_life', employeeName: 'Jane',
      submissionDate: '2024-01-01', claimType: 'dental', claimAmount: '200.00',
      approvedAmount: '180.00', paidAmount: '180.00', status: 'approved', providerName: 'Sun Life', serviceDate: '2024-01-01',
    }]);
    const r = await Q.insuranceClaims(null, {
      provider: 'SUN_LIFE', status: 'approved', startDate: '2024-01-01', endDate: '2024-02-01', pagination: { first: 10 },
    });
    expect(r[0].provider).toBe('SUN_LIFE');
    expect(r[0].claimAmount).toBe(200);

    h.q.push([{ id: 'ic2', claimNumber: 'IC-2', externalProvider: 'manulife', employeeName: null, submissionDate: null, claimType: null, claimAmount: null, approvedAmount: null, paidAmount: null, status: 'pending', providerName: null, serviceDate: null }]);
    const r2 = await Q.insuranceClaims(null, {});
    expect(r2[0].memberName).toBe('Unknown');
    expect(r2[0].claimAmount).toBe(0);
  });

  it('insurancePolicies maps rows (all filters and none)', async () => {
    h.q.push([{
      id: 'p1', externalProvider: 'manulife', policyNumber: 'PN-1', policyType: 'health',
      employeeId: 'e1', coverageAmount: '10000', premium: '50', effectiveDate: '2024-01-01', terminationDate: null, status: 'active',
    }]);
    const r = await Q.insurancePolicies(null, { provider: 'MANULIFE', status: 'active' });
    expect(r[0].provider).toBe('MANULIFE');
    expect(r[0].coverageAmount).toBe(10000);

    h.q.push([{ id: 'p2', externalProvider: 'sun_life', policyNumber: 'PN-2', policyType: null, employeeId: null, coverageAmount: null, premium: null, effectiveDate: '2024-01-01', terminationDate: null, status: 'active' }]);
    const r2 = await Q.insurancePolicies(null, {});
    expect(r2[0].policyHolder).toBe('Unknown');
    expect(r2[0].premium).toBe(0);
  });

  it('insuranceConnections aggregates claim/policy counts', async () => {
    h.q.push([{ provider: 'sun_life', count: 2 }]);
    h.q.push([{ provider: 'manulife', count: 1 }]);
    const r = await Q.insuranceConnections();
    expect(r).toHaveLength(5);
    const sun = r.find((x: { provider: string }) => x.provider === 'SUN_LIFE');
    expect(sun.connected).toBe(true);
    expect(sun.claimsCount).toBe(2);
  });

  it('systemStatus delegates to status page', async () => {
    expect(await Q.systemStatus()).toEqual({ status: 'ok' });
  });
});

describe('Mutation resolvers', () => {
  it('createClaim inserts and returns the row', async () => {
    h.q.push([{ claimId: 'new' }]);
    const r = await M.createClaim(null, { input: { organizationId: 'o', memberId: 'm', description: 'd' } }, ctx);
    expect(r).toEqual({ claimId: 'new' });
  });

  it('createClaim applies defaults for optional fields', async () => {
    h.q.push([{ claimId: 'new2' }]);
    const r = await M.createClaim(null, { input: { organizationId: 'o', memberId: 'm', claimType: 'safety', priority: 'high', incidentDate: new Date(), location: 'site', desiredOutcome: 'fix' } }, ctx);
    expect(r).toEqual({ claimId: 'new2' });
  });

  it('updateClaim updates and returns the row', async () => {
    h.q.push([{ claimId: 'c1', status: 'closed' }]);
    const r = await M.updateClaim(null, { id: 'c1', input: { status: 'closed' } }, ctx);
    expect(r.status).toBe('closed');
  });

  it('deleteClaim returns true', async () => {
    h.q.push([]);
    expect(await M.deleteClaim(null, { id: 'c1' }, ctx)).toBe(true);
  });

  it('castVote returns true', async () => {
    expect(await M.castVote(null, { voteId: 'v', optionId: 'o' }, ctx)).toBe(true);
  });

  it('calculatePensionContribution returns numeric contribution', async () => {
    const r = await M.calculatePensionContribution(null, {
      input: { planType: 'cpp', memberId: 'm', dateOfBirth: '1980-01-01', province: 'ON', grossEarnings: 5000, yearToDateEarnings: 60000 },
    });
    expect(r.totalContribution).toBe(200);
    expect(r.basicExemption).toBe(291);
  });

  it('createRemittance calculates per-member contributions', async () => {
    const r = await M.createRemittance(null, {
      input: {
        planType: 'cpp', periodStart: '2024-03-01', periodEnd: '2024-03-31',
        contributions: [{ memberId: 'm1', grossEarnings: 5000 }, { memberId: 'm2', grossEarnings: 6000, pensionableEarnings: 6000 }],
      },
    });
    expect(r.id).toBe('rem1');
    expect(r.totalContributions).toBe(200);
    expect(h.processor.calculateContribution).toHaveBeenCalledTimes(2);
  });

  it('submitRemittance returns a submitted remittance', async () => {
    const r = await M.submitRemittance(null, { id: 'rem1' });
    expect(r.status).toBe('SUBMITTED');
    expect(r.confirmationNumber).toBe('CONF-1');
  });

  it('syncInsuranceProvider syncs a known provider', async () => {
    const r = await M.syncInsuranceProvider(null, { provider: 'SUN_LIFE' });
    expect(r.connected).toBe(true);
    expect(r.claimsCount).toBe(5);
  });

  it('syncInsuranceProvider returns disconnected for an unknown provider', async () => {
    const r = await M.syncInsuranceProvider(null, { provider: 'NOPE' });
    expect(r.connected).toBe(false);
    expect(r.claimsCount).toBe(0);
  });

  it('syncInsuranceProvider returns disconnected when the adapter throws', async () => {
    h.integrationFactory.getIntegration.mockRejectedValueOnce(new Error('sync fail'));
    const r = await M.syncInsuranceProvider(null, { provider: 'MANULIFE' });
    expect(r.connected).toBe(false);
  });
});

describe('field resolvers', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Claim = (resolvers as any).Claim;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Member = (resolvers as any).Member;

  it('Claim.claimant resolves the member or null', async () => {
    h.q.push([{ userId: 'm1' }]);
    expect(await Claim.claimant({ memberId: 'm1' }, {}, ctx)).toEqual({ userId: 'm1' });
    expect(await Claim.claimant({}, {}, ctx)).toBeNull();
  });

  it('Claim.assignee resolves the assignee or null', async () => {
    h.q.push([{ userId: 'a1' }]);
    expect(await Claim.assignee({ assignedTo: 'a1' }, {}, ctx)).toEqual({ userId: 'a1' });
    expect(await Claim.assignee({}, {}, ctx)).toBeNull();
  });

  it('Member.claims returns the member claims', async () => {
    h.q.push([{ claimId: 'c1' }, { claimId: 'c2' }]);
    const r = await Member.claims({ userId: 'u1' }, {}, ctx);
    expect(r).toHaveLength(2);
  });
});
