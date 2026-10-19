/**
 * Contract: linked worktrees are removed without ever deleting through a link.
 *
 * Incident 2026-10-19: `git worktree remove --force` on Windows followed a `node_modules` junction and deleted a shared
 * dependency tree and, through workspace links inside it, tracked source plus ignored files. These tests build
 * disposable fixtures under the OS temp directory only (never a real checkout) and prove that tooling/scripts/
 * safe-remove-worktree.mjs removes links, never targets.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'safe-remove-worktree.mjs');

type Tool = {
  RefusalError: new (m: string) => Error;
  scanLinks: (root: string) => Array<{ link: string; target: string | null }>;
  removeLinkOnly: (link: string) => void;
  plan: (p: string, o?: { allowRoots?: string[] }) => { links: unknown[] };
  execute: (p: string, o?: { apply?: boolean; forceDirty?: boolean; allowRoots?: string[]; log?: (m: string) => void }) => { applied: boolean };
};

let tool: Tool;
let lab: string;

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-C', cwd, '-c', 'user.email=t@example.invalid', '-c', 'user.name=t', '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

// Directory link that behaves like the Windows junction in the incident (a plain symlink on POSIX).
const link = (target: string, at: string) => fs.symlinkSync(target, at, 'junction');

type Fixture = { fx: string; repo: string; wt: string; shared: string; src: string };

function fixture(name: string): Fixture {
  const fx = path.join(lab, name);
  const repo = path.join(fx, 'repo');
  const shared = path.join(fx, 'shared', 'node_modules');
  const src = path.join(repo, 'pkgs', 'a');
  fs.mkdirSync(src, { recursive: true });
  fs.mkdirSync(path.join(shared, '@pkg'), { recursive: true });
  fs.writeFileSync(path.join(src, 'index.ts'), 'tracked');
  fs.writeFileSync(path.join(src, '.env.local'), 'ignored placeholder');
  fs.writeFileSync(path.join(repo, '.gitignore'), '.env.local\nnode_modules\n');
  git(repo, 'init', '-q');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'init');
  fs.writeFileSync(path.join(shared, 'real.txt'), 'shared dependency');
  link(src, path.join(shared, '@pkg', 'a')); // workspace-style link back into live source
  const wt = path.join(fx, 'wt');
  git(repo, 'worktree', 'add', '-q', wt, '-b', `wt-${name}`);
  link(shared, path.join(wt, 'node_modules')); // worktree dependencies -> shared tree
  return { fx, repo, wt, shared, src };
}

const survivors = (f: Fixture) => ({
  sharedFile: fs.existsSync(path.join(f.shared, 'real.txt')),
  trackedSource: fs.existsSync(path.join(f.src, 'index.ts')),
  ignoredFile: fs.existsSync(path.join(f.src, '.env.local')),
  nestedLink: fs.lstatSync(path.join(f.shared, '@pkg', 'a')).isSymbolicLink(),
});

beforeAll(async () => {
  lab = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-worktree-lab-'));
  tool = (await import(pathToFileURL(SCRIPT).href)) as Tool;
});

afterAll(() => {
  // Remove links first (never recurse through them), then the disposable lab itself.
  for (const l of tool.scanLinks(lab)) tool.removeLinkOnly(l.link);
  fs.rmSync(lab, { recursive: true, force: true });
});

describe('scanLinks never enters a link', () => {
  it('reports the link and its target and does not report what lies behind it', () => {
    const f = fixture('scan');
    const found = tool.scanLinks(f.wt);
    expect(found).toHaveLength(1);
    expect(path.basename(found[0].link)).toBe('node_modules');
    expect(path.resolve(found[0].target ?? '')).toBe(path.resolve(f.shared));
    // the nested workspace link lives behind the first link and must NOT be traversed
    expect(found.some((x) => x.link.includes(`${path.sep}@pkg${path.sep}`))).toBe(false);
  });
});

describe('refusals', () => {
  it('refuses the main checkout', () => {
    const f = fixture('main');
    expect(() => tool.plan(f.repo, { allowRoots: [lab] })).toThrow(/main checkout/);
  });

  it('refuses a path that is not a worktree', () => {
    const f = fixture('nogit');
    expect(() => tool.plan(f.shared, { allowRoots: [lab] })).toThrow(/not a git worktree|not the worktree root|main checkout/);
  });

  it('refuses a worktree outside the allowed roots, and allows it only when the root is passed deliberately', () => {
    // The defaults are the OS temp dir and <main>.worktrees. Build a worktree outside both (under the home directory).
    const outsideRoot = fs.mkdtempSync(path.join(os.homedir(), '.safe-worktree-outside-'));
    try {
      const repo = path.join(outsideRoot, 'repo');
      fs.mkdirSync(repo);
      git(repo, 'init', '-q');
      fs.writeFileSync(path.join(repo, 'a.txt'), 'a');
      git(repo, 'add', '-A');
      git(repo, 'commit', '-q', '-m', 'init');
      const wt = path.join(outsideRoot, 'wt');
      git(repo, 'worktree', 'add', '-q', wt, '-b', 'outside');
      expect(() => tool.plan(wt)).toThrow(/outside the allowed roots/);
      expect(() => tool.execute(wt, { apply: true })).toThrow(/outside the allowed roots/);
      expect(fs.existsSync(wt)).toBe(true);
      expect(() => tool.plan(wt, { allowRoots: [outsideRoot] })).not.toThrow();
      expect(() => tool.plan(wt, { allowRoots: [wt] })).toThrow(/outside the allowed roots/); // a root equal to the worktree itself is not enough
    } finally {
      for (const l of tool.scanLinks(outsideRoot)) tool.removeLinkOnly(l.link);
      fs.rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  it('isInside is a path-boundary check, not a string prefix check', () => {
    const { isInside } = tool as unknown as { isInside: (a: string, b: string) => boolean };
    const base = path.join(lab, 'base');
    expect(isInside(path.join(base, 'x'), base)).toBe(true);
    expect(isInside(base, base)).toBe(true);
    expect(isInside(`${base}-sibling`, base)).toBe(false);
    expect(isInside(path.join(base, '..', 'base-other'), base)).toBe(false);
  });
  it('refuses when the worktree path is itself a link', () => {
    const f = fixture('selflink');
    const alias = path.join(f.fx, 'alias');
    link(f.wt, alias);
    expect(() => tool.plan(alias, { allowRoots: [lab] })).toThrow(/itself a link/);
    tool.removeLinkOnly(alias);
  });

  it('refuses a link that points back inside the worktree', () => {
    const f = fixture('loop');
    fs.mkdirSync(path.join(f.wt, 'inner'));
    link(path.join(f.wt, 'inner'), path.join(f.wt, 'loop'));
    expect(() => tool.plan(f.wt, { allowRoots: [lab] })).toThrow(/inside the worktree itself/);
    tool.removeLinkOnly(path.join(f.wt, 'loop'));
  });

  it('removeLinkOnly refuses a real directory and never recurses', () => {
    const f = fixture('realdir');
    const dir = path.join(f.fx, 'plain');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'keep.txt'), 'x');
    expect(() => tool.removeLinkOnly(dir)).toThrow(/not a link/);
    expect(fs.existsSync(path.join(dir, 'keep.txt'))).toBe(true);
  });
});

describe('dry run is the default and changes nothing', () => {
  it('lists the link and leaves the worktree registered and linked', () => {
    const f = fixture('dry');
    const lines: string[] = [];
    const res = tool.execute(f.wt, { allowRoots: [lab], log: (m) => lines.push(m) });
    expect(res.applied).toBe(false);
    expect(lines.join('\n')).toMatch(/dry run/);
    expect(fs.lstatSync(path.join(f.wt, 'node_modules')).isSymbolicLink()).toBe(true);
    expect(git(f.repo, 'worktree', 'list')).toContain('wt');
    expect(survivors(f)).toEqual({ sharedFile: true, trackedSource: true, ignoredFile: true, nestedLink: true });
  });
});

describe('--apply removes only links, then the worktree', () => {
  it('keeps the shared dependency tree, the workspace link, tracked source and ignored files', () => {
    const f = fixture('apply');
    const res = tool.execute(f.wt, { apply: true, allowRoots: [lab] });
    expect(res.applied).toBe(true);
    expect(fs.existsSync(f.wt)).toBe(false);
    expect(git(f.repo, 'worktree', 'list')).not.toContain(`${path.sep}wt`);
    expect(survivors(f)).toEqual({ sharedFile: true, trackedSource: true, ignoredFile: true, nestedLink: true });
  });

  it('handles several links in one worktree', () => {
    const f = fixture('multi');
    const extra = path.join(f.fx, 'extra-target');
    fs.mkdirSync(extra);
    fs.writeFileSync(path.join(extra, 'e.txt'), 'x');
    fs.mkdirSync(path.join(f.wt, 'apps', 'web'), { recursive: true });
    link(extra, path.join(f.wt, 'apps', 'web', 'node_modules'));
    expect(tool.scanLinks(f.wt)).toHaveLength(2);
    tool.execute(f.wt, { apply: true, allowRoots: [lab], forceDirty: true });
    expect(fs.existsSync(path.join(extra, 'e.txt'))).toBe(true);
    expect(survivors(f).sharedFile).toBe(true);
  });

  it('aborts before calling git when a link cannot be removed (never falls back to recursive deletion)', () => {
    const f = fixture('abort');
    const original = fs.unlinkSync;
    // Force the failure through the real module the tool imported.
    const fsMod = fs as unknown as { unlinkSync: typeof fs.unlinkSync; rmdirSync: typeof fs.rmdirSync };
    const originalRmdir = fs.rmdirSync;
    fsMod.unlinkSync = () => {
      throw Object.assign(new Error('simulated'), { code: 'EBUSY' });
    };
    fsMod.rmdirSync = () => {
      throw Object.assign(new Error('simulated'), { code: 'EBUSY' });
    };
    try {
      expect(() => tool.execute(f.wt, { apply: true, allowRoots: [lab] })).toThrow();
    } finally {
      fsMod.unlinkSync = original;
      fsMod.rmdirSync = originalRmdir;
    }
    expect(fs.existsSync(f.wt)).toBe(true); // git was never asked to remove it
    expect(survivors(f)).toEqual({ sharedFile: true, trackedSource: true, ignoredFile: true, nestedLink: true });
  });
});

describe('CLI', () => {
  const run = (...args: string[]) => {
    try {
      const out = execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return { code: 0, out };
    } catch (e) {
      const err = e as { status: number; stdout: string; stderr: string };
      return { code: err.status, out: `${err.stdout}${err.stderr}` };
    }
  };

  it('exits 2 with REFUSED for the main checkout and 0 for a dry run', () => {
    const f = fixture('cli');
    const refused = run(f.repo, '--allow-root', lab);
    expect(refused.code).toBe(2);
    expect(refused.out).toMatch(/REFUSED/);
    const dry = run(f.wt, '--allow-root', lab);
    expect(dry.code).toBe(0);
    expect(dry.out).toMatch(/links found: 1/);
    expect(fs.existsSync(f.wt)).toBe(true);
    const done = run(f.wt, '--allow-root', lab, '--apply');
    expect(done.code).toBe(0);
    expect(fs.existsSync(f.wt)).toBe(false);
    expect(survivors(f).sharedFile).toBe(true);
  });
});
