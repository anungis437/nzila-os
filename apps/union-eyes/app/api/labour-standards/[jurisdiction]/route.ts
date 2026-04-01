/**
 * Canadian Labour Standards — Jurisdiction Profile
 *
 * GET /api/labour-standards/[jurisdiction] — full profile for a single jurisdiction
 *
 * Includes: break rules, overtime, termination notice, statutory holidays,
 * WCB board, LRB board, anti-scab provisions, pay equity regime.
 */
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
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

const ESA_NAMES: Record<CanadianJurisdiction, string> = {
  federal: 'Canada Labour Code',
  AB: 'Employment Standards Code',
  BC: 'Employment Standards Act',
  MB: 'Employment Standards Code',
  NB: 'Employment Standards Act',
  NL: 'Labour Standards Act',
  NS: 'Labour Standards Code',
  NT: 'Employment Standards Act',
  NU: 'Labour Standards Act',
  ON: 'Employment Standards Act, 2000',
  PE: 'Employment Standards Act',
  QC: 'Loi sur les normes du travail',
  SK: 'Saskatchewan Employment Act',
  YT: 'Employment Standards Act',
};

const VALID_JURISDICTIONS = new Set<string>(Object.keys(JURISDICTION_NAMES));

export const GET = withApi({
  auth: { required: false },
  openapi: {
    tags: ['Labour Standards'],
    summary: 'Get full labour standards profile for a Canadian jurisdiction',
  },
}, async ({ params }) => {
  const code = params.jurisdiction?.toUpperCase() === 'FEDERAL'
    ? 'federal'
    : params.jurisdiction?.toUpperCase();

  if (!code || !VALID_JURISDICTIONS.has(code)) {
    throw ApiError.badRequest(
      `Invalid jurisdiction: "${params.jurisdiction}". Valid values: ${[...VALID_JURISDICTIONS].join(', ')}`,
    );
  }

  const jurisdiction = code as CanadianJurisdiction;

  const profile = {
    code: jurisdiction,
    name: JURISDICTION_NAMES[jurisdiction],
    employmentStandardsAct: ESA_NAMES[jurisdiction],
    breakRules: BREAK_RULES[jurisdiction] ?? [],
    overtimeRule: OVERTIME_RULES[jurisdiction],
    terminationNotice: TERMINATION_NOTICE[jurisdiction],
    statutoryHolidays: STATUTORY_HOLIDAYS[jurisdiction] ?? [],
    workersCompBoard: WCB_BOARDS[jurisdiction],
    labourRelationsBoard: LRB_BOARDS[jurisdiction],
    antiScab: ANTI_SCAB_PROVISIONS[jurisdiction],
    payEquity: PAY_EQUITY_REGIMES[jurisdiction],
    minimumWage: { hourly: 0, effectiveDate: 'varies' }, // populated by live data
  };

  return profile;
});
