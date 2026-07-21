import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  grievanceSelect: vi.fn(),
  userSelect: vi.fn(),
}));

// The resolver calls db.select().from(grievances)... and db.select().from(users)...
// We stub db.select with a thenable that resolves to what each subsequent call needs.
const selectCalls: Array<'grievance' | 'user'> = [];

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => {
      const call = selectCalls.shift();
      const builder: Record<string, unknown> = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn(() => {
          if (call === 'grievance') return Promise.resolve(mocks.grievanceSelect());
          if (call === 'user') return Promise.resolve(mocks.userSelect());
          return Promise.resolve([]);
        }),
      };
      return builder;
    }),
  },
}));

vi.mock('@/db/schema/grievance-schema', () => ({
  grievances: { id: {}, organizationId: {}, grievantId: {}, grievantEmail: {}, grievantName: {}, unionRepId: {} },
}));
vi.mock('@/db/schema/user-management-schema', () => ({
  users: { userId: {}, email: {}, isActive: {}, accountLockedUntil: {}, locale: {} },
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn(),
  isNull: vi.fn(),
  isNotNull: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { resolveGrievanceDeadlineRecipients } from '../recipient-resolver';

const ORG = '00000000-0000-0000-0000-000000000010';
const GRIEV = '00000000-0000-0000-0000-000000000020';
const DL = '00000000-0000-0000-0000-000000000030';

describe('recipient-resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCalls.length = 0;
  });

  it('rejects unknown source table (claim_deadlines is Phase B)', async () => {
    await expect(
      resolveGrievanceDeadlineRecipients({
        sourceTable: 'claim_deadlines',
        sourceDeadlineId: DL,
        grievanceId: GRIEV,
        correlationId: 'c-1',
      }),
    ).rejects.toThrow(/not yet supported.*Phase A grievance-only/);
  });

  it('throws when grievanceId is missing', async () => {
    await expect(
      resolveGrievanceDeadlineRecipients({
        sourceTable: 'grievance_deadlines',
        sourceDeadlineId: DL,
        grievanceId: null,
        correlationId: 'c-1',
      }),
    ).rejects.toThrow(/grievanceId is required/);
  });

  it('throws when grievance is not found', async () => {
    selectCalls.push('grievance');
    mocks.grievanceSelect.mockReturnValueOnce([]);
    await expect(
      resolveGrievanceDeadlineRecipients({
        sourceTable: 'grievance_deadlines',
        sourceDeadlineId: DL,
        grievanceId: GRIEV,
        correlationId: 'c-1',
      }),
    ).rejects.toThrow(/grievance .* not found/);
  });

  it('resolves grievor recipient and lower-cases the email', async () => {
    selectCalls.push('grievance');
    mocks.grievanceSelect.mockReturnValueOnce([
      {
        id: GRIEV,
        organizationId: ORG,
        grievantId: 'u-griev',
        grievantEmail: '  Grievor@Example.COM  ',
        grievantName: 'Alice',
        unionRepId: null,
      },
    ]);
    const result = await resolveGrievanceDeadlineRecipients({
      sourceTable: 'grievance_deadlines',
      sourceDeadlineId: DL,
      grievanceId: GRIEV,
      correlationId: 'c-1',
    });
    expect(result.organizationId).toBe(ORG);
    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0]).toMatchObject({
      role: 'grievor',
      email: 'grievor@example.com',
      userId: 'u-griev',
    });
    // org_admin skipped because Phase B; assigned_officer skipped because no unionRepId
    expect(result.skipped.map((s) => s.role).sort()).toEqual(['assigned_officer', 'org_admin']);
  });

  it('resolves both grievor and assigned officer', async () => {
    selectCalls.push('grievance', 'user');
    mocks.grievanceSelect.mockReturnValueOnce([
      {
        id: GRIEV,
        organizationId: ORG,
        grievantId: 'u-griev',
        grievantEmail: 'griev@example.com',
        grievantName: 'Alice',
        unionRepId: 'u-rep',
      },
    ]);
    mocks.userSelect.mockReturnValueOnce([
      { userId: 'u-rep', email: 'rep@example.com', locale: 'fr-CA' },
    ]);
    const result = await resolveGrievanceDeadlineRecipients({
      sourceTable: 'grievance_deadlines',
      sourceDeadlineId: DL,
      grievanceId: GRIEV,
      correlationId: 'c-1',
    });
    expect(result.recipients).toHaveLength(2);
    expect(result.recipients.find((r) => r.role === 'grievor')?.email).toBe('griev@example.com');
    const officer = result.recipients.find((r) => r.role === 'assigned_officer');
    expect(officer?.email).toBe('rep@example.com');
    expect(officer?.locale).toBe('fr'); // fr-CA reduced to primary tag
  });

  it('skips assigned officer when user is not found / inactive / missing email', async () => {
    selectCalls.push('grievance', 'user');
    mocks.grievanceSelect.mockReturnValueOnce([
      {
        id: GRIEV,
        organizationId: ORG,
        grievantId: 'u-griev',
        grievantEmail: 'griev@example.com',
        grievantName: 'Alice',
        unionRepId: 'u-inactive',
      },
    ]);
    mocks.userSelect.mockReturnValueOnce([]); // inactive/locked/missing → filter excluded
    const result = await resolveGrievanceDeadlineRecipients({
      sourceTable: 'grievance_deadlines',
      sourceDeadlineId: DL,
      grievanceId: GRIEV,
      correlationId: 'c-1',
    });
    expect(result.recipients.map((r) => r.role)).toEqual(['grievor']);
    const officerSkip = result.skipped.find((s) => s.role === 'assigned_officer');
    expect(officerSkip?.reason).toMatch(/not found, inactive, or missing email/);
  });

  it('dedupes recipients when grievor and officer share the same email (first wins)', async () => {
    selectCalls.push('grievance', 'user');
    mocks.grievanceSelect.mockReturnValueOnce([
      {
        id: GRIEV,
        organizationId: ORG,
        grievantId: 'u-griev',
        grievantEmail: 'shared@example.com',
        grievantName: 'Alice',
        unionRepId: 'u-rep',
      },
    ]);
    mocks.userSelect.mockReturnValueOnce([
      { userId: 'u-rep', email: 'shared@example.com', locale: 'en' },
    ]);
    const result = await resolveGrievanceDeadlineRecipients({
      sourceTable: 'grievance_deadlines',
      sourceDeadlineId: DL,
      grievanceId: GRIEV,
      correlationId: 'c-1',
    });
    // grievor wins (first-in-list)
    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0].role).toBe('grievor');
  });

  it('marks org_admin as skipped Phase B in every case', async () => {
    selectCalls.push('grievance');
    mocks.grievanceSelect.mockReturnValueOnce([
      {
        id: GRIEV,
        organizationId: ORG,
        grievantId: 'u-griev',
        grievantEmail: 'griev@example.com',
        grievantName: 'Alice',
        unionRepId: null,
      },
    ]);
    const result = await resolveGrievanceDeadlineRecipients({
      sourceTable: 'grievance_deadlines',
      sourceDeadlineId: DL,
      grievanceId: GRIEV,
      correlationId: 'c-1',
    });
    const orgAdminSkip = result.skipped.find((s) => s.role === 'org_admin');
    expect(orgAdminSkip?.reason).toMatch(/Phase B/);
  });
});
