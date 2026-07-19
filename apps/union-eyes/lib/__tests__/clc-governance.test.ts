/**
 * Unit Tests — CLC Governance Module
 *
 * Tests consent model, cohort thresholds, governed aggregation,
 * permission checks, audit logging, DB-backed consent loading,
 * and governance context resolution.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  type AffiliateDataParticipation,
  type GovernanceActorContext,
  type GovernedAggregationOptions,
  MIN_COHORT_THRESHOLD,
  setParticipationRegistry,
  getParticipationRegistry,
  getConsentedOrgIds,
  checkGovernedAggregation,
  runGovernedCrossUnionAggregation,
  resolveGovernanceContext,
  loadParticipationFromDB,
} from '@/lib/clc/governance';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockAuditLog = vi.fn().mockResolvedValue(undefined);
const mockGetUserContext = vi.fn().mockResolvedValue({
  userId: 'test-user',
  organizationId: 'test-org',
  permissions: ['view_congress_analytics'],
  roles: [],
});
const mockWithSystemContext = vi.fn().mockImplementation((fn: () => unknown) => fn());
const mockDbExecute = vi.fn().mockResolvedValue([]);

vi.mock('@/lib/audit-logger', () => ({
  auditLog: (...args: any[]) => mockAuditLog(...args),
  AuditEventType: { DATA_ACCESS: 'data.access' },
  AuditSeverity: { LOW: 'low', MEDIUM: 'medium' },
}));

vi.mock('@/lib/api-auth-guard', () => ({
  getUserContext: (...args: any[]) => mockGetUserContext(...args),
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: (fn: () => unknown) => mockWithSystemContext(fn),
}));

vi.mock('@/db/db', () => ({
  db: { execute: (...args: any[]) => mockDbExecute(...args) },
}));

vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: any[]) => ({ strings, values }),
}));

// ── Test Data ───────────────────────────────────────────────────────────────

function makeParticipation(
  orgId: string,
  overrides: Partial<AffiliateDataParticipation> = {},
): AffiliateDataParticipation {
  return {
    organizationId: orgId,
    organizationName: `Org ${orgId}`,
    participatesInCrossUnionAnalytics: true,
    participatesInSectorBenchmarks: true,
    participatesInNationalSignals: true,
    effectiveDate: '2024-01-01T00:00:00Z',
    revokedAt: null,
    restrictions: null,
    consentSource: 'affiliate_admin',
    ...overrides,
  };
}

function makeContext(overrides: Partial<GovernanceActorContext> = {}): GovernanceActorContext {
  return {
    userId: 'test-user',
    organizationId: 'test-org',
    hasPermission: vi.fn().mockReturnValue(true),
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('CLC Governance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setParticipationRegistry([]);
  });

  // ── Registry ──────────────────────────────────────────────────────────

  describe('participation registry', () => {
    it('starts empty', () => {
      expect(getParticipationRegistry()).toHaveLength(0);
    });

    it('stores and retrieves records', () => {
      const records = [makeParticipation('org-1'), makeParticipation('org-2')];
      setParticipationRegistry(records);
      expect(getParticipationRegistry()).toHaveLength(2);
    });
  });

  // ── Consent filtering ────────────────────────────────────────────────

  describe('getConsentedOrgIds', () => {
    it('returns orgs that opted into crossUnionAnalytics', () => {
      setParticipationRegistry([
        makeParticipation('org-1', { participatesInCrossUnionAnalytics: true }),
        makeParticipation('org-2', { participatesInCrossUnionAnalytics: false }),
        makeParticipation('org-3', { participatesInCrossUnionAnalytics: true }),
      ]);
      expect(getConsentedOrgIds('crossUnionAnalytics')).toEqual(['org-1', 'org-3']);
    });

    it('returns orgs that opted into sectorBenchmarks', () => {
      setParticipationRegistry([
        makeParticipation('org-1', { participatesInSectorBenchmarks: false }),
        makeParticipation('org-2', { participatesInSectorBenchmarks: true }),
      ]);
      expect(getConsentedOrgIds('sectorBenchmarks')).toEqual(['org-2']);
    });

    it('returns orgs that opted into nationalSignals', () => {
      setParticipationRegistry([
        makeParticipation('org-1', { participatesInNationalSignals: true }),
        makeParticipation('org-2', { participatesInNationalSignals: false }),
      ]);
      expect(getConsentedOrgIds('nationalSignals')).toEqual(['org-1']);
    });

    it('excludes revoked consents', () => {
      setParticipationRegistry([
        makeParticipation('org-1', { revokedAt: '2024-06-01T00:00:00Z' }),
        makeParticipation('org-2'),
      ]);
      expect(getConsentedOrgIds('crossUnionAnalytics')).toEqual(['org-2']);
    });

    it('returns empty for unknown dimension', () => {
      setParticipationRegistry([makeParticipation('org-1')]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(getConsentedOrgIds('unknownDimension' as any)).toEqual([]);
    });
  });

  // ── Governance check ─────────────────────────────────────────────────

  describe('checkGovernedAggregation', () => {
    const baseOpts: GovernedAggregationOptions = {
      context: makeContext(),
      requiredPermission: 'view_congress_analytics',
      operationLabel: 'test-op',
      participationDimension: 'crossUnionAnalytics',
    };

    it('denies when no affiliates have consented', () => {
      setParticipationRegistry([]);
      const result = checkGovernedAggregation(baseOpts);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No affiliates');
      expect(result.cohortSize).toBe(0);
    });

    it('denies when cohort is below minimum threshold', () => {
      setParticipationRegistry(
        Array.from({ length: MIN_COHORT_THRESHOLD - 1 }, (_, i) =>
          makeParticipation(`org-${i}`),
        ),
      );
      const result = checkGovernedAggregation(baseOpts);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Cohort too small');
      expect(result.cohortSize).toBe(MIN_COHORT_THRESHOLD - 1);
    });

    it('allows when cohort meets threshold', () => {
      setParticipationRegistry(
        Array.from({ length: MIN_COHORT_THRESHOLD }, (_, i) =>
          makeParticipation(`org-${i}`),
        ),
      );
      const result = checkGovernedAggregation(baseOpts);
      expect(result.allowed).toBe(true);
      expect(result.cohortSize).toBe(MIN_COHORT_THRESHOLD);
      expect(result.consentedOrgIds).toHaveLength(MIN_COHORT_THRESHOLD);
    });

    it('respects custom minCohort override', () => {
      setParticipationRegistry([
        makeParticipation('org-1'),
        makeParticipation('org-2'),
      ]);
      const result = checkGovernedAggregation({ ...baseOpts, minCohort: 2 });
      expect(result.allowed).toBe(true);
      expect(result.cohortSize).toBe(2);
    });

    it('filters by the correct participation dimension', () => {
      setParticipationRegistry(
        Array.from({ length: 10 }, (_, i) =>
          makeParticipation(`org-${i}`, {
            participatesInSectorBenchmarks: i < 3, // only 3 opted into benchmarks
            participatesInCrossUnionAnalytics: true,
          }),
        ),
      );

      const cuResult = checkGovernedAggregation(baseOpts);
      expect(cuResult.allowed).toBe(true);
      expect(cuResult.cohortSize).toBe(10);

      const sbResult = checkGovernedAggregation({
        ...baseOpts,
        participationDimension: 'sectorBenchmarks',
      });
      expect(sbResult.allowed).toBe(false);
      expect(sbResult.cohortSize).toBe(3);
    });
  });

  // ── Governed execution ────────────────────────────────────────────────

  describe('runGovernedCrossUnionAggregation', () => {
    const context = makeContext();
    const baseOpts: GovernedAggregationOptions = {
      context,
      requiredPermission: 'view_congress_analytics',
      operationLabel: 'test-aggregation',
      participationDimension: 'crossUnionAnalytics',
    };

    it('checks permission via context.hasPermission', async () => {
      setParticipationRegistry(
        Array.from({ length: MIN_COHORT_THRESHOLD }, (_, i) =>
          makeParticipation(`org-${i}`),
        ),
      );
      await runGovernedCrossUnionAggregation(baseOpts, async () => 'result');
      expect(context.hasPermission).toHaveBeenCalledWith('view_congress_analytics');
    });

    it('throws on permission failure and logs denial', async () => {
      const deniedContext = makeContext({
        hasPermission: vi.fn().mockReturnValue(false),
      });
      setParticipationRegistry(
        Array.from({ length: MIN_COHORT_THRESHOLD }, (_, i) =>
          makeParticipation(`org-${i}`),
        ),
      );
      await expect(
        runGovernedCrossUnionAggregation(
          { ...baseOpts, context: deniedContext },
          async () => 'result',
        ),
      ).rejects.toThrow('Permission required');

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'failure',
          action: 'test-aggregation',
          details: expect.objectContaining({
            reason: expect.stringContaining('Missing permission'),
          }),
        }),
      );
    });

    it('throws on cohort failure and logs denial', async () => {
      // Empty registry — no consented orgs
      setParticipationRegistry([]);
      await expect(
        runGovernedCrossUnionAggregation(baseOpts, async () => 'result'),
      ).rejects.toThrow('[CLC-GOV]');

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'failure',
          action: 'test-aggregation',
        }),
      );
    });

    it('executes aggregation and logs success on valid cohort', async () => {
      setParticipationRegistry(
        Array.from({ length: 6 }, (_, i) => makeParticipation(`org-${i}`)),
      );

      const aggregationFn = vi.fn().mockResolvedValue({ data: 'aggregated' });
      const result = await runGovernedCrossUnionAggregation(baseOpts, aggregationFn);

      expect(result).toEqual({ data: 'aggregated' });
      expect(aggregationFn).toHaveBeenCalledWith(
        expect.arrayContaining(['org-0', 'org-1', 'org-2', 'org-3', 'org-4', 'org-5']),
      );

      // Audit log for success
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'success',
          action: 'test-aggregation',
          details: expect.objectContaining({
            cohortSize: 6,
            consentedOrgCount: 6,
          }),
        }),
      );
    });

    it('runs aggregation within system context', async () => {
      setParticipationRegistry(
        Array.from({ length: MIN_COHORT_THRESHOLD }, (_, i) =>
          makeParticipation(`org-${i}`),
        ),
      );
      await runGovernedCrossUnionAggregation(baseOpts, async () => 'result');
      expect(mockWithSystemContext).toHaveBeenCalled();
    });

    it('passes only consented org IDs to aggregation function', async () => {
      setParticipationRegistry([
        ...Array.from({ length: 5 }, (_, i) =>
          makeParticipation(`consented-${i}`),
        ),
        makeParticipation('revoked-org', { revokedAt: '2024-06-01' }),
        makeParticipation('opted-out', { participatesInCrossUnionAnalytics: false }),
      ]);

      const aggregationFn = vi.fn().mockResolvedValue([]);
      await runGovernedCrossUnionAggregation(baseOpts, aggregationFn);

      const passedOrgIds = aggregationFn.mock.calls[0][0] as string[];
      expect(passedOrgIds).toHaveLength(5);
      expect(passedOrgIds).not.toContain('revoked-org');
      expect(passedOrgIds).not.toContain('opted-out');
    });
  });

  // ── MIN_COHORT_THRESHOLD ──────────────────────────────────────────────

  describe('MIN_COHORT_THRESHOLD', () => {
    it('is 5', () => {
      expect(MIN_COHORT_THRESHOLD).toBe(5);
    });
  });

  // ── resolveGovernanceContext ──────────────────────────────────────────

  describe('resolveGovernanceContext', () => {
    it('builds context from getUserContext permissions', async () => {
      mockGetUserContext.mockResolvedValueOnce({
        userId: 'u1',
        organizationId: 'o1',
        permissions: ['view_congress_analytics', 'manage_clauses'],
        roles: ['clc_staff'],
      });

      const ctx = await resolveGovernanceContext('u1', 'o1');
      expect(ctx.userId).toBe('u1');
      expect(ctx.organizationId).toBe('o1');
      expect(ctx.hasPermission('view_congress_analytics')).toBe(true);
      expect(ctx.hasPermission('manage_clauses')).toBe(true);
      expect(ctx.hasPermission('nonexistent_perm')).toBe(false);
    });

    it('grants all permissions when wildcard is present', async () => {
      mockGetUserContext.mockResolvedValueOnce({
        userId: 'admin',
        organizationId: null,
        permissions: ['*'],
        roles: ['admin'],
      });

      const ctx = await resolveGovernanceContext('admin', null);
      expect(ctx.hasPermission('any_permission')).toBe(true);
    });

    it('fail-closes on getUserContext error', async () => {
      mockGetUserContext.mockRejectedValueOnce(new Error('Auth unavailable'));

      const ctx = await resolveGovernanceContext('u2', 'o2');
      expect(ctx.userId).toBe('u2');
      expect(ctx.organizationId).toBe('o2');
      expect(ctx.hasPermission('view_congress_analytics')).toBe(false);
    });

    it('fail-closes when getUserContext returns null', async () => {
      mockGetUserContext.mockResolvedValueOnce(null);

      const ctx = await resolveGovernanceContext('u3', null);
      expect(ctx.hasPermission('view_congress_analytics')).toBe(false);
    });
  });

  // ── loadParticipationFromDB ──────────────────────────────────────────

  describe('loadParticipationFromDB', () => {
    it('loads and maps records from DB table', async () => {
      mockDbExecute.mockResolvedValueOnce([
        {
          organization_id: 'org-db-1',
          organization_name: 'DB Org 1',
          participates_in_cross_union_analytics: true,
          participates_in_sector_benchmarks: false,
          participates_in_national_signals: true,
          effective_date: '2024-06-01T00:00:00Z',
          revoked_at: null,
          restrictions: null,
          consent_source: 'affiliate_admin',
        },
      ]);

      const records = await loadParticipationFromDB();
      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({
        organizationId: 'org-db-1',
        organizationName: 'DB Org 1',
        participatesInCrossUnionAnalytics: true,
        participatesInSectorBenchmarks: false,
        participatesInNationalSignals: true,
        effectiveDate: '2024-06-01T00:00:00Z',
        revokedAt: null,
        restrictions: null,
        consentSource: 'affiliate_admin',
      });
    });

    it('updates in-memory registry after DB load', async () => {
      mockDbExecute.mockResolvedValueOnce([
        {
          organization_id: 'org-db-2',
          organization_name: 'DB Org 2',
          participates_in_cross_union_analytics: true,
          participates_in_sector_benchmarks: true,
          participates_in_national_signals: false,
          effective_date: '2024-01-01T00:00:00Z',
          revoked_at: null,
          restrictions: 'no PII',
          consent_source: 'clc_agreement',
        },
      ]);

      await loadParticipationFromDB();
      const registry = getParticipationRegistry();
      expect(registry).toHaveLength(1);
      expect(registry[0]!.organizationId).toBe('org-db-2');
      expect(registry[0]!.restrictions).toBe('no PII');
    });

    it('falls back to in-memory registry on DB error', async () => {
      // Pre-populate in-memory registry
      setParticipationRegistry([makeParticipation('fallback-org')]);
      mockDbExecute.mockRejectedValueOnce(new Error('relation does not exist'));

      const records = await loadParticipationFromDB();
      expect(records).toHaveLength(1);
      expect(records[0]!.organizationId).toBe('fallback-org');
    });

    it('handles revoked_at mapping', async () => {
      mockDbExecute.mockResolvedValueOnce([
        {
          organization_id: 'org-revoked',
          organization_name: 'Revoked Org',
          participates_in_cross_union_analytics: true,
          participates_in_sector_benchmarks: true,
          participates_in_national_signals: true,
          effective_date: '2024-01-01T00:00:00Z',
          revoked_at: '2024-07-01T00:00:00Z',
          restrictions: null,
          consent_source: 'federation_admin',
        },
      ]);

      const records = await loadParticipationFromDB();
      expect(records[0]!.revokedAt).toBe('2024-07-01T00:00:00Z');
      expect(records[0]!.consentSource).toBe('federation_admin');
    });
  });
});
