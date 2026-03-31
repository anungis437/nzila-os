/**
 * Canadian Labour Standards — Termination Notice by Jurisdiction
 *
 * Statutory minimum notice (or pay-in-lieu) an employer must give.
 * Organized by years of service. Does not include group termination
 * provisions, which are typically longer.
 *
 * @module canadian-labour-standards/termination-notice
 */

import type { TerminationNoticeSchedule, CanadianJurisdiction } from './types';

export const TERMINATION_NOTICE: Record<CanadianJurisdiction, TerminationNoticeSchedule> = {
  federal: {
    statute: 'Canada Labour Code, Part III',
    article: 's. 230(1)',
    tiers: [
      { minYears: 0.25, maxYears: 3, weeksNotice: 2 },
      { minYears: 3, maxYears: null, weeksNotice: 2 }, // minimum 2 weeks regardless
    ],
  },
  ON: {
    statute: 'Employment Standards Act, 2000',
    article: 's. 57(a)–(h)',
    tiers: [
      { minYears: 0.25, maxYears: 1, weeksNotice: 1 },
      { minYears: 1, maxYears: 3, weeksNotice: 2 },
      { minYears: 3, maxYears: 4, weeksNotice: 3 },
      { minYears: 4, maxYears: 5, weeksNotice: 4 },
      { minYears: 5, maxYears: 6, weeksNotice: 5 },
      { minYears: 6, maxYears: 7, weeksNotice: 6 },
      { minYears: 7, maxYears: 8, weeksNotice: 7 },
      { minYears: 8, maxYears: null, weeksNotice: 8 },
    ],
  },
  BC: {
    statute: 'Employment Standards Act (BC)',
    article: 's. 63',
    tiers: [
      { minYears: 0.25, maxYears: 1, weeksNotice: 1 },
      { minYears: 1, maxYears: 2, weeksNotice: 2 },
      { minYears: 2, maxYears: 3, weeksNotice: 3 },
      { minYears: 3, maxYears: 4, weeksNotice: 4 },
      { minYears: 4, maxYears: 5, weeksNotice: 5 },
      { minYears: 5, maxYears: 6, weeksNotice: 6 },
      { minYears: 6, maxYears: 7, weeksNotice: 7 },
      { minYears: 7, maxYears: 8, weeksNotice: 8 },
    ],
  },
  AB: {
    statute: 'Employment Standards Code (AB)',
    article: 's. 56',
    tiers: [
      { minYears: 0.25, maxYears: 2, weeksNotice: 1 },
      { minYears: 2, maxYears: 4, weeksNotice: 2 },
      { minYears: 4, maxYears: 6, weeksNotice: 4 },
      { minYears: 6, maxYears: 8, weeksNotice: 5 },
      { minYears: 8, maxYears: 10, weeksNotice: 6 },
      { minYears: 10, maxYears: null, weeksNotice: 8 },
    ],
  },
  SK: {
    statute: 'Saskatchewan Employment Act',
    article: 's. 2-56',
    tiers: [
      { minYears: 0.25, maxYears: 1, weeksNotice: 1 },
      { minYears: 1, maxYears: 3, weeksNotice: 2 },
      { minYears: 3, maxYears: 5, weeksNotice: 4 },
      { minYears: 5, maxYears: 10, weeksNotice: 6 },
      { minYears: 10, maxYears: null, weeksNotice: 8 },
    ],
  },
  MB: {
    statute: 'Employment Standards Code (MB)',
    article: 's. 61(1)',
    tiers: [
      { minYears: 0.25, maxYears: 1, weeksNotice: 1 },
      { minYears: 1, maxYears: 3, weeksNotice: 2 },
      { minYears: 3, maxYears: 5, weeksNotice: 4 },
      { minYears: 5, maxYears: 10, weeksNotice: 6 },
      { minYears: 10, maxYears: null, weeksNotice: 8 },
    ],
  },
  NB: {
    statute: 'Employment Standards Act (NB)',
    article: 's. 30',
    tiers: [
      { minYears: 0.5, maxYears: 5, weeksNotice: 2 },
      { minYears: 5, maxYears: null, weeksNotice: 4 },
    ],
  },
  NS: {
    statute: 'Labour Standards Code (NS)',
    article: 's. 72(1)',
    tiers: [
      { minYears: 0.25, maxYears: 2, weeksNotice: 1 },
      { minYears: 2, maxYears: 5, weeksNotice: 2 },
      { minYears: 5, maxYears: 10, weeksNotice: 4 },
      { minYears: 10, maxYears: null, weeksNotice: 8 },
    ],
  },
  PE: {
    statute: 'Employment Standards Act (PE)',
    article: 's. 29',
    tiers: [
      { minYears: 0.5, maxYears: 5, weeksNotice: 2 },
      { minYears: 5, maxYears: null, weeksNotice: 4 },
    ],
  },
  NL: {
    statute: 'Labour Standards Act (NL)',
    article: 's. 55',
    tiers: [
      { minYears: 0.25, maxYears: 2, weeksNotice: 1 },
      { minYears: 2, maxYears: 5, weeksNotice: 2 },
      { minYears: 5, maxYears: 10, weeksNotice: 3 },
      { minYears: 10, maxYears: 15, weeksNotice: 4 },
      { minYears: 15, maxYears: null, weeksNotice: 6 },
    ],
  },
  QC: {
    statute: 'Loi sur les normes du travail (LNT)',
    article: 'art. 82',
    tiers: [
      { minYears: 0.25, maxYears: 1, weeksNotice: 1 },
      { minYears: 1, maxYears: 5, weeksNotice: 2 },
      { minYears: 5, maxYears: 10, weeksNotice: 4 },
      { minYears: 10, maxYears: null, weeksNotice: 8 },
    ],
  },
  YT: {
    statute: 'Employment Standards Act (YT)',
    article: 's. 52',
    tiers: [
      { minYears: 0.5, maxYears: 1, weeksNotice: 1 },
      { minYears: 1, maxYears: 3, weeksNotice: 2 },
      { minYears: 3, maxYears: 4, weeksNotice: 3 },
      { minYears: 4, maxYears: 5, weeksNotice: 4 },
      { minYears: 5, maxYears: 6, weeksNotice: 5 },
      { minYears: 6, maxYears: 7, weeksNotice: 6 },
      { minYears: 7, maxYears: 8, weeksNotice: 7 },
      { minYears: 8, maxYears: null, weeksNotice: 8 },
    ],
  },
  NT: {
    statute: 'Employment Standards Act (NT)',
    article: 's. 18',
    tiers: [
      { minYears: 0.25, maxYears: 3, weeksNotice: 2 },
      { minYears: 3, maxYears: null, weeksNotice: 4 },
    ],
  },
  NU: {
    statute: 'Labour Standards Act (NU)',
    article: 's. 18',
    tiers: [
      { minYears: 0.25, maxYears: 3, weeksNotice: 2 },
      { minYears: 3, maxYears: null, weeksNotice: 4 },
    ],
  },
};

/**
 * Calculate the statutory minimum termination notice for a jurisdiction.
 *
 * @param jurisdiction Province/territory code
 * @param yearsOfService Completed years of continuous employment
 * @returns weeks of notice required, along with statutory reference
 */
export function calculateTerminationNotice(
  jurisdiction: CanadianJurisdiction,
  yearsOfService: number,
): { weeks: number; statute: string; article: string } {
  const schedule = TERMINATION_NOTICE[jurisdiction];

  if (yearsOfService < 0.25) {
    return { weeks: 0, statute: schedule.statute, article: schedule.article };
  }

  let weeks = 0;
  for (const tier of schedule.tiers) {
    if (
      yearsOfService >= tier.minYears &&
      (tier.maxYears === null || yearsOfService < tier.maxYears)
    ) {
      weeks = tier.weeksNotice;
      break;
    }
  }

  return { weeks, statute: schedule.statute, article: schedule.article };
}
