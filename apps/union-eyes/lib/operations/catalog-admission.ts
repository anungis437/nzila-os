import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

export type CatalogAdmissionReport = {
  ok: boolean
  applicationReady: false
  environment: string
  source: string
  violations: string[]
}

function repoRootFrom(start: string): string {
  let dir = start
  for (let depth = 0; depth < 6; depth += 1) {
    if (fs.existsSync(path.join(dir, 'tooling/scripts/lib/union-eyes-catalog-authority.mjs'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('Union Eyes catalog authority module is not available to this process')
}

/**
 * Read-only catalog admission used by the application health route.
 * A failure reports the drift. It does not revoke privileges.
 */
export async function evaluateCatalogAdmission(
  connectionString = process.env.DATABASE_URL,
): Promise<CatalogAdmissionReport> {
  if (!connectionString) {
    return {
      ok: false,
      applicationReady: false,
      environment: process.env.UE_ENVIRONMENT || process.env.NODE_ENV || 'unknown',
      source: 'apps/union-eyes/db/rls-storage-authority',
      violations: ['DATABASE_URL is absent'],
    }
  }
  const repoRoot = repoRootFrom(process.cwd())
  const authority = await import(path.join(repoRoot, 'tooling/scripts/lib/union-eyes-catalog-authority.mjs'))
  const client = new pg.Client({ connectionString })
  await client.connect()
  try {
    return await authority.diagnoseCatalogAuthority(client, {
      repoRoot,
      environment: process.env.UE_ENVIRONMENT || process.env.NODE_ENV || 'unknown',
    })
  } finally {
    await client.end()
  }
}
