# 14 — Final Gate Matrix

Proof date: 2026-07-15 · Proof environment: local developer proof (official PostgreSQL
18.4 + PGlite) · Base commit: `66ec5ea31` · Proof branch: `proof/sage-final-implementation`
(PR #646)

Statuses: `PASS` · `PASS_WITH_CONDITIONS` · `FAIL` · `NOT_PROVEN`.
No aggregate score is presented; each gate stands on its own. The summary counts below
equal the detailed rows exactly.

| Gate | Title | Status | Evidence | Open findings/conditions |
|---|---|---|---|---|
| G1 | Architecture & doctrine | PASS | contract-tests (arch-layer), final:go CERTIFIED | — |
| G2 | Authorization & tenant isolation | PASS | doc 05 (official-PG RLS, non-owner roles) | — |
| G3 | Evidence integrity & auditability | PASS | docs 03/07; append-only guards | — |
| G4 | Human review & decision control | PASS | doc 04 (separation of duties, human-only) | — |
| G5 | Export immutability & approval | PASS | doc 03; export durability/integrity tests | — |
| G6 | Recipient delivery security | PASS_WITH_CONDITIONS | doc 06 (code-proven) | C-1 (live Resend) |
| G7 | Notification operational resilience | PASS_WITH_CONDITIONS | doc 06 (dispatcher/lease/retry/DLQ/encryption) | C-1, C-2 |
| G8 | Retention & legal holds | PASS | doc 07 (official-PG hold races, provenance) | — |
| G9 | Controlled destruction | PASS_WITH_CONDITIONS | doc 07 (durable attempt, crash recovery, POINR) | C-9 (live object store) |
| G10 | Privacy & data minimization | PASS_WITH_CONDITIONS | doc 11 (hash-only, no leakage, honest guarantees) | C-8 (dependency scan unavailable via `pnpm audit`) |
| G11 | Accessibility & bilingual parity | **NOT_PROVEN** | doc 10 (locale parity PASS; accessibility NOT_PROVEN) | B-004 (accessibility automated + manual) |
| G12 | Observability & incident response | **NOT_PROVEN** | doc 08 (no monitoring stack; no incident drill) | B-001, B-002 |
| G13 | Backup & restoration | **NOT_PROVEN** | doc 09 (no restore environment) | B-003 |
| G14 | Performance & reliability | PASS_WITH_CONDITIONS | doc 12 (concurrency PASS) | C-6 (deployed perf budgets) |
| G15 | Documentation & operator readiness | PASS_WITH_CONDITIONS | this proof run + blueprint | deployed runbook/readiness verification |

## Summary (counts equal the rows above)

| Status | Count | Gates |
|---|---|---|
| PASS | 6 | G1, G2, G3, G4, G5, G8 |
| PASS_WITH_CONDITIONS | 6 | G6, G7, G9, G10, G14, G15 |
| NOT_PROVEN | 3 | G11, G12, G13 |
| FAIL | 0 | — |
| **Total** | **15** | — |

Three gates are **NOT_PROVEN**: **G11 (accessibility & bilingual parity — bilingual parity
is proven but accessibility is not)** and the two **critical** gates **G12
(observability/incident)** and **G13 (backup/restoration)**. Under the launch rules a
NOT_PROVEN critical gate mandates **NO_GO**. The associated launch-blocking findings are
recorded as **B-001…B-004** in `13-defect-and-remediation-ledger.md`.
