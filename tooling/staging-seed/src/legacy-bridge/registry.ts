/**
 * @nzila/staging-seed — legacy script registry.
 *
 * Maps deprecated per-app seed scripts to a single typed table so the CLI
 * can list and invoke them via `tsx cli.ts legacy [--script=<id>]`.
 *
 * This is a transitional bridge: the long-term plan is to migrate each
 * legacy script's record shapes into the framework's per-app seeders
 * (Phase 3+). Until then, callers get one CLI entry point and a single
 * source of truth for "what legacy seeders exist".
 */

export interface LegacyScript {
  /** Stable identifier used as `--script=<id>`. */
  readonly id: string
  /** Owning app (matches `SEED_APPS` where applicable). */
  readonly app: string
  /** Human-readable summary. */
  readonly description: string
  /** Repo-relative path from the workspace root. */
  readonly path: string
  /**
   * Runner used to invoke the script. `tsx` for TypeScript entrypoints,
   * `node` for `.mjs` ESM scripts.
   */
  readonly runner: 'tsx' | 'node'
  /** Why we still keep it (so we don't accidentally delete it later). */
  readonly retainedFor: string
}

export const LEGACY_SCRIPTS: readonly LegacyScript[] = [
  {
    id: 'union-eyes-demo',
    app: 'union-eyes',
    description:
      'Deterministic union-eyes demo data (claims, members, assignments, events).',
    path: 'apps/union-eyes/scripts/seed-union-eyes-demo.ts',
    runner: 'tsx',
    retainedFor:
      'sales-kit demo runbook (docs/commercial/sales-kit/02-45-minute-demo-script.md)',
  },
  {
    id: 'cupe-pilot',
    app: 'union-eyes',
    description:
      'CUPE pilot fixtures (Local 123 + 7 demo members + 5 demo cases).',
    path: 'apps/union-eyes/scripts/seed-cupe-pilot.mjs',
    runner: 'node',
    retainedFor:
      'admin LoadCUPEPilotForm + fixtures/cupe/README.md Method 2',
  },
  {
    id: 'cba-intelligence',
    app: 'union-eyes',
    description:
      'CBA Intelligence demo data (4 sources, 3 documents, 3 findings, 1 review decision).',
    path: 'apps/union-eyes/scripts/seed-cba-intelligence.ts',
    runner: 'tsx',
    retainedFor:
      'docs/governance/CBA_INTELLIGENCE_VALIDATION_REPORT.md record-count parity',
  },
] as const

export function getLegacyScript(id: string): LegacyScript | undefined {
  return LEGACY_SCRIPTS.find((s) => s.id === id)
}
