/**
 * CLI entry point for the deterministic UnionEyes staging seed.
 *
 * Usage:
 *   pnpm -C apps/union-eyes staging:seed
 *   STAGING_SEED_ORG_ID=org_xyz pnpm -C apps/union-eyes staging:seed
 */
import { runStagingSeed } from '../lib/stagingSeed'

async function main() {
  const result = await runStagingSeed()
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  if (!result.ok) process.exit(1)
}

main().catch((err) => {
  process.stderr.write(`[staging-seed] failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`)
  process.exit(1)
})
