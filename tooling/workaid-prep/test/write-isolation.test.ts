import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertWritable, harnessRoot, isInside, otherWorktreeRoots, preflight, repoRoot, safeCopyTree, safeRemoveTemp, safeTempDir } from '../scripts/guard.ts';
import { validateDocsSandboxed } from '../scripts/validate-docs-sandboxed.ts';

/**
 * WA-C-002. Preparation operations must not be able to write into any other
 * checkout, even temporarily. History: the v0.2 slice ran the repository's
 * documentation validator with another checkout's `tsx`; the validator derives its
 * output directory from the working directory and wrote tracked report files, which were
 * then restored with `git checkout`. Nothing reached another checkout, but nothing
 * prevented it either. These tests make the property structural.
 */
const PINNED_SHA = '38a824918cf2e7d7cfb7fcb0e796cbde45433be8';
const pinned = (path: string) => execFileSync('git', ['--no-optional-locks', 'show', `${PINNED_SHA}:${path}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });

const sourceFiles = (): string[] => {
  const out: string[] = [];
  for (const d of ['scripts', 'src', 'test']) {
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) (e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.ts') && out.push(join(dir, e.name)));
    };
    walk(join(harnessRoot, d));
  }
  return out;
};
const SELF = 'write-isolation.test.ts';

describe('write isolation (WA-C-002)', () => {
  it('[WA-T109] preflight confirms the isolated linked worktree on an agents/workaid-prep branch', () => {
    const p = preflight();
    assert.match(p.branch, /^agents\/workaid-prep/);
    assert.equal(p.linkedWorktree, true);
  });

  it('[WA-T109] writes are permitted only under the two preparation prefixes or the OS temp directory', () => {
    assert.doesNotThrow(() => assertWritable(join(repoRoot, 'docs', 'union-eyes', 'workaid', 'x.md')));
    assert.doesNotThrow(() => assertWritable(join(repoRoot, 'tooling', 'workaid-prep', 'scripts', 'x.ts')));
    assert.doesNotThrow(() => assertWritable(join(tmpdir(), 'anything')));
    for (const bad of ['package.json', 'pnpm-lock.yaml', 'reports/doc-consistency.json', 'apps/union-eyes/lib/x.ts', 'packages/platform-validation/src/x.ts', 'docs/other/x.md', '.github/workflows/x.yml']) {
      assert.throws(() => assertWritable(join(repoRoot, bad)), /write refused/, bad);
    }
  });

  it('[WA-T109] path traversal out of the allowed prefixes is refused', () => {
    assert.throws(() => assertWritable(join(repoRoot, 'docs', 'union-eyes', 'workaid', '..', '..', '..', 'package.json')), /write refused/);
    assert.throws(() => assertWritable(join(harnessRoot, '..', '..', 'reports', 'x.json')), /write refused/);
  });

  it('[WA-T109] every other registered worktree, including the main checkout, is refused', () => {
    const others = otherWorktreeRoots();
    assert.ok(others.length > 0, 'expected the main checkout and any agent worktrees to be registered');
    for (const o of others) {
      assert.throws(() => assertWritable(join(o, 'docs', 'union-eyes', 'workaid', 'x.md')), /another worktree/, o);
      assert.throws(() => assertWritable(join(o, 'reports', 'doc-consistency.json')), /another worktree/, o);
      assert.equal(isInside(repoRoot, o), false);
    }
  });

  it('[WA-T109] temp helpers only operate below the OS temp directory', () => {
    assert.throws(() => safeCopyTree(join(repoRoot, 'docs'), join(repoRoot, 'docs-copy')), /not under the OS temp directory/);
    assert.throws(() => safeRemoveTemp(repoRoot), /refused/);
    assert.throws(() => safeRemoveTemp(tmpdir()), /refused/);
    const t = safeTempDir('workaid-test-');
    assert.ok(isInside(t, tmpdir()));
    safeRemoveTemp(t);
  });

  it('[WA-T109] only scripts/guard.ts may import write-capable filesystem functions; nothing imports fs wholesale', () => {
    const READ_ONLY = new Set(['readFileSync', 'readdirSync', 'existsSync', 'statSync', 'lstatSync', 'realpathSync', 'readlinkSync']);
    for (const f of sourceFiles()) {
      if (f.endsWith(`${'scripts'}${f.includes('\\') ? '\\' : '/'}guard.ts`)) continue;
      const text = readFileSync(f, 'utf8');
      assert.doesNotMatch(text, /import\s+\*\s+as\s+\w+\s+from\s+['"](node:)?fs(\/promises)?['"]/, `${f}: namespace import of fs`);
      assert.doesNotMatch(text, /import\s+\w+\s+from\s+['"](node:)?fs(\/promises)?['"]/, `${f}: default import of fs`);
      assert.doesNotMatch(text, /require\(\s*['"](node:)?fs/, `${f}: require of fs`);
      assert.doesNotMatch(text, /from\s+['"]node:fs\/promises['"]/, `${f}: fs/promises`);
      for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](?:node:)?fs['"]/g)) {
        for (const name of m[1]!.split(',').map((s) => s.trim().split(/\s+as\s+/)[0]!).filter(Boolean)) assert.ok(READ_ONLY.has(name), `${f}: imports write-capable fs.${name}`);
      }
    }
  });

  it('[WA-T109] no source runs a mutating git command or names another checkout by path', () => {
    const READ_ONLY_GIT = new Set(['rev-parse', 'show', 'ls-tree', 'ls-files', 'diff', 'cat-file', 'status', 'log', 'worktree', 'grep']);
    let inspected = 0;
    for (const f of sourceFiles()) {
      if (f.endsWith(SELF)) continue;
      const text = readFileSync(f, 'utf8');
      const subcommands = [...text.matchAll(/\bgit\(\s*\[?\s*(?:['"]--[\w-]+['"]\s*,\s*)*['"]([a-z][\w-]*)['"]/g), ...text.matchAll(/['"]git['"]\s*,\s*\[\s*(?:['"]--[\w-]+['"]\s*,\s*)*['"]([a-z][\w-]*)['"]/g)].map((m) => m[1]!);
      for (const s of subcommands) {
        assert.ok(READ_ONLY_GIT.has(s), `${f}: git ${s} is not on the read-only list`);
        inspected++;
      }
      assert.doesNotMatch(text, /['"]worktree['"]\s*,\s*['"](?!list)/, `${f}: worktree subcommand other than list`);
      assert.doesNotMatch(text, /[A-Za-z]:[\\/]{1,2}(APPS|Users)/, `${f}: absolute path to another location`);
      assert.doesNotMatch(text, /\.codex|nzila-os-navigation|nzila-os\.archive/, `${f}: names another agent's checkout`);
    }
    assert.ok(inspected >= 10, `the git-subcommand scan inspected only ${inspected} calls; the pattern may have stopped matching`);
  });

  it('[WA-T109] every spawned process runs with this harness, the repository root or a temp sandbox as its working directory', () => {
    const ALLOWED_CWD = new Set(['root', 'repoRoot', 'harnessRoot', 'sandbox', 'cwd']);
    for (const f of sourceFiles()) {
      if (f.endsWith(SELF)) continue;
      for (const m of readFileSync(f, 'utf8').matchAll(/\bcwd:\s*([A-Za-z_][\w]*)/g)) assert.ok(ALLOWED_CWD.has(m[1]!), `${f}: cwd ${m[1]}`);
    }
  });

  it('[WA-T109] the type-check script can only run with --noEmit and verifies the worktree is unchanged afterwards', () => {
    const t = readFileSync(join(harnessRoot, 'scripts', 'typecheck.ts'), 'utf8');
    assert.match(t, /'--noEmit'/);
    assert.match(t, /'--incremental', 'false'/);
    assert.match(t, /worktreeUnchangedByCheck/);
  });

  it('[WA-T110] the repository validator derives its output directory from the working directory, which is why it is only ever run in a sandbox', () => {
    const src = pinned('packages/platform-validation/src/doc-consistency.ts');
    assert.match(src, /let dir = process\.cwd\(\)/);
    assert.match(src, /join\(root, 'reports'\)/);
    assert.match(src, /writeFileSync\(join\(reportsDir, 'doc-consistency\.json'\)/);
  });

  it('[WA-T110] sandboxed documentation validation reports no errors and leaves the worktree reports untouched', () => {
    const r = validateDocsSandboxed();
    assert.equal(r.exitCode, 0);
    assert.equal(r.errors, 0);
    assert.equal(r.worktreeReportsUntouched, true);
    assert.equal(r.sandboxWasUnderTemp, true);
    assert.match(r.validatorSource, /this worktree/);
    const status = execFileSync('git', ['--no-optional-locks', 'status', '--porcelain', '--', 'reports'], { cwd: repoRoot, encoding: 'utf8' }).trim();
    assert.equal(status, '');
  });
});
