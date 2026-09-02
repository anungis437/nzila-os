/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 14: ratchet against NEW, undispositioned duplicate
 * `user_management.*` physical-table declarations. Scans the real
 * apps/union-eyes/db/schema/** source tree for every
 * `userManagementSchema.table("<physical_name>", ...)` call, and fails if
 * any physical table name is declared in MORE than one file without a
 * matching entry in ./duplicate-declarations.ts (which records every
 * currently-known duplicate with real evidence — see that module's own
 * doc comment for the tracing method).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { authTableDuplicateDeclarations } from '../duplicate-declarations';

const UNION_EYES_SCHEMA_DIR = resolve(__dirname, '..', '..', '..', '..', '..', 'apps', 'union-eyes', 'db', 'schema');
const SHARED_AUTH_SCHEMA_FILE = resolve(__dirname, '..', '..', 'schema', 'auth.ts');

function listTsFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listTsFilesRecursive(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Every `userManagementSchema.table("<name>", ...)` declaration site, keyed by physical table name. */
function findPhysicalTableDeclarations(files: string[]): Map<string, string[]> {
  const byTable = new Map<string, string[]>();
  const pattern = /userManagementSchema\.table\(\s*["']([a-z_]+)["']/g;
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    for (const match of content.matchAll(pattern)) {
      const tableName = match[1];
      const existing = byTable.get(tableName) ?? [];
      existing.push(file);
      byTable.set(tableName, existing);
    }
  }
  return byTable;
}

describe('user_management duplicate-declaration ratchet', () => {
  it('every physical table declared in more than one file is explicitly dispositioned in duplicate-declarations.ts', () => {
    const unionEyesFiles = listTsFilesRecursive(UNION_EYES_SCHEMA_DIR);
    const allFiles = [...unionEyesFiles, SHARED_AUTH_SCHEMA_FILE];
    const byTable = findPhysicalTableDeclarations(allFiles);

    const dispositionedTables = new Set(
      authTableDuplicateDeclarations.map((e) => e.physicalTable.replace('user_management.', '')),
    );

    const undispositioned: string[] = [];
    for (const [tableName, files] of byTable) {
      if (files.length > 1 && !dispositionedTables.has(tableName)) {
        undispositioned.push(`${tableName} (declared in: ${files.join(', ')})`);
      }
    }

    expect(
      undispositioned,
      `New duplicate user_management physical table declaration(s) found without a disposition in packages/db/src/auth-storage-authority/duplicate-declarations.ts: ${undispositioned.join('; ')}`,
    ).toEqual([]);
  });

  it('every dispositioned physical table is still actually declared in more than one file (stale-entry check)', () => {
    const unionEyesFiles = listTsFilesRecursive(UNION_EYES_SCHEMA_DIR);
    const allFiles = [...unionEyesFiles, SHARED_AUTH_SCHEMA_FILE];
    const byTable = findPhysicalTableDeclarations(allFiles);

    for (const entry of authTableDuplicateDeclarations) {
      const tableName = entry.physicalTable.replace('user_management.', '');
      const declaredIn = byTable.get(tableName) ?? [];
      expect(
        declaredIn.length,
        `${entry.physicalTable} is dispositioned as duplicated but is now declared in only ${declaredIn.length} file(s) — update duplicate-declarations.ts`,
      ).toBeGreaterThanOrEqual(2);
    }
  });
});
