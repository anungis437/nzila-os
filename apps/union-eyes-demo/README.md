# Union Eyes Demo Artifact — `@nzila/union-eyes-demo`

**Programme:** Union Eyes Reality & World-Class Remediation Programme, Wave 0 §3 (Semantic Demo Isolation).
**Status:** `SCAFFOLD_IN_PROGRESS` — physical artifact separation is being staged. Independent build is not yet wired.

## What this directory is

This is the **only** location in the repository where CUPE 4373 demo
pages, demo fixture data, demo-only API handlers, and demo-only React
components may live. The Wave 0 anti-theatre scanner
(`tooling/reality/anti-theatre-scan.ts`) exempts paths under
`apps/union-eyes-demo/` from rule R-3 (production-code-imports-demo)
and flags demo imports from any other location as an error.

This directory exists to make the following claims true and
verifiable:

1. The operational Union Eyes application at `apps/union-eyes/` does
   not import demo fixture data, demo React components, or demo API
   handlers — statically or dynamically.
2. There exists a separately-identified demo artifact root that a
   scanner and a build tool can point at.
3. Demo behaviour cannot be activated in the operational build by
   flipping an environment variable.

## What this directory is NOT (yet)

- A running Next.js app. The `package.json` intentionally has no
  `next` dependency until §3 completes. See §20
  (`docs/union-eyes/reality-remediation/20_SEMANTIC_ISOLATION.md`) for
  the remaining work items.
- Type-checked in isolation. Its files are not currently included in
  any `pnpm typecheck` command. They must be moved back into a
  demo-app tsconfig before independent typecheck can pass.

## Follow-up work (tracked in §20)

- Wire `next.config.mjs` and add the runtime dependencies (`next`,
  `react`, `react-dom`, `@nzila/platform-auth`, `@nzila/ui`, etc.).
- Wire `pnpm typecheck` and `pnpm build` scripts.
- Add functional tests that prove the demo pages render only when
  served from this artifact, not from the operational app.
- Add a build-output demo-string scan against the operational build
  (`pnpm build --filter @nzila/union-eyes`) that greps the output
  for `cupe4373`, `/lib/demo/`, `UE_FEATURE_PROFILE`, and known
  synthetic case identifiers, expecting zero hits.
