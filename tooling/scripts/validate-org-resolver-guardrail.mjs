#!/usr/bin/env node

/**
 * Nzila OS — Org Resolver Forbidden-Pattern Guardrail (R9)
 *
 * Doctrine anchor: docs/nzila-residual-closure/r9-org-resolver-callsite-audit.md
 *
 * Scans the union-eyes app surface for FORBIDDEN org-resolver patterns:
 *
 *   1. `auth().orgId || …` — auth().orgId returns an Entra group GUID under
 *      Entra mode and never matches an app-level org UUID; the || chain
 *      silently falls back to a value that produces zero-row downstream
 *      queries instead of an honest no-org redirect.
 *
 *   2. `resolvedOrgId || …organizationId` — same structural failure mode:
 *      the canonical resolver returned null/undefined and the code silently
 *      reaches for an Entra-carried identifier.
 *
 * Exit code 0 if no forbidden patterns; exit code 1 if any are found.
 *
 * Wire into pre-commit / CI:
 *   pnpm validate:org-resolver-guardrail
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const scanRoots = [
  path.join(repoRoot, 'apps', 'union-eyes', 'app'),
  path.join(repoRoot, 'apps', 'union-eyes', 'lib'),
  path.join(repoRoot, 'apps', 'union-eyes', 'components'),
];

const skipDirNames = new Set([
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  'coverage',
  '__tests__',
]);

const fileExtensions = new Set(['.ts', '.tsx']);

const forbiddenPatterns = [
  {
    label: 'auth().orgId silent fallback',
    re: /auth\(\)\s*\.\s*orgId\s*\|\|/,
  },
  {
    label: 'resolvedOrgId silent fallback to non-canonical identifier',
    re: /\bresolvedOrgId\s*\|\|\s*\w+\.organizationId\b/,
  },
];

async function* walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (skipDirNames.has(entry.name)) continue;
      yield* walk(path.join(dir, entry.name));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (fileExtensions.has(ext)) {
        yield path.join(dir, entry.name);
      }
    }
  }
}

async function main() {
  const violations = [];

  for (const root of scanRoots) {
    for await (const filePath of walk(root)) {
      const text = await fs.readFile(filePath, 'utf8');
      const lines = text.split(/\r?\n/);
      lines.forEach((line, idx) => {
        for (const pattern of forbiddenPatterns) {
          if (pattern.re.test(line)) {
            violations.push({
              file: path.relative(repoRoot, filePath).replaceAll('\\', '/'),
              line: idx + 1,
              label: pattern.label,
              snippet: line.trim(),
            });
          }
        }
      });
    }
  }

  if (violations.length > 0) {
    console.error('\nOrg resolver guardrail FAILED — forbidden patterns detected:\n');
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  [${v.label}]`);
      console.error(`    ${v.snippet}`);
    }
    console.error('\nSee docs/nzila-residual-closure/r9-org-resolver-callsite-audit.md for the canonical fix.\n');
    process.exit(1);
  }

  console.log('Org resolver guardrail PASSED. No forbidden patterns found.');
}

main().catch((err) => {
  console.error('Guardrail threw:', err);
  process.exit(1);
});
