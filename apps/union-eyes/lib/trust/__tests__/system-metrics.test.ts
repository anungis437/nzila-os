import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  contexts: [] as Array<{ organizationId: string }>,
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  goldenShare: vi.fn(),
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (context: { organizationId: string }, work: (tx: unknown) => Promise<unknown>) => {
    mocks.contexts.push(context);
    return work({ execute: mocks.execute });
  },
}));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.loggerError, warn: mocks.loggerWarn, info: vi.fn() } }));
vi.mock('@/services/governance-service', () => ({
  GovernanceService: class {
    checkGoldenShareStatus = mocks.goldenShare;
  },
}));

import {
  exportTrustMetricsPDF,
  generateTrustSummary,
  getAuditLogMetrics,
  getImmutabilityMetrics,
  getRLSMetrics,
  getTrustMetrics,
} from '../system-metrics';
import { formatTableList } from '../format';
import type { TrustMetrics } from '@/types/marketing';

const dialect = new PgDialect();
const statement = (call: number) => dialect.sqlToQuery(mocks.execute.mock.calls[call][0]);

const metrics: TrustMetrics = {
  immutability: {
    status: 'active',
    verification: true,
    lastCheck: new Date('2026-05-24T00:00:00.000Z'),
    description: 'Immutable historical records verified.',
    triggersActive: true,
    tablesProtected: ['audit_logs', 'approval_records'],
    violationAttempts: null,
    lastAudit: new Date('2026-05-24T00:00:00.000Z'),
  },
  rlsEnforcement: {
    status: 'degraded',
    verification: false,
    lastCheck: new Date('2026-05-24T00:00:00.000Z'),
    description: '2 of 3 tables enforce row-level security.',
    policiesActive: 6,
    orgIsolation: '66%',
    lastPolicyCheck: new Date('2026-05-24T00:00:00.000Z'),
    tablesProtected: ['organizations', 'members'],
  },
  fsmValidation: {
    status: 'unknown',
    verification: false,
    lastCheck: new Date('2026-05-24T00:00:00.000Z'),
    description: 'FSM metrics source not configured.',
    invalidTransitionsBlocked: 0,
    complianceRate: 0,
    lastValidation: new Date('2026-05-24T00:00:00.000Z'),
  },
  governance: {
    status: 'active',
    verification: true,
    lastCheck: new Date('2026-05-24T00:00:00.000Z'),
    description: 'Golden share oversight is active.',
    goldenShareActive: true,
    goldenShareHolder: 'Member Oversight Council',
    lastElectionDate: new Date('2026-01-01T00:00:00.000Z'),
    reservedMattersProtection: 'active',
    upcomingElection: new Date('2027-01-01T00:00:00.000Z'),
  },
  auditLog: {
    status: 'active',
    verification: true,
    lastCheck: new Date('2026-05-24T00:00:00.000Z'),
    description: 'Audit trail is healthy.',
    eventsLogged: 1200,
    retentionPolicy: '7 years',
  },
  lastUpdated: new Date('2026-05-24T00:00:00.000Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.contexts.length = 0;
  mocks.execute.mockReset();
});

describe('getAuditLogMetrics', () => {
  it('counts the audit events of the organization, in the organization context', async () => {
    mocks.execute.mockResolvedValueOnce([{ count: 42 }]);

    const result = await getAuditLogMetrics('org-1');

    expect(result).toMatchObject({ status: 'active', verification: true, eventsLogged: 42 });
    expect(mocks.contexts).toEqual([{ organizationId: 'org-1' }]);
    const query = statement(0);
    expect(query.sql).toContain('FROM audit_logs');
    expect(query.sql).toMatch(/organization_id = \$1/);
    expect(query.params).toEqual(['org-1']);
  });

  it('reports an organization with no event as zero, from a real read', async () => {
    mocks.execute.mockResolvedValueOnce([{ count: 0 }]);

    expect(await getAuditLogMetrics('org-1')).toMatchObject({ status: 'active', eventsLogged: 0 });
  });

  it('reports a failed read as unknown, not as an audit trail that is fine', async () => {
    mocks.execute.mockRejectedValueOnce(new Error('connection lost'));

    const result = await getAuditLogMetrics('org-1');

    expect(result).toMatchObject({ status: 'unknown', verification: false });
    expect(mocks.loggerError).toHaveBeenCalled();
  });
});

describe('getRLSMetrics', () => {
  const tables = (enabled: boolean[]) => enabled.map((flag, index) => ({ table_name: `t${index}`, enabled: flag }));

  it('measures the share of the tables that carry an organization column and enforce row-level security', async () => {
    mocks.execute.mockResolvedValueOnce(tables([true, true, true, false])).mockResolvedValueOnce([{ count: 12 }]);

    const result = await getRLSMetrics('org-1');

    expect(result).toMatchObject({
      status: 'degraded',
      verification: false,
      policiesActive: 12,
      orgIsolation: '75%',
      tablesProtected: ['t0', 't1', 't2'],
    });
    expect(result.description).toBe('3 of 4 tables that carry an organization column enforce row-level security');
    expect(mocks.contexts).toEqual([{ organizationId: 'org-1' }]);
  });

  it('is active only when every table that carries an organization column is protected', async () => {
    mocks.execute.mockResolvedValueOnce(tables([true, true])).mockResolvedValueOnce([{ count: 4 }]);

    expect(await getRLSMetrics('org-1')).toMatchObject({ status: 'active', verification: true, orgIsolation: '100%' });
  });

  it('never rounds a share below one hundred percent up to it', async () => {
    mocks.execute.mockResolvedValueOnce(tables([...Array(999).fill(true), false])).mockResolvedValueOnce([{ count: 1 }]);

    expect((await getRLSMetrics('org-1')).orgIsolation).toBe('99%');
  });

  it('measures nothing when no table carries an organization column', async () => {
    mocks.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0 }]);

    expect(await getRLSMetrics('org-1')).toMatchObject({ status: 'unknown', verification: false, orgIsolation: 'Unknown' });
  });

  it('reports a failed read as unknown', async () => {
    mocks.execute.mockRejectedValueOnce(new Error('boom'));

    expect(await getRLSMetrics('org-1')).toMatchObject({ status: 'unknown', orgIsolation: 'Unknown', policiesActive: 0 });
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it('reads the catalogs, which are the same for every organization', async () => {
    mocks.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0 }]);

    await getRLSMetrics('org-1');

    expect(statement(0).sql).toContain('pg_class');
    expect(statement(0).sql).toContain("'organization_id', 'org_id'");
    expect(statement(1).sql).toContain('pg_policies');
  });
});

describe('getImmutabilityMetrics', () => {
  const row = (table_name: string, blocks_update: boolean, blocks_delete: boolean) => ({ table_name, blocks_update, blocks_delete });

  it('protects a history table only when an enabled trigger refuses both its updates and its deletes', async () => {
    mocks.execute.mockResolvedValueOnce([
      row('approval_records', true, true),
      row('audit_logs', true, true),
      row('claim_updates', true, false),
      row('grievance_transitions', true, true),
    ]);

    const result = await getImmutabilityMetrics('org-1');

    expect(result).toMatchObject({
      status: 'degraded',
      verification: false,
      triggersActive: false,
      tablesProtected: ['approval_records', 'audit_logs', 'grievance_transitions'],
      violationAttempts: null,
    });
    expect(result.description).toBe('3 of 4 history tables have enabled triggers that refuse both updates and deletes');
  });

  it('is active when every history table that exists is protected', async () => {
    mocks.execute.mockResolvedValueOnce(['audit_logs', 'claim_updates', 'grievance_transitions'].map((table) => row(table, true, true)));

    const result = await getImmutabilityMetrics('org-1');

    expect(result).toMatchObject({ status: 'active', verification: true, triggersActive: true });
    expect(result.description).toBe('3 of 3 history tables have enabled triggers that refuse both updates and deletes');
  });

  it('reports an error, and no protected table, when none has such a trigger', async () => {
    mocks.execute.mockResolvedValueOnce(['audit_logs', 'claim_updates'].map((table) => row(table, false, false)));

    expect(await getImmutabilityMetrics('org-1')).toMatchObject({ status: 'error', verification: false, tablesProtected: [] });
  });

  it('does not verify what does not exist', async () => {
    mocks.execute.mockResolvedValueOnce([]);

    expect(await getImmutabilityMetrics('org-1')).toMatchObject({
      status: 'unknown',
      verification: false,
      triggersActive: false,
      description: 'None of the history tables exists to be verified',
    });
  });

  it('reads pg_trigger, which hides nothing from the role, and does not invent a violation count', async () => {
    mocks.execute.mockResolvedValueOnce([]);

    const result = await getImmutabilityMetrics('org-1');

    expect(statement(0).sql).toContain('pg_trigger');
    expect(statement(0).sql).not.toContain('information_schema');
    expect(statement(0).params).toEqual(['grievance_transitions', 'approval_records', 'claim_updates', 'audit_logs']);
    expect(result.violationAttempts).toBeNull();
  });

  it('reports a failed read as unknown', async () => {
    mocks.execute.mockRejectedValueOnce(new Error('boom'));

    expect(await getImmutabilityMetrics('org-1')).toMatchObject({ status: 'unknown', verification: false, violationAttempts: null });
  });
});

describe('getTrustMetrics', () => {
  it('reads every database figure in the context of the organization the page is for', async () => {
    mocks.goldenShare.mockResolvedValue({ exists: true, holder: 'Council' });
    mocks.execute
      .mockResolvedValueOnce([]) // immutability
      .mockResolvedValueOnce([]) // rls tables
      .mockResolvedValueOnce([{ count: 0 }]) // rls policies
      .mockResolvedValueOnce([{ count: 7 }]); // audit

    const result = await getTrustMetrics('org-9');

    expect(mocks.contexts.length).toBe(3);
    expect(mocks.contexts.every((context) => context.organizationId === 'org-9')).toBe(true);
    expect(result.governance).toMatchObject({ goldenShareActive: true, goldenShareHolder: 'Council' });
    expect(result.fsmValidation.status).toBe('unknown');
  });
});

describe('formatTableList', () => {
  it('names a short list in full', () => {
    expect(formatTableList(['a', 'b'])).toBe('a, b');
  });

  it('names the first tables and counts the rest of a long list', () => {
    const many = Array.from({ length: 20 }, (_, index) => `table_${index}`);

    expect(formatTableList(many, 3)).toBe('table_0, table_1, table_2 and 17 more');
  });

  it('says that nothing was reported for an empty list', () => {
    expect(formatTableList([])).toBe('None reported');
  });
});

describe('generateTrustSummary', () => {
  it('states that the violation count is not measured, and caps the table list', () => {
    const summary = generateTrustSummary({
      ...metrics,
      rlsEnforcement: { ...metrics.rlsEnforcement, tablesProtected: Array.from({ length: 30 }, (_, index) => `t${index}`) },
    });

    expect(summary).toContain('Violation Attempts: not measured');
    expect(summary).toContain('Org Isolation: 66%');
    expect(summary).toContain('Events Logged (30 days): 1,200');
  });
});

describe('exportTrustMetricsPDF', () => {
  it('returns a real PDF blob', async () => {
    const blob = await exportTrustMetricsPDF(metrics);
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(1000);
  });
});
