#!/usr/bin/env node
/**
 * Junction-aware removal of a linked git worktree.
 *
 * WHY: on Windows, `git worktree remove --force` (Git for Windows 2.53.0) FOLLOWS directory junctions and deletes what
 * they point at. A worktree whose `node_modules` is a junction to a shared dependency tree - and whose shared tree holds
 * workspace links back into live source - lost the shared dependencies, 1,617 tracked source files and any ignored or
 * untracked files beside them (2026-10-19). `Remove-Item -Recurse` and `cmd /c rmdir /s` do not follow them; git does.
 * Without `--force` git refuses (the link counts as an untracked file), which is why `--force` is the trigger.
 *
 * WHAT THIS DOES (it never deletes through a link):
 *   1. Refuses anything that is not a LINKED worktree of the repository (never the main checkout), that is itself a
 *      link, or that is outside the allowed roots (default: the OS temp directory and `<main-checkout>.worktrees`).
 *   2. Scans the worktree with lstat/Dirent (links are reported, never entered) and lists every link and its target.
 *   3. Dry-run by default. With --apply it removes ONLY each link itself (unlink / non-recursive rmdir), checks after
 *      every removal that the target still exists and still has its entries, then re-scans and refuses to continue if
 *      any link remains.
 *   4. Only then runs `git worktree remove` (never --force unless --force-dirty is passed) and confirms the worktree is
 *      no longer registered.
 *
 * Usage: node tooling/scripts/safe-remove-worktree.mjs <worktree-path> [--apply] [--allow-root <dir>]... [--force-dirty]
 * Exit:  0 ok / dry-run, 2 refused or verification failed, 1 unexpected error.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const isWin = process.platform === 'win32';
// Canonical form for comparisons: expands 8.3 short names and normalizes separators (git prints long names with '/').
// Only ever called on paths that are not links themselves, or on link TARGETS for comparison; it never deletes anything.
const canon = (p) => {
  const abs = path.resolve(p);
  try {
    return fs.realpathSync.native(abs);
  } catch {
    return abs;
  }
};
const norm = (p) => (isWin ? canon(p).toLowerCase() : canon(p));

export class RefusalError extends Error {}

const git = (cwd, args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export const isInside = (child, parent) => {
  const c = norm(child);
  const p = norm(parent);
  return c === p || c.startsWith(p.endsWith(path.sep) ? p : p + path.sep);
};

/** Returns every symlink/junction below `root` without ever entering one. */
export function scanLinks(root) {
  const links = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isSymbolicLink()) {
        let target = null;
        try {
          target = fs.readlinkSync(full);
          if (!path.isAbsolute(target)) target = path.resolve(dir, target);
        } catch {
          /* unreadable link: still reported */
        }
        links.push({ link: full, target });
      } else if (e.isDirectory()) {
        stack.push(full);
      }
    }
  }
  return links;
}

const entryCount = (dir) => {
  try {
    return fs.readdirSync(dir).length;
  } catch {
    return null;
  }
};

/** Removes the link object only. Never recursive, never touches the target. */
export function removeLinkOnly(link) {
  if (!fs.lstatSync(link).isSymbolicLink()) throw new RefusalError(`not a link: ${link}`);
  try {
    fs.unlinkSync(link);
  } catch (err) {
    if (!['EPERM', 'EISDIR', 'ENOTDIR', 'EACCES'].includes(err.code)) throw err;
    fs.rmdirSync(link); // directory junction / dir symlink; non-recursive removes just the link
  }
  let stillThere = true;
  try {
    fs.lstatSync(link);
  } catch (err) {
    stillThere = err.code !== 'ENOENT';
  }
  if (stillThere) throw new RefusalError(`link still present after removal: ${link}`);
}

export function defaultAllowedRoots(worktree) {
  const common = git(worktree, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const mainCheckout = path.dirname(common);
  return [os.tmpdir(), `${mainCheckout}.worktrees`, path.join(mainCheckout, '..', `${path.basename(mainCheckout)}.worktrees`)].map((p) => path.resolve(p));
}

export function plan(worktreeArg, { allowRoots = [] } = {}) {
  const worktree = path.resolve(worktreeArg);
  let st;
  try {
    st = fs.lstatSync(worktree);
  } catch {
    throw new RefusalError(`path does not exist: ${worktree}`);
  }
  if (st.isSymbolicLink()) throw new RefusalError(`the worktree path is itself a link; refusing: ${worktree}`);
  if (!st.isDirectory()) throw new RefusalError(`not a directory: ${worktree}`);

  let gitDir;
  let commonDir;
  try {
    gitDir = git(worktree, ['rev-parse', '--path-format=absolute', '--git-dir']);
    commonDir = git(worktree, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  } catch {
    throw new RefusalError(`not a git worktree: ${worktree}`);
  }
  if (norm(gitDir) === norm(commonDir)) throw new RefusalError(`refusing the main checkout (not a linked worktree): ${worktree}`);
  const top = git(worktree, ['rev-parse', '--show-toplevel']);
  if (norm(top) !== norm(worktree)) throw new RefusalError(`path is not the worktree root (root is ${top})`);

  const roots = [...defaultAllowedRoots(worktree), ...allowRoots.map((r) => path.resolve(r))];
  if (!roots.some((r) => isInside(worktree, r) && norm(worktree) !== norm(r))) {
    throw new RefusalError(`outside the allowed roots (${roots.join(', ')}); pass --allow-root to widen deliberately: ${worktree}`);
  }

  const links = scanLinks(worktree).map((l) => ({
    ...l,
    targetExists: l.target ? fs.existsSync(l.target) : false,
    targetEntries: l.target ? entryCount(l.target) : null,
    targetInsideWorktree: l.target ? isInside(l.target, worktree) : false,
  }));
  const inside = links.filter((l) => l.targetInsideWorktree);
  if (inside.length > 0) {
    throw new RefusalError(`a link targets a location inside the worktree itself; inspect manually: ${inside.map((l) => l.link).join(', ')}`);
  }
  return { worktree, commonDir, links };
}

export function execute(worktreeArg, { apply = false, forceDirty = false, allowRoots = [], log = () => {} } = {}) {
  const p = plan(worktreeArg, { allowRoots });
  log(`worktree: ${p.worktree}`);
  log(`links found: ${p.links.length}`);
  for (const l of p.links) log(`  ${l.link} -> ${l.target} (target exists: ${l.targetExists}, entries: ${l.targetEntries})`);
  if (!apply) {
    log('dry run: nothing changed. Re-run with --apply to remove the links and then the worktree.');
    return { ...p, applied: false };
  }

  for (const l of p.links) {
    removeLinkOnly(l.link);
    if (l.targetExists) {
      if (!fs.existsSync(l.target)) throw new RefusalError(`TARGET DISAPPEARED after unlinking ${l.link}: ${l.target}`);
      const after = entryCount(l.target);
      if (l.targetEntries !== null && after !== l.targetEntries) throw new RefusalError(`target entry count changed (${l.targetEntries} -> ${after}) after unlinking ${l.link}`);
    }
    log(`  unlinked ${l.link}; target intact`);
  }
  const left = scanLinks(p.worktree);
  if (left.length > 0) throw new RefusalError(`links remain after unlinking (${left.map((x) => x.link).join(', ')}); not calling git`);

  git(p.commonDir.replace(/[\\/]\.git$/, ''), ['worktree', 'remove', ...(forceDirty ? ['--force'] : []), p.worktree]);
  const registered = git(p.commonDir.replace(/[\\/]\.git$/, ''), ['worktree', 'list', '--porcelain']);
  if (registered.split(/\r?\n/).some((line) => line.startsWith('worktree ') && norm(line.slice(9)) === norm(p.worktree))) {
    throw new RefusalError('worktree still registered after removal');
  }
  for (const l of p.links) {
    if (l.targetExists && !fs.existsSync(l.target)) throw new RefusalError(`TARGET DISAPPEARED after worktree removal: ${l.target}`);
  }
  log('worktree removed; every link target verified intact');
  return { ...p, applied: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const target = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--allow-root');
  const allowRoots = args.flatMap((a, i) => (a === '--allow-root' ? [args[i + 1]] : []));
  if (!target) {
    console.error('usage: safe-remove-worktree.mjs <worktree-path> [--apply] [--allow-root <dir>]... [--force-dirty]');
    process.exit(2);
  }
  try {
    execute(target, { apply: args.includes('--apply'), forceDirty: args.includes('--force-dirty'), allowRoots, log: (m) => console.log(m) });
  } catch (err) {
    if (err instanceof RefusalError) {
      console.error(`REFUSED: ${err.message}`);
      process.exit(2);
    }
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  }
}
