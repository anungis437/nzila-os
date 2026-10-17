# Restricted-data portfolio reconciliation

This record reconciles PR #925 (`7b12896b16ce281bc621b5c8c46e9b65c65e2f62`)
with accepted main `ede980d62959f91517b6c805787cb031d60fd420`.
The original source remains in the candidate's ancestry. The compliant
`fix/restricted-data-closure` branch carries the reconciliation because the
original `cursor/` branch does not satisfy the existing branch-name policy.

## Source boundary

The candidate retains the in-process platform reference package, default logger
redaction, AI gateway denial and audit filtering, and Console integration.
It repairs actor/org/resource binding for emergency reads, trusted expiry,
grant-bound export and minimum disclosure, principal-only deletion, detached
state snapshots, nested classification, and AI schema/route propagation.
Restricted knowledge ingestion is rejected before proposal or source storage.
Console revokes an emergency activation when its durable audit write fails.
Logger normalization retains governance markers attached to Error objects before
redacting their message and stack; ordinary unmarked errors retain diagnostics.

Administrative package interfaces require trusted server adapters using
canonical authentication. This package does not implement authenticated durable
storage, replace application authorization, or change Union Eyes RLS.
The path manifest classifies every net candidate path relative to accepted main;
incoming accepted main changes are not new work owned by this candidate.

## Qualification and human review

Focused synthetic checks cover scoped access, expiry, disclosure, export,
preservation, audit minimization, AI denial and route wiring. Repository lint,
type checking, documentation/governance checks, remote contracts and the full
fast suite must qualify the final source commit. A successful earlier source or
local focused test is not the final remote qualification receipt.

Human security review was explicitly approved on 2026-10-17 for source commit
`0dffa483685234172cb838aafbd3211007db8936`; GitHub approval by `anungisa` is on
that same commit. The maintainer requested the security-design-reviewed label.
The subsequent correction records one exact historical scanner fingerprint for
the published alphabetical fake red-team key; application/security source is
unchanged. No approval is inferred from other products. Merge is not authorized.
The typecheck contract fixture now counts the new package (233 executable
targets) and verifies its critical dependent closure; enforcement is unchanged.
Final PR receipts must identify the tested source commit and tree separately
from the qualification helper workflow revision.

## Operational limitations retained

R6 backup and replica propagation remains UNVERIFIED. Deletion expresses primary
in-process removal and propagation requests; it does not prove live backups,
caches, indexes or exports have been erased. CMK, runtime residency and provider
zero-retention evidence remains UNVERIFIED. Restricted model processing stays
disabled; caller-supplied evidence labels cannot enable it.

CIVITAS privacy stays HOLD and Phase 3 stays CLOSED. Council stays DISABLED,
Treasurer stays QUARANTINED, AUTH_START_WORKAID stays NO, and Union Eyes operational
readiness stays NO_GO. This reconciliation authorizes no production deployment,
production mutation, customer data or future phase activation.
