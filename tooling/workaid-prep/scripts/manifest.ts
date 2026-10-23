/**
 * Content manifest of everything this branch adds: path, bytes, SHA-256.
 * Binds the integration handoff to exact file contents independent of commit ids.
 *   node scripts/manifest.ts
 * Excludes evidence/harness-manifest.json itself and evidence/COMMIT_BINDING.md.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..', '..');
const roots = [join(repoRoot, 'docs', 'union-eyes', 'workaid'), join(repoRoot, 'tooling', 'workaid-prep')];
const skip = new Set(['docs/union-eyes/workaid/evidence/harness-manifest.json', 'docs/union-eyes/workaid/evidence/COMMIT_BINDING.md']);

const files: string[] = [];
const walk = (d: string) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const p = join(d, e.name);
    e.isDirectory() ? walk(p) : files.push(p);
  }
};
roots.forEach(walk);

const entries = files
  .map((f) => relative(repoRoot, f).replace(/\\/g, '/'))
  .filter((rel) => !skip.has(rel))
  .sort()
  .map((rel) => {
    // Normalize CRLF so the hash matches what git stores for these LF-normalized text files.
    const buf = readFileSync(join(repoRoot, rel));
    const norm = Buffer.from(buf.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
    return { path: rel, bytes: norm.length, sha256: createHash('sha256').update(norm).digest('hex') };
  });

writeFileSync(
  join(repoRoot, 'docs', 'union-eyes', 'workaid', 'evidence', 'harness-manifest.json'),
  JSON.stringify({ schema: 'workaid-harness-manifest/1', files: entries.length, entries }, null, 2) + '\n',
);
console.log(JSON.stringify({ files: entries.length, totalBytes: entries.reduce((n, e) => n + e.bytes, 0), statSize: statSync(repoRoot).isDirectory() }));
