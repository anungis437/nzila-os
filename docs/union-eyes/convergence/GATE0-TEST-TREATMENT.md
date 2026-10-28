# Gate 0 historical evidence tests: treatment

Mission `UE-FULL-PLATFORM-CONVERGENCE-TO-STAGING-2026`. Status: documented; CI wiring below.

## The two kinds of test

| Kind | Files | Runs against | Purpose |
|---|---|---|---|
| **Historical immutable evidence** | `tooling/scripts/lib/ue-gate0*.test.mjs` | The commit they were accepted at (`ANCHOR_COMMIT` in `ue-gate0b8-ids.mjs`, `32ae5951e…`), in a detached worktree | Prove the frozen Gate 0 scope lock, persona recovery, baselines and route classifications are internally consistent and unchanged. |
| **Current-source regression** | `apps/union-eyes/**/__tests__`, `tooling/contract-tests`, `tooling/scripts/check-ue-convergence.mjs`, the native `*.postgres.test.ts` suites | The present branch | Prove the repaired behaviour: positive and adversarial cases, ratchets and native PostgreSQL isolation. |

The historical tests quote source text and registers as they stood at acceptance (for example `crud-governance.ts` and the
docs routes). Repairs made since change that text on purpose, so run against the present tree they fail by design. They are
not edited, relaxed or deleted, and their pinned snapshots and hashes are untouched.

## Invocation

```
node tooling/scripts/run-ue-gate0-historical.mjs                      # every ue-gate0*.test.mjs at ANCHOR_COMMIT
node tooling/scripts/run-ue-gate0-historical.mjs --filter gate0b8     # a subset
node tooling/scripts/run-ue-gate0-historical.mjs --commit <sha>       # another pinned commit
```

The script adds a temporary detached worktree at the commit, runs `node --test` there and removes it. It exits non-zero if any
historical test fails at its own commit. The checkout of a repository this size is slow (minutes), so it is a scheduled or
release-candidate job, not a per-push gate.

## CI treatment

- **Per push (unchanged):** `union-eyes-deployment-safety.test.mjs`, the current-source suites, contract tests, `check-ue-convergence`.
- **Not run against the present tree:** `ue-gate0*-classification.test.mjs`. Running them there reports the intended
  source drift as failures and must not be read as a regression.
- **Release candidate:** run `run-ue-gate0-historical.mjs` and attach its output to the candidate evidence.

## What is and is not claimed

- Claimed: the separation, the invocation and the rule that historical evidence is never edited to pass.
- Not claimed: a recorded green run of the historical suite in this branch. The worktree checkout plus the git-history lookups
  inside the tests exceeded this session's time budget on the development machine; the first recorded run is a release-candidate
  obligation.
