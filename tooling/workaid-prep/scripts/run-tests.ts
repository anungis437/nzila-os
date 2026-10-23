/**
 * Runs the isolated WorkAid test suite and records machine-readable results.
 * Usage (from tooling/workaid-prep): node scripts/run-tests.ts [--out <file>]
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const repoRoot = resolve(root, '..', '..');
const outIdx = process.argv.indexOf('--out');
const outFile = resolve(outIdx > -1 ? process.argv[outIdx + 1]! : join(repoRoot, 'docs', 'union-eyes', 'workaid', 'evidence', 'test-results.json'));

const tmp = mkdtempSync(join(tmpdir(), 'workaid-junit-'));
const junit = join(tmp, 'junit.xml');
const testFiles = readdirSync(join(root, 'test')).filter((f) => f.endsWith('.test.ts')).sort().map((f) => join('test', f));
const args = ['--test', '--test-reporter=junit', `--test-reporter-destination=${junit}`, ...testFiles];
const run = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', env: { ...process.env, NODE_NO_WARNINGS: '1' } });

const xml = readFileSync(junit, 'utf8');
const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

interface Case {
  readonly file: string;
  readonly name: string;
  readonly status: 'PASS' | 'FAIL' | 'SKIPPED';
}
const cases: Case[] = [];
const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
for (const m of xml.matchAll(re)) {
  const attrs = m[1] ?? '';
  const body = m[3] ?? '';
  const name = unescape(/name="([^"]*)"/.exec(attrs)?.[1] ?? '');
  const file = unescape(/file="([^"]*)"/.exec(attrs)?.[1] ?? '').replace(/^.*[\\/]test[\\/]/, 'test/');
  if (!name) continue;
  const status: Case['status'] = /<failure\b|<error\b/.test(body) ? 'FAIL' : /<skipped\b/.test(body) ? 'SKIPPED' : 'PASS';
  cases.push({ file, name, status });
}

const git = (a: string[]) => execFileSync('git', a, { cwd: repoRoot, encoding: 'utf8' }).trim();
const result = {
  schema: 'workaid-test-results/1',
  command: `node --test --test-reporter=junit ${testFiles.join(' ')}`,
  cwd: 'tooling/workaid-prep',
  node: process.version,
  baseCommit: git(['rev-parse', 'HEAD']),
  workingTreeDirty: git(['status', '--porcelain']).length > 0,
  exitCode: run.status,
  totals: {
    total: cases.length,
    pass: cases.filter((c) => c.status === 'PASS').length,
    fail: cases.filter((c) => c.status === 'FAIL').length,
    skipped: cases.filter((c) => c.status === 'SKIPPED').length,
  },
  cases,
};
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ outFile, exitCode: run.status, ...result.totals }));
if (run.status !== 0) {
  console.error(run.stdout.split('\n').filter((l) => /✖|failing/.test(l)).slice(0, 40).join('\n'));
  process.exitCode = 1;
}
