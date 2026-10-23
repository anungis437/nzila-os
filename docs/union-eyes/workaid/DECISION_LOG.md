# Decision log

Engineering decisions taken by the preparation agent under its delegated scope, with the reason and how to reverse them. Institutional decisions (Domenic, Angelo, counsel) are **not** here; they are in [11](11_WORKAID_VALIDATION_DECISIONS.md). Dates are 2026-10-23.

| # | Decision | Reason | Reversal |
|---|---|---|---|
| E-01 | Work in the existing isolated worktree `C:/APPS/nzila-os.worktrees/pasted-text-processing`, create branch `agents/workaid-prep-20261023` there, based on the verified `origin/main` `38a824918` | The worktree is physically distinct from every Codex-pattern worktree, clean at start, and already at the verified base | Delete the local branch; worktree contents are only under two prefixes |
| E-02 | Keep all work under `docs/union-eyes/workaid/` and `tooling/workaid-prep/`; no `package.json`, no lockfile or workspace change | Mission file ownership; the harness must not need a build change | `git rm -r` the two prefixes |
| E-03 | Use Node's built-in test runner and native type stripping instead of Vitest | `pnpm-workspace.yaml` globs `tooling/*` and the worktree has no installed dependencies; Vitest would require registering a project in the shared `vitest.config.ts` | Port imports to Vitest (mechanical; see 13 §5) |
| E-04 | Make the pure contracts take injected clocks, principals and policy objects; no I/O | Deterministic tests; no dependency on any runtime | n/a |
| E-05 | Leave every open WorkAid decision as a **required policy input or unconfigured**, never a default | Mission §10: do not fabricate institutional decisions. Test fixtures use a clearly named synthetic policy | Supply the answered policy |
| E-06 | Task-of-record is a three-valued switch defaulting to `UNRESOLVED`, under which tasks are non-authoritative and schedule no reminders | Task-of-record "left unresolved until Domenic validates it" | Set `UNION_EYES` or `CLIO` |
| E-07 | Recipient snapshot **and** epoch supersession **and** delivery-time re-validation | Reconciles Grok's snapshot rule with WA-T048 (never notify a former assignee) | Drop to snapshot-only (not recommended) |
| E-08 | Do not compute any statutory deadline; registry empty; no "met" status | WA-R1-01, WA-R2-03; mission: never automate legal decisions or deadline determinations | n/a |
| E-09 | Model `DELIVERY_ACK` as a system-only transition that never confirms receipt; human receipt needs method + evidence | WA-R1-04 | n/a |
| E-10 | ITO grouping has no default strategy | WA-R2-02, D-05 | Supply the decision |
| E-11 | Platform defects are reproduced in `src/platform-repro/` and routed to Codex; the platform is **not** patched | Mission: route to Codex | n/a |
| E-12 | Tests read the **pinned** blobs (`git show 38a824918:…`) rather than the working tree for platform source | Deterministic; unaffected by Codex's branch; avoids a fragile tripwire that would fail when Codex fixes something. A separate informational script reports drift | n/a |
| E-13 | Evidence is credited to a matrix case, adversarial case or finding **only by an explicit `[WA-…]` tag in a passing test's title**; the builder fails if an overlay cites a tag with no passing test | No `PASS` for unexecuted tests; no finding cites evidence that does not exist | n/a |
| E-14 | Remove tags from tests that covered only part of a matrix row's stimulus (for example T020, T021, T089, T036, T058, T067) | Avoid over-claiming; those rows stay `DESIGNED_NOT_EXECUTED` or `BLOCKED` | Re-tag when the full stimulus is executed |
| E-15 | Introduce a *proof level* (`SYNTHETIC_CONTRACT`, `SYNTHETIC_REPRO_OF_PLATFORM_DEFECT`, `NONE`) and a `Runtime_gate = NOT_CLOSED` column | Distinguish synthetic evidence from runtime evidence on every row | n/a |
| E-16 | Never emit `FIXED_PROVEN`; WorkAid-owned findings with passing synthetic contract tests become `PARTIALLY_MITIGATED`, platform-owned stay `OPEN` | No executable evidence of a fix on the operational platform exists | n/a |
| E-17 | Keep Grok's original artifacts byte-identical under `grok-redteam-01/` and do not edit the executive verdict's inconsistent footer | Preserve source evidence; the correction is documented in 10 | n/a |
| E-18 | Do not run `pnpm lint`, `typecheck`, `test:fast` or `governance:audit` for this branch | The worktree has no installed workspace and adding one is a shared change. What **was** run: the isolated suite; `tsc` over the harness using the main checkout's TypeScript (clean); and the repository's `validate:docs` script via the main checkout's `tsx` (0 errors; the only finding on these docs was a link to the then-ungenerated inventory; its tracked report files were restored, not committed) | Run the full repository checks in an installed checkout before any PR |
