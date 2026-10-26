import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * Isolation proof: every path this branch has added or changed, relative to the
 * verified origin/main base, is inside the two preparation directories. Shared
 * files (lockfile, workspace config, apps, packages, migrations, workflows) are untouched.
 */
const BASE = '38a824918cf2e7d7cfb7fcb0e796cbde45433be8';
const repoRoot = join(import.meta.dirname, '..', '..', '..');
const git = (...args: string[]) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const ALLOWED = ['docs/union-eyes/workaid/', 'tooling/workaid-prep/'];
const NEVER = [/^pnpm-lock\.yaml$/, /^package\.json$/, /^pnpm-workspace\.yaml$/, /^turbo\.json$/, /^vitest\.config\.ts$/, /^apps\//, /^packages\//, /^migrations\//, /^\.github\//, /^infrastructure\//, /^governance\//, /^tooling\/(?!workaid-prep\/)/];

// Branch-provenance proof: it describes the preparation branch and cannot hold once the harness is merged into an integration branch.
const onPrepBranch = /^agents\/workaid-prep/.test(git('rev-parse', '--abbrev-ref', 'HEAD')[0] ?? '');
const provenance = { skip: onPrepBranch ? false : 'applies only on an agents/workaid-prep* branch' };

describe('worktree isolation', () => {
  const changed = () => [...new Set([...git('diff', '--name-only', BASE), ...git('ls-files', '--others', '--exclude-standard')])];

  it('the base commit exists locally', () => {
    assert.equal(git('cat-file', '-t', BASE)[0], 'commit');
  });

  it('every changed or added path is inside docs/union-eyes/workaid/ or tooling/workaid-prep/', provenance, () => {
    const outside = changed().filter((p) => !ALLOWED.some((a) => p.startsWith(a)));
    assert.deepEqual(outside, []);
  });

  it('no shared, operational or release-critical path is touched', provenance, () => {
    assert.deepEqual(changed().filter((p) => NEVER.some((re) => re.test(p))), []);
  });

  it('the preparation harness adds no package manifest or lockfile entry', provenance, () => {
    assert.deepEqual(changed().filter((p) => /(^|\/)(package\.json|pnpm-lock\.yaml|tsconfig\.base\.json)$/.test(p)), []);
  });
});
