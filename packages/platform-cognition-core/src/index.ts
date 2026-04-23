/**
 * @nzila/platform-cognition-core — Public barrel
 *
 * Apps SHOULD import from the focused subpaths (`/memory`, `/trajectory`,
 * `/state`, `/consent`) rather than this barrel — the subpaths track Phase-2
 * boundary changes more precisely. The root barrel is provided for ergonomic
 * exploration and for the integration adapter.
 *
 * @module @nzila/platform-cognition-core
 */

// Types
export type {
  CognitionSubject,
  MemoryKind,
  MemorySource,
  MemoryEvent,
  MemoryRecallQuery,
  RecalledMemory,
  PreferenceValence,
  PreferenceProfile,
  TrajectoryRiskKind,
  TrajectoryFeatures,
  TrajectoryRiskScore,
  StateDimension,
  StateSignalInput,
  StateInference,
  ConsentZone,
  Jurisdiction,
  ConsentPolicy,
  ConsentGateResult,
  CognitionAdapterOptions,
} from './types'
export { COGNITION_ENGINE_VERSION } from './types'

// Schemas
export * from './schemas'

// Utils
export {
  nowISO,
  generateMemoryId,
  generateRiskScoreId,
  subjectKey,
  computeHash,
  daysBetween,
  clamp01,
  sigmoid,
} from './utils'

// Sub-engines (re-exported for ergonomic use)
export * as memory from './memory/index'
export * as trajectory from './trajectory/index'
export * as state from './state/index'
export * as consent from './consent/index'

// Integration adapter
export {
  riskScoreToSignal,
  riskScoresToSignals,
} from './integration/decision-engine-adapter'
