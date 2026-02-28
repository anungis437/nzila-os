/**
 * Nzila OS — Data Lifecycle Manifest Engine
 *
 * Generates per-app data lifecycle manifests covering:
 *   - Data categories stored
 *   - Retention schedules
 *   - Deletion policy and verification method
 *   - Residency options (managed/sovereign/hybrid)
 *   - Backup posture (who/where/how)
 *
 * Manifests are used for procurement compliance, proof packs,
 * and regulatory evidence.
 *
 * @module @nzila/data-lifecycle
 */

export {
  generateAppManifest,
  generateAllManifests,
  validateManifest,
  APP_MANIFESTS,
  type DataLifecycleManifest,
  type DataCategory,
  type RetentionSchedule,
  type DeletionPolicy,
  type ResidencyOption,
  type BackupPosture,
} from './manifest'
