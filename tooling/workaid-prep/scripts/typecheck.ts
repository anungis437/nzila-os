/**
 * Static type check of the harness (WA-C-002).
 *
 * The worktree has no installed dependencies, so TypeScript and @types/node are
 * read from a checkout the caller names explicitly. That use is READ-ONLY:
 * the check is run with --noEmit and --incremental false (nothing is emitted,
 * no build-info is written), the working directory is this harness, and the
 * script verifies afterwards that no path in this worktree changed.
 *
 *   $env:WORKAID_NODE_MODULES = '<path-to>\node_modules'
 *   node scripts/typecheck.ts
 *
 * Nothing is executed from the other checkout except the TypeScript compiler's
 * own JavaScript entry point.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { harnessRoot, preflight, repoRoot } from './guard.ts';

preflight();
const nm = process.env['WORKAID_NODE_MODULES'];
if (!nm) {
  console.error('set WORKAID_NODE_MODULES to a node_modules directory that contains typescript and @types/node');
  process.exit(2);
}
const tsc = join(nm, 'typescript', 'bin', 'tsc');
if (!existsSync(tsc) || !existsSync(join(nm, '@types', 'node'))) {
  console.error('typescript or @types/node not found under WORKAID_NODE_MODULES');
  process.exit(2);
}

const status = () => execFileSync('git', ['--no-optional-locks', 'status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' });
const before = status();
const args = [tsc, '-p', 'tsconfig.json', '--noEmit', '--incremental', 'false', '--typeRoots', join(nm, '@types')];
if (!args.includes('--noEmit')) throw new Error('refusing to run a type check that may emit');
const run = spawnSync(process.execPath, args, { cwd: harnessRoot, encoding: 'utf8' });
process.stdout.write(run.stdout);
process.stderr.write(run.stderr);
const after = status();
if (before !== after) {
  console.error('the type check changed the worktree:\n' + after);
  process.exit(3);
}
console.log(JSON.stringify({ exitCode: run.status, worktreeUnchangedByCheck: true }));
process.exitCode = run.status ?? 1;
