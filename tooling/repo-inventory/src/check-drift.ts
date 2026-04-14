/**
 * CI Drift Check
 *
 * Compares canonical repo inventory against claims made in core docs.
 * Fails if any doc references stale app/package/workflow counts.
 *
 * Usage:
 *   pnpm --filter @nzila/repo-inventory check
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { RepoInventory } from './generate';

const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const INVENTORY_PATH = join(ROOT, 'tooling', 'repo-inventory', 'output', 'inventory.json');

interface DriftError {
  file: string;
  line: number;
  claim: string;
  actual: string;
}

interface CanonicalRefError {
  file: string;
  issue: string;
}

// ── Load inventory ──────────────────────────────────────

function loadInventory(): RepoInventory {
  if (!existsSync(INVENTORY_PATH)) {
    console.error('ERROR: inventory.json not found. Run `pnpm --filter @nzila/repo-inventory generate` first.');
    process.exit(1);
  }
  return JSON.parse(readFileSync(INVENTORY_PATH, 'utf-8'));
}

// ── Check a single doc ──────────────────────────────────

function checkDoc(relPath: string, inv: RepoInventory): DriftError[] {
  const fullPath = join(ROOT, relPath);
  if (!existsSync(fullPath)) return [];

  const content = readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  const errors: DriftError[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip archival markers
    if (/archiv(e|al|ed)/i.test(line)) continue;

    // Check app count claims — match patterns like "16 apps", "16 applications", "Apps | 13"
    const appClaims = line.match(/\b(\d+)\s+(apps?|applications?)\b/i)
      ?? line.match(/Apps?\s*\|\s*(\d+)/);
    if (appClaims) {
      const claimed = parseInt(appClaims[1], 10);
      if (claimed !== inv.appCount && claimed > 5) { // ignore small counts referring to subsets
        errors.push({
          file: relPath,
          line: lineNum,
          claim: `${claimed} apps`,
          actual: `${inv.appCount} apps`,
        });
      }
    }

    // Check package count claims — "120+ packages", "58+ shared packages", "150+ packages"
    const pkgClaims = line.match(/\b(\d+)\+?\s+(shared\s+)?packages?\b/i)
      ?? line.match(/Packages?\s*\|\s*(\d+)\+?/);
    if (pkgClaims) {
      const claimed = parseInt(pkgClaims[1], 10);
      // Allow "58+" for domain-specific counts; only flag if claim is wildly off
      if (Math.abs(claimed - inv.packageCount) > 20 && claimed > 50) {
        errors.push({
          file: relPath,
          line: lineNum,
          claim: `${claimed} packages`,
          actual: `${inv.packageCount} packages`,
        });
      }
    }

    // Check workflow count claims — "15 CI/CD pipelines", "15 workflows"
    const wfClaims = line.match(/\b(\d+)\s+(CI\/CD\s+)?(workflows?|pipelines?)\b/i);
    if (wfClaims) {
      const claimed = parseInt(wfClaims[1], 10);
      if (claimed !== inv.workflowCount && Math.abs(claimed - inv.workflowCount) > 5) {
        errors.push({
          file: relPath,
          line: lineNum,
          claim: `${claimed} workflows`,
          actual: `${inv.workflowCount} workflows`,
        });
      }
    }
  }

  return errors;
}

// ── Docs to check ───────────────────────────────────────

const DOCS_TO_CHECK = [
  'README.md',
  'README.business.md',
  'docs/plans/REPO_ASSESSMENT.md',
  'docs/platform/platform-boundaries.md',
  'docs/platform/GA_READINESS.md',
  'docs/ga/GA_READINESS_GATE.md',
  'ARCHITECTURE.md',
];

const CANONICAL_COUNT_DOCS = [
  'README.md',
  'docs/plans/REPO_ASSESSMENT.md',
];

function checkCanonicalCountReferences(inv: RepoInventory): CanonicalRefError[] {
  const errors: CanonicalRefError[] = [];

  for (const relPath of CANONICAL_COUNT_DOCS) {
    const fullPath = join(ROOT, relPath);
    if (!existsSync(fullPath)) continue;
    const content = readFileSync(fullPath, 'utf-8');

    const requiresReference =
      content.includes('tooling/repo-inventory/output/repo-inventory.md') ||
      content.includes('tooling/repo-inventory/output/repo-inventory.json');

    if (!requiresReference) {
      errors.push({
        file: relPath,
        issue: 'Missing canonical inventory reference (tooling/repo-inventory/output/repo-inventory.md)',
      });
    }

    const hardcodedPatterns = [
      /\b\d+\s+apps?\b/i,
      /\b\d+\s+packages?\b/i,
      /\b\d+\s+(workflows?|pipelines?)\b/i,
      /\b\d+[\d,]*\+?\s+(tests?|test files?)\b/i,
      /\|\s*Apps?\s*\|\s*\d+/i,
      /\|\s*Packages?\s*\|\s*\d+/i,
      /\|\s*(GitHub\s+)?Workflows?\s*\|\s*\d+/i,
      /\|\s*Tests?\s*\|\s*\d+/i,
    ];

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('inventory') || line.includes('repo-inventory')) continue;
      if (hardcodedPatterns.some((pattern) => pattern.test(line))) {
        errors.push({
          file: relPath,
          issue: `Hardcoded count claim at line ${i + 1}: ${line.trim().slice(0, 120)}`,
        });
      }
    }
  }

  return errors;
}

// ── App floor checks ────────────────────────────────────

interface FloorError {
  app: string;
  issue: string;
}

function checkAppFloor(inv: RepoInventory): FloorError[] {
  const errors: FloorError[] = [];
  const exceptionsPath = join(ROOT, 'governance', 'exceptions', 'platform-adoption-exceptions.json');
  let exceptions: { entries: Array<{ path: string }> } = { entries: [] };
  if (existsSync(exceptionsPath)) {
    exceptions = JSON.parse(readFileSync(exceptionsPath, 'utf-8'));
  }
  const exceptionApps = new Set(exceptions.entries.map(e => e.path.replace('apps/', '')));

  for (const app of inv.apps) {
    if (!app.hasReadme) {
      errors.push({ app: app.name, issue: 'Missing README.md' });
    }
    if (!app.hasEnvExample) {
      errors.push({ app: app.name, issue: 'Missing .env.example' });
    }
  }

  return errors;
}

// ── Exception registry validation ───────────────────────

interface ExceptionError {
  file: string;
  issue: string;
}

function checkExceptionRegistry(inv: RepoInventory): ExceptionError[] {
  const errors: ExceptionError[] = [];
  const exceptionsPath = join(ROOT, 'governance', 'exceptions', 'platform-adoption-exceptions.json');

  if (!existsSync(exceptionsPath)) {
    errors.push({ file: exceptionsPath, issue: 'Platform adoption exception registry not found' });
    return errors;
  }

  const registry = JSON.parse(readFileSync(exceptionsPath, 'utf-8'));
  const appNames = new Set(inv.apps.map(a => a.name));

  for (const entry of registry.entries ?? []) {
    const appName = entry.path?.replace('apps/', '');
    if (!appNames.has(appName)) {
      errors.push({ file: 'platform-adoption-exceptions.json', issue: `Exception references nonexistent app: ${appName}` });
    }
    if (!entry.justification) {
      errors.push({ file: 'platform-adoption-exceptions.json', issue: `Exception for ${appName} has no justification` });
    }
    if (!entry.owner) {
      errors.push({ file: 'platform-adoption-exceptions.json', issue: `Exception for ${appName} has no owner` });
    }
    if (!entry.expiresOn) {
      errors.push({ file: 'platform-adoption-exceptions.json', issue: `Exception for ${appName} has no review date` });
    }
  }

  return errors;
}

// ── Main ────────────────────────────────────────────────

const inv = loadInventory();
let exitCode = 0;

console.log('🔍 Checking doc drift against canonical inventory…\n');

const driftErrors: DriftError[] = [];
for (const doc of DOCS_TO_CHECK) {
  driftErrors.push(...checkDoc(doc, inv));
}

if (driftErrors.length > 0) {
  console.log('❌ Doc drift detected:\n');
  for (const e of driftErrors) {
    console.log(`  ${e.file}:${e.line} — claims "${e.claim}", actual: "${e.actual}"`);
  }
  exitCode = 1;
} else {
  console.log('✅ All docs consistent with canonical inventory.');
}

console.log('\n🔍 Enforcing canonical count references…\n');

const canonicalErrors = checkCanonicalCountReferences(inv);
if (canonicalErrors.length > 0) {
  console.log('❌ Canonical count reference violations:\n');
  for (const e of canonicalErrors) {
    console.log(`  ${e.file}: ${e.issue}`);
  }
  exitCode = 1;
} else {
  console.log('✅ Canonical docs reference generated inventory and avoid hardcoded counts.');
}

console.log('\n🔍 Checking app operational floor…\n');

const floorErrors = checkAppFloor(inv);
if (floorErrors.length > 0) {
  console.log('❌ App floor gaps:\n');
  for (const e of floorErrors) {
    console.log(`  ${e.app}: ${e.issue}`);
  }
  exitCode = 1;
} else {
  console.log('✅ All apps meet operational floor (README + .env.example).');
}

console.log('\n🔍 Checking exception registry…\n');

const exceptionErrors = checkExceptionRegistry(inv);
if (exceptionErrors.length > 0) {
  console.log('❌ Exception registry issues:\n');
  for (const e of exceptionErrors) {
    console.log(`  ${e.file}: ${e.issue}`);
  }
  exitCode = 1;
} else {
  console.log('✅ Exception registry valid.');
}

console.log('');
process.exit(exitCode);
