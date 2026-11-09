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
  type CanadianJurisdiction,
} from '@/lib/canadian-labour-standards';
import { resolveStatutoryRules } from '@/lib/canadian-labour-standards/rule-resolver';

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
}, async ({ params, request }) => {
  const code = params.jurisdiction?.toUpperCase() === 'FEDERAL'
    ? 'federal'
    : params.jurisdiction?.toUpperCase();

  if (!code || !VALID_JURISDICTIONS.has(code)) {
    throw ApiError.badRequest(
      `Invalid jurisdiction: "${params.jurisdiction}". Valid values: ${[...VALID_JURISDICTIONS].join(', ')}`,
    );
  }

  const jurisdiction = code as CanadianJurisdiction;
  const eventDateRaw = new URL(request.url).searchParams.get('eventDate');
  const eventDate = eventDateRaw ? new Date(eventDateRaw) : new Date();
  if (Number.isNaN(eventDate.getTime())) throw ApiError.badRequest('eventDate must be a valid date');
  const resolved = await resolveStatutoryRules(jurisdiction, eventDate);
  if (resolved.status === 'unknown') {
    return {
      code: jurisdiction,
      name: JURISDICTION_NAMES[jurisdiction],
      eventDate: eventDate.toISOString(),
      ruleStatus: 'unknown' as const,
      reason: resolved.reason,
      rules: [],
      minimumWage: null,
      minimumWageStatus: 'not_published' as const,
    };
  }

  const profile = {
    code: jurisdiction,
    name: JURISDICTION_NAMES[jurisdiction],
    employmentStandardsAct: ESA_NAMES[jurisdiction],
    eventDate: eventDate.toISOString(),
    ruleStatus: 'governed' as const,
    rules: resolved.rules,
    // No source of minimum wage rates is wired in, so none is published: a zero hourly rate reads as a real rate. Consumers get an
    // explicit null with the reason instead.
    minimumWage: null,
    minimumWageStatus: 'not_published' as const,
  };

  return profile;
});
