/**
 * Canadian Labour Standards — Overtime Rules by Jurisdiction
 *
 * Province-specific overtime thresholds, multipliers, and statutory references.
 * Note: BC, AB, SK, MB, YT, NT, NU have DAILY overtime in addition to weekly.
 *
 * @module canadian-labour-standards/overtime
 */

import type { OvertimeRule, CanadianJurisdiction } from './types';

export const OVERTIME_RULES: Record<CanadianJurisdiction, OvertimeRule> = {
  federal: {
    dailyThresholdHours: 8,
    weeklyThresholdHours: 40,
    multiplier: 1.5,
    statute: 'Canada Labour Code, Part III',
    article: 's. 174',
    notes: 'Modified work schedule may vary daily threshold',
  },
  ON: {
    dailyThresholdHours: null,
    weeklyThresholdHours: 44,
    multiplier: 1.5,
    statute: 'Employment Standards Act, 2000',
    article: 's. 22(1)',
    notes: 'No daily overtime. 44h weekly threshold is among the highest in Canada',
  },
  BC: {
    dailyThresholdHours: 8,
    weeklyThresholdHours: 40,
    multiplier: 1.5,
    statute: 'Employment Standards Act (BC)',
    article: 's. 40',
    notes: 'Double time (2×) after 12h/day. Unique daily + weekly OT structure',
  },
  AB: {
    dailyThresholdHours: 8,
    weeklyThresholdHours: 44,
    multiplier: 1.5,
    statute: 'Employment Standards Code (AB)',
    article: 's. 21',
    notes: 'Overtime on whichever is greater: daily or weekly',
  },
  SK: {
    dailyThresholdHours: 8,
    weeklyThresholdHours: 40,
    multiplier: 1.5,
    statute: 'Saskatchewan Employment Act',
    article: 's. 2-17',
    notes: 'Overtime on whichever is greater: daily or weekly',
  },
  MB: {
    dailyThresholdHours: 8,
    weeklyThresholdHours: 40,
    multiplier: 1.5,
    statute: 'Employment Standards Code (MB)',
    article: 's. 19',
    notes: 'Overtime on whichever is greater: daily or weekly',
  },
  NB: {
    dailyThresholdHours: null,
    weeklyThresholdHours: 44,
    multiplier: 1.5,
    statute: 'Employment Standards Act (NB)',
    article: 's. 14',
    notes: 'No daily overtime provision',
  },
  NS: {
    dailyThresholdHours: null,
    weeklyThresholdHours: 48,
    multiplier: 1.5,
    statute: 'Labour Standards Code (NS)',
    article: 's. 60',
    notes: 'Highest weekly threshold in Canada at 48 hours',
  },
  PE: {
    dailyThresholdHours: null,
    weeklyThresholdHours: 48,
    multiplier: 1.5,
    statute: 'Employment Standards Act (PE)',
    article: 's. 12',
    notes: 'Tied with NS for highest weekly threshold at 48 hours',
  },
  NL: {
    dailyThresholdHours: null,
    weeklyThresholdHours: 40,
    multiplier: 1.5,
    statute: 'Labour Standards Act (NL)',
    article: 's. 22',
    notes: 'No daily overtime provision',
  },
  QC: {
    dailyThresholdHours: null,
    weeklyThresholdHours: 40,
    multiplier: 1.5,
    statute: 'Loi sur les normes du travail (LNT)',
    article: 'art. 55',
    notes: 'No daily overtime. Some sectors have different hours (e.g. garment)',
  },
  YT: {
    dailyThresholdHours: 8,
    weeklyThresholdHours: 40,
    multiplier: 1.5,
    statute: 'Employment Standards Act (YT)',
    article: 's. 24',
    notes: 'Daily and weekly overtime; double time after 12h/day',
  },
  NT: {
    dailyThresholdHours: 8,
    weeklyThresholdHours: 40,
    multiplier: 1.5,
    statute: 'Employment Standards Act (NT)',
    article: 's. 13',
    notes: 'Daily and weekly overtime',
  },
  NU: {
    dailyThresholdHours: 8,
    weeklyThresholdHours: 40,
    multiplier: 1.5,
    statute: 'Labour Standards Act (NU)',
    article: 's. 13',
    notes: 'Daily and weekly overtime',
  },
};

/**
 * Calculate overtime pay for a given jurisdiction.
 *
 * @param jurisdiction Province/territory code
 * @param hoursWorkedDay Hours worked in the day (for daily OT jurisdictions)
 * @param hoursWorkedWeek Total hours worked in the week
 * @param hourlyRate Regular hourly rate
 * @returns Object with regular hours, OT hours, regular pay, OT pay, OT rate
 */
export function calculateOvertime(
  jurisdiction: CanadianJurisdiction,
  hoursWorkedDay: number,
  hoursWorkedWeek: number,
  hourlyRate: number,
): {
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  overtimeRate: number;
  statute: string;
  article: string;
} {
  const rule = OVERTIME_RULES[jurisdiction];
  let overtimeHours = 0;

  // Daily overtime (BC, AB, SK, MB, YT, NT, NU)
  if (rule.dailyThresholdHours !== null && hoursWorkedDay > rule.dailyThresholdHours) {
    overtimeHours = hoursWorkedDay - rule.dailyThresholdHours;
  }

  // Weekly overtime (all jurisdictions)
  const weeklyOT = Math.max(0, hoursWorkedWeek - rule.weeklyThresholdHours);

  // Use whichever is greater (avoid double-counting)
  overtimeHours = Math.max(overtimeHours, weeklyOT);

  const regularHours = Math.max(0, hoursWorkedDay - overtimeHours);
  const overtimeRate = hourlyRate * rule.multiplier;

  return {
    regularHours,
    overtimeHours,
    regularPay: regularHours * hourlyRate,
    overtimePay: overtimeHours * overtimeRate,
    overtimeRate,
    statute: rule.statute,
    article: rule.article,
  };
}

/**
 * BC double time: after 12h/day, rate goes to 2×.
 */
export function calculateBCOvertime(
  hoursWorkedDay: number,
  hoursWorkedWeek: number,
  hourlyRate: number,
): {
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  regularPay: number;
  overtimePay: number;
  doubleTimePay: number;
} {
  let regular = Math.min(hoursWorkedDay, 8);
  let ot = 0;
  let dt = 0;

  if (hoursWorkedDay > 12) {
    ot = 4; // 8–12
    dt = hoursWorkedDay - 12;
  } else if (hoursWorkedDay > 8) {
    ot = hoursWorkedDay - 8;
  }

  // Weekly OT still applies for total weekly hours > 40
  const weeklyOT = Math.max(0, hoursWorkedWeek - 40);
  if (weeklyOT > ot + dt) {
    // Weekly OT exceeds daily OT already counted
    const extra = weeklyOT - (ot + dt);
    ot += extra;
    regular = Math.max(0, regular - extra);
  }

  return {
    regularHours: regular,
    overtimeHours: ot,
    doubleTimeHours: dt,
    regularPay: regular * hourlyRate,
    overtimePay: ot * hourlyRate * 1.5,
    doubleTimePay: dt * hourlyRate * 2,
  };
}
