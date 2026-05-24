#!/usr/bin/env node
// One-off: flip the 7 renamed lib subdir slugs from institutional-* to organizational-*
// in import paths, JSDoc/comments, and string labels across apps/union-eyes/**.
// Excludes node_modules, .next, dist, .turbo, coverage, lock files, .git.
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'apps/union-eyes';
const SLUGS = [
  'chronology',
  'dynamics',
  'narratives',
  'observability',
  'operating-intelligence',
  'storytelling',
  'topology',
];
const EXCLUDE_DIRS = new Set(['node_modules', '.next', 'dist', '.turbo', 'coverage', '.git']);
const EXCLUDE_FILES = new Set(['tsconfig.tsbuildinfo']);
const INCLUDE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|mdx)$/;

let filesChanged = 0;
let totalEdits = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else if (st.isFile() && INCLUDE_EXT.test(entry) && !EXCLUDE_FILES.has(entry)) processFile(full);
  }
}

function processFile(file) {
  const before = readFileSync(file, 'utf8');
  let after = before;
  let edits = 0;
  for (const slug of SLUGS) {
    const re = new RegExp(`institutional-${slug}`, 'g');
    after = after.replace(re, (m) => { edits++; return `organizational-${slug}`; });
  }
  if (edits > 0 && after !== before) {
    writeFileSync(file, after);
    filesChanged++;
    totalEdits += edits;
    console.log(`✓ ${relative(process.cwd(), file)} (${edits})`);
  }
}

walk(ROOT);
console.log(`\nDone — ${totalEdits} slug flips across ${filesChanged} files.`);
