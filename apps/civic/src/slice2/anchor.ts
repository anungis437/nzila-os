import { readFileSync, writeFileSync } from 'node:fs'
import { authorizeRuntime, anchorDirectory } from './authorization'
import {
  boundedPath,
  canonical,
  digest,
  Slice2Store,
  type Principal,
  type Checkpoint,
} from './store'
import { reject } from '../slice1/model'

export interface Anchor {
  schemaVersion: 2
  proofId: string
  scenarioId: string
  orgId: string
  position: number
  previousDigest: string | null
  journalSequence: number
  journalHeadDigest: string
  stateDigest: string
  authoritySnapshotDigest: string
  checkpointDigest: string
  createdAt: string
  custodian: 'Aubert Nungisa'
  classification: 'LOCAL_SYNTHETIC_PROOF_ARTIFACT'
}
export interface TrustedPin {
  schemaVersion: 2
  orgId: string
  expectedDigest: string
  minimumPosition: number
  minimumSequence: number
}
export function publishAnchor(
  checkpoint: Checkpoint,
  name: string,
  proofId: string,
  previous?: Anchor,
) {
  authorizeRuntime()
  if (
    !/^SYN-[A-Z0-9-]+$/.test(proofId) ||
    (previous &&
      (previous.orgId !== checkpoint.orgId || previous.journalSequence >= checkpoint.sequence))
  )
    reject('ANCHOR_INVALID', 'Invalid monotonic anchor publication')
  const anchor: Anchor = {
    schemaVersion: 2,
    proofId,
    scenarioId: checkpoint.scenarioId,
    orgId: checkpoint.orgId,
    position: (previous?.position ?? 0) + 1,
    previousDigest: previous ? digest(previous) : null,
    journalSequence: checkpoint.sequence,
    journalHeadDigest: checkpoint.headDigest,
    stateDigest: checkpoint.stateDigest,
    authoritySnapshotDigest: checkpoint.authoritySnapshotDigest,
    checkpointDigest: digest(checkpoint),
    createdAt: new Date().toISOString(),
    custodian: 'Aubert Nungisa',
    classification: 'LOCAL_SYNTHETIC_PROOF_ARTIFACT',
  }
  const pin: TrustedPin = {
    schemaVersion: 2,
    orgId: anchor.orgId,
    expectedDigest: digest(anchor),
    minimumPosition: anchor.position,
    minimumSequence: anchor.journalSequence,
  }
  writeFileSync(boundedPath(anchorDirectory, `${name}-receipt.json`), canonical(anchor) + '\n', {
    flag: 'wx',
  })
  writeFileSync(boundedPath(anchorDirectory, `${name}-trusted-pin.json`), canonical(pin) + '\n', {
    flag: 'wx',
  })
  return { anchor, pin }
}
export function trustedPin(name: string): TrustedPin {
  authorizeRuntime()
  return JSON.parse(readFileSync(boundedPath(anchorDirectory, `${name}-trusted-pin.json`), 'utf8'))
}
export function verifyAnchor(
  store: Slice2Store,
  principal: Principal,
  checkpoint: Checkpoint,
  anchor: Anchor,
  pin: TrustedPin,
) {
  authorizeRuntime()
  if (
    pin.schemaVersion !== 2 ||
    anchor.schemaVersion !== 2 ||
    anchor.orgId !== principal.orgId ||
    pin.orgId !== principal.orgId ||
    anchor.position < pin.minimumPosition ||
    anchor.journalSequence < pin.minimumSequence
  )
    reject('STALE_ANCHOR', 'Foreign or stale custody-bound position')
  if (
    digest(anchor) !== pin.expectedDigest ||
    anchor.checkpointDigest !== digest(checkpoint) ||
    anchor.classification !== 'LOCAL_SYNTHETIC_PROOF_ARTIFACT' ||
    anchor.custodian !== 'Aubert Nungisa' ||
    anchor.scenarioId !== checkpoint.scenarioId ||
    anchor.journalSequence !== checkpoint.sequence ||
    anchor.journalHeadDigest !== checkpoint.headDigest ||
    anchor.stateDigest !== checkpoint.stateDigest ||
    anchor.authoritySnapshotDigest !== checkpoint.authoritySnapshotDigest
  )
    reject('INTEGRITY_FAILED', 'Independent custody anchor mismatch')
  store.verifyCheckpoint(principal, checkpoint)
  const read = store.read(principal)
  return {
    status:
      read.version > anchor.journalSequence
        ? ('UNANCHORED_PENDING_REVIEW' as const)
        : ('ANCHORED_PREFIX_VERIFIED' as const),
    anchoredThrough: anchor.journalSequence,
    observedThrough: read.version,
    reconciliation: 'HUMAN_REVIEW_REQUIRED_NO_AUTOMATIC_PUBLICATION',
  }
}
