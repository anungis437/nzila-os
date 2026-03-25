/**
 * Contract Test — Union Eyes: Component Boundary Enforcement
 *
 * INVARIANT: UI components (components/, app/) must NOT directly import from:
 * - db/ (database layer)
 * - infra/ (infrastructure layer)
 * - services/ (service layer — must go through actions/)
 *
 * Allowed import patterns for components/app:
 * - @/lib/* (shared utilities)
 * - @/hooks/* (React hooks)
 * - @/types/* (type definitions)
 * - @/contexts/* (React contexts)
 * - @/actions/* (server actions)
 * - @/components/* (other components)
 * - @nzila/* (monorepo packages)
 * - External packages
 *
 * @invariant INV-40: UE component layer cannot import db/infra/services directly
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const UE_ROOT = join(ROOT, 'apps', 'union-eyes');

/** Directories that count as "UI layer" */
const UI_DIRS = ['components', 'app'];

/**
 * Forbidden import targets for UI layer.
 *
 * NOTE: `import type { … }` is excluded — type-only imports create no runtime
 * coupling and are erased at compile time, so they do not violate the boundary.
 */
const FORBIDDEN_IMPORTS = [
  { pattern: /^(?!.*\bimport\s+type\b).*from\s+['"]@\/db\//, label: 'direct db/ import' },
  { pattern: /^(?!.*\bimport\s+type\b).*from\s+['"]@\/db['"]/, label: 'direct db barrel import' },
  { pattern: /^(?!.*\bimport\s+type\b).*from\s+['"]@\/infra\//, label: 'direct infra/ import' },
  { pattern: /^(?!.*\bimport\s+type\b).*from\s+['"]@\/services\//, label: 'direct services/ import' },
  { pattern: /^(?!.*\bimport\s+type\b).*from\s+['"]\.\.\/db\//, label: 'relative db/ import' },
  { pattern: /^(?!.*\bimport\s+type\b).*from\s+['"]\.\.\/\.\.\/db\//, label: 'relative db/ import (2 levels)' },
  { pattern: /^(?!.*\bimport\s+type\b).*from\s+['"]\.\.\/services\//, label: 'relative services/ import' },
  { pattern: /^(?!.*\bimport\s+type\b).*from\s+['"]\.\.\/infra\//, label: 'relative infra/ import' },
];

/**
 * Files/patterns allowed to bypass the boundary (e.g. server components
 * that legitimately act as action wrappers).
 *
 * Next.js server components (pages, layouts) in app/ are rendered on the
 * server and may query the DB directly — this is a standard RSC pattern.
 */
const ALLOWLIST = [
  'app/api/',               // API routes are server-side, allowed to import db/services
  'app/admin/',             // Admin pages — server components with direct DB access
  'app/[locale]/admin/',    // Locale-prefixed admin pages — server components with direct DB access
  'app/[locale]/dashboard/', // Dashboard RSC pages — server components querying DB directly
  'app/layout.tsx',         // Root layout may use server-side providers
  'components/providers/',  // Provider wrappers
  'components/admin/',      // Admin components — server-side with direct DB access
];

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '__pycache__', '.turbo'].includes(entry.name)) continue;
      files.push(...collectFiles(fullPath));
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

function scanForBoundaryViolations(dir: string, dirName: string): Violation[] {
  const violations: Violation[] = [];
  const files = collectFiles(join(UE_ROOT, dir));

  for (const fullPath of files) {
    const relPath = relative(UE_ROOT, fullPath).split(sep).join('/');

    // Skip allowlisted paths
    if (ALLOWLIST.some(a => relPath.startsWith(a))) continue;

    const content = readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

      for (const { pattern, label } of FORBIDDEN_IMPORTS) {
        if (pattern.test(line)) {
          violations.push({
            file: relPath,
            line: i + 1,
            content: line.trim(),
            label,
          });
        }
      }
    }
  }
  return violations;
}

describe('INV-40 — UE Component Boundary Enforcement', () => {
  it('UE components/ directory exists', () => {
    expect(existsSync(join(UE_ROOT, 'components'))).toBe(true);
  });

  it('components/ must not import from db/, infra/, or services/', () => {
    const violations = scanForBoundaryViolations('components', 'components');

    expect(
      violations,
      `BLOCKER: UI components must not import directly from db/, infra/, or services/.\n` +
        `Use actions/ or lib/ as intermediaries.\n\n` +
        `Violations:\n` +
        violations.map(v => `  ${v.file}:${v.line} — [${v.label}] ${v.content}`).join('\n'),
    ).toEqual([]);
  });

  it('app/ pages (non-API) must not import from db/ or infra/ directly', () => {
    const violations = scanForBoundaryViolations('app', 'app');

    expect(
      violations,
      `BLOCKER: App pages/layouts must not import from db/ or infra/ directly.\n` +
        `Use server actions (actions/) for data access.\n\n` +
        `Violations:\n` +
        violations.map(v => `  ${v.file}:${v.line} — [${v.label}] ${v.content}`).join('\n'),
    ).toEqual([]);
  });
});
