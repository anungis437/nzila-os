import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth-guard';
import { type CanadianJurisdiction } from '@/lib/canadian-labour-standards';
import { resolveStatutoryRules } from '@/lib/canadian-labour-standards/rule-resolver';

/** Map jurisdiction code from ISO-style "CA-XX" to our module's format */
export const RULE_CATEGORIES = ['workers_compensation_board_reference', 'break_rule', 'overtime', 'termination_notice'] as const;

/** Returns null for anything that is not an own key of the table, so inherited names such as `constructor` are refused. */
export function parseJurisdictionCode(code: string): CanadianJurisdiction | null {
  const mapping: Record<string, CanadianJurisdiction> = {
    'CA-FED': 'federal', 'CA-AB': 'AB', 'CA-BC': 'BC', 'CA-MB': 'MB',
    'CA-NB': 'NB', 'CA-NL': 'NL', 'CA-NS': 'NS', 'CA-NT': 'NT',
    'CA-NU': 'NU', 'CA-ON': 'ON', 'CA-PE': 'PE', 'CA-QC': 'QC',
    'CA-SK': 'SK', 'CA-YT': 'YT',
  };
  return Object.prototype.hasOwnProperty.call(mapping, code) ? mapping[code] : null;
}

async function handler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jurisdictionParam = searchParams.get('jurisdiction') || 'CA-FED';
    const category = searchParams.get('category');
    const eventDateRaw = searchParams.get('eventDate');
    const eventDate = eventDateRaw ? new Date(eventDateRaw) : new Date();

    const jur = parseJurisdictionCode(jurisdictionParam);
    if (!jur) {
      return NextResponse.json({ success: false, error: 'Unknown jurisdiction code', code: 'INVALID_JURISDICTION' }, { status: 400 });
    }
    if (category && !(RULE_CATEGORIES as readonly string[]).includes(category)) {
      return NextResponse.json({ success: false, error: 'Unknown rule category', code: 'INVALID_CATEGORY', allowed: RULE_CATEGORIES }, { status: 400 });
    }
    if (Number.isNaN(eventDate.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid eventDate', code: 'INVALID_EVENT_DATE' }, { status: 400 });
    }
    const resolved = await resolveStatutoryRules(jur, eventDate, category ?? undefined);
    if (resolved.status === 'unknown') {
      return NextResponse.json({ success: true, jurisdiction: jurisdictionParam, eventDate: eventDate.toISOString(), ruleStatus: 'unknown', reason: resolved.reason, data: [] });
    }
    const rules = resolved.rules.map((rule) => ({
      ruleName: String(rule.payload.name ?? rule.ruleKey),
      ruleCategory: rule.category,
      legalReference: null,
      parameters: rule.payload,
      version: rule.version,
      source: rule.source,
      effectiveFrom: rule.effectiveFrom,
      effectiveUntil: rule.effectiveUntil,
    }));

    return NextResponse.json({
      success: true,
      jurisdiction: jurisdictionParam,
      eventDate: eventDate.toISOString(),
      ruleStatus: 'governed',
      data: rules,
    });
  } catch (_error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch jurisdiction rules' },
      { status: 500 }
    );
  }
}

export const GET = withApiAuth(handler);
