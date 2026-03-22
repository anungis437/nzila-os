/**
 * Capital Cost Allowance (CCA) Schedule Engine
 *
 * Implements ITA Regulation 1100 CCA computation:
 * - All major CCA classes with prescribed rates
 * - Half-year rule (ITA Reg 1100(2))
 * - Accelerated Investment Incentive Property (AIIP) — 2024+ rules
 * - UCC tracking (additions, dispositions, recapture, terminal loss)
 * - Short fiscal year proration
 * - Class pooling and disposition rules
 *
 * Feeds directly into T2 Schedule 8 (CCA).
 *
 * @module cfo/cca-schedule
 */

// ── CCA Classes (ITA Regulation, Schedule II) ───────────────────────────────

export interface CcaClass {
  /** Class number (1–55) */
  classNumber: number
  /** Prescribed CCA rate (decimal) */
  rate: number
  /** Description */
  description: string
  /** Declining balance (true) or straight-line (false) */
  decliningBalance: boolean
  /** Eligible for AIIP (Accelerated Investment Incentive Property) */
  aiipEligible: boolean
}

/**
 * Core CCA classes per ITA Schedule II and Reg 1100.
 * Covers the classes most commonly used by Canadian CCPCs.
 */
export const CCA_CLASSES: CcaClass[] = [
  { classNumber: 1, rate: 0.04, description: 'Buildings acquired after 1987', decliningBalance: true, aiipEligible: true },
  { classNumber: 3, rate: 0.05, description: 'Buildings acquired before 1988', decliningBalance: true, aiipEligible: false },
  { classNumber: 6, rate: 0.10, description: 'Frame/log/stucco buildings', decliningBalance: true, aiipEligible: true },
  { classNumber: 7, rate: 0.15, description: 'Canoes, boats, vessels', decliningBalance: true, aiipEligible: true },
  { classNumber: 8, rate: 0.20, description: 'Furniture, fixtures, equipment (general)', decliningBalance: true, aiipEligible: true },
  { classNumber: 10, rate: 0.30, description: 'Motor vehicles, automotive equipment', decliningBalance: true, aiipEligible: true },
  { classNumber: 10.1, rate: 0.30, description: 'Passenger vehicles >$37,000 (prescribed limit)', decliningBalance: true, aiipEligible: true },
  { classNumber: 12, rate: 1.00, description: 'Tools <$500, dishes, cutlery, linen, uniforms, dies, moulds', decliningBalance: true, aiipEligible: false },
  { classNumber: 13, rate: 0, description: 'Leasehold improvements (straight-line over lease term)', decliningBalance: false, aiipEligible: true },
  { classNumber: 14, rate: 0, description: 'Patents, franchises, licences (limited life, straight-line)', decliningBalance: false, aiipEligible: false },
  { classNumber: 14.1, rate: 0.05, description: 'Goodwill and other eligible capital property (post-2016)', decliningBalance: true, aiipEligible: true },
  { classNumber: 17, rate: 0.08, description: 'Roads, parking lots, sidewalks', decliningBalance: true, aiipEligible: true },
  { classNumber: 29, rate: 0.50, description: 'Manufacturing/processing M&P machinery (straight-line, 2 years)', decliningBalance: false, aiipEligible: false },
  { classNumber: 43, rate: 0.30, description: 'Manufacturing/processing M&P equipment', decliningBalance: true, aiipEligible: true },
  { classNumber: 43.1, rate: 0.30, description: 'Clean energy generation equipment', decliningBalance: true, aiipEligible: true },
  { classNumber: 43.2, rate: 0.50, description: 'Clean energy generation — enhanced rate', decliningBalance: true, aiipEligible: true },
  { classNumber: 44, rate: 0.25, description: 'Patents acquired after April 26, 1993', decliningBalance: true, aiipEligible: true },
  { classNumber: 45, rate: 0.45, description: 'Computer equipment acquired after March 22, 2004', decliningBalance: true, aiipEligible: true },
  { classNumber: 46, rate: 0.30, description: 'Data network infrastructure equipment', decliningBalance: true, aiipEligible: true },
  { classNumber: 50, rate: 0.55, description: 'Computer equipment acquired after January 2011', decliningBalance: true, aiipEligible: true },
  { classNumber: 52, rate: 1.00, description: 'General-purpose electronic data processing equipment (2013+)', decliningBalance: true, aiipEligible: false },
  { classNumber: 53, rate: 0.50, description: 'Manufacturing/processing M&P assets acquired after 2015', decliningBalance: true, aiipEligible: true },
  { classNumber: 54, rate: 0.30, description: 'Zero-emission vehicles — $61,000 limit (2024+)', decliningBalance: true, aiipEligible: true },
  { classNumber: 55, rate: 0.40, description: 'Zero-emission vehicles — no cost limit', decliningBalance: true, aiipEligible: true },
]

/**
 * Look up a CCA class by number.
 */
export function getCcaClass(classNumber: number): CcaClass | undefined {
  return CCA_CLASSES.find((c) => c.classNumber === classNumber)
}

// ── Asset & Pool tracking ───────────────────────────────────────────────────

export interface CcaAsset {
  /** Unique asset identifier */
  id: string
  /** CCA class number */
  classNumber: number
  /** Description */
  description: string
  /** Capital cost (original cost) */
  capitalCost: number
  /** Date acquired */
  dateAcquired: string
  /** Date disposed (null if still held) */
  dateDisposed?: string
  /** Proceeds of disposition (if disposed) */
  proceedsOfDisposition?: number
  /** Is this AIIP-eligible? */
  isAiip: boolean
}

export interface CcaPoolInput {
  /** CCA class number */
  classNumber: number
  /** UCC opening balance */
  uccOpeningBalance: number
  /** Additions during the year */
  additions: CcaAsset[]
  /** Dispositions during the year */
  dispositions: CcaAsset[]
  /** Is this a short fiscal year? If so, provide days in fiscal year */
  fiscalYearDays?: number
}

export interface CcaPoolResult {
  classNumber: number
  rate: number
  uccOpening: number
  additionsCost: number
  dispositionsLesser: number
  /** Net additions (before CCA) */
  netAdditions: number
  /** UCC before CCA */
  uccBeforeCca: number
  /** CCA on existing pool (UCC × rate, declining balance) */
  ccaOnPool: number
  /** CCA on net additions (AIIP: 1.5× rate; non-AIIP: 50% half-year rule) */
  ccaOnAdditions: number
  /** Total CCA claimed */
  totalCca: number
  /** UCC closing balance */
  uccClosing: number
  /** Recapture (negative = refund to income, ITA s.13(1)) */
  recapture: number
  /** Terminal loss (ITA s.20(16)) */
  terminalLoss: number
  /** Short year proration factor */
  prorationFactor: number
}

/**
 * Calculate CCA for a single class pool.
 *
 * Implements:
 * - Declining balance method (most classes)
 * - Half-year rule: 50% of net additions (ITA Reg 1100(2))
 * - AIIP: 1.5× the class rate on new additions (replacing half-year rule)
 * - Disposition: lesser of proceeds and capital cost
 * - Recapture: when disposition brings UCC below zero
 * - Terminal loss: when all assets disposed and UCC > 0
 */
export function calculateCcaPool(input: CcaPoolInput): CcaPoolResult {
  const ccaClass = getCcaClass(input.classNumber)
  const rate = ccaClass?.rate ?? 0
  const isDeclining = ccaClass?.decliningBalance ?? true

  // Short year proration
  const prorationFactor = input.fiscalYearDays
    ? input.fiscalYearDays / 365
    : 1

  // Additions cost
  const additionsCost = input.additions.reduce((s, a) => s + a.capitalCost, 0)

  // Dispositions: lesser of proceeds and capital cost (ITA s.13(21))
  const dispositionsLesser = input.dispositions.reduce((s, d) => {
    const proceeds = d.proceedsOfDisposition ?? 0
    return s + Math.min(proceeds, d.capitalCost)
  }, 0)

  const netAdditions = additionsCost - dispositionsLesser
  const uccBeforeCca = input.uccOpeningBalance + netAdditions

  // Handle recapture and terminal loss
  let recapture = 0
  let terminalLoss = 0

  if (uccBeforeCca < 0) {
    // Recapture: UCC goes negative = income inclusion
    recapture = Math.abs(uccBeforeCca)
    return {
      classNumber: input.classNumber,
      rate,
      uccOpening: input.uccOpeningBalance,
      additionsCost,
      dispositionsLesser,
      netAdditions,
      uccBeforeCca,
      ccaOnPool: 0,
      ccaOnAdditions: 0,
      totalCca: 0,
      uccClosing: 0,
      recapture,
      terminalLoss: 0,
      prorationFactor,
    }
  }

  // Terminal loss: all assets disposed and UCC > 0
  const allDisposed =
    input.dispositions.length > 0 &&
    additionsCost === 0 &&
    uccBeforeCca > 0 &&
    input.uccOpeningBalance > 0

  if (allDisposed) {
    terminalLoss = uccBeforeCca
    return {
      classNumber: input.classNumber,
      rate,
      uccOpening: input.uccOpeningBalance,
      additionsCost,
      dispositionsLesser,
      netAdditions,
      uccBeforeCca,
      ccaOnPool: 0,
      ccaOnAdditions: 0,
      totalCca: 0,
      uccClosing: 0,
      recapture: 0,
      terminalLoss,
      prorationFactor,
    }
  }

  if (!isDeclining) {
    // Straight-line classes (13, 14, 29): prorate over useful life
    const totalCca = Math.min(uccBeforeCca, additionsCost * rate * prorationFactor)
    return {
      classNumber: input.classNumber,
      rate,
      uccOpening: input.uccOpeningBalance,
      additionsCost,
      dispositionsLesser,
      netAdditions,
      uccBeforeCca,
      ccaOnPool: 0,
      ccaOnAdditions: totalCca,
      totalCca,
      uccClosing: uccBeforeCca - totalCca,
      recapture: 0,
      terminalLoss: 0,
      prorationFactor,
    }
  }

  // Declining balance CCA calculation

  // CCA on existing pool: UCC opening × rate (before additions)
  const poolBase = Math.max(0, input.uccOpeningBalance - dispositionsLesser)
  const ccaOnPool = poolBase * rate * prorationFactor

  // CCA on additions: AIIP vs half-year rule
  let ccaOnAdditions = 0
  if (additionsCost > 0) {
    const aiipAdditions = input.additions
      .filter((a) => a.isAiip)
      .reduce((s, a) => s + a.capitalCost, 0)
    const nonAiipAdditions = additionsCost - aiipAdditions

    // AIIP: 1.5× class rate (no half-year rule)
    const aiipCca = aiipAdditions * rate * 1.5 * prorationFactor
    // Non-AIIP: half-year rule (50% of additions × rate)
    const nonAiipCca = nonAiipAdditions * rate * 0.5 * prorationFactor

    ccaOnAdditions = aiipCca + nonAiipCca
  }

  const totalCca = Math.min(uccBeforeCca, ccaOnPool + ccaOnAdditions)
  const uccClosing = uccBeforeCca - totalCca

  return {
    classNumber: input.classNumber,
    rate,
    uccOpening: input.uccOpeningBalance,
    additionsCost,
    dispositionsLesser,
    netAdditions,
    uccBeforeCca,
    ccaOnPool,
    ccaOnAdditions,
    totalCca,
    uccClosing,
    recapture,
    terminalLoss,
    prorationFactor,
  }
}

// ── Schedule 8 (multi-class) ────────────────────────────────────────────────

export interface Schedule8Input {
  /** All class pools for the tax year */
  pools: CcaPoolInput[]
  /** Optional: maximum CCA to claim (can claim less than maximum) */
  maxClaimOverride?: number
}

export interface Schedule8Result {
  /** Results per class */
  pools: CcaPoolResult[]
  /** Total CCA claimed across all classes */
  totalCca: number
  /** Total recapture across all classes (income inclusion) */
  totalRecapture: number
  /** Total terminal losses across all classes (deduction) */
  totalTerminalLoss: number
  /** Net CCA deduction (CCA + terminal − recapture) */
  netCcaDeduction: number
}

/**
 * Calculate a complete Schedule 8 — CCA across all class pools.
 *
 * Returns per-pool results plus aggregate totals that feed into Schedule 1.
 */
export function calculateSchedule8(input: Schedule8Input): Schedule8Result {
  const pools = input.pools.map(calculateCcaPool)

  let totalCca = pools.reduce((s, p) => s + p.totalCca, 0)
  const totalRecapture = pools.reduce((s, p) => s + p.recapture, 0)
  const totalTerminalLoss = pools.reduce((s, p) => s + p.terminalLoss, 0)

  // Optional: limit to max claim override
  if (input.maxClaimOverride !== undefined) {
    totalCca = Math.min(totalCca, input.maxClaimOverride)
  }

  return {
    pools,
    totalCca,
    totalRecapture,
    totalTerminalLoss,
    netCcaDeduction: totalCca + totalTerminalLoss - totalRecapture,
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Calculate the tax shield value of an asset's CCA deductions.
 *
 * Uses the present-value declining-balance formula:
 *   PV = (C × d × t) / (d + r) × (1 + 1.5r) / (1 + r)
 * where:
 *   C = capital cost, d = CCA rate, t = tax rate, r = discount rate
 *
 * For AIIP property, factor is (1 + 1.5r)/(1+r) instead of (2+r)/(2(1+r))
 */
export function ccaTaxShield(params: {
  capitalCost: number
  ccaRate: number
  taxRate: number
  discountRate: number
  isAiip: boolean
}): number {
  const { capitalCost, ccaRate, taxRate, discountRate, isAiip } = params
  const base = (capitalCost * ccaRate * taxRate) / (ccaRate + discountRate)

  if (isAiip) {
    // AIIP: 1.5× first-year factor
    return base * (1 + 1.5 * discountRate) / (1 + discountRate)
  }
  // Half-year rule timing factor
  return base * (2 + discountRate) / (2 * (1 + discountRate))
}

/**
 * Get commonly-used CCA classes for quick reference.
 */
export function getCommonClasses(): CcaClass[] {
  return CCA_CLASSES.filter((c) =>
    [1, 8, 10, 10.1, 12, 14.1, 43, 45, 50, 53, 54].includes(c.classNumber),
  )
}
