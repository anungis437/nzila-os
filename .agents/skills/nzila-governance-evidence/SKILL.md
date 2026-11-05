---
name: nzila-governance-evidence
description: Use when closing issues, updating defect ledgers, recording product decisions, or reporting Nzila release readiness. Bind every claim to the exact artifact, commit, tests, owner, and environment.
---

# Governance evidence and truthful closure

## Trigger
Use for issues/register changes, readiness matrices, audit packs, exception handling, or sign-off reporting.

## Procedure
1. Identify which register, decision owner, policy, environment, and exact commit controls the claim. Preserve superseded decisions as history.
2. Distinguish `IDENTIFIED`, `IMPLEMENTED`, `TARGETED_TESTED`, `CI_VERIFIED`, `STAGING_PROVEN`, and `PRODUCTION_ACCEPTED`. These are separate states, not synonyms.
3. Build one-to-one traceability: issue/defect ID -> root cause -> changed files and commit -> test case and output -> required reviewer/approver -> residual risk -> disposition.
4. Update a ledger item only with evidence appropriate to its state; use `UNKNOWN`, `UNEXECUTED`, or `NO_GO` when a proof is absent. Avoid a green-looking document whose source and runtime disagree.
5. Compare denominators and IDs before/after reconciliation. For a batch, report corrected vs remaining in the user's requested register, not merely passing test totals.
6. Run required repository checks before requesting PR review, then identify the exact run and SHA. Lack of cloud credentials or deployed identity is an unexecuted proof, not an inferred pass.
7. Keep approvals, risk acceptances, finance mandates, and production promotion in their existing authoritative systems. Document what was authorized; never invent an approver, sign-off, or live environment.

## Required handoff
Provide scope, precise diff/commit, evidence matrix, counterexamples tested, remaining blockers, and the next executable action. Explicitly mark anything that has not been run.

