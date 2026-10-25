import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  authorizedDownloadUrl,
  canonicalClassificationRewriteUnavailable,
  canonicalDownloadPath,
  canonicalShareUnavailable,
  denialFromStatus,
  isDocumentId,
  journeyCopy,
  mutationAccepted,
  repositoryRows,
  bulkReportFrom,
  denialForBulkOutcome,
  formatBulkSummary,
  mutationDenialFromStatus,
} from './canonical-journey';

const MATRIX = join(__dirname, 'UE_CURSOR_DOCUMENT_CONSUMER_MATRIX.json');
const COORDINATION = join(
  __dirname,
  '../../../../docs/union-eyes/convergence/UE_AGENT_COORDINATION.json',
);

describe('canonical document journey rules', () => {
  it('accepts only uuid document ids', () => {
    expect(isDocumentId('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isDocumentId('doc-1')).toBe(false);
    expect(isDocumentId('../etc/passwd')).toBe(false);
    expect(canonicalDownloadPath('11111111-1111-4111-8111-111111111111')).toBe(
      '/api/documents/11111111-1111-4111-8111-111111111111/download',
    );
  });

  it('never treats a list-row file url as download authority', () => {
    const rows = repositoryRows({
      data: [{ id: '11111111-1111-4111-8111-111111111111', fileUrl: 'https://secret.example/raw.pdf' }],
    });
    expect(rows).toEqual([{ id: '11111111-1111-4111-8111-111111111111', fileUrl: 'https://secret.example/raw.pdf' }]);
    expect(authorizedDownloadUrl(200, { data: { fileUrl: 'https://secret.example/raw.pdf' } })).toBeNull();
    expect(authorizedDownloadUrl(200, { data: { downloadUrl: 'https://storage.example/signed' } })).toBe(
      'https://storage.example/signed',
    );
    expect(authorizedDownloadUrl(403, { data: { downloadUrl: 'https://storage.example/signed' } })).toBeNull();
    expect(authorizedDownloadUrl(200, { data: { downloadUrl: '' } })).toBeNull();
  });

  it('accepts a mutation only on a successful status', () => {
    expect(mutationAccepted(201)).toBe(true);
    expect(mutationAccepted(403)).toBe(false);
    expect(mutationAccepted(409)).toBe(false);
    expect(mutationAccepted(500)).toBe(false);
    expect(denialFromStatus(400)).toBe('malformed_id');
    expect(denialFromStatus(403)).toBe('unauthorized');
    expect(denialFromStatus(404)).toBe('unauthorized');
    expect(denialFromStatus(409)).toBe('conflict');
    expect(denialFromStatus(502)).toBe('storage_failure');
    expect(denialFromStatus(503)).toBe('audit_failure');
  });

  it('blocks share and classification rewrites that are not canonical actions', () => {
    expect(canonicalShareUnavailable()).toEqual({ accepted: false, denial: 'share_blocked' });
    expect(canonicalClassificationRewriteUnavailable()).toEqual({
      accepted: false,
      denial: 'classification_change_blocked',
    });
  });

  it('covers english and french denial copy', () => {
    expect(journeyCopy('en-CA').share_blocked).toMatch(/privacy label/i);
    expect(journeyCopy('fr-CA').share_blocked).toMatch(/partage/i);
    expect(journeyCopy('fr').download).toBe('Telecharger');
    expect(journeyCopy('en').download).toBe('Download');
  });

  it('tracks every cursor-owned path and no protected contract', () => {
    const matrix = JSON.parse(readFileSync(MATRIX, 'utf8')) as {
      paths: Array<{ path: string; disposition: string; migrationStatus: string }>;
      canonicalContractGaps: Array<{ id: string }>;
    };
    const coordination = JSON.parse(readFileSync(COORDINATION, 'utf8')) as {
      cursorMayEdit: string[];
      cursorMustConsumeWithoutEditing: string[];
      integratorReservedCaseDocumentRoutes: string[];
    };
    const tracked = matrix.paths.map((entry) => entry.path);
    expect(tracked).toEqual(coordination.cursorMayEdit);
    const allowed = new Set([
      'MIGRATE',
      'REPLACE',
      'RETAIN_CANONICAL',
      'RETIRE_UNUSED',
      'BLOCKED_CANONICAL_CONTRACT',
    ]);
    for (const entry of matrix.paths) {
      expect(allowed.has(entry.disposition), entry.path).toBe(true);
    }
    const protectedPaths = new Set([
      ...coordination.cursorMustConsumeWithoutEditing,
      ...coordination.integratorReservedCaseDocumentRoutes,
    ]);
    expect(tracked.some((path) => protectedPaths.has(path))).toBe(false);
    expect(matrix.paths.filter((entry) => entry.migrationStatus === 'tranche_1_complete')).toEqual([
      expect.objectContaining({ path: 'apps/union-eyes/app/[locale]/dashboard/documents/page.tsx' }),
      expect.objectContaining({ path: 'apps/union-eyes/app/api/documents/[id]/download/route.ts' }),
      expect.objectContaining({ path: 'apps/union-eyes/components/documents/documents-console.tsx' }),
    ]);
    expect(matrix.canonicalContractGaps.map((gap) => gap.id)).toEqual([
      'document-share-disclosure',
      'document-retention-execution',
      'download-audit-when-canonical-v2-disabled',
    ]);
  });
});

describe('bulk and retention copy', () => {
  const report = (status: 'complete' | 'partial' | 'none', issued: number, failed: number) =>
    ({ atomic: false as const, status, requested: issued + failed, issued, failed, items: [] });

  it('says plainly that a partial bulk keeps the links already issued', () => {
    const text = formatBulkSummary(journeyCopy('en'), report('partial', 2, 1));
    expect(text).toContain('2 of 3 links were issued; 1 were not');
    expect(text).toContain('Links already issued stay valid');
  });

  it('formats each status in both languages and never leaves a placeholder', () => {
    for (const locale of ['en', 'fr-CA']) {
      for (const status of ['complete', 'partial', 'none'] as const) {
        expect(formatBulkSummary(journeyCopy(locale), report(status, 1, 1))).not.toMatch(/[{}]/);
      }
    }
  });

  it('declares retention unavailable in both languages without claiming a rule or a hold', () => {
    expect(journeyCopy('en').retention_unavailable).toContain('No canonical document retention record exists yet');
    expect(journeyCopy('fr').retention_unavailable.length).toBeGreaterThan(40);
  });

  it('maps bulk outcomes to the same denials as a single download and rejects forged bulk bodies', () => {
    expect(denialForBulkOutcome('storage_unverified')).toBe('storage_failure');
    expect(denialForBulkOutcome('audit_failed')).toBe('audit_failure');
    expect(denialForBulkOutcome('denied')).toBe('unauthorized');
    expect(mutationDenialFromStatus(400)).toBe('reference_rejected');
    expect(bulkReportFrom(200, { data: { atomic: true, items: [], requested: 0, issued: 0, failed: 0 } })).toBeNull();
    expect(bulkReportFrom(500, {})).toBeNull();
  });
});
