# Worktree and Junction Safety

Linked git worktrees often carry a `node_modules` junction (Windows) or symlink to a shared dependency tree. On Windows,
**`git worktree remove --force` follows those junctions and deletes what they point at.** Do not use it on a worktree that
contains a link.

## What happened (2026-10-19)

A temporary worktree had `node_modules` junctions to the main checkout's dependency tree. The tree held workspace links
back into `packages/*`. `git worktree remove --force` (Git for Windows 2.53.0) walked through them and deleted the shared
dependencies, 1,617 tracked source files in 76 `packages/*` directories and any ignored or untracked files beside them.
Tracked files were restored from git; ignored and untracked material in those directories could not be accounted for.

Reproduced on disposable fixtures only:

| Operation on a worktree containing a `node_modules` junction | Follows the junction? |
|---|---|
| `git worktree remove --force` | **Yes** - deletes shared dependencies, tracked source and ignored files |
| `git worktree remove` (no `--force`) | Refuses (the link counts as untracked) |
| PowerShell 7 `Remove-Item -Recurse -Force` | No |
| `cmd /c rmdir /s /q` | No |

## Procedure

Remove a linked worktree only with the guarded tool. It is a dry run unless `--apply` is given:

```
node tooling/scripts/safe-remove-worktree.mjs <worktree-path>           # lists links and targets, changes nothing
node tooling/scripts/safe-remove-worktree.mjs <worktree-path> --apply   # unlinks links, verifies targets, then git worktree remove
```

It refuses the main checkout, a path that is itself a link, a link that points back inside the worktree, and any worktree
outside the allowed roots (the OS temp directory and `<main-checkout>.worktrees`; widen deliberately with `--allow-root`).
With `--apply` it removes **only the link objects** (unlink or non-recursive `rmdir`), checks after each that the target
still exists with the same number of entries, re-scans and aborts if any link remains, and only then calls
`git worktree remove` (without `--force` unless `--force-dirty` is passed). It never deletes through a link and never
touches a link target.

## Rules

- Never run `git worktree remove --force`, `git clean -fdx`, or a recursive delete on a directory that may contain a link
  before the links are removed.
- To unlink a junction by hand use `cmd /c rmdir <junction>` (no `/s`) or `fs.rmdirSync(<junction>)`, then check that the
  target is intact.
- Cleanup scripts must stay inside their designated temporary root and must not resolve a link target for deletion.
- Try any new cleanup on disposable fixtures under the OS temp directory first. The contract test
  `tooling/contract-tests/safe-remove-worktree.test.ts` is the reference fixture builder.
