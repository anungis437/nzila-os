/**
 * Canadian Labour Standards — Jurisdictions List
 *
 * GET /api/labour-standards — list all 14 Canadian jurisdictions with summary data
 */
import { withApi } from '@/lib/api/with-api';
import {
  BREAK_RULES,
  OVERTIME_RULES,
  TERMINATION_NOTICE,
  STATUTORY_HOLIDAYS,
  WCB_BOARDS,
  LRB_BOARDS,
  ANTI_SCAB_PROVISIONS,
  PAY_EQUITY_REGIMES,
  type CanadianJurisdiction,
} from '@/lib/canadian-labour-standards';

export const dynamic = 'force-dynamic';

const JURISDICTION_NAMES: Record<CanadianJurisdiction, string> = {
  federal: 'Federal (Canada Labour Code)',
  AB: 'Alberta',
  BC: 'British Columbia',
  MB: 'Manitoba',
  NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador',
  NS: 'Nova Scotia',
  NT: 'Northwest Territories',
  NU: 'Nunavut',
  ON: 'Ontario',
  PE: 'Prince Edward Island',
  QC: 'Quebec',
  SK: 'Saskatchewan',
  YT: 'Yukon',
};

const ALL_JURISDICTIONS = Object.keys(JURISDICTION_NAMES) as CanadianJurisdiction[];

export const GET = withApi({
  auth: { required: false },
  openapi: {
    tags: ['Labour Standards'],
    summary: 'List all Canadian jurisdictions with labour standards summary',
  },
}, async () => {
  const jurisdictions = ALL_JURISDICTIONS.map((code) => ({
    code,
    name: JURISDICTION_NAMES[code],
    breakRulesCount: BREAK_RULES[code]?.length ?? 0,
    weeklyOvertimeThreshold: OVERTIME_RULES[code]?.weeklyThresholdHours ?? null,
    terminationNoticeTiers: TERMINATION_NOTICE[code]?.tiers.length ?? 0,
    statutoryHolidayCount: STATUTORY_HOLIDAYS[code]?.length ?? 0,
    wcbBoard: WCB_BOARDS[code]?.acronym ?? null,
    lrbBoard: LRB_BOARDS[code]?.acronym ?? null,
    hasAntiScab: ANTI_SCAB_PROVISIONS[code]?.hasAntiScab ?? false,
    hasPayEquityLegislation: PAY_EQUITY_REGIMES[code]?.hasProactivePayEquity ?? false,
  }));

  return jurisdictions;
});
