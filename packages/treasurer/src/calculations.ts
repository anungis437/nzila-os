/**
 * Deterministic personal-capital arithmetic.
 * Outputs keep the epistemic class of their inputs. Opportunity cost is
 * counterfactual and is never FACT.
 */
import {
  assertSafeInt,
  deriveEpistemicClass,
  fail,
  mulDivRound,
  ok,
  parseIsoDate,
  rationalToBps,
  type EpistemicClass,
  type Result,
} from './kernel'
import { scenarioSchema, type BenchmarkRef, type Scenario } from './schemas'

export interface AllocationWeight {
  readonly id: string
  readonly bps: number
}

export function allocateMinor(totalMinor: number, weights: readonly AllocationWeight[]): Result<readonly { id: string; minor: number }[]> {
  const total = assertSafeInt(totalMinor, 'allocation total must be an integer')
  if (!total.ok) return total
  if (total.value < 0) return fail('ILLOGICAL_QUANTITY', 'allocation total cannot be negative')
  if (weights.length === 0) return fail('MISSING_EVIDENCE', 'allocation weights are missing')
  let sum = 0
  for (const weight of weights) {
    const bps = assertSafeInt(weight.bps, 'weight must be integer basis points')
    if (!bps.ok) return bps
    if (bps.value < 0) return fail('ILLOGICAL_QUANTITY', `negative weight ${weight.id}`)
    sum += bps.value
  }
  if (sum !== 10_000) return fail('MALFORMED', `weights sum to ${sum}, not 10000`)
  const floors = weights.map((weight) => {
    const raw = total.value * weight.bps
    return { id: weight.id, floor: Math.floor(raw / 10_000), remainder: raw % 10_000 }
  })
  let leftover = total.value - floors.reduce((acc, row) => acc + row.floor, 0)
  const ranked = [...floors].sort((a, b) => b.remainder - a.remainder || a.id.localeCompare(b.id))
  const assigned = new Map(floors.map((row) => [row.id, row.floor]))
  for (const row of ranked) {
    if (leftover <= 0) break
    assigned.set(row.id, (assigned.get(row.id) ?? 0) + 1)
    leftover -= 1
  }
  return ok(weights.map((weight) => ({ id: weight.id, minor: assigned.get(weight.id) ?? 0 })))
}

export function holdingPeriodReturnBps(startMinor: number, endMinor: number): Result<number> {
  const start = assertSafeInt(startMinor, 'start value must be an integer')
  if (!start.ok) return start
  const end = assertSafeInt(endMinor, 'end value must be an integer')
  if (!end.ok) return end
  if (start.value <= 0) return fail('ILLOGICAL_QUANTITY', 'return base must be positive')
  if (end.value < 0) return fail('ILLOGICAL_QUANTITY', 'end value cannot be negative')
  return rationalToBps(end.value - start.value, start.value)
}

export function benchmarkExcess(input: {
  portfolioReturnBps: number
  portfolioClass: EpistemicClass
  portfolioPeriodStart: string
  portfolioPeriodEnd: string
  portfolioCurrency: string
  benchmark: BenchmarkRef
}): Result<{ readonly excessBps: number; readonly epistemicClass: EpistemicClass }> {
  const portfolioReturn = assertSafeInt(input.portfolioReturnBps, 'portfolio return must be integer bps')
  if (!portfolioReturn.ok) return portfolioReturn
  const benchmarkReturn = assertSafeInt(input.benchmark.returnBps, 'benchmark return must be integer bps')
  if (!benchmarkReturn.ok) return benchmarkReturn
  const start = parseIsoDate(input.portfolioPeriodStart)
  if (!start.ok) return start
  const end = parseIsoDate(input.portfolioPeriodEnd)
  if (!end.ok) return end
  const benchStart = parseIsoDate(input.benchmark.periodStart)
  if (!benchStart.ok) return benchStart
  const benchEnd = parseIsoDate(input.benchmark.periodEnd)
  if (!benchEnd.ok) return benchEnd
  if (input.portfolioPeriodStart !== input.benchmark.periodStart || input.portfolioPeriodEnd !== input.benchmark.periodEnd) {
    return fail('CONTRADICTORY_EVIDENCE', 'benchmark period does not match the portfolio period')
  }
  if (input.portfolioPeriodEnd < input.portfolioPeriodStart) return fail('INVALID_DATE', 'period ends before it starts')
  if (input.portfolioCurrency !== input.benchmark.currency) {
    return fail('INCONSISTENT_CURRENCY', 'benchmark currency does not match')
  }
  const epistemic = deriveEpistemicClass([input.portfolioClass, input.benchmark.epistemicClass])
  if (!epistemic.ok) return epistemic
  return ok({ excessBps: portfolioReturn.value - benchmarkReturn.value, epistemicClass: epistemic.value })
}

export function opportunityCostBps(input: {
  chosenReturnBps: number
  chosenClass: EpistemicClass
  alternativeReturnBps: number
  alternativeClass: EpistemicClass
}): Result<{ readonly costBps: number; readonly epistemicClass: EpistemicClass }> {
  const chosen = assertSafeInt(input.chosenReturnBps, 'chosen return must be integer bps')
  if (!chosen.ok) return chosen
  const alternative = assertSafeInt(input.alternativeReturnBps, 'alternative return must be integer bps')
  if (!alternative.ok) return alternative
  const epistemic = deriveEpistemicClass([input.chosenClass, input.alternativeClass], { counterfactual: true })
  if (!epistemic.ok) return epistemic
  if (epistemic.value === 'FACT') {
    return fail('EPISTEMIC_CONFLATION', 'opportunity cost is counterfactual and cannot be FACT')
  }
  return ok({ costBps: alternative.value - chosen.value, epistemicClass: epistemic.value })
}

export function maxDrawdownBps(values: readonly number[]): Result<number> {
  if (values.length === 0) return fail('MISSING_EVIDENCE', 'drawdown series is empty')
  let peak = 0
  let worst = 0
  for (const value of values) {
    const point = assertSafeInt(value, 'drawdown point must be an integer')
    if (!point.ok) return point
    if (point.value < 0) return fail('ILLOGICAL_QUANTITY', 'drawdown series cannot contain negative value')
    if (point.value > peak) peak = point.value
    if (peak === 0) return fail('ILLOGICAL_QUANTITY', 'drawdown peak is zero')
    const drawdown = mulDivRound(point.value - peak, 10_000, peak)
    if (!drawdown.ok) return drawdown
    if (drawdown.value < worst) worst = drawdown.value
  }
  return ok(worst)
}

export function envelopeUnreleased(ceilingMinor: number, releasedMinor: number): Result<number> {
  const ceiling = assertSafeInt(ceilingMinor, 'ceiling must be an integer')
  if (!ceiling.ok) return ceiling
  const released = assertSafeInt(releasedMinor, 'released capital must be an integer')
  if (!released.ok) return released
  if (ceiling.value < 0 || released.value < 0) return fail('ILLOGICAL_QUANTITY', 'envelope amounts cannot be negative')
  if (released.value > ceiling.value) return fail('FAIL_CLOSED', 'released capital exceeds the envelope ceiling')
  return ok(ceiling.value - released.value)
}

export function acceptScenarioForDecision(input: unknown): Result<Scenario> {
  const parsed = scenarioSchema.safeParse(input)
  if (!parsed.success) return fail('MALFORMED', 'scenario is malformed')
  if (parsed.data.epistemicClass !== 'SCENARIO') {
    return fail('EPISTEMIC_CONFLATION', 'scenario cannot be classified as fact')
  }
  if (!parsed.data.includesFailedPaths || parsed.data.droppedPathIds.length > 0) {
    return fail('SURVIVORSHIP_BIAS', 'scenario drops failed paths and cannot support a decision')
  }
  return ok(parsed.data)
}

export function applyScenario(startMinor: number, scenario: Scenario): Result<{ readonly endMinor: number; readonly epistemicClass: 'SCENARIO' }> {
  const start = assertSafeInt(startMinor, 'scenario base must be an integer')
  if (!start.ok) return start
  if (start.value < 0) return fail('ILLOGICAL_QUANTITY', 'scenario base cannot be negative')
  const delta = mulDivRound(start.value, scenario.returnBps, 10_000)
  if (!delta.ok) return delta
  const end = start.value + delta.value
  if (!Number.isSafeInteger(end) || end < 0) return fail('ILLOGICAL_QUANTITY', 'scenario end value is not a usable amount')
  return ok({ endMinor: end, epistemicClass: 'SCENARIO' })
}
