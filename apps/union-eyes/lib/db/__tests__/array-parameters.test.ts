import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * `= ANY(${values})` in a Drizzle `sql` template has never reached PostgreSQL as an array: Drizzle expands a JavaScript array to a parenthesized list of
 * parameters (`ANY(($1, $2))`), which PostgreSQL refuses whatever the length (see lib/db/sql-in.ts). Every statement written that way failed on its first run, and only a
 * run against a real database shows it: the CBA benchmark, the claims analytics filters, the semantic knowledge search, the GDPR claim export, the bulk
 * reward balances and others were all broken by it, behind unit tests that mock the database.
 *
 * This scans the source for the spelling and refuses a new one. A column of array type (`ANY(${organizations.hierarchyPath})`) is a real array and is pinned below. Each pinned
 * entry must still exist, so the list cannot outlive the code it excuses. The three finance statements that were pinned while the finance freeze held (the CLC remittance export,
 * arrears processing and the accounting invoice sync) were fixed when the freeze was lifted and left the list.
 */
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SKIPPED_DIRECTORIES = new Set([
  'node_modules', '.next', '.turbo', 'coverage', 'dist', 'build', '__tests__', 'e2e', 'tests', 'scripts', 'public', 'docs',
  'migrations', 'migrations-platform', 'migrations-cache',
]);
const PATTERN = /\bANY\s*\(\s*\$\{/;

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) found.push(...sourceFiles(join(directory, entry.name)));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(d|test|spec)\.tsx?$/.test(entry.name)) {
      found.push(join(directory, entry.name));
    }
  }
  return found;
}

interface Pinned {
  file: string;
  text: string;
  why: string;
}

const COLUMN_ARRAYS: Pinned[] = [
  { file: 'lib/services/policy-engine.ts', text: 'legalHolds.dataTypes', why: 'a column of array type' },
  { file: 'lib/organizations/reparent.ts', text: 'organizations.hierarchyPath', why: 'a column of array type' },
  { file: 'app/api/organizations/[id]/descendants/route.ts', text: 'organizations.hierarchyPath', why: 'a column of array type' },
  { file: 'app/api/organizations/hierarchy/route.ts', text: 'organizations.hierarchyPath', why: 'a column of array type' },
];

const hits = (() => {
  const found: Array<{ file: string; line: number; text: string }> = [];
  for (const path of sourceFiles(ROOT)) {
    const file = relative(ROOT, path).split(sep).join('/');
    readFileSync(path, 'utf8').split('\n').forEach((text, index) => {
      if (PATTERN.test(text)) found.push({ file, line: index + 1, text: text.trim() });
    });
  }
  return found;
})();

const isPinned = (hit: { file: string; text: string }) => COLUMN_ARRAYS.some((pin) => pin.file === hit.file && hit.text.includes(pin.text));

describe('array parameters in ANY(...)', () => {
  it('has no statement that hands ANY a JavaScript array, outside the pinned ones', () => {
    const offenders = hits.filter((hit) => !isPinned(hit)).map((hit) => `${hit.file}:${hit.line}  ${hit.text}`);
    expect(offenders, 'use inArray(column, values) for a table column, or sqlIn(sql`alias`, values) from lib/db/sql-in.ts for raw SQL').toEqual([]);
  });

  it('keeps every pinned exception alive, so a fixed statement leaves the list', () => {
    for (const pin of COLUMN_ARRAYS) {
      expect(hits.some((hit) => hit.file === pin.file && hit.text.includes(pin.text)), `${pin.file} (${pin.why}) no longer has the statement: remove it from the pinned list`).toBe(true);
    }
  });

  it('has no finance statement left in the list: the freeze is lifted and each was fixed', () => {
    const finance = ['services/clc/remittance-exporter.ts', 'services/financial-service/src/routes/arrears.ts', 'lib/integrations/adapters/accounting/sync-utils.ts'];
    for (const file of finance) expect(hits.some((hit) => hit.file === file), `${file} hands ANY an array again`).toBe(false);
  });
});
