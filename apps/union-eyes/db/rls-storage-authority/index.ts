/**
 * db/rls-storage-authority/index.ts
 *
 * Composes the domain-partitioned entry modules into the ONE canonical
 * `storageAuthorityManifest` array — see types.ts for the full doctrine.
 * Composition order is fixed and alphabetical by module name (not
 * semantically meaningful; the registry is consumed as a Map/array keyed
 * by `table`, never by position) so re-running this file never changes
 * which entries exist, only reproduces the same array deterministically.
 *
 * Do NOT hand-maintain a second table list anywhere downstream (grant
 * generation, census generation, verifiers, migration tooling) — every
 * consumer must import `storageAuthorityManifest` from here (or from the
 * db/rls-storage-authority-manifest.ts compatibility facade, which
 * re-exports this file unchanged).
 */
import type { StorageAuthorityEntry } from './types'
import { analyticsAiEntries } from './analytics-ai'
import { baseline0108Entries } from './baseline-0108'
import { claimsContinuityEntries } from './claims-continuity'
import { communicationsNotificationsEntries } from './communications-notifications'
import { documentsEvidenceEntries } from './documents-evidence'
import { financeEntries } from './finance'
import { governanceEntries } from './governance'
import { healthSafetyEntries } from './health-safety'
import { integrationsWorkersEntries } from './integrations-workers'
import { organizationsMembershipEntries } from './organizations-membership'
import { referenceLatentEntries } from './reference-latent'

export * from './types'

export const storageAuthorityManifest: StorageAuthorityEntry[] = [
  ...analyticsAiEntries,
  ...baseline0108Entries,
  ...claimsContinuityEntries,
  ...communicationsNotificationsEntries,
  ...documentsEvidenceEntries,
  ...financeEntries,
  ...governanceEntries,
  ...healthSafetyEntries,
  ...integrationsWorkersEntries,
  ...organizationsMembershipEntries,
  ...referenceLatentEntries,
]
