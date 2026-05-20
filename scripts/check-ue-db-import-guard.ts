#!/usr/bin/env tsx
/**
 * check-ue-db-import-guard.ts
 *
 * Governance guard: prevents direct raw DB imports in Union Eyes case/claim API modules.
 * All DB access in these paths must go through withRLSContext or an approved scoped wrapper.
 *
 * Exit 0 — clean (no violations)
 * Exit 1 — violations found (CI-blocking)
 *
 * Usage:
 *   pnpm governance:check-db-imports
 *   tsx scripts/check-ue-db-import-guard.ts
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// ── Configuration ─────────────────────────────────────────────────────────────

/** Root-relative paths to scan (Union Eyes case/claim API surfaces). */
const SCAN_PATHS = [
  'apps/union-eyes/app/api/cases',
  'apps/union-eyes/app/api/claims',
  'apps/union-eyes/db/queries',
  'apps/union-eyes/lib/workflow-engine.ts',
];

/**
 * Raw DB import patterns that are disallowed in scanned paths.
 * These bypass RLS context and must not appear in case/claim code.
 */
const DISALLOWED_PATTERNS: RegExp[] = [
  // Direct import of bare db client
  /import\s*\{[^}]*\bdb\b[^}]*\}\s*from\s*['"]@\/db\/db['"]/,
  /import\s*\{[^}]*\bdb\b[^}]*\}\s*from\s*['"]\.\.\/+db\/db['"]/,
  /import\s*\{[^}]*\bdb\b[^}]*\}\s*from\s*['"]\.\.\/\.\.\/+db\/db['"]/,
];

/** File extensions to check. */
const EXTENSIONS = ['.ts', '.tsx'];

/**
 * Explicit allowlist: files where a raw db import is permitted with a documented reason.
 * Add entries with justification when a true system-level need exists.
 *
 * PENDING MIGRATION: The entries below are pre-existing violations documented here so
 * the guard passes today while preventing NEW violations. Each should be migrated to
 * withRLSContext() as part of the ongoing org-isolation hardening work.
 */
const ALLOWLIST: Set<string> = new Set([
  // ── Pre-existing violations — P1 migration backlog ──────────────────────────
  'apps/union-eyes/app/api/cases/bulk-import/route.ts',          // TODO: migrate to withRLSContext
  'apps/union-eyes/app/api/cases/route.ts',                      // TODO: migrate to withRLSContext
  'apps/union-eyes/app/api/cases/[caseId]/escalate/route.ts',    // TODO: migrate to withRLSContext
  'apps/union-eyes/app/api/cases/[caseId]/evidence/route.ts',    // TODO: migrate to withRLSContext
  'apps/union-eyes/app/api/cases/[caseId]/route.ts',             // TODO: migrate to withRLSContext
  'apps/union-eyes/app/api/cases/[caseId]/timeline/route.ts',    // TODO: migrate to withRLSContext
  'apps/union-eyes/app/api/claims/route.ts',                     // TODO: migrate to withRLSContext
  'apps/union-eyes/app/api/claims/[id]/evidence/route.ts',       // TODO: migrate to withRLSContext
  'apps/union-eyes/app/api/claims/[id]/route.ts',                // TODO: migrate to withRLSContext
  'apps/union-eyes/app/api/claims/[id]/workflow/history/route.ts', // TODO: migrate to withRLSContext
  'apps/union-eyes/db/queries/analytics-queries.ts',             // TODO: migrate to withRLSContext
  'apps/union-eyes/db/queries/deadline-queries.ts',              // TODO: migrate to withRLSContext
  'apps/union-eyes/db/queries/enhanced-rbac-queries.ts',         // TODO: migrate to withRLSContext
  'apps/union-eyes/lib/workflow-engine.ts',                      // PARTIAL: assignClaim migrated; remaining functions pending
]);

// ── Scanner ───────────────────────────────────────────────────────────────────

function collectFiles(pathOrFile: string): string[] {
  const stat = statSync(pathOrFile, { throwIfNoEntry: false });
  if (!stat) return [];
  if (stat.isFile()) {
    const ext = pathOrFile.slice(pathOrFile.lastIndexOf('.'));
    return EXTENSIONS.includes(ext) ? [pathOrFile] : [];
  }
  const entries = readdirSync(pathOrFile);
  return entries.flatMap((entry) => collectFiles(join(pathOrFile, entry)));
}

interface Violation {
  file: string;
  line: number;
  text: string;
  pattern: string;
}

function checkFile(filePath: string, repoRoot: string): Violation[] {
  const relPath = relative(repoRoot, filePath).replace(/\\/g, '/');
  if (ALLOWLIST.has(relPath)) return [];

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: Violation[] = [];

  for (let i = 0; i < lines.length; i++) {
    for (const pattern of DISALLOWED_PATTERNS) {
      if (pattern.test(lines[i])) {
        violations.push({
          file: relPath,
          line: i + 1,
          text: lines[i].trim(),
          pattern: pattern.toString(),
        });
      }
    }
  }

  return violations;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const repoRoot = process.cwd();
  const allViolations: Violation[] = [];

  for (const scanPath of SCAN_PATHS) {
    const absPath = join(repoRoot, scanPath);
    const files = collectFiles(absPath);
    for (const file of files) {
      allViolations.push(...checkFile(file, repoRoot));
    }
  }

  if (allViolations.length === 0) {
    console.log('✅ governance:check-db-imports — clean (0 violations)');
    process.exit(0);
  }

  console.error(`\n❌ governance:check-db-imports — ${allViolations.length} violation(s) found\n`);
  console.error('Direct raw DB imports are not permitted in Union Eyes case/claim modules.');
  console.error('Use withRLSContext() or an approved scoped DB wrapper instead.\n');

  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    ${v.text}\n`);
  }

  console.error('To add a justified exception, add the file path to ALLOWLIST in:');
  console.error('  scripts/check-ue-db-import-guard.ts\n');

  process.exit(1);
}

main();
