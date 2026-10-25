import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const matrix = JSON.parse(
  readFileSync(join(__dirname, 'UE_CURSOR_DOCUMENT_CONSUMER_MATRIX.json'), 'utf8'),
) as {
  canonicalContractGaps: Array<{ id: string }>;
  tranche2ContractGaps: Array<{ id: string }>;
  tranche3ContractGaps: Array<{ id: string; owner: string; files: string[] }>;
  paths: Array<{ path: string; migrationStatus: string }>;
};

describe('tranche 3 document contract record', () => {
  it('keeps tranche 1 and tranche 2 gaps unchanged', () => {
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
      'temporary-intake-lifecycle',
      'ocr-case-processing-authority',
    ]);
  });

  it('records the remaining canonical dependencies', () => {
    expect(matrix.tranche3ContractGaps.map((gap) => gap.id)).toEqual([
      'legacy-list-unowned-callers',
      'document-folders',
      'document-categories',
      'portal-cms-routes-are-not-the-document-repository',
      'signature-provider-activation',
      'sharepoint-credentials',
      'staff-console-bulk-download',
      'external-download-sas-activation',
    ]);
    for (const gap of matrix.tranche3ContractGaps) {
      expect(gap.owner.length).toBeGreaterThan(0);
      expect(gap.files.length).toBeGreaterThan(0);
    }
  });

  it('moves the portal and signature consumers off the unstarted list', () => {
    const status = new Map(matrix.paths.map((entry) => [entry.path, entry.migrationStatus]));
    expect(status.get('apps/union-eyes/app/[locale]/dashboard/documents/page.tsx')).toBe('tranche_1_complete');
    expect(status.get('apps/union-eyes/components/documents/document-browser.tsx')).toBe('tranche_2_complete');
    expect(status.get('apps/union-eyes/app/api/signatures/documents/route.ts')).toBe('tranche_3_projection');
    expect(status.get('apps/union-eyes/components/documents/document-preview-modal.tsx')).toBe('tranche_3_fail_closed');
    expect(status.get('apps/union-eyes/app/api/documents/route.ts')).toBe('tranche_3_blocked_unowned_caller');
    expect(status.get('apps/union-eyes/lib/documents/batch-operations-service.ts')).toBe('tranche_3_fail_closed');
    expect(status.get('apps/union-eyes/app/api/external/documents/[id]/download/route.ts')).toBe('tranche_3_sas_without_file_url');
  });
});
