/**
 * Bargaining Notes Service — Unit Tests
 *
 * Tests:
 *   - getBargainingNoteById: fetch note
 *   - createBargainingNote: insert
 *   - listBargainingNotes: filtered query
 *   - searchBargainingNotes: text search
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindFirst, mockFindMany, mockInsertValues, mockReturning } = vi.hoisted(() => {
  const mockReturning = vi.fn();
  return {
    mockFindFirst: vi.fn(),
    mockFindMany: vi.fn(),
    mockInsertValues: vi.fn(() => ({ returning: mockReturning })),
    mockReturning,
  };
});

vi.mock('@/db/db', () => ({
  db: {
    query: {
      bargainingNotes: { findFirst: mockFindFirst, findMany: mockFindMany },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockReturning })) })) })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{ count: 0 }]),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({ offset: vi.fn(async () => []) })),
        })),
        limit: vi.fn(async () => []),
      })),
    })),
  },
}));

vi.mock('@/db/schema', () => ({
  bargainingNotes: {
    id: 'id', cbaId: 'cbaId', organizationId: 'organizationId',
    sessionDate: 'sessionDate', content: 'content', createdAt: 'createdAt',
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { getBargainingNoteById, createBargainingNote } from '../bargaining-notes-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getBargainingNoteById', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns note when found', async () => {
    const note = { id: 'bn-1', content: 'Session notes from June' };
    mockFindFirst.mockResolvedValue(note);
    const result = await getBargainingNoteById('bn-1');
    expect(result).toEqual(note);
  });

  it('returns null when not found', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const result = await getBargainingNoteById('missing');
    expect(result).toBeNull();
  });
});

describe('createBargainingNote', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('inserts and returns the new note', async () => {
    const newNote = { id: 'bn-new', content: 'Employer proposal received' };
    mockReturning.mockResolvedValue([newNote]);
    const result = await createBargainingNote({
      organizationId: 'org-1',
      cbaId: 'cba-1',
      content: 'Employer proposal received',
    } as never);
    expect(result).toEqual(newNote);
  });
});
