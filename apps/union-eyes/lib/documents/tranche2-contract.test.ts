import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const matrix = JSON.parse(
  readFileSync(join(__dirname, 'UE_CURSOR_DOCUMENT_CONSUMER_MATRIX.json'), 'utf8'),
) as {
  canonicalContractGaps: Array<{ id: string }>;
  tranche2ContractGaps: Array<{ id: string; owner: string; files: string[]; tests: string[] }>;
  paths: Array<{ path: string; migrationStatus: string }>;
};

describe('tranche 2 document contract record', () => {
  it('keeps the tranche 1 gaps and records the OCR dependencies', () => {
    expect(matrix.canonicalContractGaps.map((gap) => gap.id)).toEqual([
      'document-share-disclosure',
      'document-retention-execution',
      'download-audit-when-canonical-v2-disabled',
    ]);
    expect(matrix.tranche2ContractGaps.map((gap) => gap.id)).toEqual([
      'repository-create-audit-for-unlinked-documents',
      'ocr-transcript-persistence',
      'ocr-member-visibility-role-gate',
      'ocr-audit-when-canonical-v2-disabled',
      'ocr-processor-and-blob-activation',
    ]);
    for (const gap of matrix.tranche2ContractGaps) {
      expect(gap.owner.length).toBeGreaterThan(0);
      expect(gap.files.length).toBeGreaterThan(0);
      expect(gap.tests.length).toBeGreaterThan(0);
    }
  });

  it('marks the browser and OCR surfaces migrated without moving tranche 1', () => {
    const status = new Map(matrix.paths.map((entry) => [entry.path, entry.migrationStatus]));
    expect(status.get('apps/union-eyes/app/[locale]/dashboard/documents/page.tsx')).toBe('tranche_1_complete');
    expect(status.get('apps/union-eyes/app/api/documents/[id]/download/route.ts')).toBe('tranche_1_complete');
    expect(status.get('apps/union-eyes/components/documents/documents-console.tsx')).toBe('tranche_1_complete');
    expect(status.get('apps/union-eyes/components/documents/document-browser.tsx')).toBe('tranche_2_complete');
    expect(status.get('apps/union-eyes/components/documents/ocr-upload.tsx')).toBe('tranche_2_complete');
    expect(status.get('apps/union-eyes/app/api/documents/[id]/ocr/route.ts')).toBe('tranche_2_complete');
    expect(status.get('apps/union-eyes/app/api/documents/upload/route.ts')).toBe('tranche_2_intake');
  });
});
