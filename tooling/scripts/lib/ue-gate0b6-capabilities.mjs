/**
 * Capability records created in Gate 0B.6. Each domain module names the capabilities it creates only when a classified
 * operation of the tranche is owned by it and no earlier capability can reasonably own the obligation. None claims
 * delivery: each records what the source does and what it lacks.
 */
import { CAPABILITY_RECORDS } from './ue-gate0b6-modules.mjs'

export const capabilitiesForTranche6 = (cap) => CAPABILITY_RECORDS.map((record) => cap(record))
