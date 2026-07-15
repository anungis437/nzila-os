# 15 — Launch-Governance Decision

## Decision summary

```
Recommended decision:  NO_GO
Authorized decision:    NO_GO
Scope:                  external production availability
Basis:                  G11, G12, G13 NOT_PROVEN (G12 + G13 are critical)
Code/database chain:    PROVEN (production-grade)
```

## Authorized launch decision: **NO_GO**

**SAGE is not authorized for external production use.**

**Rationale.** The code and PostgreSQL control chain has passed the implementation proof
(authorization/RLS under real non-owner roles, evidence/decision separation, export
immutability, retention + legal-hold coordination, durable pre-delete attempt with
crash/reconnect recovery, the point-of-no-return race, one-way tombstoning, and
privacy/data-minimization). However, critical operational gates remain **NOT_PROVEN**,
including production observability and incident response (**G12**), backup restoration
(**G13**), and accessibility assurance (**G11**). Under the approved launch-governance
rules, any critical `FAIL` or `NOT_PROVEN` gate requires **NO_GO**.

**This decision does not reject the implementation.** It authorizes the next work to
provision and prove the missing operational controls. A new launch decision is required
after those controls are evidenced.

## Authorized-decision record

```
Approver:        Aubert Nungisa (authorized governance approver)
Decision:        NO_GO (external production availability)
Decision date:   2026-07-15
Proof:           proof-run 004 (PR #646, branch proof/sage-final-implementation, base 66ec5ea31)
Proof head:      tip of proof/sage-final-implementation at merge (recorded in PR #646)
Launch blockers: B-001 (observability/alerting), B-002 (incident drill), B-003 (backup restore), B-004 (accessibility)
```

## Path to a future GO / CONDITIONAL_GO

A future proof run in a **deployed production-equivalent environment** must close, at
minimum:

1. **B-001 / B-002 (G12)** — Sentry ingest with PII scrubbing + alert routing +
   backlog/DLQ/destruction-failure metrics, and a controlled incident-response drill.
2. **B-003 (G13)** — a real backup capture + isolated restoration with row-count/hash
   reconciliation and the two non-resurrection invariants (destroyed bytes / destroyed
   ciphertext must not become accessible).
3. **B-004 (G11)** — automated + manual accessibility evidence.
4. Conditions C-1, C-2, C-6, C-8, C-9 (live Resend, live Redis, deployed performance,
   dependency scan, live object-storage destruction).

`CONDITIONAL_GO` becomes available only once **no** critical (security/privacy/
authorization/destruction/backup/incident) gate is failed or unproven and every remaining
condition has a named owner, deadline and written acceptance.

## Accuracy of external messaging

No public-availability, procurement-ready, pilot-ready, certified or launch claim may be
made for SAGE. `final:go CERTIFIED` denotes **repository governance readiness only**, not
authorization for external production use. This proof run is **complete**: it accurately
establishes that the implementation is strong and that external production authorization
must remain **NO_GO** until the missing operational controls are provisioned and proven.
