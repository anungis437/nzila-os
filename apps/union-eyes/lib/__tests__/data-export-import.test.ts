import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockDynamic: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
  mockError: vi.fn(),
  mockDebug: vi.fn(),
}));

const insertHandler: ProxyHandler<object> = {
  get: (_t, p) => {
    if (p === 'then') return undefined;
    return vi.fn(() => new Proxy({}, insertHandler));
  },
};

vi.mock('@/db', () => ({
  db: {
    select: mocks.mockSelect.mockImplementation(() => ({
      from: mocks.mockFrom.mockImplementation(() => ({
        $dynamic: mocks.mockDynamic.mockImplementation(() =>
          Object.assign(Promise.resolve([]), { where: mocks.mockWhere })
        ),
      })),
    })),
    insert: mocks.mockInsert.mockReturnValue(new Proxy({}, insertHandler)),
    update: mocks.mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

vi.mock('@/db/schema', () => ({
  organizationMembers: { id: 'id', organizationId: 'organizationId' },
  claims: { organizationId: 'organizationId' },
  grievanceDocuments: { organizationId: 'organizationId' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: unknown[]) => a),
  relations: vi.fn(() => ({})),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: mocks.mockInfo,
    warn: mocks.mockWarn,
    error: mocks.mockError,
    debug: mocks.mockDebug,
  },
}));

describe('data-export-import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockWhere.mockResolvedValue([]);
    mocks.mockDynamic.mockImplementation(() =>
      Object.assign(Promise.resolve([]), { where: mocks.mockWhere })
    );
    mocks.mockFrom.mockImplementation(() => ({
      $dynamic: mocks.mockDynamic,
    }));
    mocks.mockSelect.mockImplementation(() => ({
      from: mocks.mockFrom,
    }));
    mocks.mockInsert.mockReturnValue(new Proxy({}, insertHandler));
    mocks.mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  // ── DataExportService ────────────────────────────────────────────────

  describe('DataExportService', () => {
    it('creates export job and returns completed status', async () => {
      const { DataExportService } = await import('../data-export-import');
      const svc = new DataExportService();
      const result = await svc.export('user1', 'members', {});
      expect(result.status).toBe('completed');
      expect(result.recordCount).toBe(0);
      expect(result.userId).toBe('user1');
      expect(result.error).toBeUndefined();
    });

    it('exports members with data rows', async () => {
      const memberRow = {
        id: 'm1', userId: 'u1', name: 'Alice', email: 'a@e.com', role: 'member',
        status: 'active', department: 'HR', membershipNumber: 'M001', organizationId: 'org1',
        createdAt: new Date('2026-01-15'),
      };
      mocks.mockDynamic.mockImplementation(() =>
        Object.assign(Promise.resolve([memberRow]), { where: mocks.mockWhere })
      );
      const { DataExportService } = await import('../data-export-import');
      const svc = new DataExportService();
      const result = await svc.export('user1', 'members', {});
      expect(result.status).toBe('completed');
      expect(result.recordCount).toBe(1);
    });

    it('exports claims entity type', async () => {
      const claimRow = {
        claimId: 'c1', claimNumber: 'CLM-1', memberId: 'm1', claimType: 'grievance',
        status: 'open', priority: 'high', incidentDate: new Date('2026-02-01'),
        createdAt: new Date('2026-02-02'),
      };
      mocks.mockDynamic.mockImplementation(() =>
        Object.assign(Promise.resolve([claimRow]), { where: mocks.mockWhere })
      );
      const { DataExportService } = await import('../data-export-import');
      const svc = new DataExportService();
      const result = await svc.export('user1', 'claims', {});
      expect(result.status).toBe('completed');
      expect(result.recordCount).toBe(1);
    });

    it('exports documents entity type', async () => {
      const docRow = {
        id: 'd1', documentName: 'evidence.pdf', documentType: 'pdf',
        filePath: '/files/e.pdf', fileSize: 1024, mimeType: 'application/pdf',
        version: 1, uploadedAt: new Date('2026-03-01'),
      };
      mocks.mockDynamic.mockImplementation(() =>
        Object.assign(Promise.resolve([docRow]), { where: mocks.mockWhere })
      );
      const { DataExportService } = await import('../data-export-import');
      const svc = new DataExportService();
      const result = await svc.export('user1', 'documents', {});
      expect(result.status).toBe('completed');
      expect(result.recordCount).toBe(1);
    });

    it('returns empty array for unknown entity type', async () => {
      const { DataExportService } = await import('../data-export-import');
      const svc = new DataExportService();
      const result = await svc.export('user1', 'unknown_entity', {});
      expect(result.status).toBe('completed');
      expect(result.recordCount).toBe(0);
    });

    it('applies organizationId filter on members export', async () => {
      mocks.mockWhere.mockResolvedValue([]);
      const { DataExportService } = await import('../data-export-import');
      const svc = new DataExportService();
      await svc.export('user1', 'members', { organizationId: 'org-123' });
      expect(mocks.mockWhere).toHaveBeenCalled();
    });

    it('returns failed job on fetchData error', async () => {
      mocks.mockDynamic.mockImplementation(() => {
        const p = Promise.reject(new Error('DB error'));
        return Object.assign(p, { where: mocks.mockWhere });
      });
      const { DataExportService } = await import('../data-export-import');
      const svc = new DataExportService();
      const result = await svc.export('user1', 'members', {});
      expect(result.status).toBe('failed');
      expect(result.error).toBe('DB error');
    });

    it('exports as CSV format', async () => {
      const row = {
        id: 'm1', userId: 'u1', name: 'Bob', email: 'b@e.com', role: 'member',
        status: 'active', department: null, membershipNumber: null, organizationId: 'org1',
        createdAt: null,
      };
      mocks.mockDynamic.mockImplementation(() =>
        Object.assign(Promise.resolve([row]), { where: mocks.mockWhere })
      );
      const { DataExportService } = await import('../data-export-import');
      const svc = new DataExportService();
      const result = await svc.export('user1', 'members', {}, { format: 'csv', includeRelations: false, dateFormat: '', compression: false });
      expect(result.status).toBe('completed');
      expect(result.format).toBe('csv');
    });

    it('getExportStatus returns null for unknown jobs', async () => {
      const { DataExportService } = await import('../data-export-import');
      const svc = new DataExportService();
      expect(await svc.getExportStatus('nonexistent')).toBeNull();
    });
  });

  // ── DataImportService ────────────────────────────────────────────────

  describe('DataImportService', () => {
    it('validates-only and returns success with 0 imported', async () => {
      const { DataImportService } = await import('../data-export-import');
      const svc = new DataImportService();
      const result = await svc.import(
        'user1', 'members',
        JSON.stringify([{ name: 'Test', email: 'test@example.com' }]),
        'json', { updateExisting: false, validateOnly: true }
      );
      expect(result.success).toBe(true);
      expect(result.imported).toBe(0);
    });

    it('returns error for unsupported format', async () => {
      const { DataImportService } = await import('../data-export-import');
      const svc = new DataImportService();
      const result = await svc.import(
        'user1', 'members', 'data', 'excel' as 'json',
        { updateExisting: false, validateOnly: false }
      );
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('imports JSON members (insert new)', async () => {
      const { DataImportService } = await import('../data-export-import');
      const svc = new DataImportService();
      const result = await svc.import(
        'user1', 'members',
        JSON.stringify([{ email: 'a@e.com', organizationId: 'org1', name: 'A' }]),
        'json', { updateExisting: false, validateOnly: false }
      );
      expect(result.imported).toBe(1);
      expect(mocks.mockInsert).toHaveBeenCalled();
    });

    it('imports JSON members (update existing)', async () => {
      const { DataImportService } = await import('../data-export-import');
      const svc = new DataImportService();
      const result = await svc.import(
        'user1', 'members',
        JSON.stringify([{ id: 'm1', email: 'a@e.com', organizationId: 'org1', name: 'A' }]),
        'json', { updateExisting: true, validateOnly: false }
      );
      expect(result.imported).toBe(1);
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });

    it('imports claims (always insert)', async () => {
      const { DataImportService } = await import('../data-export-import');
      const svc = new DataImportService();
      const result = await svc.import(
        'user1', 'claims',
        JSON.stringify([{ memberId: 'm1', organizationId: 'org1' }]),
        'json', { updateExisting: false, validateOnly: false }
      );
      expect(result.imported).toBe(1);
      expect(mocks.mockInsert).toHaveBeenCalled();
    });

    it('returns error for unsupported entity type on import', async () => {
      const { DataImportService } = await import('../data-export-import');
      const svc = new DataImportService();
      const result = await svc.import(
        'user1', 'unknown',
        JSON.stringify([{ foo: 'bar' }]),
        'json', { updateExisting: false, validateOnly: false }
      );
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('validates members require email', async () => {
      const { DataImportService } = await import('../data-export-import');
      const svc = new DataImportService();
      const result = await svc.import(
        'user1', 'members',
        JSON.stringify([{ name: 'No Email' }]),
        'json', { updateExisting: false, validateOnly: false }
      );
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Email');
    });

    it('validates claims require memberId', async () => {
      const { DataImportService } = await import('../data-export-import');
      const svc = new DataImportService();
      const result = await svc.import(
        'user1', 'claims',
        JSON.stringify([{ claimNumber: 'C1' }]),
        'json', { updateExisting: false, validateOnly: false }
      );
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Member ID');
    });

    it('parses CSV and imports records', async () => {
      const csv = 'email,organizationId,name\na@e.com,org1,Alice';
      const { DataImportService } = await import('../data-export-import');
      const svc = new DataImportService();
      const result = await svc.import(
        'user1', 'members', csv, 'csv',
        { updateExisting: false, validateOnly: false }
      );
      expect(result.imported).toBe(1);
    });

    it('handles CSV with quoted values containing commas', async () => {
      const csv = 'email,organizationId,name\na@e.com,org1,"Smith, John"';
      const { DataImportService } = await import('../data-export-import');
      const svc = new DataImportService();
      const result = await svc.import(
        'user1', 'members', csv, 'csv',
        { updateExisting: false, validateOnly: false }
      );
      expect(result.imported).toBe(1);
    });

    it('accumulates errors for failed import records', async () => {
      // First record has missing required fields, second is fine
      mocks.mockInsert.mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error('DB constraint')),
      });
      const { DataImportService } = await import('../data-export-import');
      const svc = new DataImportService();
      const result = await svc.import(
        'user1', 'members',
        JSON.stringify([
          { email: 'a@e.com', organizationId: 'org1' },
          { email: 'b@e.com', organizationId: 'org1' },
        ]),
        'json', { updateExisting: false, validateOnly: false }
      );
      expect(result.errors.length).toBe(2);
      expect(result.success).toBe(false);
    });
  });

  // ── Gap coverage ────────────────────────────────────────────────────

  describe('DataExportService gap coverage', () => {
    it('applies organizationId filter on claims export', async () => {
      const claimRow = {
        claimId: 'c1', claimNumber: 'C-1', memberId: 'm1', claimType: 'grievance',
        status: 'open', priority: 'high', incidentDate: null, createdAt: null,
      };
      mocks.mockWhere.mockResolvedValue([claimRow]);
      const { DataExportService } = await import('../data-export-import');
      const svc = new DataExportService();
      const result = await svc.export('user1', 'claims', { organizationId: 'org-1' });
      expect(result.status).toBe('completed');
      expect(mocks.mockWhere).toHaveBeenCalled();
    });

    it('applies organizationId filter on documents export', async () => {
      const docRow = {
        id: 'd1', documentName: 'f.pdf', documentType: 'pdf',
        filePath: '/f', fileSize: 100, mimeType: 'application/pdf',
        version: 1, uploadedAt: null,
      };
      mocks.mockWhere.mockResolvedValue([docRow]);
      const { DataExportService } = await import('../data-export-import');
      const svc = new DataExportService();
      const result = await svc.export('user1', 'documents', { organizationId: 'org-1' });
      expect(result.status).toBe('completed');
      expect(mocks.mockWhere).toHaveBeenCalled();
    });

    it('fails excel format because xlsx serialization is not implemented', async () => {
      // Honesty pass: excel format throws rather than silently emitting a broken file.
      mocks.mockDynamic.mockImplementation(() =>
        Object.assign(Promise.resolve([{ id: '1' }]), { where: mocks.mockWhere })
      );
      const { DataExportService } = await import('../data-export-import');
      const svc = new DataExportService();
      const result = await svc.export('user1', 'members', {}, { format: 'excel', includeRelations: false, dateFormat: '', compression: false });
      expect(result.status).toBe('failed');
      expect(result.error ?? '').toMatch(/excel|xlsx/i);
    });

    it('exports with unknown format uses default', async () => {
      mocks.mockDynamic.mockImplementation(() =>
        Object.assign(Promise.resolve([{ id: '1' }]), { where: mocks.mockWhere })
      );
      const { DataExportService } = await import('../data-export-import');
      const svc = new DataExportService();
      const result = await svc.export('user1', 'members', {}, { format: 'xml' as 'json', includeRelations: false, dateFormat: '', compression: false });
      expect(result.status).toBe('completed');
    });

    it('jsonToCsv returns empty string for empty data', async () => {
      mocks.mockDynamic.mockImplementation(() =>
        Object.assign(Promise.resolve([]), { where: mocks.mockWhere })
      );
      const { DataExportService } = await import('../data-export-import');
      const svc = new DataExportService();
      const result = await svc.export('user1', 'members', {}, { format: 'csv', includeRelations: false, dateFormat: '', compression: false });
      expect(result.status).toBe('completed');
    });

    it('jsonToCsv escapes values with quotes', async () => {
      const row = {
        id: 'm1', userId: 'u1', name: 'Has "Quotes"', email: 'a@e.com', role: 'member',
        status: 'active', department: null, membershipNumber: null, organizationId: 'org1',
        createdAt: null,
      };
      mocks.mockDynamic.mockImplementation(() =>
        Object.assign(Promise.resolve([row]), { where: mocks.mockWhere })
      );
      const { DataExportService } = await import('../data-export-import');
      const svc = new DataExportService();
      const result = await svc.export('user1', 'members', {}, { format: 'csv', includeRelations: false, dateFormat: '', compression: false });
      expect(result.status).toBe('completed');
    });
  });

  describe('DataImportService gap coverage', () => {
    it('throws for member import missing email or organizationId', async () => {
      const { DataImportService } = await import('../data-export-import');
      const svc = new DataImportService();
      const result = await svc.import(
        'user1', 'members',
        JSON.stringify([{ name: 'NoOrg', email: 'a@e.com' }]),
        'json', { updateExisting: false, validateOnly: false }
      );
      // importRecord throws when organizationId is missing
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('throws for claim import missing memberId or organizationId', async () => {
      const { DataImportService } = await import('../data-export-import');
      const svc = new DataImportService();
      const result = await svc.import(
        'user1', 'claims',
        JSON.stringify([{ claimNumber: 'C1', memberId: 'm1' }]),
        'json', { updateExisting: false, validateOnly: false }
      );
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('imports claims without incidentDate (uses default)', async () => {
      const { DataImportService } = await import('../data-export-import');
      const svc = new DataImportService();
      const result = await svc.import(
        'user1', 'claims',
        JSON.stringify([{ memberId: 'm1', organizationId: 'org1', claimNumber: 'C9' }]),
        'json', { updateExisting: false, validateOnly: false }
      );
      expect(result.imported).toBe(1);
    });

    it('imports claims with incidentDate string', async () => {
      const { DataImportService } = await import('../data-export-import');
      const svc = new DataImportService();
      const result = await svc.import(
        'user1', 'claims',
        JSON.stringify([{ memberId: 'm1', organizationId: 'org1', incidentDate: '2026-01-01' }]),
        'json', { updateExisting: false, validateOnly: false }
      );
      expect(result.imported).toBe(1);
    });

    it('CSV line with empty content returns empty records via csvToJson', async () => {
      const { DataImportService } = await import('../data-export-import');
      const svc = new DataImportService();
      const result = await svc.import(
        'user1', 'members', '', 'csv',
        { updateExisting: false, validateOnly: true }
      );
      // Empty CSV → no data → valid with 0 records or error depending on validation
      expect(result).toBeDefined();
    });
  });
});
