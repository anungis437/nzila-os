/**
 * Write isolation for the WorkAid preparation tooling (WA-C-002).
 *
 * Rule: nothing in this package may write anywhere except
 *   - docs/union-eyes/workaid/  and  tooling/workaid-prep/  of THIS worktree, or
 *   - the operating-system temp directory,
 * and never inside any other registered worktree (including the main checkout
 * and any agent's worktree). Every write in scripts/ goes through the helpers
 * below; test/write-isolation.test.ts statically forbids direct filesystem
 * writes and mutating git commands anywhere else.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export const harnessRoot = resolve(import.meta.dirname, '..');
export const repoRoot = resolve(harnessRoot, '..', '..');
export const ALLOWED_WRITE_PREFIXES = ['docs/union-eyes/workaid', 'tooling/workaid-prep'] as const;

/** Normalized form for comparisons: forward slashes, lower case (Windows is case-insensitive). */
export const norm = (p: string) => resolve(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
export const isInside = (child: string, parent: string) => norm(child) === norm(parent) || norm(child).startsWith(norm(parent) + '/');

const git = (args: string[], cwd = repoRoot) => execFileSync('git', ['--no-optional-locks', ...args], { cwd, encoding: 'utf8' }).trim();

let cachedOthers: string[] | null = null;
/** Roots of every OTHER registered worktree (read-only query, cached for the process lifetime). */
export function otherWorktreeRoots(): string[] {
  if (cachedOthers) return cachedOthers;
  const out = git(['worktree', 'list', '--porcelain']);
  cachedOthers = out
    .split(/\r?\n/)
    .filter((l) => l.startsWith('worktree '))
    .map((l) => l.slice('worktree '.length).trim())
    .filter((p) => norm(p) !== norm(repoRoot));
  return cachedOthers;
}

export interface PreflightResult {
  readonly toplevel: string;
  readonly branch: string;
  readonly linkedWorktree: boolean;
  readonly otherWorktrees: readonly string[];
}

/** Throws if this is not the isolated WorkAid worktree. Read-only. */
export function preflight(): PreflightResult {
  const toplevel = git(['rev-parse', '--show-toplevel']);
  if (norm(toplevel) !== norm(repoRoot)) throw new Error(`preflight: git top level ${toplevel} is not the tooling's own root ${repoRoot}`);
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (!/^agents\/workaid-prep/.test(branch)) throw new Error(`preflight: branch ${branch} is not an agents/workaid-prep* branch`);
  const gitDir = resolve(repoRoot, git(['rev-parse', '--git-dir']));
  const common = resolve(repoRoot, git(['rev-parse', '--git-common-dir']));
  const linkedWorktree = norm(gitDir) !== norm(common);
  if (!linkedWorktree) throw new Error('preflight: this is the main checkout, not a linked worktree');
  return { toplevel, branch, linkedWorktree, otherWorktrees: otherWorktreeRoots() };
}

/** Resolves a target and throws unless a write there is permitted. Returns the absolute path. */
export function assertWritable(target: string): string {
  const abs = resolve(target);
  for (const other of otherWorktreeRoots()) {
    if (isInside(abs, other)) throw new Error(`write refused: ${abs} is inside another worktree (${other})`);
  }
  if (isInside(abs, tmpdir())) return abs;
  if (!isInside(abs, repoRoot)) throw new Error(`write refused: ${abs} is outside this worktree`);
  if (!ALLOWED_WRITE_PREFIXES.some((p) => isInside(abs, join(repoRoot, p)))) {
    throw new Error(`write refused: ${abs} is outside ${ALLOWED_WRITE_PREFIXES.join(' and ')}`);
  }
  return abs;
}

export function safeMkdir(dir: string): void {
  mkdirSync(assertWritable(dir), { recursive: true });
}

export function safeWrite(file: string, data: string | Uint8Array): void {
  const abs = assertWritable(file);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, data);
}

export function safeAppend(file: string, data: string): void {
  const abs = assertWritable(file);
  mkdirSync(dirname(abs), { recursive: true });
  appendFileSync(abs, data);
}

/** A fresh private directory under the OS temp directory. */
export function safeTempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** Copy a directory tree INTO the OS temp directory (never anywhere else). */
export function safeCopyTree(src: string, dest: string): void {
  if (!isInside(dest, tmpdir())) throw new Error(`copy refused: destination ${dest} is not under the OS temp directory`);
  assertWritable(dest);
  cpSync(src, dest, { recursive: true });
}

/** Remove a temp directory created by safeTempDir; refuses anything outside the OS temp directory. */
export function safeRemoveTemp(dir: string): void {
  if (!isInside(dir, tmpdir()) || norm(dir) === norm(tmpdir())) throw new Error(`remove refused: ${dir} is not a directory below the OS temp directory`);
  rmSync(dir, { recursive: true, force: true });
}
