import { describe, expect, it } from 'vitest';
import {
  authorizedBrowserDocuments,
  pageBrowserDocuments,
  sortBrowserDocuments,
  toBrowserDocument,
} from './browser-repository';

const DOC = '11111111-1111-4111-8111-111111111111';

describe('browser repository projection', () => {
  it('drops storage urls, extracted text, and forged ids', () => {
    expect(toBrowserDocument({
      id: DOC,
      title: 'Case note',
      documentType: 'evidence',
      privacyLabel: 'privileged',
      fileUrl: 'https://secret.example/raw.pdf',
      contentText: 'privileged transcript',
      storageKey: 'documents/org/raw.pdf',
      ocrText: 'extracted',
    })).toEqual({
      id: DOC,
      title: 'Case note',
      documentType: 'evidence',
      privacyLabel: 'privileged',
      uploadedBy: null,
      createdAt: null,
      updatedAt: null,
    });
    expect(toBrowserDocument({ id: 'doc-1', title: 'forged', fileUrl: 'https://secret.example/x' })).toBeNull();
    expect(authorizedBrowserDocuments({ data: [{ id: 'not-a-uuid', fileUrl: 'https://secret.example/x' }] })).toEqual([]);
    expect(authorizedBrowserDocuments({ documents: [] })).toBeNull();
  });

  it('sorts and pages only the authorized rows', () => {
    const rows = [
      { id: '11111111-1111-4111-8111-111111111111', title: 'B', documentType: 'pdf', privacyLabel: null, uploadedBy: null, createdAt: null, updatedAt: '2026-02-01' },
      { id: '22222222-2222-4222-8222-222222222222', title: 'A', documentType: 'pdf', privacyLabel: null, uploadedBy: null, createdAt: null, updatedAt: '2026-03-01' },
    ];
    expect(sortBrowserDocuments(rows, 'title', 'asc').map((row) => row.title)).toEqual(['A', 'B']);
    expect(pageBrowserDocuments(rows, 2, 1)).toEqual([rows[1]]);
  });
});
