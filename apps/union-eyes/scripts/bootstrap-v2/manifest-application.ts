import { proveCurrentApplicationStartup, type ApplicationStartupProof } from './backend-application'
import { producerBytes } from './manifest-trace'
import { currentBackendSourceDigests, type V2Plan } from './source'

const helpers = [
  'apps/union-eyes/scripts/bootstrap-v2/backend-application.ts',
  'apps/union-eyes/scripts/bootstrap-v2/manifest-application.ts',
  'apps/union-eyes/scripts/bootstrap-v2/current_application.py',
  'apps/union-eyes/scripts/bootstrap-v2/source.ts',
]

export function bindApplicationStartupSources(plan: V2Plan): V2Plan {
  const sourceCommitments = { ...plan.sourceCommitments }
  for (const [file, digest] of Object.entries({
    ...currentBackendSourceDigests(),
    ...Object.fromEntries(helpers.map((file) => [file, producerBytes(file)])),
  }))
    sourceCommitments[file] ??= digest
  return { ...plan, sourceCommitments }
}

export function qualifyApplicationStartup(
  plan: V2Plan,
  wheelhouse?: string,
):
  | ApplicationStartupProof
  | {
      startup: 'NOT_PROVEN'
      runtimeDatabaseQualification: 'NOT_PROVEN'
      reason: 'UE_V2_WHEELHOUSE_REQUIRED'
    } {
  if (!wheelhouse)
    return {
      startup: 'NOT_PROVEN',
      runtimeDatabaseQualification: 'NOT_PROVEN',
      reason: 'UE_V2_WHEELHOUSE_REQUIRED',
    }
  const before = Object.fromEntries(helpers.map((file) => [file, producerBytes(file)]))
  const proof = proveCurrentApplicationStartup(wheelhouse)
  for (const file of helpers)
    if (before[file] !== producerBytes(file))
      throw new Error(`UE_V2_STARTUP_HELPER_CHANGED_DURING_PROOF:${file}`)
  for (const [file, digest] of Object.entries({ ...before, ...proof.sourceDigests }))
    if (!plan.sourceCommitments[file]) throw new Error(`UE_V2_STARTUP_SOURCE_NOT_BOUND:${file}`)
    else if (plan.sourceCommitments[file] !== digest)
      throw new Error(`UE_V2_STARTUP_SOURCE_CHANGED_SINCE_PLAN:${file}`)
  return proof
}
