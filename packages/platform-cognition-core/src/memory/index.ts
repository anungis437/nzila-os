/**
 * @nzila/platform-cognition-core/memory — Barrel
 *
 * @module @nzila/platform-cognition-core/memory
 */
export {
  recordMemoryEvent,
  loadMemoryEvent,
  loadMemoryEvents,
  loadMemoryEventsRaw,
  redactMemoryEvent,
  redactSubject,
  purgeRedacted,
  setMemoryStoreRoot,
} from './store'
export type { MemoryEventInput } from './store'

export { recallMemories } from './recall'
export { exponentialDecay, linearDecay } from './decay'
export { computePreferenceProfile } from './preferences'
