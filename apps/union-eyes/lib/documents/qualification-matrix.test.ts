import { existsSync, readFileSync } from 'node:fs';
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
  retiredPaths: Array<{ path: string; retiredBy: string; reason: string; replacement: string }>;
};

describe('document lane qualification statuses', () => {
  it('uses only the qualification vocabulary', () => {
    const allowed = new Set<string>(ALLOWED);
    for (const entry of matrix.paths) {
      expect(allowed.has(entry.migrationStatus), entry.path).toBe(true);
    }
  });

  it('leaves no owned path unstarted, and lists a path as owned exactly while its file exists', () => {
    const counts = Object.fromEntries(ALLOWED.map((status) => [status, 0])) as Record<string, number>;
    for (const entry of matrix.paths) counts[entry.migrationStatus] += 1;
    expect(counts.NOT_STARTED).toBe(0);
    expect(counts.RETIRED_VERIFIED).toBe(0);
    expect(counts.RETIREMENT_READY).toBe(0);
    expect(matrix.paths).toHaveLength(39);
    // A path that no longer exists is not a consumer to be migrated; it is a retirement, recorded with its reason.
    const repoRoot = join(__dirname, '..', '..', '..', '..');
    for (const entry of matrix.paths) expect(existsSync(join(repoRoot, entry.path)), entry.path).toBe(true);
    expect(matrix.retiredPaths.map((entry) => entry.path)).toEqual([
      'apps/union-eyes/components/documents/document-preview-modal.tsx',
      'apps/union-eyes/lib/integrations/adapters/documents/sharepoint-adapter.ts',
      'apps/union-eyes/lib/integrations/adapters/documents/sharepoint-client.ts',
      'apps/union-eyes/lib/integrations/adapters/documents/index.ts',
      'apps/union-eyes/lib/integrations/adapters/documents/__tests__/sharepoint-adapter.test.ts',
      'apps/union-eyes/lib/integrations/adapters/documents/__tests__/sharepoint-client.test.ts',
      'apps/union-eyes/components/documents/advanced-search.tsx',
      'apps/union-eyes/components/documents/document-sharing-controls.tsx',
      'apps/union-eyes/components/documents/document-approval-workflow.tsx',
    ]);
    for (const retired of matrix.retiredPaths) {
      expect(existsSync(join(repoRoot, retired.path)), retired.path).toBe(false);
      expect(matrix.paths.some((entry) => entry.path === retired.path), retired.path).toBe(false);
      expect(retired.reason.length, retired.path).toBeGreaterThan(40);
      expect(retired.replacement.length, retired.path).toBeGreaterThan(0);
    }
  });

  it('keeps the tranche 3 gap list and records the audit correction', () => {
    expect(matrix.tranche3ContractGaps.map((gap) => gap.id)).toEqual([
      'legacy-list-unowned-callers',
      'document-folders',
      'document-categories',
      'portal-cms-routes-are-not-the-document-repository',
      'signature-provider-activation',
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
    // The SharePoint adapter was deleted (no approved provider, no database authority): it is recorded in retiredPaths.
    expect(status.has('apps/union-eyes/lib/integrations/adapters/documents/sharepoint-adapter.ts')).toBe(false);
    expect(status.has('apps/union-eyes/lib/integrations/adapters/documents/__tests__/sharepoint-adapter.test.ts')).toBe(false);
    expect(status.get('apps/union-eyes/lib/services/cba-intelligence/__tests__/document-service.test.ts')).toBe('IMPLEMENTED_TESTED');
    expect(status.get('apps/union-eyes/lib/services/cba-intelligence/document-service.ts')).toBe('IMPLEMENTED_TESTED');
    expect(status.get('apps/union-eyes/app/api/external/documents/[id]/download/route.ts')).toBe('IMPLEMENTED_PENDING_RUNTIME_PROOF');
  });
});
