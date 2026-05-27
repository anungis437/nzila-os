import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

describe('Union Eyes DR restore readiness contract', () => {
  it('keeps required DR drill scripts wired in workspace package scripts', () => {
    const packageJson = read('package.json');

    expect(packageJson).toContain('"db:restore-drill"');
    expect(packageJson).not.toContain('"db:restore-drill:execute"');
    expect(packageJson).toContain('"dr:drill:checklist"');
    expect(packageJson).toContain('"dr:drill:report"');
  });

  it('keeps restore drill execution and evidence fields required for auditable RTO', () => {
    const source = read('scripts/db/restore-drill.ts');

    expect(source).toContain('--execute');
    expect(source).toContain('rtoActual');
    expect(source).toContain('db-doctor');
    expect(source).toContain('migration-safety');
    expect(source).toContain('DR_DB_HOST');
    expect(source).toContain('DR_READY_URL');
  });

  it('keeps DR runbook aligned with live drill execution workflow', () => {
    const runbook = read('docs/union-eyes/dr/restore-drill-runbook.md');

    expect(runbook).toContain('pnpm dr:drill:checklist --live');
    expect(runbook).toContain('pnpm db:restore-drill -- --execute');
    expect(runbook).toContain('reports/dr/restore-drill-YYYY-MM-DD.md');
  });

  it('keeps public readiness summary transparent about measured RTO status', () => {
    const summary = read('docs/public/restore-readiness-summary.md');

    expect(summary).toContain('Live RTO measurement');
    expect(summary).toContain('We will not claim an RTO we have not measured.');
  });
});
