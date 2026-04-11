/**
 * Contract Test — UnionEyes: Layer Boundary Enforcement
 *
 * Enforces the layered architecture:
 * - db/ layer cannot import from actions/, services/, app/, components/
 * - services/ can import db/ + lib/ but NOT app/ or components/
 * - actions/ can import services/ + db/ + lib/ but NOT components/ or app/
 *
 * @invariant INV-41: UE architectural layer boundaries
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const UE_ROOT = join(ROOT, 'apps', 'union-eyes');

function collectTsFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '__pycache__', '.turbo', 'migrations'].includes(entry.name)) continue;
      files.push(...collectTsFiles(fullPath));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue;
      if (entry.name.endsWith('.d.ts')) continue;
      files.push(fullPath);
    }
  }
  return files;
}

interface Violation {
  file: string;
  line: number;
  content: string;
  label: string;
}

function scanImports(dir: string, forbiddenPatterns: Array<{ pattern: RegExp; label: string }>): Violation[] {
  const violations: Violation[] = [];
  const absDir = join(UE_ROOT, dir);
  if (!existsSync(absDir)) return violations;

  const files = collectTsFiles(absDir);

  for (const fullPath of files) {
    const relPath = relative(UE_ROOT, fullPath).split(sep).join('/');
    const content = readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

      for (const { pattern, label } of forbiddenPatterns) {
        if (pattern.test(line)) {
          violations.push({ file: relPath, line: i + 1, content: line.trim(), label });
        }
      }
    }
  }
  return violations;
}

describe('INV-41 — UE Architectural Layer Boundaries', () => {
  it('db/ cannot import from actions/', () => {
    const violations = scanImports('db', [
      { pattern: /from\s+['"]@\/actions\//, label: 'db/ imports actions/' },
    ]);
    expect(violations, formatMsg('db/', violations)).toEqual([]);
  });

  it('db/ cannot import from services/', () => {
    const violations = scanImports('db', [
      { pattern: /from\s+['"]@\/services\//, label: 'db/ imports services/' },
    ]);
    expect(violations, formatMsg('db/', violations)).toEqual([]);
  });

  it('db/ cannot import from app/', () => {
    const violations = scanImports('db', [
      { pattern: /from\s+['"]@\/app\//, label: 'db/ imports app/' },
    ]);
    expect(violations, formatMsg('db/', violations)).toEqual([]);
  });

  it('db/ cannot import from components/', () => {
    const violations = scanImports('db', [
      { pattern: /from\s+['"]@\/components\//, label: 'db/ imports components/' },
    ]);
    expect(violations, formatMsg('db/', violations)).toEqual([]);
  });

  it('services/ cannot import from app/', () => {
    const violations = scanImports('services', [
      { pattern: /from\s+['"]@\/app\//, label: 'services/ imports app/' },
    ]);
    expect(violations, formatMsg('services/', violations)).toEqual([]);
  });

  it('services/ cannot import from components/', () => {
    const violations = scanImports('services', [
      { pattern: /from\s+['"]@\/components\//, label: 'services/ imports components/' },
    ]);
    expect(violations, formatMsg('services/', violations)).toEqual([]);
  });

  it('actions/ cannot import from app/', () => {
    const violations = scanImports('actions', [
      { pattern: /from\s+['"]@\/app\//, label: 'actions/ imports app/' },
    ]);
    expect(violations, formatMsg('actions/', violations)).toEqual([]);
  });

  it('actions/ cannot import from components/', () => {
    const violations = scanImports('actions', [
      { pattern: /from\s+['"]@\/components\//, label: 'actions/ imports components/' },
    ]);
    expect(violations, formatMsg('actions/', violations)).toEqual([]);
  });
});

function formatMsg(layer: string, violations: Violation[]): string {
  return (
    `BLOCKER: ${layer} has forbidden imports:\n` +
    violations.map(v => `  ${v.file}:${v.line} — [${v.label}] ${v.content}`).join('\n')
  );
}
