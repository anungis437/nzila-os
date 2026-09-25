# Schema P0 convergence disposition (Lane C)

Auth: Principal DG-W-02 B + COMMAND, schema PR disposition (not WorkAid).
Re-fetched `origin/main` on 2026-09-25. Tip is unchanged from the board baseline.

| Field | Value |
|---|---|
| MAIN_SHA | `bc62aff2c2edf7e19421ea9ccc297bc78e99755f` |
| Main tip | Merge pull request #817 (`fix/gitops-efficient-scoping`) |
| This branch | `fix/ue-runtime-schema-lineage-restoration` rebased onto MAIN_SHA |
| Pre-rebase #799 tip | `3e9a0cf8431bf9c57333f48743f7cd0f851bd291` |

## Sequence

1. **Land #799 first** after CI on this rebase is green. It is the schema lineage authority path.
2. **Close #797** as superseded. Evidence is below. Do not merge it.
3. **Hold #796.** Do not merge it onto this branch and do not land it in parallel. After #799 merges, rebase #796 and stack the non-overlapping schema-authority contract. It is not redundant, and it is not safe to land beside unresolved #799.
4. Branch deletes stay out of this pass.

## Ownership

### #799 — unique work that must land

46 commits replayed onto main (one commit dropped; see conflict notes). Versus current main this PR still adds:

- Forward-only `apps/union-eyes/db/migrations-platform/0001`–`0007` (new root; not on main).
- Append-only scoped journal entry `0014_lineage_restoration_rls_closure` plus the new SQL file.
- Runtime schema authority oracle, cleanroom wiring, and Phase G/H evidence under this directory.
- Application authority fixes (`/api/organizations/current`, system-context membership/entitlements/RBAC, grievance and document repository RLS, org-id join cast).
- Canonical-snapshot seed and E2E restore wiring.

### #797 — fully superseded

`workstream/ue-runtime-schema-lineage-restoration` @ `72c112519` is an earlier replay of the same lineage story (merge-base with main is `ff989637`, behind #800/#801). Commit subjects match #799's lineage commits but the OIDs differ because #799 was rebuilt onto `d7bfe6a`.

File evidence versus the pre-rebase #799 tip:

- 71 of 82 files #797 changes are byte-identical on #799.
- 9 shared files differ because #799 evolved them (platform `0005` extended with tenant/membership columns, platform journal, bootstrap, oracle test, inventory).
- The only paths on #797's diff that are absent from #799's diff are the two memory-holder route tests. Those already exist on main via #801, and #797's copies are older than main.

Nothing unique remains to land from #797.

### #796 — parallel, not redundant, do not land now

`fix/ue-runtime-schema-authority-reconciliation` @ `b30798326` is MERGEABLE against main and UNSTABLE on checks. Nine commits are not in #799. Unique surface:

- `apps/union-eyes/db/schema-authority/**` and `apps/union-eyes/scripts/schema-authority/**`
- Django model updates and three new migrations: `auth_core/0005`, `content/0004`, `grievances/0005` (`claims.idempotency_hash`)
- `withApi` / CRUD / organization-middleware RLS context fixes
- gitleaks allowlist notes for the schema-contract harness

Overlap with #799 is four paths, and the blobs differ on all four: `claims/[id]/route.ts` (equality join versus `::text` cast), `apps/union-eyes/package.json`, scoped-migration executor, drizzle bootstrap.

## Migration safety

Frozen historical production SQL was not rewritten.

- `git diff origin/main...HEAD -- apps/union-eyes/db/migrations/*.sql` is empty.
- Existing Django migrations `auth_core/0001`–`0004`, `content/0001`–`0003`, and `grievances/0001`–`0004` are untouched.
- `migrations-cache/meta/_journal.json` only appends idx 14. Entries 0000–0013 are unchanged.
- Platform `0001`–`0007` are new files. Column changes use `ADD COLUMN IF NOT EXISTS`. They have never been on `main`, so editing them before first land is still forward-only relative to production history on main.
- `migrations/INDEX.md` path text that had been stored with literal BEL (`\a`) and tab (`\t`) escapes is corrected to real paths. No SQL body changed.
- This rebase does not deploy and does not mark a capability proven in staging. Prior Phase G evidence in this tree stays historical evidence, not a new production claim.

### Why #796 must wait

Platform SQL `0005` / `0006` and Django `auth_core/0005` / `content/0004` add overlapping `organization_members` and `documents` columns. Platform SQL is idempotent. Django `AddField` is not. Applying #796's migrations after #799's platform SQL on the same database can fail `migrate` on columns that already exist. Applying both app join fixes without a rebase will also fight the claims org-id predicate.

After #799 is on main, rebase #796 and keep the schema-authority contract plus any column Django still owns that platform SQL does not add (notably a Django-side `claims.idempotency_hash` if the model is still behind the frozen SQL lineage). Convert overlapping `AddField` operations so they do not emit a second ADD against columns platform SQL already created.

## Rebase conflict resolutions

| Path | Resolution | Reason |
|---|---|---|
| `9e29aaa` CI align commit | skipped | Memory-holder tests, red-team allowlist, and ops snapshot already on main via #801, #806, and #805. Replaying it would regress the #805 snapshot and duplicate the claimed-access pattern. |
| `pnpm-lock.yaml`, `package.json`, `tooling/security/supply-chain-policy.ts` | kept main | #804 already pins `adm-zip>=0.6.1` and drops the same expired waivers. Main also keeps the civic OCI doctrine script from #810. |
| `reports/ops/snapshot.*` | kept main | #805 snapshot (2026-09-24) is newer than the #799 copy, which nulls build metrics. |
| `security/redteam/ue-org-scope-fuzz.test.ts` | kept main | #806 already recognizes `withClaimedWorkbookAccess` and `verifyClaimedWorkbookAccess`. |
| `tooling/repo-inventory/output/*` | kept main during rebase, then regenerated | Generated inventory. Rebase kept main's copy. A follow-up regenerate updates `tsTestFileCount` 2671 → 2673 and union-eyes `codeFileCount` 5243 → 5247 so the CI inventory lock (which ignores only the date stamp) stays green. |
| `.github/workflows/ci.yml` | both | Main's affected Turbo build (#817) plus this PR's perf `BASE_URL` for union-eyes staging. |

Pre-rebase migration blobs for every new or modified SQL, journal, and platform README match `3e9a0cf84`.
