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
