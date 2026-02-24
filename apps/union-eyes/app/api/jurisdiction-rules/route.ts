import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth-guard';

const defaultRules = [
  {
    ruleName: 'Arbitration Deadline',
    ruleCategory: 'arbitration_deadline',
    legalReference: 'Default arbitration deadline',
    parameters: {
      deadline_days: 30,
    },
  },
];

async function handler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jurisdiction = searchParams.get('jurisdiction') || 'CA-FED';
    const category = searchParams.get('category');

    const rules = defaultRules.filter((rule) => {
      if (!category) return true;
      return rule.ruleCategory === category;
    });

    return NextResponse.json({
      success: true,
      jurisdiction,
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
