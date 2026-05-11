# Full Workspace & Substrate Sovereignty

> **Authority:** Deterministic workspace truth across local, CI, and runtime
> environments. Authorizes downstream PR `feat/workspace-substrate-sovereignty`.

> **Doctrine:** Workspace truth must be deterministic across all environments.
> No package may resolve differently in CI than locally. No artifact may be
> generated implicitly at boot. No symlink may be ambiguous about its target.

---

## 1. Audit surface

The hardening covers the pnpm workspace substrate that backs union-eyes:

- `pnpm-workspace.yaml` — package globs and workspace boundaries
- `pnpm-lock.yaml` — lockfile parity (single lockfile, never per-app)
- ontology / contract package resolution — `@nzila/os-core/*`,
  `@nzila/platform-auth`, `@nzila/contracts`, `@nzila/governance-runtime`
- shared schema resolution — Drizzle schemas exported from
  `packages/db-schema` (or equivalent), consumed by union-eyes and the
  Django sidecar
- generated artifact parity — Tailwind CSS, generated TypeScript clients,
  evidence indexes
- local / CI parity — Turbopack resolves the same files as the CI builder
- symlink integrity — pnpm `node_modules/.pnpm/` symlinks resolve to the
  expected workspace package, not a registry tarball
- runtime package visibility — packages consumed by Next.js apps are
  declared in the consumer's `dependencies`, never just hoisted

---

## 2. Required hardening

The hardening contract forbids:

- hidden local-only behavior — any path that "works on my machine" but
  fails in CI is a doctrine violation; the resolver must be made symmetric
- CI / runtime divergence — Turbopack's resolution must match `tsc` and
  Vitest under the same `tsconfig.json`. Known divergence: Turbopack
  cannot resolve `.js` extension imports to `.ts` source files in
  workspace packages — extensionless imports are mandatory in any
  package consumed by a Next.js app.
- workspace ambiguity — every package has exactly one canonical name and
  one canonical export map. No package re-exports another package's
  internals as a parallel public surface.
- stale artifacts — `pnpm install` is the only legitimate artifact
  generator at install time; runtime artifact generation (e.g. building
  Tailwind at first request) is forbidden.
- package export drift — when a package adds an export, every consumer
  must declare it explicitly; barrel re-exports that mask drift are
  forbidden.

---

## 3. Determinism contract

The substrate is deterministic when:

- a fresh checkout + `pnpm install` produces a workspace whose every
  package version equals the lockfile entry
- `pnpm typecheck` passes locally and in CI with identical output
- `pnpm test` exhibits identical pass / fail topology locally and in CI
- `pnpm build` produces identical bundle hashes (modulo embedded build
  timestamps, which are pinned via `SOURCE_DATE_EPOCH`)
- `docker build` against the union-eyes Dockerfile produces an image whose
  workspace tree is byte-identical to the local workspace tree (modulo
  `.git/` and ignored paths)

These five symmetries are the operational floor. A failure in any of them
is a substrate-sovereignty violation and surfaces in the validator.

---

## 4. Per-package vitest config

A package-level `pnpm run test` must not silently inherit the root
`vitest.config.ts` workspace `projects` array — that pattern caused
spurious failures looking for nonexistent paths
(`packages/<pkg>/apps/...`). Every package that ships its own tests
declares a local `vitest.config.ts` with its own `include` and
`passWithNoTests: true` where appropriate. This is recorded as a known
footgun in the User memory; the hardening contract codifies it.

---

## 5. Anti-drift guarantees

The hardening contract forbids:

- packages that import from another package's `src/internal/`
- packages that depend on `process.env.NODE_ENV` to choose an export
- runtime resolution paths that branch on `process.platform`
- generated files committed to the repo without a deterministic generator
  recipe (i.e. `pnpm gen:<name>` reproduces them byte-for-byte)
- monorepo-wide `tsconfig.json` overrides that disagree with the
  per-package `tsconfig.json`

---

## 6. Authorized downstream PR

`feat/workspace-substrate-sovereignty`: enumerates every package's export
map, adds the per-package `vitest.config.ts` where missing, adds a CI step
that builds union-eyes via Docker and diffs the workspace tree, and
documents every non-symmetric resolver path as a known degradation. No
mass-migration; no churn. Surgical closure of the enumerated divergences.

---

## 7. Verdict (live, May 9, 2026)

| Symmetry                       | Status   | Verdict        |
| ------------------------------ | -------- | -------------- |
| Lockfile parity                | enforced | GO             |
| Local typecheck = CI typecheck | enforced | GO             |
| Local tests = CI tests         | mostly   | CONDITIONAL GO |
| Local build = CI build         | mostly   | CONDITIONAL GO |
| Docker tree = local tree       | enforced | GO             |
| Per-package vitest config      | partial  | CONDITIONAL GO |

The terminal verdict is **deterministic in the spine, conditional in the
edges**. The hardening PR closes the conditional rows.
