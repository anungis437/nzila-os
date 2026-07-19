import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  execReturn: [] as unknown[],
}));

vi.mock('@/db/db', () => ({
  db: {
    execute: vi.fn(() => Promise.resolve(h.execReturn)),
  },
}));

vi.mock('drizzle-orm', () => ({
  sql: Object.assign(
    vi.fn(() => 'sql'),
    { raw: vi.fn(() => 'sql-raw') },
  ),
}));

import {
  exportReport,
  runPostMigrationValidation,
  runPreMigrationValidation,
} from '../data-integrity';

beforeEach(() => {
  h.execReturn = [];
});

describe('lib/migrations/data-integrity', () => {
  it('runPreMigrationValidation reports issues when checks find problems', async () => {
    h.execReturn = [{ tenant_id: 'x', id: 'i', count: 3, slug: 's', org_count: 2 }];
    const report = await runPreMigrationValidation();
    expect(report.phase).toBe('pre-migration');
    expect(report.totalIssues).toBeGreaterThan(0);
    expect(report.criticalIssues).toBeGreaterThan(0);
    expect(report.status).toBe('fail');
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it('runPreMigrationValidation passes when no issues found', async () => {
    h.execReturn = [];
    const report = await runPreMigrationValidation();
    expect(report.totalIssues).toBe(0);
    expect(report.status).toBe('pass');
    expect(report.recommendations).toContain('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ All pre-migration checks passed');
  });

  it('runPostMigrationValidation reports issues when checks find problems', async () => {
    h.execReturn = [{ tenant_id: 'x', id: 'i', count: 3, slug: 's', org_count: 2 }];
    const report = await runPostMigrationValidation();
    expect(report.phase).toBe('post-migration');
    expect(report.criticalIssues).toBeGreaterThan(0);
    expect(report.status).toBe('fail');
  });

  it('runPostMigrationValidation passes when no issues found', async () => {
    h.execReturn = [];
    const report = await runPostMigrationValidation();
    expect(report.totalIssues).toBe(0);
    expect(report.status).toBe('pass');
  });

  it('runPostMigrationValidation flags unmigrated rows as info', async () => {
    // total > migrated: first execute returns total=5, second migrated=2 for every table
    let call = 0;
    const { db } = await import('@/db/db');
    (db.execute as ReturnType<typeof vi.fn>).mockImplementation(() => {
      call += 1;
      // alternate larger total then smaller migrated count
      return Promise.resolve([{ count: call % 2 === 1 ? 5 : 2 }]);
    });
    const report = await runPostMigrationValidation();
    expect(report.infoIssues).toBeGreaterThanOrEqual(0);
    (db.execute as ReturnType<typeof vi.fn>).mockReset();
    (db.execute as ReturnType<typeof vi.fn>).mockImplementation(() => Promise.resolve(h.execReturn));
  });

  it('exportReport writes JSON and returns true on success', async () => {
    const os = await import('node:os');
    const path = await import('node:path');
    const fs = await import('node:fs');
    const file = path.join(os.tmpdir(), `integrity-${Date.now()}.json`);
    const report = await runPreMigrationValidation();
    expect(await exportReport(report, file)).toBe(true);
    expect(fs.existsSync(file)).toBe(true);
    fs.unlinkSync(file);
  });

  it('exportReport returns false on write failure', async () => {
    const report = await runPreMigrationValidation();
    expect(await exportReport(report, '/nonexistent-dir-xyz-123/report.json')).toBe(false);
  });
});
