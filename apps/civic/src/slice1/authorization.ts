import { resolve } from 'node:path'
import {
  assertCivicSlice1Authorized,
  CIVIC_SLICE1_APPROVAL,
} from '../../../../scripts/lib/civic-oci-doctrine'

export const repositoryRoot = resolve(__dirname, '..', '..', '..', '..')
export const storageDirectory = CIVIC_SLICE1_APPROVAL.storageDirectory
export const checkpointDirectory = CIVIC_SLICE1_APPROVAL.checkpointDirectory

export function authorizeRuntime(): void {
  assertCivicSlice1Authorized(repositoryRoot)
}
