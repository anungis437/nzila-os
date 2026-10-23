# Commit binding

A file cannot contain the id of the commit that contains it, so this file is committed after the content commit and names it.

| Item | Value |
|---|---|
| Content commit | `4f7be0337b9a395499c868e43e10e30e830be7a4` |
| Parent / base (`origin/main`, verified) | `38a824918cf2e7d7cfb7fcb0e796cbde45433be8` |
| Branch | `agents/workaid-prep-20261023` (local only; never pushed) |
| Worktree | `C:/APPS/nzila-os.worktrees/pasted-text-processing` |
| Content commit changes | 81 files added, 0 modified, 0 deleted; all under `docs/union-eyes/workaid/` or `tooling/workaid-prep/` |
| Suite on the committed, clean tree | 177 passed, 0 failed, 0 skipped (`node scripts/run-tests.ts`, Node v24.13.1, working tree clean) |
| Typecheck | `tsc -p tooling/workaid-prep/tsconfig.json` with the main checkout's TypeScript: no errors |
| `validate:docs` | 0 errors (run with the main checkout's `tsx`; tracked report files restored, not committed) |
| Not run | `pnpm lint`, `pnpm typecheck`, `pnpm test:fast`, `pnpm governance:audit` (no installed workspace in this worktree; see DECISION_LOG E-18) |

`evidence/test-results.json` was recorded from the working tree immediately before the content commit (`workingTreeDirty: true`); the line above records the re-run on the committed tree. `evidence/harness-manifest.json` hashes every file in the content commit except itself and this file.

---

## Slice C (UE-WORKAID-PREP-20261023-C)

| Item | Value |
|---|---|
| Slice C content commit | `67ff8bb5d8c184962eb82d5a207d82c1b23e6690` |
| Parent (v0.2 branch tip) | `023712d6ab3b40b43ef7f487183315e846de21fc` |
| Platform base (unchanged) | `38a824918cf2e7d7cfb7fcb0e796cbde45433be8` |
| Branch / worktree | `agents/workaid-prep-20261023`, local only, never pushed / `C:/APPS/nzila-os.worktrees/pasted-text-processing` |
| Content commit changes | 56 files: 28 added, 28 modified, 0 deleted; all under `docs/union-eyes/workaid/` or `tooling/workaid-prep/` |
| Suite on the committed, clean tree | 264 passed, 0 failed, 0 skipped; 184 journey steps recorded; Node v24.13.1; `workingTreeDirty: false` (run to a temp output file) |
| Type-check | `node scripts/typecheck.ts` (TypeScript read-only from another checkout's `node_modules`; `--noEmit --incremental false`; worktree verified unchanged): exit 0 |
| Document validation | `node scripts/validate-docs-sandboxed.ts`: 0 errors (10 warnings and 26 info findings, listed by the script; the sandbox contains no `packages/` directory, so its package-existence check is not representative); the worktree's `reports/` untouched; run only in an OS-temp sandbox |
| Not run | `pnpm lint`, `pnpm typecheck`, `pnpm test:fast`, `pnpm governance:audit` (no installed workspace in this worktree; running them would require an install or another checkout's toolchain) |
| Challenge-set hashes | `evidence/R7_MANIFEST.json`: SHA-256 of every file in the two prefixes as stored in the content commit (this file and the manifest itself excluded) |

`evidence/test-results.json` and `evidence/journey-trace.json` in the content commit were recorded from the working tree immediately before that commit (`workingTreeDirty: true`); the clean-tree re-run above produced the same totals.

**Correction to the v0.2 binding above.** The v0.2 line "`validate:docs` … run with the main checkout's `tsx`; tracked report files restored" understated the issue. The run wrote its report files into *this* worktree (the validator derives its output directory from the working directory); they were restored and never committed, and the main checkout's `reports/` was unchanged. See `17_RECEIPT_VS_FILING_AUTHORITY.md` §7 and `DECISION_LOG.md` E-22.
