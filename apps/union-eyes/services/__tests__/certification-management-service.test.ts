import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'orderBy', 'insert', 'update', 'set', 'values', 'returning', 'delete']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const db = {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
  };
  return { queue, db };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema/certification-management-schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
}));

import { CertificationManagementService } from '../certification-management-service';

const push = (...items: unknown[]) => h.queue.push(...items);

beforeEach(() => {
  h.queue.length = 0;
  vi.clearAllMocks();
});

const renewableType = {
  id: 't1',
  certificationName: 'CPA',
  requiresRenewal: true,
  renewalFrequencyMonths: '12',
  continuingEducationRequired: true,
  ceHoursRequired: '40',
};

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

describe('CertificationManagementService.issueCertification', () => {
  it('issues a renewable certification and schedules a 90-day alert', async () => {
    push([renewableType]); // certType lookup
    push([{ id: 'c1' }]); // insert returning
    push([]); // logAuditAction insert
    push([]); // scheduleExpiryAlerts 90-day insert
    const result = await CertificationManagementService.issueCertification(
      {
        userId: 'u1',
        fullName: 'Jane',
        role: 'rep',
        certificationTypeId: 't1',
        certificationNumber: 'CN-1',
        issuedDate: new Date('2024-01-01'),
        expiryDate: daysFromNow(60),
      },
      'admin'
    );
    expect(result).toEqual({ id: 'c1' });
  });

  it('schedules a 30-day alert when expiry is close', async () => {
    push([{ ...renewableType, requiresRenewal: false }]);
    push([{ id: 'c2' }]);
    push([]);
    push([]); // 30-day insert
    const r = await CertificationManagementService.issueCertification(
      {
        userId: 'u1', fullName: 'Jane', role: 'rep', certificationTypeId: 't1',
        certificationNumber: 'CN-2', issuedDate: new Date('2024-01-01'), expiryDate: daysFromNow(15),
      },
      'admin'
    );
    expect(r).toEqual({ id: 'c2' });
  });

  it('schedules an expired alert and marks certification expired', async () => {
    push([renewableType]);
    push([{ id: 'c3' }]);
    push([]); // audit
    push([]); // expired alert insert
    push([]); // staffCertifications update
    const r = await CertificationManagementService.issueCertification(
      {
        userId: 'u1', fullName: 'Jane', role: 'rep', certificationTypeId: 't1',
        certificationNumber: 'CN-3', issuedDate: new Date('2024-01-01'), expiryDate: daysFromNow(-5),
      },
      'admin'
    );
    expect(r).toEqual({ id: 'c3' });
  });

  it('issues without an expiry date (no alerts scheduled)', async () => {
    push([{ ...renewableType, requiresRenewal: false, renewalFrequencyMonths: null }]);
    push([{ id: 'c4' }]);
    push([]); // audit
    const r = await CertificationManagementService.issueCertification(
      {
        userId: 'u1', fullName: 'Jane', role: 'rep', certificationTypeId: 't1',
        certificationNumber: 'CN-4', issuedDate: new Date('2024-01-01'),
      },
      'admin'
    );
    expect(r).toEqual({ id: 'c4' });
  });

  it('throws when the certification type is not found', async () => {
    push([]);
    await expect(
      CertificationManagementService.issueCertification(
        {
          userId: 'u1', fullName: 'Jane', role: 'rep', certificationTypeId: 'bad',
          certificationNumber: 'CN-X', issuedDate: new Date('2024-01-01'),
        },
        'admin'
      )
    ).rejects.toThrow('Certification type not found');
  });
});

describe('CertificationManagementService.recordCECompletion', () => {
  it('records CE hours and logs an audit entry', async () => {
    push([{ id: 'ce1' }]); // insert returning
    push([]); // audit
    const r = await CertificationManagementService.recordCECompletion(
      {
        userId: 'u1', certificationId: 'c1', courseTitle: 'Ethics',
        courseProvider: 'Provider', courseDate: new Date('2024-02-01'),
        ceHoursEarned: 5, ceCategory: 'general',
      },
      'verifier'
    );
    expect(r).toEqual({ id: 'ce1' });
  });

  it('accepts a string course date', async () => {
    push([{ id: 'ce2' }]);
    push([]);
    const r = await CertificationManagementService.recordCECompletion(
      {
        userId: 'u1', certificationId: 'c1', courseTitle: 'Ethics',
        courseProvider: 'Provider', courseDate: '2024-02-01' as unknown as Date,
        ceHoursEarned: 3, ceCategory: 'general',
      },
      'verifier'
    );
    expect(r).toEqual({ id: 'ce2' });
  });
});

describe('CertificationManagementService.checkCECompliance', () => {
  it('reports compliance when hours meet the requirement', async () => {
    push([{ id: 'c1', certificationTypeId: 't1' }]); // cert
    push([renewableType]); // certType
    push([{ ceHoursEarned: '25' }, { ceHoursEarned: '20' }]); // ce records
    const r = await CertificationManagementService.checkCECompliance('c1');
    expect(r.compliant).toBe(true);
    expect(r.hoursRequired).toBe(40);
    expect(r.hoursCompleted).toBe(45);
    expect(r.hoursRemaining).toBe(0);
  });

  it('reports non-compliance with remaining hours', async () => {
    push([{ id: 'c1', certificationTypeId: 't1' }]);
    push([renewableType]);
    push([{ ceHoursEarned: '10' }]);
    const r = await CertificationManagementService.checkCECompliance('c1');
    expect(r.compliant).toBe(false);
    expect(r.hoursRemaining).toBe(30);
  });

  it('returns trivially compliant when CE is not required', async () => {
    push([{ id: 'c1', certificationTypeId: 't1' }]);
    push([{ ...renewableType, continuingEducationRequired: false }]);
    const r = await CertificationManagementService.checkCECompliance('c1');
    expect(r).toEqual({ compliant: true, hoursRequired: 0, hoursCompleted: 0, hoursRemaining: 0 });
  });

  it('throws when the certification is not found', async () => {
    push([]);
    await expect(CertificationManagementService.checkCECompliance('bad')).rejects.toThrow('Certification not found');
  });
});

describe('CertificationManagementService.initiateRenewal', () => {
  it('creates a renewal record after checking CE compliance', async () => {
    push([{ id: 'c1', certificationTypeId: 't1', userId: 'u1', nextRenewalDue: new Date('2025-01-01'), certificationNumber: 'CN-1' }]); // cert
    // checkCECompliance: cert, certType, ce records
    push([{ id: 'c1', certificationTypeId: 't1' }]);
    push([renewableType]);
    push([{ ceHoursEarned: '40' }]);
    push([{ id: 'r1' }]); // insert renewal returning
    push([]); // audit
    const r = await CertificationManagementService.initiateRenewal('c1', 'admin');
    expect(r).toEqual({ id: 'r1' });
  });

  it('uses today as the renewal due date when none exists', async () => {
    push([{ id: 'c1', certificationTypeId: 't1', userId: 'u1', nextRenewalDue: null, certificationNumber: 'CN-1' }]);
    push([{ id: 'c1', certificationTypeId: 't1' }]);
    push([renewableType]);
    push([{ ceHoursEarned: '40' }]);
    push([{ id: 'r2' }]);
    push([]);
    const r = await CertificationManagementService.initiateRenewal('c1', 'admin');
    expect(r).toEqual({ id: 'r2' });
  });

  it('throws when the certification is not found', async () => {
    push([]);
    await expect(CertificationManagementService.initiateRenewal('bad', 'admin')).rejects.toThrow('Certification not found');
  });
});

describe('CertificationManagementService.completeRenewal', () => {
  it('completes a renewal and updates the certification', async () => {
    push([{ id: 'r1', certificationId: 'c1' }]); // renewal lookup
    push([]); // update renewal
    push([{ id: 'c1', certificationTypeId: 't1', userId: 'u1' }]); // cert lookup
    push([renewableType]); // certType lookup
    push([]); // update certification
    push([]); // scheduleExpiryAlerts (expiry far out -> no insert) -- safe default
    push([]); // audit
    await expect(
      CertificationManagementService.completeRenewal('r1', daysFromNow(60), 'admin')
    ).resolves.toBeUndefined();
  });

  it('completes a renewal even when the certification lookup is empty', async () => {
    push([{ id: 'r1', certificationId: 'c1' }]);
    push([]); // update renewal
    push([]); // cert lookup empty -> skip block
    await expect(
      CertificationManagementService.completeRenewal('r1', daysFromNow(60), 'admin')
    ).resolves.toBeUndefined();
  });

  it('throws when the renewal is not found', async () => {
    push([]);
    await expect(
      CertificationManagementService.completeRenewal('bad', daysFromNow(60), 'admin')
    ).rejects.toThrow('Renewal not found');
  });
});

describe('CertificationManagementService queries', () => {
  it('getExpiredCertifications returns rows', async () => {
    push([{ id: 'c1' }]);
    expect(await CertificationManagementService.getExpiredCertifications()).toEqual([{ id: 'c1' }]);
  });

  it('getExpiringSoon filters by expiry within 90 days', async () => {
    push([
      { id: 'c1', expiryDate: daysFromNow(30).toISOString() },
      { id: 'c2', expiryDate: daysFromNow(200).toISOString() },
      { id: 'c3', expiryDate: null },
    ]);
    const r = await CertificationManagementService.getExpiringSoon();
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('c1');
  });

  it('generateComplianceReport aggregates certification stats', async () => {
    push([
      { id: 'c1', userId: 'u1', status: 'active' },
      { id: 'c2', userId: 'u1', status: 'expired' },
      { id: 'c3', userId: 'u2', status: 'pending_renewal' },
    ]); // allCerts
    push([{ id: 'c1', status: 'active', expiryDate: daysFromNow(30).toISOString() }]); // getExpiringSoon
    push([{ id: 'rep1' }]); // insert returning
    const r = await CertificationManagementService.generateComplianceReport('2024-Q1', 'admin');
    expect(r).toEqual({ id: 'rep1' });
  });

  it('generateComplianceReport handles an empty certification set', async () => {
    push([]); // allCerts
    push([]); // getExpiringSoon
    push([{ id: 'rep2' }]);
    const r = await CertificationManagementService.generateComplianceReport('2024-Q2', 'admin');
    expect(r).toEqual({ id: 'rep2' });
  });

  it('getUserCertifications returns rows', async () => {
    push([{ id: 'c1' }]);
    expect(await CertificationManagementService.getUserCertifications('u1')).toEqual([{ id: 'c1' }]);
  });

  it('getUserAlerts returns rows (default unresolved)', async () => {
    push([{ id: 'a1' }]);
    expect(await CertificationManagementService.getUserAlerts('u1')).toEqual([{ id: 'a1' }]);
  });

  it('getUserAlerts accepts a resolved flag', async () => {
    push([{ id: 'a2' }]);
    expect(await CertificationManagementService.getUserAlerts('u1', true)).toEqual([{ id: 'a2' }]);
  });
});
