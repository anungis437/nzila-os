#!/usr/bin/env node

/**
 * Nzila OS — Operational Honesty Copy Sweep Guardrail (R7)
 *
 * Doctrine anchor: docs/nzila-residual-closure/r7-operational-honesty-copy-sweep.md
 *
 * Scans the union-eyes app surface for FORBIDDEN operational-honesty framings:
 *  - inflated readiness ("All systems operational", "fully operational",
 *    "100% available", "all systems go")
 *  - celebratory recovery on operational surfaces ("Back online! Syncing",
 *    "we're back", "service restored — fully operational")
 *  - ambient AI assistant framing ("AI is thinking", "smart suggestions",
 *    "intelligent assistant")
 *
 * Carve-outs (legitimate user-content / non-operational surfaces):
 *  - peer-recognition reward emails / cards (rewards/* )
 *  - marketing pilot-request success page
 *  - user-content emoji reactions (award-card.tsx)
 *
 * Exit code 0 if no operational-honesty violations; exit 1 otherwise.
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
  path.join(repoRoot, 'apps', 'union-eyes', 'messages'),
];

const skipDirNames = new Set([
  'node_modules', '.next', '.turbo', 'dist', 'coverage', '__tests__',
]);

const fileExtensions = new Set(['.ts', '.tsx', '.json']);

// Skip carve-out paths (legitimate user-content / marketing surfaces).
const carveOutSubstrings = [
  '/lib/services/rewards/',
  '/components/rewards/award-card',
  '/(marketing)/pilot-request/',
  '/lib/mobile/social-media',
];

const forbiddenPatterns = [
  { label: 'inflated readiness', re: /\ball systems operational\b/i },
  { label: 'inflated readiness', re: /\bfully operational\b/i },
  { label: 'inflated readiness', re: /\b100% available\b/i },
  { label: 'inflated readiness', re: /\ball systems go\b/i },
  { label: 'celebratory recovery', re: /back online!\s*syncing/i },
  { label: 'celebratory recovery', re: /\bwe['\u2019]re back\b/i },
  { label: 'ambient AI assistant', re: /\bAI is thinking\b/i },
  { label: 'ambient AI assistant', re: /\bsmart suggestions\b/i },
  { label: 'ambient AI assistant', re: /\bintelligent assistant\b/i },
];

async function* walk(dir) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (skipDirNames.has(entry.name)) continue;
      yield* walk(path.join(dir, entry.name));
    } else if (entry.isFile() && fileExtensions.has(path.extname(entry.name))) {
      yield path.join(dir, entry.name);
    }
  }
}

function isCarveOut(relPath) {
  const normalized = relPath.replaceAll('\\', '/');
  return carveOutSubstrings.some((s) => normalized.includes(s));
}

async function main() {
  const violations = [];
  for (const root of scanRoots) {
    for await (const filePath of walk(root)) {
      const rel = path.relative(repoRoot, filePath).replaceAll('\\', '/');
      if (isCarveOut(rel)) continue;
      const text = await fs.readFile(filePath, 'utf8');
      const lines = text.split(/\r?\n/);
      lines.forEach((line, idx) => {
        for (const p of forbiddenPatterns) {
          if (p.re.test(line)) {
            violations.push({ file: rel, line: idx + 1, label: p.label, snippet: line.trim().slice(0, 200) });
          }
        }
      });
    }
  }

  if (violations.length > 0) {
    console.error('\nOperational honesty guardrail FAILED — forbidden framings detected:\n');
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  [${v.label}]`);
      console.error(`    ${v.snippet}`);
    }
    console.error('\nSee docs/nzila-residual-closure/r7-operational-honesty-copy-sweep.md for the canonical taxonomy.\n');
    process.exit(1);
  }

  console.log('Operational honesty guardrail PASSED. No forbidden framings found.');
}

main().catch((err) => { console.error('Guardrail threw:', err); process.exit(1); });
