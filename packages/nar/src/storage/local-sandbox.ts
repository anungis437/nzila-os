import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { NarRecord, NarStorageRef } from '../types'

/**
 * Local sandbox storage for NAR records.
 *
 * A developer or acceptance machine has no immutable (WORM) blob store, so without this the audit proof cannot be created at
 * all and every route that needs one fails. This writes the sealed record to a local directory and says so: the reference
 * is typed `local_sandbox` and `immutable` is false. It is never a substitute for immutable storage and it refuses to run
 * unless every one of these holds: NAR_STORAGE_MODE=local_sandbox, QA_TEST_ENV=true, UE_ENVIRONMENT=local, NODE_ENV is not
 * production, and no production deployment signal is present. Anywhere else the setting is ignored and the Azure path is used.
 */
export function localSandboxEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const norm = (v: string | undefined) => (v ?? '').trim().toLowerCase()
  const production = [env.NODE_ENV, env.VERCEL_ENV, env.NZILA_DEPLOYMENT_TYPE, env.DEPLOYMENT_ENVIRONMENT, env.UE_ENVIRONMENT]
  return (
    norm(env.NAR_STORAGE_MODE) === 'local_sandbox' &&
    norm(env.QA_TEST_ENV) === 'true' &&
    norm(env.UE_ENVIRONMENT) === 'local' &&
    !production.some((v) => /^(prod|production)(\s|$)/.test(norm(v)))
  )
}

export async function writeNarToLocalSandbox(record: NarRecord, env: NodeJS.ProcessEnv = process.env): Promise<NarStorageRef> {
  if (!localSandboxEnabled(env)) throw new Error('NAR local sandbox storage is not enabled here')
  const dir = env.NAR_LOCAL_SANDBOX_DIR?.trim() || join(tmpdir(), 'nar-local-sandbox')
  const folder = join(dir, record.organizationId)
  await mkdir(folder, { recursive: true })
  const file = join(folder, `${record.id}.nar.json`)
  await writeFile(file, JSON.stringify(record), { encoding: 'utf8', flag: 'wx' })
  return {
    type: 'local_sandbox',
    uri: `file://${file.replace(/\\/g, '/')}`,
    immutable: false,
    retentionUntil: record.createdAt,
  }
}
