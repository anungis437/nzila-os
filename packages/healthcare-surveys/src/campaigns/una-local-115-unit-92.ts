import { UNIT_SCHEDULING_TEMPLATE } from '../templates/unit-scheduling'

export const UNIT_92_CAMPAIGN_KEY = 'una-local-115-unit-92'

export const UNIT_92_CAMPAIGN_SEED = {
  key: UNIT_92_CAMPAIGN_KEY,
  title: 'Unit 92 Scheduling Experience Survey',
  internalCampaignName: 'UNA Local 115 - Unit 92 Short Stay Cardiology Discovery',
  purposeStatement:
    'This short anonymous survey is intended to understand scheduling clarity, communication friction, schedule-change issues, open-shift transparency, shift-exchange confusion, and documentation gaps on Unit 92.',
  audience: 'Nurses and eligible unit members on Unit 92',
  localName: 'UNA Local 115',
  unitName: 'Unit 92, Short Stay Cardiology',
  championLabel: 'Heather Haberli',
  championInternalOnly: true,
  status: 'draft' as const,
  anonymous: true,
  allowFreeText: true,
  estimatedMinutes: 5,
  introText:
    'Thank you for taking a few minutes to complete this short survey.\n\nThe purpose of this survey is to better understand how nurses on Unit 92 experience scheduling, schedule changes, open shifts, shift exchanges, communication, and documentation.\n\nThis is early discovery only. It is not a grievance form, not an employer audit, and not intended to collect patient information or confidential case details.\n\nPlease do not include patient names, employee names, manager names, or identifying details in your responses.\n\nYour feedback will help identify whether there are small, practical ways to improve scheduling clarity, transparency, and documentation support on this unit.',
  privacyNotice:
    'This discovery survey is for workflow discovery only. Do not include patient information, employee names, manager names, grievance details, or identifying details.',
  distributionMessage:
    'Hi everyone,\n\nWe are doing a short anonymous survey to better understand scheduling experiences on Unit 92.\n\nThe goal is to learn where scheduling processes create confusion, friction, or documentation gaps - for example around schedule changes, open shifts, shift exchanges, communication, and follow-up when questions arise.\n\nThis is not a grievance form and not an employer audit. Please do not include patient names, employee names, manager names, or identifying details.\n\nThe survey should take about 5 minutes.\n\nThank you for sharing your perspective.',
  internalNotes:
    'Initial discovery target confirmed after UNA conversation. Scope is intentionally small: one unit, anonymous survey, no real scheduling documents, no patient data, no employer integration. Goal is to identify one tiny workflow wedge for a future governed Nzila Healthcare / UnionEyes Healthcare pilot.',
  template: UNIT_SCHEDULING_TEMPLATE,
}
