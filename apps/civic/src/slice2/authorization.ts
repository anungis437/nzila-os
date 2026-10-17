import { resolve } from 'node:path'
import {
  assertCivicSlice2Authorized,
  CIVIC_SLICE2_APPROVAL,
  validateCivicSlice2Admission,
} from '../../../../scripts/lib/civic-oci-doctrine'

export const repositoryRoot = resolve(__dirname, '..', '..', '..', '..')
export const storageDirectory = CIVIC_SLICE2_APPROVAL.storageDirectory
export const checkpointDirectory = CIVIC_SLICE2_APPROVAL.checkpointDirectory
export const adversarialDirectory = CIVIC_SLICE2_APPROVAL.adversarialDirectory
export const anchorDirectory = CIVIC_SLICE2_APPROVAL.anchorDirectory
export const authorizationCalls: { startedAt: string; elapsedMs: number; error: string | null }[] =
  []

export function authorizeRuntime(denyOnlyGrantFixture?: string): void {
  const start = Date.now()
  const call = {
    startedAt: new Date(start).toISOString(),
    elapsedMs: 0,
    error: null as string | null,
  }
  try {
    assertCivicSlice2Authorized(repositoryRoot)
    if (denyOnlyGrantFixture !== undefined) {
      if (!/^grant-(?:revoked|terminated|missing)-fixture-[0-9]+$/.test(denyOnlyGrantFixture))
        throw new Error('DENY_ONLY_GRANT_FIXTURE_PATH_INVALID')
      const root = resolve(adversarialDirectory, denyOnlyGrantFixture)
      const findings = validateCivicSlice2Admission(root, {
        now: new Date(),
        branch: 'SYN-DENY-ONLY-FIXTURE',
        worktree: root,
        descendsFromApprovedSha: false,
        changedPaths: [],
      })
      // A fixture may only add a denial; it can never authorize canonical runtime.
      throw new Error(
        `CIVIC_RUNTIME_SLICE_2_STOP_REQUIRED: DENY_ONLY_SYNTHETIC_GRANT_FIXTURE: ${
          findings.length ? JSON.stringify(findings) : 'FIXTURE_CANNOT_ADMIT'
        }`,
      )
    }
  } catch (error) {
    call.error = String(error)
    throw error
  } finally {
    call.elapsedMs = Date.now() - start
    authorizationCalls.push(call)
  }
}
