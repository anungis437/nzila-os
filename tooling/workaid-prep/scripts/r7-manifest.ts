/**
 * Binds the Grok R7 challenge set to an exact commit: SHA-256 of every file
 * under the two preparation prefixes as stored in that commit.
 *   node scripts/r7-manifest.ts <content-commit>
 * Read-only git (ls-tree, show); output goes through the write guard.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { preflight, safeWrite } from './guard.ts';

preflight();
const repoRoot = resolve(import.meta.dirname, '..', '..', '..');
const commit = process.argv[2];
if (!commit || !/^[0-9a-f]{40}$/.test(commit)) {
  console.error('usage: node scripts/r7-manifest.ts <40-hex content commit>');
  process.exit(2);
}
const git = (args: string[]) => execFileSync('git', ['--no-optional-locks', ...args], { cwd: repoRoot, maxBuffer: 256 * 1024 * 1024 });

const skip = new Set(['docs/union-eyes/workaid/evidence/R7_MANIFEST.json', 'docs/union-eyes/workaid/evidence/COMMIT_BINDING.md']);
const paths = git(['ls-tree', '-r', '--name-only', commit, '--', 'docs/union-eyes/workaid', 'tooling/workaid-prep'])
  .toString('utf8')
  .split('\n')
  .filter((p) => p && !skip.has(p))
  .sort();

const entries = paths.map((path) => {
  const buf = git(['show', `${commit}:${path}`]);
  return { path, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') };
});
const parent = git(['rev-parse', `${commit}^`]).toString('utf8').trim();

safeWrite(
  join(repoRoot, 'docs', 'union-eyes', 'workaid', 'evidence', 'R7_MANIFEST.json'),
  JSON.stringify({ schema: 'workaid-r7-manifest/1', contentCommit: commit, parent, platformBase: '38a824918cf2e7d7cfb7fcb0e796cbde45433be8', files: entries.length, entries }, null, 2) + '\n',
);
console.log(JSON.stringify({ commit, parent, files: entries.length }));
