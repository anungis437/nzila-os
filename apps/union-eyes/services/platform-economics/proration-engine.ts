/**
 * Proration Engine
 *
 * Calculates pro-rated charges for mid-cycle subscription changes
 * (upgrades, downgrades, seat count changes).
 *
 * All amounts are in CAD. Proration uses daily granularity.
 *
 * @domain platform-economics
 * @layer 1.5 — Billing Lifecycle
 */

// ============================================================================
// Types
// ============================================================================

export interface ProrationInput {
  /** Date the change takes effect */
  changeDate: Date;
  /** Start of the current billing period */
  periodStart: Date;
  /** End of the current billing period */
  periodEnd: Date;
  /** Monthly amount BEFORE the change */
  previousAmountCad: string;
  /** Monthly amount AFTER the change */
  newAmountCad: string;
}

export interface ProrationResult {
  /** Credit for unused days on old plan */
  creditAmountCad: string;
  /** Charge for remaining days on new plan */
  chargeAmountCad: string;
  /** Net amount (positive = charge, negative = credit) */
  netAmountCad: string;
  /** Days remaining in the period */
  daysRemaining: number;
  /** Total days in the period */
  totalDays: number;
  /** Fraction of period remaining */
  fractionRemaining: string;
}

// ============================================================================
// Engine
// ============================================================================

/**
 * Calculate prorated credit/charge for a mid-cycle subscription change.
 *
 * Uses daily granularity:
 *   credit  = previousAmount × (daysRemaining / totalDays)
 *   charge  = newAmount      × (daysRemaining / totalDays)
 *   net     = charge − credit
 */
export function calculateProration(input: ProrationInput): ProrationResult {
  const periodStart = input.periodStart.getTime();
  const periodEnd = input.periodEnd.getTime();
  const changeDate = input.changeDate.getTime();

  if (changeDate < periodStart || changeDate > periodEnd) {
    throw new Error('Change date must be within billing period');
  }

  const MS_PER_DAY = 86_400_000;
  const totalDays = Math.round((periodEnd - periodStart) / MS_PER_DAY);
  const daysRemaining = Math.round((periodEnd - changeDate) / MS_PER_DAY);

  if (totalDays <= 0) {
    throw new Error('Invalid billing period: end must be after start');
  }

  const fraction = daysRemaining / totalDays;

  const prevAmount = Number(input.previousAmountCad);
  const newAmount = Number(input.newAmountCad);

  const credit = prevAmount * fraction;
  const charge = newAmount * fraction;
  const net = charge - credit;

  return {
    creditAmountCad: credit.toFixed(2),
    chargeAmountCad: charge.toFixed(2),
    netAmountCad: net.toFixed(2),
    daysRemaining,
    totalDays,
    fractionRemaining: fraction.toFixed(6),
  };
}

/**
 * Calculate prorated charge for adding seats mid-cycle.
 */
export function prorateSeats(
  seatDelta: number,
  perSeatFee: string,
  changeDate: Date,
  periodStart: Date,
  periodEnd: Date,
): ProrationResult {
  const monthlyCost = seatDelta * Number(perSeatFee);
  return calculateProration({
    changeDate,
    periodStart,
    periodEnd,
    previousAmountCad: '0',
    newAmountCad: monthlyCost.toFixed(2),
  });
}

/**
 * Calculate prorated charge for adding modules mid-cycle.
 */
export function prorateModules(
  moduleDelta: number,
  perModuleFee: string,
  changeDate: Date,
  periodStart: Date,
  periodEnd: Date,
): ProrationResult {
  const monthlyCost = moduleDelta * Number(perModuleFee);
  return calculateProration({
    changeDate,
    periodStart,
    periodEnd,
    previousAmountCad: '0',
    newAmountCad: monthlyCost.toFixed(2),
  });
}
