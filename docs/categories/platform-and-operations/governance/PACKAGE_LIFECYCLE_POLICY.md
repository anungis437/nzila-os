# Package Lifecycle Policy

> Canonical rules governing when to **create**, **graduate**, **deprecate**, and **remove** packages in the Nzila OS monorepo.

---

## 1 — Lifecycle Stages

| Stage | `stability` value | Description |
|---|---|---|
| Proposal | — | An RFC / issue discussing a new package |
| Experimental | `EXPERIMENTAL` | Initial code, API may change without notice |
| Evolving | `EVOLVING` | Active development, API mostly stable, breaking changes possible with notice |
| Stable | `STABLE` | Production-grade, breaking changes follow semver |
| Deprecated | `DEPRECATED` | Superseded or unused, must specify `replacement_for` / `deprecation_note` |
| Removed | — | Directory deleted, entry removed from workspace |

---

## 2 — When to Create a Package

A new package is justified **only** when:

1. The capability is needed by **two or more** consumers (apps or packages).
2. The capability does **not** already exist in another package (check `PACKAGE_OWNERSHIP.md`).
3. The package has a clear **owner** and **category** assignment.
4. A `package.meta.json` is created before the first merge.

**Naming conventions:**

- Platform-wide: `platform-<name>`
- Vertical-scoped: `<vertical>-<name>` (e.g. `commerce-pricing`)
- Shared utilities: descriptive noun, no `utils-` prefix
- Forbidden: `shared-`, `common-`, `helpers-`, `misc-`

---

## 3 — Graduation Criteria

### Experimental → Evolving

- At least one consumer uses the package in production code.
- Basic tests exist (`*.test.ts`).
- `package.meta.json` has correct `owner` and `category`.

### Evolving → Stable

- Two or more consumers depend on the package.
- Test coverage above 60 %.
- No `FIXME` or `TODO` markers in public API surface.
- Exports are explicitly listed in `package.json` `exports` field.
- TypeScript strict mode enabled.

---

## 4 — Deprecation Process

1. Set `deprecated: true` in `package.meta.json`.
2. Add `deprecation_note` explaining the reason and successor.
3. If a replacement exists, set `replacement_for` on the **new** package.
4. Add a console warning in the package's barrel `index.ts`:

   ```ts
   console.warn('[DEPRECATED] @nzila/<pkg> is deprecated. Use @nzila/<replacement> instead.')
   ```

5. Open a tracking issue with label `lifecycle:deprecation`.
6. Consumers have **two release cycles** (or 60 days) to migrate.

---

## 5 — Removal Process

1. Package must have been `DEPRECATED` for at least 60 days.
2. Zero workspace consumers (verified via `dependency-boundary-check.ts`).
3. Directory is deleted and entry removed from `pnpm-workspace.yaml` (if listed).
4. `PACKAGE_OWNERSHIP.md` entry moved to an "Archived" appendix.

---

## 6 — Exceptions

Any deviation from this policy requires a documented exception in an issue or PR description with the label `lifecycle:exception` and approval from the package owner listed in `PACKAGE_OWNERSHIP.md`.

---

## Enforcement

- `scripts/package-deprecation-check.ts` validates deprecation metadata consistency.
- `scripts/package-ownership-check.ts` validates presence and schema of `package.meta.json`.
- `scripts/dependency-boundary-check.ts` detects usage of deprecated packages.
