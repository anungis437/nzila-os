# ORM Governance Readiness Review

**Status:** Active — first review
**Effective:** 2026-05-09
**Scope:** Union Eyes (Nzila ecosystem)
**Owner:** Platform / Schema Governance

This document records the readiness of the Nzila ORM governance program
across the dimensions established in the master index, identifies
unresolved ambiguity risks, and states the operational governance
posture as of the reconciliation date.

---

## 1. Readiness Matrix

| Dimension                                | Maturity      | Notes                                                                              |
|------------------------------------------|---------------|------------------------------------------------------------------------------------|
| Authority reconciliation                 | **Established** | Constitutional rules written; ownership matrix codified.                          |
| Lineage legitimacy                       | **Established** | Historical lineage frozen with sentinel + freeze doc + replay refusal contract.   |
| Bootstrap legitimacy                     | **Initial**     | Reference orchestrator implemented; restore interface stub; awaits snapshot wiring.|
| Deployment legitimacy                    | **Reconciled**  | Distinction between runtime and schema legitimacy formalized.                     |
| Runtime governance attachment            | **Specified**   | Contract written; automated reflection / reconciliation jobs are follow-on work.  |
| Migration legitimacy validation          | **Initial**     | Static validator implemented; runtime/CI checks roadmap documented.               |
| Production isolation guarantee           | **Specified**   | TSOSA prohibits prod sharing; production bootstrap policy written.                |
| Future migration safety                  | **Established** | Scoped Drizzle root makes new migrations safe-by-construction.                    |

Legend: **Specified** (rule exists), **Initial** (rule + reference
implementation), **Established** (rule + implementation + enforcement
path), **Reconciled** (rule + implementation + enforcement + verified
outcomes).

---

## 2. What This Phase Has Achieved

- Constitutional ownership rules are written and committed.
- The Drizzle layer is narrowed: scoped config, scoped barrel, scoped
  migration root, intentionally empty starting state.
- The pre-reconciliation Drizzle lineage is frozen with an enforceable
  replay-refusal contract.
- A canonical bootstrap orchestrator is in place: extensions +
  optional snapshot restore + scoped migrate + attestation row.
- A snapshot restore interface is in place with environment-aware
  guardrails (production refusal).
- A static legitimacy validator is in place and runnable today.
- A 14-document governance set is committed with a master index and
  decision tree.
- Production isolation under TSOSA is preserved by construction.

---

## 3. Unresolved Ambiguity Risks

The following risks remain after this phase. Each must be addressed
before that aspect of governance can graduate to **Reconciled**.

### 3.1 Snapshot source not yet operator-wired

`UE_DB_RESTORE_SNAPSHOT_URL` is supported but the actual restore
mechanism per environment (storage account, blob, signed URL, etc.)
is not yet wired in the restore script. Demo bootstrap currently
materializes only extensions + an empty scoped layer — the canonical
zone is not populated until the operator completes snapshot wiring.

**Mitigation:** demo validation report explicitly records this state.
Pilot bootstrap is gated on snapshot wiring per the operator mandate.

### 3.2 Auxiliary tooling still references frozen lineage path

Several scripts under `scripts/db/*`, `scripts/dr/*`, and
`scripts/release/rollback-prod.ts` reference
`apps/union-eyes/db/migrations/`. They are read-only consumers and the
freeze does not break them, but a future cleanup must re-point them at
the scoped root or at canonical Django snapshots.

**Mitigation:** lineage governance §8 enumerates known consumers.

### 3.3 No automated reconciliation jobs yet

The runtime governance attachment contract is written, but periodic
reconciliation jobs that re-validate signal subjects against canonical
entities are not yet implemented.

**Mitigation:** contract holds today by code review and operator
discipline; jobs are the destination state.

### 3.4 No CI wiring of `db:validate`

`db:validate` runs locally and is invokable on demand, but is not yet
required in the Union Eyes CI workflow. A PR that violates the
governance contract may merge today if reviewers do not run the
validator.

**Mitigation:** CI wiring is recommended in
[migration-legitimacy-validation-system.md §5](./migration-legitimacy-validation-system.md);
expected in the same PR that introduces the first scoped migration.

### 3.5 No contract test for production attestation

A future contract test should assert that production environments
never carry `legacy_replay_override = true` and always advertise
`SECRET_TOPOLOGY=isolated`.

**Mitigation:** operator-enforced today; documented as required.

### 3.6 `docs/architecture/orm-boundary.md` previously referenced

Older code references a path `docs/architecture/orm-boundary.md` that
did not exist. The new `orm-governance/` directory supersedes it; a
short redirector should be added at the old path so existing comments
continue to navigate.

**Mitigation:** redirector added in this phase (see
`docs/architecture/orm-boundary.md`).

---

## 4. Future Migration Safety Readiness

- The scoped Drizzle layer is safe-by-construction for fresh-DB
  replay.
- Adding a new scoped migration is a low-risk operation: edit
  `cache.ts` + `db:generate` + review.
- Removing a scoped migration is a forward-only operation, not a
  retroactive edit; rollbacks happen via snapshot restore (non-prod) or
  reverse migration (prod).

This is a categorical improvement over the pre-reconciliation state,
where any fresh-DB attempt invoked the broken lineage replay path.

---

## 5. Operational Governance Readiness

The Nzila operational governance posture as of this phase is:

- **Demo:** runtime healthy; schema legitimacy pending operator
  snapshot wiring per [environment-bootstrap-strategy.md](./environment-bootstrap-strategy.md).
- **Pilot:** not yet provisioned; provisioning is gated on demo schema
  legitimacy per the operator mandate.
- **Production:** not yet provisioned; production must follow the
  isolation contract in
  [TSOSA §4](../../union-eyes/release/transitional-shared-secret-topology.md)
  and the production bootstrap policy in
  [migration-execution-governance.md §7](./migration-execution-governance.md).

---

## 6. Sign-off Criteria for "Reconciliation Complete"

This phase will be marked **Reconciled** in a follow-on review when
all of the following are true:

1. Snapshot restore is operator-wired for at least demo and pilot.
2. Demo and pilot bootstrap attestations exist with
   `legacy_replay_override = false` and non-null `snapshot_digest`.
3. `db:validate` is wired into the Union Eyes CI workflow.
4. Production has bootstrapped via Django migrate + `db:bootstrap`
   with isolated TSOSA topology and attestation.
5. Auxiliary tooling listed in §3.2 has been re-pointed.
6. The first contract tests in §3.5 are present and passing.

Until then, the governance posture is **Established for
non-production**, **Specified for production**.
