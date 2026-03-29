import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Hoisted mocks                                                     */
/* ------------------------------------------------------------------ */
const mocks = vi.hoisted(() => ({
  mockFindFirstDoc: vi.fn(),
  mockFindFirstFolder: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    query: {
      documents: { findFirst: mocks.mockFindFirstDoc },
      documentFolders: { findFirst: mocks.mockFindFirstFolder },
    },
    select: mocks.mockSelect,
    insert: mocks.mockInsert,
    update: mocks.mockUpdate,
    delete: mocks.mockDelete,
  },
}));

vi.mock('@/db/schema', () => ({
  documents: {
    id: 'id',
    organizationId: 'organizationId',
    folderId: 'folderId',
    category: 'category',
    fileType: 'fileType',
    uploadedBy: 'uploadedBy',
    name: 'name',
    description: 'description',
    contentText: 'contentText',
    tags: 'tags',
    deletedAt: 'deletedAt',
    uploadedAt: 'uploadedAt',
    createdAt: 'createdAt',
    fileSize: 'fileSize',
    isConfidential: 'isConfidential',
    updatedAt: 'updatedAt',
  },
  documentFolders: {
    id: 'id',
    organizationId: 'organizationId',
    parentFolderId: 'parentFolderId',
    name: 'name',
    deletedAt: 'deletedAt',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: unknown[]) => ({ _type: 'eq', _args: a })),
  and: vi.fn((...a: unknown[]) => ({ _type: 'and', _args: a })),
  or: vi.fn((...a: unknown[]) => ({ _type: 'or', _args: a })),
  desc: vi.fn((c: unknown) => ({ _type: 'desc', _col: c })),
  asc: vi.fn((c: unknown) => ({ _type: 'asc', _col: c })),
  sql: Object.assign(vi.fn((...a: unknown[]) => ({ _type: 'sql', _args: a })), {
    raw: vi.fn(),
    join: vi.fn(),
  }),
  count: vi.fn(() => 'count_fn'),
  inArray: vi.fn((...a: unknown[]) => ({ _type: 'inArray', _args: a })),
  like: vi.fn((...a: unknown[]) => ({ _type: 'like', _args: a })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function chain(result: any = undefined) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy', 'set', 'values', 'returning']) {
    c[m] = vi.fn(() => c);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c.then = (resolve: any) => resolve(result);
  return c;
}

/* ------------------------------------------------------------------ */
/*  Import SUT                                                        */
/* ------------------------------------------------------------------ */
import {
  getDocumentById,
  listDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  permanentlyDeleteDocument,
  getFolderById,
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  getFolderTree,
  createDocumentVersion,
  getDocumentVersions,
  processDocumentOCR,
  bulkProcessOCR,
  searchDocuments,
  bulkMoveDocuments,
  bulkUpdateTags,
  bulkDeleteDocuments,
  getDocumentStatistics,
} from '@/lib/services/document-service';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */
const DOC = {
  id: 'd1',
  name: 'Contract.pdf',
  organizationId: 'org-1',
  folderId: 'f1',
  category: 'legal',
  fileType: 'pdf',
  uploadedBy: 'u1',
  tags: ['contract'],
  fileSize: 1024,
  isConfidential: true,
  deletedAt: null,
  contentText: 'some text',
};

const FOLDER = {
  id: 'f1',
  name: 'Legal',
  organizationId: 'org-1',
  parentFolderId: null,
  deletedAt: null,
};

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */
describe('document-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ================================================================
  // getDocumentById
  // ================================================================
  describe('getDocumentById', () => {
    it('returns document when found', async () => {
      mocks.mockFindFirstDoc.mockResolvedValue(DOC);
      const result = await getDocumentById('d1');
      expect(result).toEqual(DOC);
    });

    it('returns null when not found', async () => {
      mocks.mockFindFirstDoc.mockResolvedValue(undefined);
      expect(await getDocumentById('missing')).toBeNull();
    });

    it('returns null when deletedAt is set', async () => {
      mocks.mockFindFirstDoc.mockResolvedValue({ ...DOC, deletedAt: new Date() });
      expect(await getDocumentById('d1')).toBeNull();
    });

    it('includes folder when requested', async () => {
      mocks.mockFindFirstDoc.mockResolvedValue(DOC);
      mocks.mockFindFirstFolder.mockResolvedValue(FOLDER);
      const result = await getDocumentById('d1', true);
      expect(result).toEqual({ ...DOC, folder: FOLDER });
    });

    it('returns folder as undefined when folder not found', async () => {
      mocks.mockFindFirstDoc.mockResolvedValue(DOC);
      mocks.mockFindFirstFolder.mockResolvedValue(undefined);
      const result = await getDocumentById('d1', true);
      expect(result!.folder).toBeUndefined();
    });

    it('throws on error', async () => {
      mocks.mockFindFirstDoc.mockRejectedValue(new Error('db'));
      await expect(getDocumentById('d1')).rejects.toThrow('Failed to fetch document');
    });
  });

  // ================================================================
  // listDocuments
  // ================================================================
  describe('listDocuments', () => {
    it('returns paginated results with defaults', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 1 }]))
        .mockReturnValueOnce(chain([DOC]));

      const result = await listDocuments();
      expect(result).toEqual({ documents: [DOC], total: 1, page: 1, limit: 50 });
    });

    it('applies filters including tags and search', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 0 }]))
        .mockReturnValueOnce(chain([]));

      const result = await listDocuments(
        { organizationId: 'org-1', folderId: 'f1', category: 'legal', fileType: 'pdf', uploadedBy: 'u1', tags: ['contract'], searchQuery: 'term' },
        { page: 2, limit: 10, sortBy: 'name', sortOrder: 'asc' },
      );
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });

    it('throws on error', async () => {
      mocks.mockSelect.mockImplementation(() => { throw new Error('fail'); });
      await expect(listDocuments()).rejects.toThrow('Failed to list documents');
    });

    it('uses createdAt as sort fallback when sortBy is not name/uploadedAt', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 0 }]))
        .mockReturnValueOnce(chain([]));

      const result = await listDocuments({}, { sortBy: 'createdAt', sortOrder: 'desc' });
      expect(result.documents).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ================================================================
  // Document CRUD
  // ================================================================
  describe('createDocument', () => {
    it('inserts and returns document', async () => {
      mocks.mockInsert.mockReturnValue(chain([DOC]));
      const result = await createDocument(DOC as never);
      expect(result).toEqual(DOC);
    });
  });

  describe('updateDocument', () => {
    it('updates and returns document', async () => {
      const updated = { ...DOC, name: 'Renamed.pdf' };
      mocks.mockUpdate.mockReturnValue(chain([updated]));
      const result = await updateDocument('d1', { name: 'Renamed.pdf' } as never);
      expect(result).toEqual(updated);
    });

    it('returns null when not found', async () => {
      mocks.mockUpdate.mockReturnValue(chain([undefined]));
      expect(await updateDocument('missing', {} as never)).toBeNull();
    });
  });

  describe('deleteDocument', () => {
    it('soft deletes and returns true', async () => {
      mocks.mockUpdate.mockReturnValue(chain([DOC]));
      expect(await deleteDocument('d1')).toBe(true);
    });

    it('returns false when not found', async () => {
      mocks.mockUpdate.mockReturnValue(chain([undefined]));
      expect(await deleteDocument('missing')).toBe(false);
    });
  });

  describe('permanentlyDeleteDocument', () => {
    it('hard deletes and returns true', async () => {
      mocks.mockDelete.mockReturnValue(chain());
      expect(await permanentlyDeleteDocument('d1')).toBe(true);
    });
  });

  // ================================================================
  // Folder operations
  // ================================================================
  describe('getFolderById', () => {
    it('returns folder with document count', async () => {
      mocks.mockFindFirstFolder.mockResolvedValue(FOLDER);
      mocks.mockSelect.mockReturnValue(chain([{ count: 5 }]));
      const result = await getFolderById('f1');
      expect(result).toEqual({ ...FOLDER, documentCount: 5 });
    });

    it('returns null when not found', async () => {
      mocks.mockFindFirstFolder.mockResolvedValue(undefined);
      expect(await getFolderById('missing')).toBeNull();
    });

    it('returns null when deletedAt is set', async () => {
      mocks.mockFindFirstFolder.mockResolvedValue({ ...FOLDER, deletedAt: new Date() });
      expect(await getFolderById('f1')).toBeNull();
    });

    it('falls back to documentCount 0 when count row is missing', async () => {
      mocks.mockFindFirstFolder.mockResolvedValue(FOLDER);
      mocks.mockSelect.mockReturnValue(chain([]));

      const result = await getFolderById('f1');
      expect(result).toEqual({ ...FOLDER, documentCount: 0 });
    });
  });

  describe('listFolders', () => {
    it('returns folders with document counts', async () => {
      // First select → folders, second select → doc count for folder1
      mocks.mockSelect
        .mockReturnValueOnce(chain([FOLDER]))
        .mockReturnValueOnce(chain([{ count: 3 }]));

      const result = await listFolders('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].documentCount).toBe(3);
    });

    it('handles null parentFolderId for root folders', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([]))
      const result = await listFolders('org-1', null);
      expect(result).toEqual([]);
    });

    it('filters by non-null parentFolderId', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([FOLDER]))
        .mockReturnValueOnce(chain([{ count: 1 }]));

      const result = await listFolders('org-1', 'parent-1');
      expect(result).toHaveLength(1);
      expect(result[0].documentCount).toBe(1);
    });

    it('falls back documentCount to 0 when count query returns empty', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([FOLDER]))
        .mockReturnValueOnce(chain([]));

      const result = await listFolders('org-1');
      expect(result[0].documentCount).toBe(0);
    });
  });

  describe('createFolder', () => {
    it('inserts and returns folder', async () => {
      mocks.mockInsert.mockReturnValue(chain([FOLDER]));
      const result = await createFolder(FOLDER as never);
      expect(result).toEqual(FOLDER);
    });
  });

  describe('updateFolder', () => {
    it('updates and returns folder', async () => {
      const updated = { ...FOLDER, name: 'Renamed' };
      mocks.mockUpdate.mockReturnValue(chain([updated]));
      const result = await updateFolder('f1', { name: 'Renamed' } as never);
      expect(result).toEqual(updated);
    });

    it('returns null when update yields no row', async () => {
      mocks.mockUpdate.mockReturnValue(chain([undefined]));
      const result = await updateFolder('missing', { name: 'Nope' } as never);
      expect(result).toBeNull();
    });
  });

  describe('deleteFolder', () => {
    it('soft deletes folder without contents', async () => {
      mocks.mockUpdate.mockReturnValue(chain([FOLDER]));
      expect(await deleteFolder('f1')).toBe(true);
    });

    it('deletes folder with contents (recursive)', async () => {
      // 1st update: soft delete docs in folder
      // 1st select: get subfolders → none
      // 2nd update: soft delete main folder
      mocks.mockUpdate
        .mockReturnValueOnce(chain())    // soft delete docs
        .mockReturnValueOnce(chain([FOLDER])); // delete main folder
      mocks.mockSelect.mockReturnValue(chain([])); // no subfolders

      expect(await deleteFolder('f1', true)).toBe(true);
    });
  });

  // ================================================================
  // getFolderTree
  // ================================================================
  describe('getFolderTree', () => {
    it('builds tree structure from flat folders', async () => {
      const child = { id: 'f2', name: 'Sub', organizationId: 'org-1', parentFolderId: 'f1', deletedAt: null };
      mocks.mockSelect.mockReturnValue(chain([FOLDER, child]));

      const tree = await getFolderTree('org-1');
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe('f1');
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children![0].id).toBe('f2');
    });

    it('returns empty array when no folders', async () => {
      mocks.mockSelect.mockReturnValue(chain([]));
      expect(await getFolderTree('org-1')).toEqual([]);
    });

    it('keeps orphaned folders out of root when parent is missing', async () => {
      const orphan = { id: 'f3', name: 'Orphan', organizationId: 'org-1', parentFolderId: 'missing-parent', deletedAt: null };
      mocks.mockSelect.mockReturnValue(chain([orphan]));

      const tree = await getFolderTree('org-1');
      expect(tree).toEqual([]);
    });
  });

  // ================================================================
  // Version control
  // ================================================================
  describe('createDocumentVersion', () => {
    it('returns version with generated fields', async () => {
      const v = await createDocumentVersion('d1', 'https://example.com/file.pdf', 'u1', 'Initial');
      expect(v.documentId).toBe('d1');
      expect(v.versionNumber).toBe(1);
      expect(v.changeDescription).toBe('Initial');
      expect(v.id).toMatch(/^version-/);
    });
  });

  describe('getDocumentVersions', () => {
    it('returns empty array', async () => {
      expect(await getDocumentVersions('d1')).toEqual([]);
    });
  });

  // ================================================================
  // OCR
  // ================================================================
  describe('processDocumentOCR', () => {
    it('processes and updates document', async () => {
      mocks.mockUpdate.mockReturnValue(chain([DOC]));
      const result = await processDocumentOCR('d1');
      expect(result.documentId).toBe('d1');
      expect(result.language).toBe('en');
      expect(result.processedAt).toBeInstanceOf(Date);
    });
  });

  describe('bulkProcessOCR', () => {
    it('processes all documents', async () => {
      mocks.mockUpdate.mockReturnValue(chain([DOC]));
      const result = await bulkProcessOCR(['d1', 'd2']);
      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
    });

    it('collects errors for failed documents', async () => {
      mocks.mockUpdate
        .mockReturnValueOnce(chain([DOC]))
        .mockImplementationOnce(() => { throw new Error('oops'); });

      const result = await bulkProcessOCR(['d1', 'd2']);
      expect(result.success).toBe(false);
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('uses fallback message when non-Error is thrown during OCR', async () => {
      mocks.mockUpdate.mockImplementationOnce(() => { throw 'bad-ocr'; });

      const result = await bulkProcessOCR(['d1']);
      expect(result.success).toBe(false);
      expect(result.errors?.[0].error).toBe('Failed to process document OCR');
    });
  });

  // ================================================================
  // Search
  // ================================================================
  describe('searchDocuments', () => {
    it('returns matching documents', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 1 }]))
        .mockReturnValueOnce(chain([DOC]));

      const result = await searchDocuments('org-1', 'contract');
      expect(result.documents).toEqual([DOC]);
      expect(result.total).toBe(1);
    });

    it('applies optional filters', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 0 }]))
        .mockReturnValueOnce(chain([]));

      const result = await searchDocuments('org-1', 'term', { category: 'legal', fileType: 'pdf', tags: ['x'], uploadedBy: 'u1' });
      expect(result.documents).toEqual([]);
    });

    it('skips full-text condition when searchQuery is empty', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 0 }]))
        .mockReturnValueOnce(chain([]));

      const result = await searchDocuments('org-1', '', { fileType: 'pdf' });
      expect(result.total).toBe(0);
    });
  });

  // ================================================================
  // Bulk operations
  // ================================================================
  describe('bulkMoveDocuments', () => {
    it('moves documents to target folder', async () => {
      mocks.mockUpdate.mockReturnValue(chain());
      const result = await bulkMoveDocuments(['d1', 'd2'], 'f2');
      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
    });

    it('returns failure on error', async () => {
      mocks.mockUpdate.mockImplementation(() => { throw new Error('fail'); });
      const result = await bulkMoveDocuments(['d1'], 'f2');
      expect(result.success).toBe(false);
    });
  });

  describe('bulkUpdateTags', () => {
    it('replaces tags', async () => {
      mocks.mockUpdate.mockReturnValue(chain());
      const result = await bulkUpdateTags(['d1'], ['new-tag'], 'replace');
      expect(result.success).toBe(true);
    });

    it('adds tags to existing', async () => {
      mocks.mockSelect.mockReturnValue(chain([{ ...DOC, tags: ['old'] }]));
      mocks.mockUpdate.mockReturnValue(chain([DOC]));
      const result = await bulkUpdateTags(['d1'], ['new'], 'add');
      expect(result.success).toBe(true);
    });

    it('removes tags', async () => {
      mocks.mockSelect.mockReturnValue(chain([{ ...DOC, tags: ['keep', 'remove'] }]));
      mocks.mockUpdate.mockReturnValue(chain([DOC]));
      const result = await bulkUpdateTags(['d1'], ['remove'], 'remove');
      expect(result.success).toBe(true);
    });

    it('treats missing tags as empty list in add operation', async () => {
      mocks.mockSelect.mockReturnValue(chain([{ ...DOC, tags: undefined }]));
      mocks.mockUpdate.mockReturnValue(chain([DOC]));

      const result = await bulkUpdateTags(['d1'], ['first'], 'add');
      expect(result.success).toBe(true);
    });
  });

  describe('bulkDeleteDocuments', () => {
    it('soft deletes documents', async () => {
      mocks.mockUpdate.mockReturnValue(chain());
      const result = await bulkDeleteDocuments(['d1', 'd2']);
      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
    });

    it('returns failure on error', async () => {
      mocks.mockUpdate.mockImplementation(() => { throw new Error('fail'); });
      const result = await bulkDeleteDocuments(['d1']);
      expect(result.success).toBe(false);
    });
  });

  // ================================================================
  // Statistics
  // ================================================================
  describe('getDocumentStatistics', () => {
    it('aggregates document statistics', async () => {
      const docs = [
        { category: 'legal', fileType: 'pdf', fileSize: 100, isConfidential: true },
        { category: 'legal', fileType: 'pdf', fileSize: 200, isConfidential: false },
        { category: 'hr', fileType: 'docx', fileSize: 300, isConfidential: true },
      ];
      mocks.mockSelect.mockReturnValue(chain(docs));

      const stats = await getDocumentStatistics('org-1');
      expect(stats.total).toBe(3);
      expect(stats.byCategory).toEqual({ legal: 2, hr: 1 });
      expect(stats.byFileType).toEqual({ pdf: 2, docx: 1 });
      expect(stats.totalSize).toBe(600);
      expect(stats.confidential).toBe(2);
    });

    it('handles empty documents', async () => {
      mocks.mockSelect.mockReturnValue(chain([]));
      const stats = await getDocumentStatistics('org-1');
      expect(stats.total).toBe(0);
      expect(stats.totalSize).toBe(0);
    });

    it('handles docs without category and fileSize', async () => {
      const docs = [
        { category: undefined, fileType: 'pdf', fileSize: undefined, isConfidential: false },
      ];
      mocks.mockSelect.mockReturnValue(chain(docs));

      const stats = await getDocumentStatistics('org-1');
      expect(stats.byCategory).toEqual({});
      expect(stats.byFileType).toEqual({ pdf: 1 });
      expect(stats.totalSize).toBe(0);
      expect(stats.confidential).toBe(0);
    });
  });
});
