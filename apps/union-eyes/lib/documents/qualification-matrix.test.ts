import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ALLOWED = [
  'IMPLEMENTED_TESTED',
  'IMPLEMENTED_PENDING_RUNTIME_PROOF',
  'BLOCKED_CANONICAL_CONTRACT',
  'BLOCKED_EXTERNAL_ACTIVATION',
  'RETAINED_REQUIRED_CONSUMER',
  'RETIREMENT_READY',
  'RETIRED_VERIFIED',
  'NOT_STARTED',
] as const;

const matrix = JSON.parse(
  readFileSync(join(__dirname, 'UE_CURSOR_DOCUMENT_CONSUMER_MATRIX.json'), 'utf8'),
) as {
  tranche3ContractGaps: Array<{ id: string }>;
  qualificationContractGaps: Array<{ id: string; owner: string; files: string[] }>;
  paths: Array<{ path: string; migrationStatus: string }>;
};

describe('document lane qualification statuses', () => {
  it('uses only the qualification vocabulary', () => {
    const allowed = new Set<string>(ALLOWED);
    for (const entry of matrix.paths) {
      expect(allowed.has(entry.migrationStatus), entry.path).toBe(true);
    }
  });

  it('leaves no owned path unstarted and retires none', () => {
    const counts = Object.fromEntries(ALLOWED.map((status) => [status, 0])) as Record<string, number>;
    for (const entry of matrix.paths) counts[entry.migrationStatus] += 1;
    expect(counts.NOT_STARTED).toBe(0);
    expect(counts.RETIRED_VERIFIED).toBe(0);
    expect(counts.RETIREMENT_READY).toBe(0);
    expect(matrix.paths).toHaveLength(48);
  });

  it('keeps the tranche 3 gap list and records the audit correction', () => {
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
    expect(matrix.qualificationContractGaps.map((gap) => gap.id)).toEqual([
      'external-download-durable-audit',
      'signature-provider-acknowledgment-timestamp',
    ]);
    for (const gap of matrix.qualificationContractGaps) {
      expect(gap.owner.length).toBeGreaterThan(0);
      expect(gap.files.length).toBeGreaterThan(0);
    }
  });

  it('marks the former unstarted consumers by their real obligation', () => {
    const status = new Map(matrix.paths.map((entry) => [entry.path, entry.migrationStatus]));
    expect(status.get('apps/union-eyes/lib/integrations/adapters/documents/__tests__/sharepoint-adapter.test.ts')).toBe('IMPLEMENTED_TESTED');
    expect(status.get('apps/union-eyes/lib/services/cba-intelligence/__tests__/document-service.test.ts')).toBe('IMPLEMENTED_TESTED');
    expect(status.get('apps/union-eyes/lib/services/cba-intelligence/document-service.ts')).toBe('IMPLEMENTED_TESTED');
    expect(status.get('apps/union-eyes/lib/integrations/adapters/documents/sharepoint-adapter.ts')).toBe('BLOCKED_EXTERNAL_ACTIVATION');
    expect(status.get('apps/union-eyes/app/api/external/documents/[id]/download/route.ts')).toBe('BLOCKED_CANONICAL_CONTRACT');
  });
});
