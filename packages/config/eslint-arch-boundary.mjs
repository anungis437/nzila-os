/**
 * ESLint — Architectural Boundary Enforcement
 *
 * Prevents cross-app imports and enforces the layered architecture:
 *
 *   1. Apps MUST NOT import from other apps
 *   2. Apps MUST NOT reach into platform internals — use the published contract
 *   3. packages/ MUST NOT import from apps/
 *   4. Shared packages MUST NOT depend on app-specific packages
 *
 * This rule enforces the Nzila OS dependency inversion principle:
 *   apps → packages (allowed)
 *   packages → packages (allowed, if declared in package.json)
 *   apps → apps (FORBIDDEN)
 *   packages → apps (FORBIDDEN)
 *
 * Usage in your eslint.config.mjs:
 *
 *   import noArchBoundaryViolation from '@nzila/config/eslint-arch-boundary'
 *   export default [
 *     ...otherConfigs,
 *     noArchBoundaryViolation,
 *   ]
 *
 * @module @nzila/config/eslint-arch-boundary
 */

/** @type {import('eslint').Linter.FlatConfig} */
const archBoundaryConfig = {
  name: 'nzila/arch-boundary',
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          // ── Cross-App Imports ──────────────────────────────────────────
          // Apps must never import from other apps directly.
          // Use shared packages (@nzila/*) for cross-cutting concerns.
          {
            group: [
              '@nzila/web/*',
              '@nzila/console/*',
              '@nzila/union-eyes/*',
              '@nzila/flow/*',
              '@nzila/partners/*',
              '@nzila/control-plane/*',
              '@nzila/cfo/*',
              '@nzila/zonga/*',
              '@nzila/agrimo/*',
              '@nzila/trade/*',
              '@nzila/cora/*',
              '@nzila/nacp-exams/*',
              '@nzila/mobility/*',
              '@nzila/mobility-client-portal/*',
              '@nzila/abr/*',
              '@nzila/platform-admin/*',
              '@nzila/orchestrator-api/*',
            ],
            message:
              'Cross-app imports are forbidden. Extract shared logic into a package under packages/. ' +
              'See docs/architecture/BOUNDARY_POLICY.md.',
          },

          // ── Internal Source Import ─────────────────────────────────────
          // Never import from another package's /src/ or /lib/ directly.
          // Always use the published package entrypoint.
          {
            group: ['**/packages/*/src/*', '**/packages/*/lib/*'],
            message:
              'Do not import from a package\'s internal src/ or lib/ directory. ' +
              'Import from the package root (e.g. @nzila/contracts) or a declared export path.',
          },

          // ── Relative Escape Hatch ──────────────────────────────────────
          // Prevent ../../apps/... or ../../packages/.../src/... patterns.
          {
            group: ['**/apps/**'],
            message:
              'Do not import from apps/ via relative paths. Use @nzila/* package imports.',
          },
        ],
      },
    ],
  },
}

export default archBoundaryConfig
