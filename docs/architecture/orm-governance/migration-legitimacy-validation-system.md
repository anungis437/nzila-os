# Migration Legitimacy Validation System

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [orm-authority-governance.md](./orm-authority-governance.md)

This document specifies the continuous validation system for ORM
governance legitimacy.

---

## 1. Validator

`tooling/scripts/validate-orm-legitimacy.mjs`, invoked via:

```
pnpm --filter @nzila/union-eyes db:validate
```

Designed to be runnable locally and in CI on every pull request.

---

## 2. Static Checks (current)

| # | Check                                                      | Detects                                          |
|---|------------------------------------------------------------|--------------------------------------------------|
| 1 | `drizzle.config.ts` exists                                 | accidental deletion                              |
| 2 | `drizzle.config.ts` `out` is `./db/migrations-cache`       | scope drift / authority drift                    |
| 3 | `drizzle.config.ts` `schema` is `./db/schema-cache/cache.ts`| scope drift / barrel reintroduction              |
| 4 | scoped barrel exists                                       | accidental deletion                              |
| 5 | scoped migration root + `_journal.json` exist              | accidental deletion                              |
| 6 | legacy lineage freeze sentinel exists                      | accidental unfreezing                            |
| 7 | legacy lineage freeze documentation exists                 | accidental unfreezing                            |
| 8 | scoped barrel does not import broad legacy schema          | scope creep                                      |
| 9 | (warn) legacy `.sql` mtimes newer than freeze date         | post-freeze edits to lineage                     |

Failures exit non-zero and block PR merges (when wired in CI).
Warnings surface to stdout but do not block.

---

## 3. Future Detections (roadmap)

The following detections are governance-required and will be added in
a follow-on phase. They are listed here so that operators and reviewers
can hold them as the destination state.

| Detection                                                              | Mechanism                                          |
|-----------------------------------------------------------------------|-----------------------------------------------------|
| Ownership ambiguity (cross-ORM table mutation)                         | git diff inspection of Django + Drizzle migrations |
| Replay ambiguity (legacy lineage referenced in CI scripts)             | grep over `.github/workflows/**`                   |
| Schema drift (introspected DB vs scoped journal)                       | runtime introspection vs `_journal.json`           |
| Unauthorized migration authority (external psql DDL)                   | audit log scan                                     |
| Topology violations (FK from canonical → projection)                   | introspect FK graph                                |
| Lineage inconsistencies (journal entries without SQL files)            | journal vs filesystem                              |
| Production attestation with `legacy_replay_override = true`            | query `drizzle.bootstrap_attestations`             |
| TSOSA prod prohibition (production SECRET_TOPOLOGY != isolated)        | runtime metadata check                             |

---

## 4. Required Outputs

The validator must emit, at minimum, the following on each run:

- A per-check `ok` / `FAIL` line.
- A `warnings` block listing any non-blocking detections.
- A final summary line `ORM legitimacy: OK.` or
  `<n> legitimacy check(s) failed.`
- Non-zero exit code on any FAIL.

Future enhancements should also emit JSON reports for:

- legitimacy reports (per-check, machine-readable)
- reconciliation reports (drift items + remediation pointers)
- topology consistency reports (canonical topology vs introspected DB)
- attestation compatibility reports (bootstrap attestation rows vs
  TSOSA contract)

These reports become inputs to the runtime governance dashboards
described in
[orm-authority-runtime-governance-attachment.md](./orm-authority-runtime-governance-attachment.md).

---

## 5. CI Wiring (recommended)

Add to the Union Eyes workflow:

```yaml
- name: Validate ORM legitimacy
  run: pnpm --filter @nzila/union-eyes db:validate
```

This wiring is recommended but not yet committed; the validator runs
locally today and is expected to be wired into CI in the same PR that
introduces the first scoped Drizzle migration.

---

## 6. Operator Workflow

When `db:validate` fails:

1. Read the failing check line; it points at the broken contract.
2. Consult the linked governance doc for the rule definition.
3. Reconcile the working tree (do not weaken the validator).
4. Re-run `db:validate` to confirm.

The validator must not be silenced or weakened to make a PR pass.
Weakening the validator is a governance event and requires its own PR
with a written justification.
