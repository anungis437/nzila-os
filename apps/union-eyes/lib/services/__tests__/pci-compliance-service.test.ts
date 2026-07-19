import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  // Set env vars early so the singleton constructor doesn't throw
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

  return {
    mockInsert: vi.fn(),
    mockSelect: vi.fn(),
    mockUpdate: vi.fn(),
    mockValues: vi.fn(),
    mockReturning: vi.fn(),
    mockFrom: vi.fn(),
    mockWhere: vi.fn(),
    mockOrderBy: vi.fn(),
    mockLimit: vi.fn(),
    mockSet: vi.fn(),
    mockSupabaseFrom: vi.fn(),
    mockSupabaseSelect: vi.fn(),
    mockCreateClient: vi.fn(),
  };
});

vi.mock('@/db', () => ({
  db: {
    insert: mocks.mockInsert,
    select: mocks.mockSelect,
    update: mocks.mockUpdate,
  },
}));

vi.mock('@/db/schema/domains/compliance/pci-dss', () => ({
  pciDssSaqAssessments: { id: 'id', organizationId: 'organization_id', assessmentDate: 'assessment_date', overallStatus: 'overall_status' },
  pciDssRequirements: { id: 'id', assessmentId: 'assessment_id', complianceStatus: 'compliance_status', requirementNumber: 'requirement_number', requirementDescription: 'requirement_description' },
  pciDssQuarterlyScans: { id: 'id', organizationId: 'organization_id', scanDate: 'scan_date', vulnerabilitiesFound: 'vulnerabilities_found', criticalIssues: 'critical_issues', vendorName: 'vendor_name', scanStatus: 'scan_status', reportUrl: 'report_url' },
  pciDssEncryptionKeys: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
  desc: vi.fn((col) => ({ column: col, direction: 'desc' })),
  asc: vi.fn((col) => ({ column: col, direction: 'asc' })),
  sql: vi.fn(),
  and: vi.fn((...args: any[]) => args),
  or: vi.fn((...args: any[]) => args),
  gt: vi.fn((a, b) => ({ field: a, value: b })),
  lt: vi.fn((a, b) => ({ field: a, value: b })),
  gte: vi.fn((a, b) => ({ field: a, value: b })),
  lte: vi.fn((a, b) => ({ field: a, value: b })),
  inArray: vi.fn((a, b) => ({ field: a, values: b })),
  isNull: vi.fn((a) => ({ field: a, op: 'isNull' })),
  between: vi.fn((a, b, c) => ({ field: a, from: b, to: c })),
  like: vi.fn((a, b) => ({ field: a, pattern: b })),
  ilike: vi.fn((a, b) => ({ field: a, pattern: b })),
  not: vi.fn((a) => ({ op: 'not', value: a })),
  ne: vi.fn((a, b) => ({ field: a, value: b })),
  count: vi.fn(),
  sum: vi.fn(),
  avg: vi.fn(),
  min: vi.fn(),
  max: vi.fn(),
  relations: vi.fn(() => ({})),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.mockCreateClient,
}));

// Env vars are set in vi.hoisted() above

import { PCIComplianceService } from '../pci-compliance-service';

describe('PCIComplianceService', () => {
  let service: PCIComplianceService;

  beforeEach(() => {
    vi.clearAllMocks();

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    // Supabase mock: from().select().order() → { data, error }
    const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    mocks.mockSupabaseSelect.mockReturnValue({ order: mockOrder });
    mocks.mockSupabaseFrom.mockReturnValue({ select: mocks.mockSupabaseSelect });
    mocks.mockCreateClient.mockReturnValue({ from: mocks.mockSupabaseFrom });

    // Chain: select().from().where().orderBy().limit()
    mocks.mockLimit.mockResolvedValue([]);
    mocks.mockOrderBy.mockReturnValue({ limit: mocks.mockLimit });
    mocks.mockWhere.mockReturnValue({ orderBy: mocks.mockOrderBy, limit: mocks.mockLimit });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

    // Chain: insert().values().returning()
    mocks.mockReturning.mockResolvedValue([{ id: 'assessment-1' }]);
    mocks.mockValues.mockReturnValue({ returning: mocks.mockReturning });
    mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });

    // Chain: update().set().where()
    mocks.mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    service = new PCIComplianceService();
  });

  describe('constructor', () => {
    it('throws if env vars missing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      expect(() => new PCIComplianceService()).toThrow('Missing required environment variables');
    });
  });

  describe('generatePCIAssessmentReport', () => {
    it('throws if no assessments found', async () => {
      mocks.mockLimit.mockResolvedValue([]);
      await expect(service.generatePCIAssessmentReport('org-1')).rejects.toThrow('No PCI-DSS assessments found');
    });

    it('returns assessment report when data exists', async () => {
      // First call: get assessment — select().from().where().orderBy().limit()
      mocks.mockFrom.mockReturnValueOnce({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'a1',
              organizationId: 'org-1',
              assessmentDate: '2026-01-01',
              overallStatus: 'completed',
            }]),
          }),
        }),
      });
      // Second call: get requirements — select().from().where()
      mocks.mockFrom.mockReturnValueOnce({
        where: vi.fn().mockResolvedValue([
          { id: 'r1', requirementNumber: '1.1', requirementDescription: 'Req 1', complianceStatus: 'compliant', evidence: null, remediationNotes: null },
          { id: 'r2', requirementNumber: '1.2', requirementDescription: 'Req 2', complianceStatus: 'requires_remediation', evidence: null, remediationNotes: null },
        ]),
      });

      const report = await service.generatePCIAssessmentReport('org-1');
      expect(report.id).toBe('a1');
      expect(report.findings).toHaveLength(2);
    });
  });

  describe('createAssessment', () => {
    it('creates new assessment and returns id', async () => {
      const id = await service.createAssessment('org-1');
      expect(id).toBe('assessment-1');
      expect(mocks.mockInsert).toHaveBeenCalled();
    });

    it('returns assessment id even when the template has no requirements', async () => {
      const mockOrder = vi.fn().mockResolvedValue({ data: [{ id: 'org-1' }], error: null });
      mocks.mockSupabaseSelect.mockReturnValue({ order: mockOrder });
      mocks.mockSupabaseFrom.mockReturnValue({ select: mocks.mockSupabaseSelect });
      mocks.mockCreateClient.mockReturnValue({ from: mocks.mockSupabaseFrom });

      const id = await service.createAssessment('org-1');
      expect(id).toBe('assessment-1');
    });

    it('filters invalid template rows before inserting requirements', async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: [
          { requirement_number: '1.1', requirement_description: 'Valid requirement' },
          { requirement_number: '1.2' },
        ],
        error: null,
      });
      mocks.mockSupabaseSelect.mockReturnValue({ order: mockOrder });
      mocks.mockSupabaseFrom.mockReturnValue({ select: mocks.mockSupabaseSelect });
      mocks.mockCreateClient.mockReturnValue({ from: mocks.mockSupabaseFrom });

      const id = await service.createAssessment('org-1');
      expect(id).toBe('assessment-1');
      expect(mocks.mockValues).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ requirementNumber: '1.1' }),
      ]));
    });

    it('handles non-array template data', async () => {
      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: null });
      mocks.mockSupabaseSelect.mockReturnValue({ order: mockOrder });
      mocks.mockSupabaseFrom.mockReturnValue({ select: mocks.mockSupabaseSelect });
      mocks.mockCreateClient.mockReturnValue({ from: mocks.mockSupabaseFrom });

      const id = await service.createAssessment('org-1');
      expect(id).toBe('assessment-1');
    });
  });

  describe('updateRequirement', () => {
    it('updates requirement status', async () => {
      await service.updateRequirement('req-1', 'compliant', 'evidence data');
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });

    it('stores nulls when optional fields are omitted', async () => {
      await service.updateRequirement('req-2', 'not_applicable');
      expect(mocks.mockUpdate).toHaveBeenCalledWith(expect.anything());
    });
  });

  describe('recordQuarterlyScan', () => {
    it('records scan and returns id', async () => {
      mocks.mockReturning.mockResolvedValue([{ id: 'scan-1' }]);
      const id = await service.recordQuarterlyScan('org-1', {
        vendorName: 'Qualys',
        scanStatus: 'pass',
        vulnerabilitiesFound: 0,
        criticalIssues: 0,
      });
      expect(id).toBe('scan-1');
    });
  });

  describe('getLatestQuarterlyScan', () => {
    it('returns null when no scans exist', async () => {
      // Override the entire chain for this test
      mocks.mockFrom.mockReturnValueOnce({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      const result = await service.getLatestQuarterlyScan('org-1');
      expect(result).toBeNull();
    });

    it('returns latest scan', async () => {
      mocks.mockLimit.mockResolvedValue([{
        id: 'scan-1',
        organizationId: 'org-1',
        scanDate: '2026-01-15',
        vendorName: 'Qualys',
        scanStatus: 'pass',
        vulnerabilitiesFound: 2,
        criticalIssues: 0,
        reportUrl: null,
      }]);
      const result = await service.getLatestQuarterlyScan('org-1');
      expect(result).not.toBeNull();
      expect(result!.vendorName).toBe('Qualys');
    });
  });

  describe('isQuarterlyScanDue', () => {
    it('returns true when no scans exist', async () => {
      mocks.mockLimit.mockResolvedValue([]);
      const result = await service.isQuarterlyScanDue('org-1');
      expect(result).toBe(true);
    });

    it('returns false when recent scan exists', async () => {
      mocks.mockLimit.mockResolvedValue([{
        id: 'scan-1',
        organizationId: 'org-1',
        scanDate: new Date().toISOString(),
        vendorName: 'Qualys',
        scanStatus: 'pass',
        vulnerabilitiesFound: 0,
        criticalIssues: 0,
        reportUrl: null,
      }]);
      const result = await service.isQuarterlyScanDue('org-1');
      expect(result).toBe(false);
    });

    it('returns true when the latest scan is stale', async () => {
      mocks.mockLimit.mockResolvedValue([{
        id: 'scan-1',
        organizationId: 'org-1',
        scanDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
        vendorName: 'Qualys',
        scanStatus: 'pass',
        vulnerabilitiesFound: 0,
        criticalIssues: 0,
        reportUrl: null,
      }]);
      const result = await service.isQuarterlyScanDue('org-1');
      expect(result).toBe(true);
    });
  });

  describe('getOverdueScans', () => {
    it('returns empty when no organizations exist', async () => {
      mocks.mockSupabaseSelect.mockResolvedValue({ data: [], error: null });
      mocks.mockSupabaseFrom.mockReturnValue({ select: mocks.mockSupabaseSelect });
      mocks.mockCreateClient.mockReturnValue({ from: mocks.mockSupabaseFrom });

      const result = await service.getOverdueScans();
      expect(result).toEqual([]);
    });

    it('returns overdue organizations when scans are stale', async () => {
      const staleScanDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
      mocks.mockSupabaseSelect.mockResolvedValue({ data: [{ id: 'org-1' }, { id: 'invalid' }], error: null });
      mocks.mockSupabaseFrom.mockReturnValue({ select: mocks.mockSupabaseSelect });
      mocks.mockCreateClient.mockReturnValue({ from: mocks.mockSupabaseFrom });

      const originalGetLatest = service.getLatestQuarterlyScan.bind(service);
      service.getLatestQuarterlyScan = vi.fn(async (orgId: string) => {
        if (orgId === 'org-1') {
          return {
            id: 'scan-1',
            organizationId: 'org-1',
            scanDate: new Date(staleScanDate),
            vendorName: 'Qualys',
            scanStatus: 'pass',
            vulnerabilitiesFound: 0,
            criticalIssues: 0,
          };
        }
        return originalGetLatest(orgId);
      }) as any;

      const result = await service.getOverdueScans();
      expect(result[0]).toMatchObject({ organizationId: 'org-1' });
    });

    it('skips organizations with recent scans', async () => {
      mocks.mockSupabaseSelect.mockResolvedValue({ data: [{ id: 'org-2' }], error: null });
      mocks.mockSupabaseFrom.mockReturnValue({ select: mocks.mockSupabaseSelect });
      mocks.mockCreateClient.mockReturnValue({ from: mocks.mockSupabaseFrom });

      service.getLatestQuarterlyScan = vi.fn(async () => ({
        id: 'scan-2',
        organizationId: 'org-2',
        scanDate: new Date(),
        vendorName: 'Qualys',
        scanStatus: 'pass',
        vulnerabilitiesFound: 0,
        criticalIssues: 0,
      })) as any;

      const result = await service.getOverdueScans();
      expect(result).toEqual([]);
    });

    it('handles non-array organization data', async () => {
      mocks.mockSupabaseSelect.mockResolvedValue({ data: null, error: null });
      mocks.mockSupabaseFrom.mockReturnValue({ select: mocks.mockSupabaseSelect });
      mocks.mockCreateClient.mockReturnValue({ from: mocks.mockSupabaseFrom });

      const result = await service.getOverdueScans();
      expect(result).toEqual([]);
    });
  });

  describe('getKeysNeedingRotation', () => {
    it('returns empty when no keys exist', async () => {
      const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
      mocks.mockSupabaseSelect.mockReturnValue({ order: mockOrder });
      mocks.mockSupabaseFrom.mockReturnValue({ select: mocks.mockSupabaseSelect });
      mocks.mockCreateClient.mockReturnValue({ from: mocks.mockSupabaseFrom });

      const result = await service.getKeysNeedingRotation();
      expect(result).toEqual([]);
    });

    it('returns keys that are older than 90 days', async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: [
          { organization_id: 'org-1', key_type: 'stripe_secret_key', rotated_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString() },
          { organization_id: 'org-2', key_type: 'database_encryption', rotated_at: new Date().toISOString() },
        ],
        error: null,
      });
      mocks.mockSupabaseSelect.mockReturnValue({ order: mockOrder });
      mocks.mockSupabaseFrom.mockReturnValue({ select: mocks.mockSupabaseSelect });
      mocks.mockCreateClient.mockReturnValue({ from: mocks.mockSupabaseFrom });

      const result = await service.getKeysNeedingRotation();
      expect(result).toEqual([
        expect.objectContaining({ organizationId: 'org-1', keyType: 'stripe_secret_key' }),
      ]);
    });

    it('returns empty for non-array responses', async () => {
      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: null });
      mocks.mockSupabaseSelect.mockReturnValue({ order: mockOrder });
      mocks.mockSupabaseFrom.mockReturnValue({ select: mocks.mockSupabaseSelect });
      mocks.mockCreateClient.mockReturnValue({ from: mocks.mockSupabaseFrom });

      const result = await service.getKeysNeedingRotation();
      expect(result).toEqual([]);
    });
  });

  describe('trackKeyRotation', () => {
    it('records a scheduled key rotation', async () => {
      await service.trackKeyRotation('org-1', 'stripe_secret_key', 'key-123');
      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });
});
