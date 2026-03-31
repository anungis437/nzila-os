/**
 * Canadian Labour Standards — Break Rules by Jurisdiction
 *
 * Statutory minimum break entitlements for every province, territory,
 * and the federal jurisdiction. Based on each jurisdiction's
 * employment/labour standards act.
 *
 * @module canadian-labour-standards/break-rules
 */

import type { BreakRule, CanadianJurisdiction } from './types';

export const BREAK_RULES: Record<CanadianJurisdiction, BreakRule[]> = {
  // ─── Federal ─────────────────────────────────────────────
  federal: [
    {
      type: 'meal',
      description: '30-minute meal break after every 5 consecutive hours of work',
      article: 's. 169.1',
      statute: 'Canada Labour Code, Part III',
      consecutiveHoursTrigger: 5,
      durationMinutes: 30,
      paid: false,
      exceptions: ['Paid if employee must remain available during break'],
    },
    {
      type: 'rest',
      description: 'Minimum 8 consecutive hours off between shifts',
      article: 's. 169.2',
      statute: 'Canada Labour Code, Part III',
      consecutiveHoursTrigger: 0,
      durationMinutes: 480,
      paid: false,
      exceptions: ['Does not apply in emergencies or unforeseeable circumstances'],
    },
    {
      type: 'weekly_rest',
      description: 'At least 24 consecutive hours of rest in every 7-day period',
      article: 's. 173',
      statute: 'Canada Labour Code, Part III',
      consecutiveHoursTrigger: 0,
      durationMinutes: 1440,
      paid: false,
      exceptions: [],
    },
  ],

  // ─── Ontario ─────────────────────────────────────────────
  ON: [
    {
      type: 'meal',
      description: '30-minute eating period after no more than 5 consecutive hours of work',
      article: 's. 20(1)',
      statute: 'Employment Standards Act, 2000 (ESA)',
      consecutiveHoursTrigger: 5,
      durationMinutes: 30,
      paid: false,
      exceptions: [
        'Employer and employee may agree to split into two shorter breaks',
        'Break must be free from work duties to be unpaid',
      ],
    },
    {
      type: 'weekly_rest',
      description: 'Minimum 24 consecutive hours off in every work week, or 48 hours off in every period of two consecutive work weeks',
      article: 's. 18(1)',
      statute: 'Employment Standards Act, 2000 (ESA)',
      consecutiveHoursTrigger: 0,
      durationMinutes: 1440,
      paid: false,
      exceptions: ['Exceptional circumstances as defined by regulation'],
    },
  ],

  // ─── British Columbia ────────────────────────────────────
  BC: [
    {
      type: 'meal',
      description: '30-minute meal break after 5 consecutive hours of work',
      article: 's. 32',
      statute: 'Employment Standards Act (BC ESA)',
      consecutiveHoursTrigger: 5,
      durationMinutes: 30,
      paid: false,
      exceptions: ['Paid if employee required to work or be available during break'],
    },
    {
      type: 'rest',
      description: 'Minimum 8 consecutive hours off between shifts',
      article: 's. 36',
      statute: 'Employment Standards Act (BC ESA)',
      consecutiveHoursTrigger: 0,
      durationMinutes: 480,
      paid: false,
      exceptions: ['May be reduced by mutual consent in certain industries'],
    },
    {
      type: 'weekly_rest',
      description: '32 consecutive hours free from work each work week',
      article: 's. 36',
      statute: 'Employment Standards Act (BC ESA)',
      consecutiveHoursTrigger: 0,
      durationMinutes: 1920,
      paid: false,
      exceptions: [],
    },
  ],

  // ─── Alberta ─────────────────────────────────────────────
  AB: [
    {
      type: 'meal',
      description: '30-minute break within each 5-hour work period',
      article: 's. 18(1)',
      statute: 'Employment Standards Code (AB ESC)',
      consecutiveHoursTrigger: 5,
      durationMinutes: 30,
      paid: false,
      exceptions: [
        'Employer and employee may agree in writing to shorter or different breaks',
        'Paid if employee must remain at workstation',
      ],
    },
    {
      type: 'rest',
      description: 'Minimum rest period of 8 consecutive hours between shifts',
      article: 's. 18(2)',
      statute: 'Employment Standards Code (AB ESC)',
      consecutiveHoursTrigger: 0,
      durationMinutes: 480,
      paid: false,
      exceptions: [],
    },
    {
      type: 'weekly_rest',
      description: 'At least 1 day of rest in each work week',
      article: 's. 19',
      statute: 'Employment Standards Code (AB ESC)',
      consecutiveHoursTrigger: 0,
      durationMinutes: 1440,
      paid: false,
      exceptions: ['Averaging agreements may modify this requirement'],
    },
  ],

  // ─── Saskatchewan ────────────────────────────────────────
  SK: [
    {
      type: 'meal',
      description: '30-minute meal break after 5 consecutive hours of work',
      article: 's. 13',
      statute: 'Saskatchewan Employment Act (SEA)',
      consecutiveHoursTrigger: 5,
      durationMinutes: 30,
      paid: false,
      exceptions: ['Paid if employee not free to leave the premises'],
    },
    {
      type: 'weekly_rest',
      description: '24 consecutive hours of rest in each 7-day period',
      article: 's. 2-15',
      statute: 'Saskatchewan Employment Act (SEA)',
      consecutiveHoursTrigger: 0,
      durationMinutes: 1440,
      paid: false,
      exceptions: ['Modified work arrangements may apply'],
    },
  ],

  // ─── Manitoba ────────────────────────────────────────────
  MB: [
    {
      type: 'meal',
      description: '30-minute eating period after every 5 consecutive hours of work',
      article: 's. 17',
      statute: 'Employment Standards Code (MB ESC)',
      consecutiveHoursTrigger: 5,
      durationMinutes: 30,
      paid: false,
      exceptions: ['Paid if employee unable to leave the work area'],
    },
    {
      type: 'weekly_rest',
      description: '24 consecutive hours of rest in each work week',
      article: 's. 16',
      statute: 'Employment Standards Code (MB ESC)',
      consecutiveHoursTrigger: 0,
      durationMinutes: 1440,
      paid: false,
      exceptions: [],
    },
  ],

  // ─── New Brunswick ──────────────────────────────────────
  NB: [
    {
      type: 'meal',
      description: '30-minute unpaid break after 5 consecutive hours of work',
      article: 's. 19.1',
      statute: 'Employment Standards Act (NB ESA)',
      consecutiveHoursTrigger: 5,
      durationMinutes: 30,
      paid: false,
      exceptions: ['May be split into two 15-minute breaks by agreement'],
    },
    {
      type: 'weekly_rest',
      description: 'At least 24 consecutive hours of rest each week',
      article: 's. 17.01',
      statute: 'Employment Standards Act (NB ESA)',
      consecutiveHoursTrigger: 0,
      durationMinutes: 1440,
      paid: false,
      exceptions: [],
    },
  ],

  // ─── Nova Scotia ─────────────────────────────────────────
  NS: [
    {
      type: 'meal',
      description: '30-minute eating break after 5 consecutive hours of work',
      article: 's. 56',
      statute: 'Labour Standards Code (NS LSC)',
      consecutiveHoursTrigger: 5,
      durationMinutes: 30,
      paid: false,
      exceptions: ['Paid if employee must remain available or at workstation'],
    },
    {
      type: 'weekly_rest',
      description: '24 consecutive hours free from work in each work week',
      article: 's. 58',
      statute: 'Labour Standards Code (NS LSC)',
      consecutiveHoursTrigger: 0,
      durationMinutes: 1440,
      paid: false,
      exceptions: ['Exemptions may apply for continuous operations'],
    },
  ],

  // ─── Prince Edward Island ───────────────────────────────
  PE: [
    {
      type: 'meal',
      description: '30-minute unpaid break for each period of 5 consecutive hours of work',
      article: 's. 17',
      statute: 'Employment Standards Act (PE ESA)',
      consecutiveHoursTrigger: 5,
      durationMinutes: 30,
      paid: false,
      exceptions: ['Paid if employee must stay at workstation'],
    },
    {
      type: 'weekly_rest',
      description: '24 consecutive hours of rest each week',
      article: 's. 18',
      statute: 'Employment Standards Act (PE ESA)',
      consecutiveHoursTrigger: 0,
      durationMinutes: 1440,
      paid: false,
      exceptions: [],
    },
  ],

  // ─── Newfoundland and Labrador ─────────────────────────
  NL: [
    {
      type: 'meal',
      description: '1-hour meal break in each work period; may be 30 minutes if agreed',
      article: 's. 23',
      statute: 'Labour Standards Act (NL LSA)',
      consecutiveHoursTrigger: 0,
      durationMinutes: 60,
      paid: false,
      exceptions: [
        '30-minute break by mutual agreement',
        'Paid if employee must remain at workstation',
        'Unique among provinces: default is 1 hour, not 30 minutes',
      ],
    },
    {
      type: 'weekly_rest',
      description: '24 consecutive hours of rest each week',
      article: 's. 19',
      statute: 'Labour Standards Act (NL LSA)',
      consecutiveHoursTrigger: 0,
      durationMinutes: 1440,
      paid: false,
      exceptions: [],
    },
  ],

  // ─── Yukon ───────────────────────────────────────────────
  YT: [
    {
      type: 'meal',
      description: '30-minute break after 5 consecutive hours of work',
      article: 's. 12',
      statute: 'Employment Standards Act (YT ESA)',
      consecutiveHoursTrigger: 5,
      durationMinutes: 30,
      paid: false,
      exceptions: ['Paid if employee cannot leave the work premises'],
    },
    {
      type: 'weekly_rest',
      description: 'At least 24 consecutive hours off each work week',
      article: 's. 16',
      statute: 'Employment Standards Act (YT ESA)',
      consecutiveHoursTrigger: 0,
      durationMinutes: 1440,
      paid: false,
      exceptions: [],
    },
  ],

  // ─── Northwest Territories ─────────────────────────────
  NT: [
    {
      type: 'meal',
      description: '30-minute break after 5 consecutive hours of work',
      article: 's. 11',
      statute: 'Employment Standards Act (NT ESA)',
      consecutiveHoursTrigger: 5,
      durationMinutes: 30,
      paid: false,
      exceptions: ['Paid if employee must remain at the workplace'],
    },
    {
      type: 'weekly_rest',
      description: 'At least 24 consecutive hours off in every period of 7 consecutive days',
      article: 's. 12',
      statute: 'Employment Standards Act (NT ESA)',
      consecutiveHoursTrigger: 0,
      durationMinutes: 1440,
      paid: false,
      exceptions: ['Modified by agreement in remote work sites'],
    },
  ],

  // ─── Nunavut ─────────────────────────────────────────────
  NU: [
    {
      type: 'meal',
      description: '30-minute break after 5 consecutive hours of work',
      article: 's. 11',
      statute: 'Labour Standards Act (NU LSA)',
      consecutiveHoursTrigger: 5,
      durationMinutes: 30,
      paid: false,
      exceptions: ['Paid if employee must remain at the workplace'],
    },
    {
      type: 'weekly_rest',
      description: 'At least 24 consecutive hours off in every period of 7 consecutive days',
      article: 's. 12',
      statute: 'Labour Standards Act (NU LSA)',
      consecutiveHoursTrigger: 0,
      durationMinutes: 1440,
      paid: false,
      exceptions: ['Modified by agreement in remote work sites'],
    },
  ],

  // ─── Quebec (reference — detailed implementation in lib/quebec/) ─
  QC: [
    {
      type: 'meal',
      description: '30-minute meal break after 5 consecutive hours of work',
      article: 'art. 79',
      statute: 'Loi sur les normes du travail (LNT)',
      consecutiveHoursTrigger: 5,
      durationMinutes: 30,
      paid: false,
      exceptions: [
        'Paid if employee must remain at workstation',
        'CBA may provide more generous provisions',
      ],
    },
    {
      type: 'weekly_rest',
      description: '32 consecutive hours of weekly rest',
      article: 'art. 78',
      statute: 'Loi sur les normes du travail (LNT)',
      consecutiveHoursTrigger: 0,
      durationMinutes: 1920,
      paid: false,
      exceptions: [],
    },
  ],
};
