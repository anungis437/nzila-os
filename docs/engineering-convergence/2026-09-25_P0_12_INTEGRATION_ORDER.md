# P0.12 Dependency-Aware Integration Order

**Starting `origin/main`:** `abc7e07bae4b11fcaf9c4d51a2245758ad31e9d8`

**Plan status:** READY FOR P0.13

**Production promotion:** NOT AUTHORIZED

This sequence follows observed dependencies. It is not ordered by branch age,
PR number, or perceived completion percentage. Each batch must leave `main` as
a valid integration point before the next batch begins.

## Integration batches

### Batch 1: convergence control record

| Field | Value |
| --- | --- |
| Input SHA | `abc7e07bae4b11fcaf9c4d51a2245758ad31e9d8` |
| Development lane | LANE-030 |
| Integration method | Normal documentation PR from `docs/engineering-estate-convergence` |
| Expected changes | Reproducible estate census plus P0.2-P0.12 ledger, classifications, architectural rulings, and integration order |
| Required tests | `git diff --check`, documentation consistency, required repository validation |
| Required CI | Branch policy, docs, governance, inventory, security, and all required PR checks |
| Post-integration SHA | `TBD_AFTER_MERGE` |
| Remaining lanes affected | All; the merged ledger becomes their disposition record |

### Batch 2: CIVIC runtime-boundary hardening

| Field | Value |
| --- | --- |
| Input SHA | Batch 1 exact `main` SHA |
| Development lane | New bounded component from LANE-009 finding; LANE-009 runtime itself remains excluded |
| Integration method | Small replacement PR extending the existing #810 validator and adversarial tests |
| Expected changes | Reject cross-application CIVIC routes/aliases such as `apps/union-eyes/app/[locale]/civic` while runtime authorization is false |
| Required tests | Doctrine unit/contract tests, mutation tests for route/config/package bypasses |
| Required CI | `validate:doctrine`, Portfolio Governance, Governance Gates, required PR checks |
| Post-integration SHA | `TBD_AFTER_MERGE` |
| Remaining lanes affected | LANE-006 documentation and LANE-009 disposition |

### Batch 3: schema ownership foundation

| Field | Value |
| --- | --- |
| Input SHA | Batch 2 exact `main` SHA |
| Development lane | LANE-003 / replacement for PR #796 |
| Integration method | Rebase into a new integration branch; preserve valid commits, resolve against current main, no force-push requirement |
| Expected changes | One-owner schema registry, Django canonical migrations, runtime contract, fresh-build guard, Drizzle declaration reconciliation, organization/RLS-context fixes |
| Required tests | Schema-authority suites, Django migration checks, empty-database fresh build, runtime-contract verification, focused organization/RLS tests |
| Required CI | Full required PR suite including architecture, security, migration, Union Eyes, inventory, and governance checks |
| Post-integration SHA | `TBD_AFTER_MERGE` |
| Remaining lanes affected | LANE-004, LANE-007, LANE-008, LANE-011, LANE-012, LANE-027 |

### Batch 4: runtime schema and migration replacement

| Field | Value |
| --- | --- |
| Input SHA | Batch 3 exact `main` SHA |
| Development lane | LANE-004 replacement for PR #799; #797 remains duplicate |
| Integration method | Rebuild on Batch 3; component-port deterministic journals/oracle/RLS work and re-author accepted platform migrations |
| Expected changes | Owner-bounded platform creation migrations, adjudicated `claim_updates`, deterministic apply/baseline behavior, clean-room schema oracle, regenerated RLS closure |
| Required tests | Empty PG build, canonical snapshot restore, journal/hash/order tests, zero missing/unowned/dual-owned required tables, full RLS verification, focused E2E seed/bootstrap |
| Required CI | Full required PR suite plus exact-head clean-room and schema/RLS gates |
| Post-integration SHA | `TBD_AFTER_MERGE` |
| Remaining lanes affected | LANE-008, LANE-011, LANE-012, LANE-027, LANE-028, LANE-006 |

### Batch 5: authority and RLS call-site closure

| Field | Value |
| --- | --- |
| Input SHA | Batch 4 exact `main` SHA |
| Development lane | Accepted components from LANE-011 and LANE-012; current-main defects identified in P0.9 |
| Integration method | One or more small security-reviewed PRs, grouped by authority boundary rather than stash origin |
| Expected changes | Remove ordinary-request system elevation, re-author valid mutation/assignment continuity controls, classify every privileged caller, retain stronger current credential controls |
| Required tests | Auth negative-path matrix, cross-tenant tests, privileged-caller contract tests, audit attribution, RLS verification, secret scan |
| Required CI | Full required PR suite with security, CodeQL, red-team, authority, and evidence gates |
| Post-integration SHA | `TBD_AFTER_MERGE` |
| Remaining lanes affected | LANE-007, LANE-008, LANE-021, LANE-024, LANE-025, LANE-027 |

### Batch 6: bounded staging acceptance and commissioning

| Field | Value |
| --- | --- |
| Input SHA | Batch 5 exact `main` SHA |
| Development lane | Accepted components from LANE-007, LANE-008, and LANE-027 |
| Integration method | Separate fixture, probe, and E2E PRs where ownership differs; never import generated evidence as source |
| Expected changes | Synthetic Wave-1 fixtures, canonical commissioning/oracle integration, staging-only acceptance auth E2E, current negative-path coverage |
| Required tests | Fixture determinism, staging/prod environment matrix, auth denial cases, role navigation, tenant isolation, snapshot/bootstrap compatibility |
| Required CI | Full required PR suite and bounded staging proof on the exact accepted head where environment evidence is needed |
| Post-integration SHA | `TBD_AFTER_MERGE` |
| Remaining lanes affected | LANE-017, LANE-018, LANE-024, LANE-028, LANE-006 |

### Batch 7: operations residuals

| Field | Value |
| --- | --- |
| Input SHA | Batch 6 exact `main` SHA |
| Development lane | Residual requirement review from LANE-017 and LANE-018 |
| Integration method | Implement only verified deltas not already superseded by #814/current main |
| Expected changes | Missing health-safety behavior such as the absent training-stats route, and observability parity only where current controls still lack it |
| Required tests | Endpoint contracts, health/readiness/version behavior, observability assertions, fail-closed post-deploy contracts |
| Required CI | Full required PR suite and GitOps contract checks; no production deployment |
| Post-integration SHA | `TBD_AFTER_MERGE` |
| Remaining lanes affected | LANE-006 and final Gate C recomputation |

### Batch 8: dependency programme

| Field | Value |
| --- | --- |
| Input SHA | Latest green `main` after code convergence |
| Development lane | LANE-020.01 through LANE-020.17 |
| Integration method | Rebase and review individually or in proven compatible groups; no blanket merge |
| Expected changes | Supported dependency upgrades without lockfile contention from active code lanes |
| Required tests | Package-specific tests plus lint, typecheck, fast tests, audit, build/E2E where the upgrade blast radius requires it |
| Required CI | Full required PR suite, dependency review, security scans |
| Post-integration SHA | `TBD_PER_PR` |
| Remaining lanes affected | LANE-006 generated inventories and final main audit |

### Batch 9: documentation and evidence truth

| Field | Value |
| --- | --- |
| Input SHA | Latest green code/dependency `main` |
| Development lane | LANE-006 / replacement or rebase of PR #808 |
| Integration method | Rebase editable docs; regenerate every derived report from the exact head; preserve historical evidence without rewriting it |
| Expected changes | Current document topology, claim verification, archive disposition, regenerated truth surfaces, accurate readiness boundaries |
| Required tests | Docs consistency, links, claims, portfolio, governance, evidence, inventory, CIVIC doctrine |
| Required CI | Full required PR suite with zero unsupported readiness claims |
| Post-integration SHA | `TBD_AFTER_MERGE` |
| Remaining lanes affected | Closure/accountability lanes only |

### Batch 10: estate closure and final audit

| Field | Value |
| --- | --- |
| Input SHA | Batch 9 exact `main` SHA |
| Development lane | All remaining dispositions |
| Integration method | Close/supersede PRs with replacement evidence; retain or remove branches/worktrees/stashes only after unique-work proof and authorization |
| Expected changes | No unexplained PR, branch, worktree, stash, detached commit, generated output, or dirty checkout |
| Required tests | Fresh topology census and content-equivalence checks, then complete repository validation from synchronized `main` |
| Required CI | All required current-main checks green at one exact SHA; no production promotion used to manufacture green |
| Post-integration SHA | Final convergence SHA |
| Remaining lanes affected | Explicit post-convergence retained product inputs only |

## Explicitly retained, not pre-integrated

The following lanes are accounted for but do not enter `main` merely to finish
convergence:

- LANE-010 local ACR operator experiments;
- LANE-022 broad historical cleanup/committee/correspondence work;
- LANE-023 later CBA intelligence/security product work;
- LANE-024 dispatch/employer/partner product requirements beyond any narrowly
  accepted authority prerequisite;
- LANE-025 older cross-app/auth/ML experiments;
- LANE-028 historical Phase H evidence;
- LANE-029 CourtLens Gap 3 proof work;
- LANE-031 platform-admin lifecycle reclassification pending a new decision.

Their terminal convergence disposition may be `RETAIN_ACTIVE` or
`RETAIN_HISTORICAL` with an explicit owner and purpose. They do not count as
unaccounted development.

## Main-green rule

After every merged batch:

1. fetch and record the exact `origin/main` SHA;
2. verify the merged behavior and all required checks at that SHA;
3. refresh the estate census and ledger;
4. detect newly orphaned or superseded refs;
5. begin the next batch only from that green main.

No stack of knowingly broken dependent PRs will be accumulated. Waiting or
manual production gates are not approved merely to improve the displayed
check count.

## P0.12 ruling

The integration order is established. P0.13 may begin with Batch 1. Gate A/B/C
remain unchanged, SaaS implementation remains paused, and
`UNACCOUNTED_DEVELOPMENT = 0` has not yet been reached.
