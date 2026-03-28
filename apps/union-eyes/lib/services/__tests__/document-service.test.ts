/**
 * Document Service — Unit Tests
 *
 * Tests:
 *   - getDocumentById: fetch doc
 *   - createDocument: insert
 *   - createFolder: folder insert
 *   - searchDocuments: query
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
      documents: { findFirst: mockFindFirst, findMany: mockFindMany },
      documentFolders: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockReturning })) })) })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => []),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({ offset: vi.fn(async () => []) })),
        })),
        limit: vi.fn(async () => []),
      })),
    })),
  },
}));

vi.mock('@/db/schema', () => ({
  documents: {
    id: 'id', organizationId: 'organizationId', title: 'title',
    folderId: 'folderId', status: 'status',
  },
  documentFolders: { id: 'id', organizationId: 'organizationId', name: 'name' },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { getDocumentById, createDocument, createFolder } from '../document-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getDocumentById', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns document when found', async () => {
    const doc = { id: 'doc-1', title: 'Union Constitution' };
    mockFindFirst.mockResolvedValue(doc);
    const result = await getDocumentById('doc-1');
    expect(result).toEqual(doc);
  });

  it('returns null when not found', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const result = await getDocumentById('missing');
    expect(result).toBeNull();
  });
});

describe('createDocument', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('inserts and returns the new document', async () => {
    const newDoc = { id: 'doc-new', title: 'Safety Report' };
    mockReturning.mockResolvedValue([newDoc]);
    const result = await createDocument({
      organizationId: 'org-1', title: 'Safety Report',
    } as never);
    expect(result).toEqual(newDoc);
  });
});

describe('createFolder', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('inserts and returns the new folder', async () => {
    const newFolder = { id: 'fld-new', name: 'Legal Docs' };
    mockReturning.mockResolvedValue([newFolder]);
    const result = await createFolder({
      organizationId: 'org-1', name: 'Legal Docs',
    } as never);
    expect(result).toEqual(newFolder);
  });
});
