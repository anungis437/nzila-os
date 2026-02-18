/**
 * Nzila Business OS - Probabilistic Cardinality Estimators
 * 
 * Provides HyperLogLog-based estimators for counting unique entities
 * with minimal memory footprint. Useful for:
 * - Counting unique shareholders across entities
 * - Unique user tracking across platforms
 * - Entity deduplication in portfolio analytics
 * 
 * Based on HyperLogLog algorithm (Flajolet et al., 2007)
 * Error rate: ~2% with 12 bits per register (4096 registers)
 */

import { z } from 'zod'

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Precision levels for HyperLogLog
 * Higher precision = more accurate but more memory
 */
export enum CardinalityPrecision {
  LOW = 10,      // ~1024 registers, 4KB, ~10% error
  MEDIUM = 12,   // ~4096 registers, 12KB, ~5% error  
  HIGH = 14,     // ~16384 registers, 48KB, ~2% error
  ULTRA = 16,    // ~65536 registers, 192KB, ~1% error
}

const DEFAULT_PRECISION = CardinalityPrecision.MEDIUM

// ============================================================================
// TYPES
// ============================================================================

/**
 * Serialized HyperLogLog state for persistence
 */
export const HyperLogLogStateSchema = z.object({
  precision: z.number().int().min(6).max(16),
  registers: z.array(z.number().int().min(0)),
  count: z.number().int().nonnegative(),
})

export type HyperLogLogState = z.infer<typeof HyperLogLogStateSchema>

/**
 * Cardinality estimation result
 */
export const CardinalityEstimateSchema = z.object({
  estimate: z.number(),
  lowerBound: z.number(),
  upperBound: z.number(),
  precision: z.number(),
  standardError: z.number(),
})

export type CardinalityEstimate = z.infer<typeof CardinalityEstimateSchema>

/**
 * Merge result for combining multiple estimators
 */
export const MergeResultSchema = z.object({
  totalEstimate: z.number(),
  sources: z.array(z.object({
    sourceId: z.string(),
    estimate: z.number(),
  })),
})

export type MergeResult = z.infer<typeof MergeResultSchema>

// ============================================================================
// HASH FUNCTION (MURMUR3-based)
// ============================================================================

/**
 * Simple hash function for strings
 * Uses a simplified Murmur3-like approach
 */
function hash(item: string, seed: number = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  
  for (let i = 0; i < item.length; i++) {
    const char = item.charCodeAt(i)
    h1 = Math.imul(h1 ^ char, 2654435761)
    h2 = Math.imul(h2 ^ char, 1597334677)
  }
  
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

/**
 * Hash to get position and run of zeros
 */
function hashWithZeros(hash: number, precision: number): { position: number; runLength: number } {
  const mask = (1 << precision) - 1
  const position = hash & mask
  
  // Count leading zeros in the remaining bits
  const remainingBits = hash >>> precision
  let runLength = 0
  let testBit = 1
  
  while ((remainingBits & testBit) === 0 && runLength < 32) {
    runLength++
    testBit <<= 1
  }
  
  return { position, runLength }
}

// ============================================================================
// HYPERLOGLOG IMPLEMENTATION
// ============================================================================

/**
 * HyperLogLog cardinality estimator
 * 
 * Uses probabilistic counting to estimate the number of unique items
 * with constant memory usage regardless of input size.
 */
export class HyperLogLog {
  private precision: number
  private registers: number[]
  private itemCount: number = 0
  
  /**
   * Create a new HyperLogLog estimator
   * @param precision Number of bits for register indexing (default: MEDIUM = 12)
   */
  constructor(precision: number = DEFAULT_PRECISION) {
    if (precision < 6 || precision > 16) {
      throw new Error(`Precision must be between 6 and 16, got ${precision}`)
    }
    
    this.precision = precision
    const numRegisters = 1 << precision
    this.registers = new Array(numRegisters).fill(0)
  }
  
  /**
   * Add an item to the estimator
   * @param item String item to add
   */
  add(item: string): void {
    const hashValue = hashWithZeros(hash(item), this.precision)
    this.registers[hashValue.position] = Math.max(
      this.registers[hashValue.position],
      hashValue.runLength
    )
    this.itemCount++
  }
  
  /**
   * Add multiple items at once
   * @param items Array of items to add
   */
  addMany(items: string[]): void {
    for (const item of items) {
      this.add(item)
    }
  }
  
  /**
   * Estimate the cardinality (number of unique items)
   */
  count(): number {
    const numRegisters = 1 << this.precision
    const sum = this.registers.reduce((acc, val) => acc + Math.pow(2, -val), 0)
    const rawEstimate = (numRegisters * numRegisters) / sum
    
    // Apply correction for small counts
    if (rawEstimate < 2.5 * numRegisters) {
      // Use linear counting
      let zeroCount = 0
      for (const reg of this.registers) {
        if (reg === 0) zeroCount++
      }
      if (zeroCount > 0) {
        return Math.round(numRegisters * Math.log(numRegisters / zeroCount))
      }
    }
    
    // Apply correction for very large counts
    const alpha = 0.7213 / (1 + 1.079 / numRegisters)
    return Math.round(alpha * numRegisters * numRegisters / sum)
  }
  
  /**
   * Get detailed estimate with bounds
   */
  estimate(): CardinalityEstimate {
    const count = this.count()
    const standardError = 1.04 / Math.sqrt(1 << this.precision)
    
    return {
      estimate: count,
      lowerBound: Math.round(count * (1 - 2 * standardError)),
      upperBound: Math.round(count * (1 + 2 * standardError)),
      precision: this.precision,
      standardError,
    }
  }
  
  /**
   * Merge another HyperLogLog into this one
   * Both must have the same precision
   * @param other HyperLogLog to merge
   */
  merge(other: HyperLogLog): void {
    if (this.precision !== other.precision) {
      throw new Error(`Cannot merge HyperLogLog with different precision: ${other.precision} vs ${this.precision}`)
    }
    
    for (let i = 0; i < this.registers.length; i++) {
      this.registers[i] = Math.max(this.registers[i], other.registers[i])
    }
    
    this.itemCount += other.itemCount
  }
  
  /**
   * Export state for serialization
   */
  toJSON(): HyperLogLogState {
    return {
      precision: this.precision,
      registers: [...this.registers],
      count: this.itemCount,
    }
  }
  
  /**
   * Create HyperLogLog from serialized state
   */
  static fromJSON(state: HyperLogLogState): HyperLogLog {
    const hll = new HyperLogLog(state.precision)
    hll.registers = [...state.registers]
    hll.itemCount = state.count
    return hll
  }
  
  /**
   * Merge multiple estimators into one
   * @param estimators Array of HyperLogLog instances
   * @returns Merged estimator
   */
  static mergeAll(estimators: HyperLogLog[]): HyperLogLog {
    if (estimators.length === 0) {
      return new HyperLogLog()
    }
    
    const precision = estimators[0].precision
    const merged = new HyperLogLog(precision)
    
    for (const estimator of estimators) {
      merged.merge(estimator)
    }
    
    return merged
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create a new cardinality estimator
 */
export function createCardinalityEstimator(
  precision: CardinalityPrecision = CardinalityPrecision.MEDIUM
): HyperLogLog {
  return new HyperLogLog(precision)
}

/**
 * Estimate unique items from an array
 */
export function estimateUnique(
  items: string[],
  precision: CardinalityPrecision = CardinalityPrecision.MEDIUM
): CardinalityEstimate {
  const hll = new HyperLogLog(precision)
  hll.addMany(items)
  return hll.estimate()
}

/**
 * Estimate unique shareholders from shareholder records
 * Each shareholder is identified by name + email combination
 */
export interface ShareholderRecord {
  legalName: string
  email?: string
  personId?: string
}

/**
 * Estimate unique shareholders across multiple entities
 */
export function estimateUniqueShareholders(
  shareholders: ShareholderRecord[],
  precision: CardinalityPrecision = CardinalityPrecision.MEDIUM
): CardinalityEstimate {
  const identifiers = shareholders.map(s => 
    `${s.legalName}|${s.email || ''}|${s.personId || ''}`
  )
  return estimateUnique(identifiers, precision)
}

/**
 * Merge multiple entity-level estimators into portfolio-level estimate
 */
export function mergeEntityEstimators(
  entityEstimates: Array<{ entityId: string; hll: HyperLogLog }>
): MergeResult {
  const merged = HyperLogLog.mergeAll(entityEstimates.map(e => e.hll))
  
  return {
    totalEstimate: merged.count(),
    sources: entityEstimates.map(e => ({
      sourceId: e.entityId,
      estimate: e.hll.count(),
    })),
  }
}

// ============================================================================
// STATIC HLL (Pre-computed for common scenarios)
// ============================================================================

/**
 * Create a pre-initialized HyperLogLog for a specific entity
 * This can be stored in the database and updated incrementally
 */
export interface EntityCardinality {
  entityId: string
  hllState: HyperLogLogState
  lastUpdated: string
  itemType: 'shareholders' | 'members' | 'users' | 'contacts'
}

/**
 * Get or create cardinality tracker for an entity
 * Note: In production, this would interact with a database
 */
export function getEntityCardinalityTracker(
  entityId: string,
  itemType: EntityCardinality['itemType'],
  existingState?: HyperLogLogState
): HyperLogLog {
  if (existingState) {
    return HyperLogLog.fromJSON(existingState)
  }
  return new HyperLogLog()
}
