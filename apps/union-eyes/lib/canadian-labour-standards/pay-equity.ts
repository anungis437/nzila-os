/**
 * Canadian Labour Standards — Pay Equity Regimes
 *
 * Pay equity legislation varies significantly across Canada.
 * Federal, QC, and ON have proactive pay equity (employers must proactively
 * audit and correct gender-based pay gaps). Other provinces have complaint-based
 * or no specific pay equity framework.
 *
 * @module canadian-labour-standards/pay-equity
 */

import type { PayEquityRegime, CanadianJurisdiction } from './types';

export const PAY_EQUITY_REGIMES: Record<CanadianJurisdiction, PayEquityRegime> = {
  federal: {
    hasProactivePayEquity: true,
    statute: 'Pay Equity Act (Federal)',
    administeredBy: 'Pay Equity Commissioner (Canadian Human Rights Commission)',
    description:
      'Proactive pay equity regime. Employers with 10+ employees must establish a pay equity plan ' +
      'within 3 years, update every 5 years. Enacted 2018, in force 2021.',
    threshold: 10,
  },
  QC: {
    hasProactivePayEquity: true,
    statute: 'Loi sur l\'équité salariale',
    administeredBy: 'CNESST (Commission des normes)',
    description:
      'Proactive pay equity since 1996. Employers with 10+ employees must achieve pay equity within 4 years ' +
      'of reaching threshold. Maintenance audit every 5 years. Penalties for non-compliance.',
    threshold: 10,
  },
  ON: {
    hasProactivePayEquity: true,
    statute: 'Pay Equity Act, 1987',
    administeredBy: 'Pay Equity Commission of Ontario',
    description:
      'Proactive pay equity for public sector (all sizes) and private sector (10+ employees). ' +
      'Employers must achieve and maintain pay equity. Review Tribunal handles disputes.',
    threshold: 10,
  },
  BC: {
    hasProactivePayEquity: true,
    statute: 'Pay Transparency Act (2023)',
    administeredBy: 'Ministry of Labour',
    description:
      'Pay Transparency Act (2023) requires pay ranges in job postings and pay transparency reports. ' +
      'Not full proactive pay equity but moves toward transparency. Human Rights Code prohibits discriminatory pay.',
    threshold: 0,
  },
  MB: {
    hasProactivePayEquity: true,
    statute: 'Pay Equity Act (Manitoba)',
    administeredBy: 'Pay Equity Bureau',
    description:
      'Proactive pay equity for public sector and broader public sector. ' +
      'Private sector covered through complaint-based human rights process.',
    threshold: 0,
    notes: 'Public sector proactive; private sector complaint-based.',
  },
  NS: {
    hasProactivePayEquity: true,
    statute: 'Pay Equity Act (Nova Scotia)',
    administeredBy: 'Pay Equity Commission',
    description:
      'Proactive pay equity for public sector employers (civil service, Crown agencies, municipalities, ' +
      'school boards, health authorities). Private sector covered under Human Rights Act.',
    threshold: 0,
    notes: 'Public sector proactive; private sector complaint-based.',
  },
  PE: {
    hasProactivePayEquity: true,
    statute: 'Pay Equity Act (PEI)',
    administeredBy: 'Employment Standards Board',
    description:
      'Proactive pay equity for public sector (Crown corporations, civil service). ' +
      'Private sector covered under Human Rights Act complaint process.',
    threshold: 0,
    notes: 'Public sector proactive; private sector complaint-based.',
  },
  NB: {
    hasProactivePayEquity: true,
    statute: 'Pay Equity Act (New Brunswick)',
    administeredBy: 'Employment Standards Tribunal',
    description:
      'Proactive pay equity for public sector employers (parts of the civil service). ' +
      'Private sector covered under Human Rights Act.',
    threshold: 0,
    notes: 'Limited to parts of public sector.',
  },
  AB: {
    hasProactivePayEquity: false,
    statute: 'Alberta Human Rights Act',
    administeredBy: 'Alberta Human Rights Commission',
    description:
      'No proactive pay equity legislation. Pay discrimination complaints handled under ' +
      'Alberta Human Rights Act (equal pay for equal work).',
  },
  SK: {
    hasProactivePayEquity: false,
    statute: 'Saskatchewan Human Rights Code',
    administeredBy: 'Saskatchewan Human Rights Commission',
    description:
      'No proactive pay equity legislation. Pay discrimination complaints handled under ' +
      'Human Rights Code (equal pay for similar work).',
  },
  NL: {
    hasProactivePayEquity: true,
    statute: 'Pay Equity Act (NL)',
    administeredBy: 'Pay Equity Division',
    description:
      'Proactive pay equity for public sector employers. ' +
      'Private sector covered by Human Rights Act complaint-based process.',
    threshold: 0,
    notes: 'Public sector proactive; private sector complaint-based.',
  },
  YT: {
    hasProactivePayEquity: false,
    statute: 'Yukon Human Rights Act',
    administeredBy: 'Yukon Human Rights Commission',
    description:
      'No proactive pay equity legislation. Complaint-based under Human Rights Act.',
  },
  NT: {
    hasProactivePayEquity: false,
    statute: 'Human Rights Act (NT)',
    administeredBy: 'NWT Human Rights Commission',
    description:
      'No proactive pay equity legislation. Equal pay provisions under Human Rights Act.',
  },
  NU: {
    hasProactivePayEquity: false,
    statute: 'Human Rights Act (NU)',
    administeredBy: 'Nunavut Human Rights Tribunal',
    description:
      'No proactive pay equity legislation. Equal pay provisions under Human Rights Act.',
  },
};

/**
 * Check if a jurisdiction has proactive pay equity legislation.
 */
export function hasProactivePayEquity(jurisdiction: CanadianJurisdiction): boolean {
  return PAY_EQUITY_REGIMES[jurisdiction].hasProactivePayEquity;
}

/**
 * Get all jurisdictions with proactive pay equity.
 */
export function getProactivePayEquityJurisdictions(): CanadianJurisdiction[] {
  return (Object.entries(PAY_EQUITY_REGIMES) as [CanadianJurisdiction, PayEquityRegime][])
    .filter(([, r]) => r.hasProactivePayEquity)
    .map(([j]) => j);
}
