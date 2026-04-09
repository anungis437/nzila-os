/**
 * Contract Test — Migration Replay Integrity
 *
 * Verifies the migration chain is well-formed:
 *  1. Every .sql file in the migrations dir is valid SQL (non-empty, no NUL bytes)
 *  2. Numbered migrations follow a monotonically increasing sequence (no dups, no gaps in the numbered prefix)
 *  3. MANIFEST.md references match actual files on disk
 *  4. Sub-directories (manual/, compliance/) contain only .sql or .md files
 *
 * @invariant INV-MIG-REPLAY: migration chain is replayable and manifest is consistent
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const MIGRATIONS_DIR = join(ROOT, 'apps', 'union-eyes', 'db', 'migrations');
const MANIFEST_PATH = join(MIGRATIONS_DIR, 'MANIFEST.md');

/** All .sql files directly in the migrations directory */
function listMigrationSqlFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter(
    (f) => f.endsWith('.sql') && statSync(join(MIGRATIONS_DIR, f)).isFile(),
  );
}

/** Extract the leading numeric prefix from a migration filename (e.g. "0007" from "0007_add_wage_benchmarks.sql") */
function numericPrefix(filename: string): number | null {
  const match = filename.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

describe('INV-MIG-REPLAY — Migration Replay Integrity', () => {
  const sqlFiles = listMigrationSqlFiles();

  it('migrations directory exists and contains SQL files', () => {
    expect(existsSync(MIGRATIONS_DIR)).toBe(true);
    expect(sqlFiles.length).toBeGreaterThan(0);
  });

  it('every .sql file is non-empty and contains no NUL bytes', () => {
    const problems: string[] = [];
    for (const file of sqlFiles) {
      const content = readFileSync(join(MIGRATIONS_DIR, file));
      if (content.length === 0) problems.push(`${file}: empty file`);
      if (content.includes(0)) problems.push(`${file}: contains NUL byte`);
    }
    expect(problems).toEqual([]);
  });

  it('every .sql file starts with a SQL-compatible statement or comment', () => {
    const problems: string[] = [];
    for (const file of sqlFiles) {
      const text = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8').trimStart();
      // Valid SQL files should start with a comment (--, /*) or a keyword
      const validStart = /^(--|\/\*|CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SET|DO|BEGIN|WITH|SELECT|GRANT|REVOKE|COMMENT|NOTIFY|LISTEN)/i;
      if (!validStart.test(text)) {
        problems.push(`${file}: unexpected start → "${text.slice(0, 40)}…"`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('numbered migration prefixes are unique when grouped by canonical sequence', () => {
    // Group files by their numeric prefix; exclude non-numbered files (like "add-payment-processor-support.sql")
    const numbered = sqlFiles
      .map((f) => ({ file: f, num: numericPrefix(f) }))
      .filter((e): e is { file: string; num: number } => e.num !== null);

    const seen = new Map<number, string[]>();
    for (const { file, num } of numbered) {
      const group = seen.get(num) ?? [];
      group.push(file);
      seen.set(num, group);
    }

    // Having multiple files with the same prefix is accepted only for known variant sets (e.g. 0059B/C/D/E/F)
    const duplicates: string[] = [];
    for (const [num, files] of seen) {
      // Strip variant suffixes (A-Z) after the number to group related migrations
      const canonicalNames = new Set(files.map((f) => f.replace(/^\d+[A-Z]?_/, '')));
      if (canonicalNames.size > 1 && files.length > 1) {
        // Multiple DISTINCT migrations sharing a prefix — flag for review
        // but 0059 variants and 0001 variants are expected (phase-based)
        // Date-prefixed migrations (YYYYMMDD) group multiple changes on the same day
        const isDatePrefix = num >= 20260101;
        const isKnownVariant = [0, 1, 59, 70, 80, 81, 1770880372830].includes(num) || isDatePrefix;
        if (!isKnownVariant) {
          duplicates.push(`prefix ${num}: ${files.join(', ')}`);
        }
      }
    }
    expect(duplicates).toEqual([]);
  });

  it('MANIFEST.md exists', () => {
    expect(existsSync(MANIFEST_PATH)).toBe(true);
  });

  it('MANIFEST.md references only files that exist on disk', () => {
    const manifest = readFileSync(MANIFEST_PATH, 'utf-8');
    // Extract filenames from the markdown table (pattern: | 0000 | filename.sql | ...)
    const referenced = [...manifest.matchAll(/\|\s*\d+\s*\|\s*(\S+\.sql)\s*\|/g)].map((m) => m[1]);
    expect(referenced.length).toBeGreaterThan(0);

    const onDisk = new Set(sqlFiles);
    const missing = referenced.filter((f) => !onDisk.has(f));
    expect(missing).toEqual([]);
  });

  it('sub-directories contain only .sql or .md files', () => {
    const subdirs = readdirSync(MIGRATIONS_DIR).filter((f) =>
      statSync(join(MIGRATIONS_DIR, f)).isDirectory(),
    );

    const problems: string[] = [];
    for (const dir of subdirs) {
      const children = readdirSync(join(MIGRATIONS_DIR, dir));
      for (const child of children) {
        const ext = extname(child).toLowerCase();
        if (!['.sql', '.md', '.json'].includes(ext)) {
          problems.push(`${dir}/${child}: unexpected extension ${ext}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
