import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ---------- hoisted mocks ---------- */
const mocks = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockTransaction: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
  mockSet: vi.fn(),
  mockDeleteWhere: vi.fn(),
  mockQueryRecognitionPrograms: { findFirst: vi.fn(), findMany: vi.fn() },
  mockQueryRecognitionAwardTypes: { findFirst: vi.fn(), findMany: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  or: vi.fn((...args: unknown[]) => args),
  desc: vi.fn(),
  asc: vi.fn(),
  sql: vi.fn(),
  gt: vi.fn(),
  lt: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  inArray: vi.fn(),
  isNull: vi.fn(),
  between: vi.fn(),
  like: vi.fn(),
  ilike: vi.fn(),
  not: vi.fn(),
  ne: vi.fn((...a: unknown[]) => a),
  count: vi.fn(),
  sum: vi.fn(),
  avg: vi.fn(),
  min: vi.fn(),
  max: vi.fn(),
  relations: vi.fn(() => ({})),
}));

vi.mock('@/db', () => {
  const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mocks.mockReturning });
  mocks.mockSet.mockReturnValue({ where: mockUpdateWhere });
  mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });

  mocks.mockReturning.mockResolvedValue([]);
  mocks.mockValues.mockReturnValue({ returning: mocks.mockReturning });
  mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });

  mocks.mockDeleteWhere.mockResolvedValue(undefined);
  mocks.mockDelete.mockReturnValue({ where: mocks.mockDeleteWhere });

  const mockSelectWhere = vi.fn().mockReturnValue({
    orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ offset: vi.fn().mockResolvedValue([]) }) }),
    limit: vi.fn().mockResolvedValue([]),
  });
  const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockSelectFrom });

  return {
    db: {
      select: mockSelect,
      insert: mocks.mockInsert,
      update: mocks.mockUpdate,
      delete: mocks.mockDelete,
      transaction: mocks.mockTransaction,
      query: {
        recognitionPrograms: mocks.mockQueryRecognitionPrograms,
        recognitionAwardTypes: mocks.mockQueryRecognitionAwardTypes,
      },
    },
  };
});

vi.mock('@/db/schema', () => ({
  recognitionPrograms: { id: 'id', orgId: 'orgId', createdAt: 'createdAt' },
  recognitionAwardTypes: { id: 'id', orgId: 'orgId', programId: 'programId', createdAt: 'createdAt' },
}));

import {
  createProgram,
  getProgramById,
  listPrograms,
  updateProgram,
  archiveProgram,
  createAwardType,
  getAwardTypeById,
  listAwardTypes,
  updateAwardType,
} from '../program-service';

describe('program-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ============================= createProgram ============================= */
  describe('createProgram', () => {
    it('inserts program and returns it', async () => {
      const program = { id: 'p-1', orgId: 'org-1', name: 'Kudos Program' };
      mocks.mockReturning.mockResolvedValueOnce([program]);

      const result = await createProgram({ orgId: 'org-1', name: 'Kudos Program' } as any);

      expect(result).toEqual(program);
      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });

  /* ============================= getProgramById ============================= */
  describe('getProgramById', () => {
    it('returns program when found', async () => {
      const program = { id: 'p-1', orgId: 'org-1', name: 'Test' };
      mocks.mockQueryRecognitionPrograms.findFirst.mockResolvedValue(program);

      const result = await getProgramById('p-1', 'org-1');

      expect(result).toEqual(program);
    });

    it('returns null when not found', async () => {
      mocks.mockQueryRecognitionPrograms.findFirst.mockResolvedValue(null);

      const result = await getProgramById('nope', 'org-1');

      expect(result).toBeNull();
    });

    it('returns null when findFirst returns undefined', async () => {
      mocks.mockQueryRecognitionPrograms.findFirst.mockResolvedValue(undefined);

      const result = await getProgramById('x', 'org-1');

      expect(result).toBeNull();
    });
  });

  /* ============================= listPrograms ============================= */
  describe('listPrograms', () => {
    it('returns programs for an organization', async () => {
      const programs = [{ id: 'p-1' }, { id: 'p-2' }];
      mocks.mockQueryRecognitionPrograms.findMany.mockResolvedValue(programs);

      const result = await listPrograms('org-1');

      expect(result).toHaveLength(2);
    });

    it('returns empty array when no programs', async () => {
      mocks.mockQueryRecognitionPrograms.findMany.mockResolvedValue([]);

      const result = await listPrograms('org-1');

      expect(result).toEqual([]);
    });
  });

  /* ============================= updateProgram ============================= */
  describe('updateProgram', () => {
    it('updates program and returns it', async () => {
      const updated = { id: 'p-1', name: 'Updated Name' };
      mocks.mockReturning.mockResolvedValueOnce([updated]);

      const result = await updateProgram('p-1', 'org-1', { name: 'Updated Name' } as any);

      expect(result).toEqual(updated);
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });
  });

  /* ============================= archiveProgram ============================= */
  describe('archiveProgram', () => {
    it('archives program by setting status', async () => {
      const archived = { id: 'p-1', status: 'archived' };
      mocks.mockReturning.mockResolvedValueOnce([archived]);

      const result = await archiveProgram('p-1', 'org-1');

      expect(result.status).toBe('archived');
    });
  });

  /* ============================= createAwardType ============================= */
  describe('createAwardType', () => {
    it('inserts award type and returns it', async () => {
      const awardType = { id: 'at-1', name: 'Kudos', programId: 'p-1' };
      mocks.mockReturning.mockResolvedValueOnce([awardType]);

      const result = await createAwardType({ name: 'Kudos', programId: 'p-1' } as any);

      expect(result).toEqual(awardType);
    });
  });

  /* ============================= getAwardTypeById ============================= */
  describe('getAwardTypeById', () => {
    it('returns award type when found', async () => {
      const awardType = { id: 'at-1', orgId: 'org-1' };
      mocks.mockQueryRecognitionAwardTypes.findFirst.mockResolvedValue(awardType);

      const result = await getAwardTypeById('at-1', 'org-1');

      expect(result).toEqual(awardType);
    });

    it('returns null when not found', async () => {
      mocks.mockQueryRecognitionAwardTypes.findFirst.mockResolvedValue(null);

      const result = await getAwardTypeById('nope', 'org-1');

      expect(result).toBeNull();
    });
  });

  /* ============================= listAwardTypes ============================= */
  describe('listAwardTypes', () => {
    it('returns award types for a program', async () => {
      const types = [{ id: 'at-1' }, { id: 'at-2' }];
      mocks.mockQueryRecognitionAwardTypes.findMany.mockResolvedValue(types);

      const result = await listAwardTypes('p-1', 'org-1');

      expect(result).toEqual(types);
    });
  });

  /* ============================= updateAwardType ============================= */
  describe('updateAwardType', () => {
    it('updates award type and returns it', async () => {
      const updated = { id: 'at-1', name: 'Super Kudos' };
      mocks.mockReturning.mockResolvedValueOnce([updated]);

      const result = await updateAwardType('at-1', 'org-1', { name: 'Super Kudos' } as any);

      expect(result).toEqual(updated);
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });
  });
});
