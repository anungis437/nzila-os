/**
 * Canadian Labour Standards — Workers' Compensation Boards
 *
 * Registry of WCB/WSIB equivalent for each Canadian jurisdiction,
 * including reporting portals, key statutes, and claim deadlines.
 *
 * @module canadian-labour-standards/wcb-boards
 */

import type { WorkersCompBoard, CanadianJurisdiction } from './types';

export const WCB_BOARDS: Record<CanadianJurisdiction, WorkersCompBoard> = {
  federal: {
    name: 'Federal Workers\' Compensation (GECA)',
    acronym: 'GECA',
    statute: 'Government Employees Compensation Act',
    portalUrl: 'https://www.canada.ca/en/employment-social-development/services/health-safety/compensation.html',
    claimDeadlineDays: 30,
    notes: 'Federal workers file through their provincial WCB; GECA provides compensation for federal employees.',
  },
  ON: {
    name: 'Workplace Safety and Insurance Board',
    acronym: 'WSIB',
    statute: 'Workplace Safety and Insurance Act, 1997',
    portalUrl: 'https://www.wsib.ca',
    claimDeadlineDays: 30,
    notes: 'Form 7 (employer), Form 6 (worker). Online filing via WSIB portal.',
  },
  BC: {
    name: 'WorkSafeBC',
    acronym: 'WorkSafeBC',
    statute: 'Workers Compensation Act',
    portalUrl: 'https://www.worksafebc.com',
    claimDeadlineDays: 30,
    notes: 'Employer Report of Injury (Form 7). Online filing available.',
  },
  AB: {
    name: 'Workers\' Compensation Board – Alberta',
    acronym: 'WCB-AB',
    statute: 'Workers\' Compensation Act (Alberta)',
    portalUrl: 'https://www.wcb.ab.ca',
    claimDeadlineDays: 72,
    notes: 'Employer must report within 72 hours. myWCB online portal for filing.',
  },
  SK: {
    name: 'Workers\' Compensation Board – Saskatchewan',
    acronym: 'WCB-SK',
    statute: 'Workers\' Compensation Act, 2013 (Saskatchewan)',
    portalUrl: 'https://www.wcbsask.com',
    claimDeadlineDays: 5,
    notes: 'Employer must report within 5 business days. Online filing via WCBSask portal.',
  },
  MB: {
    name: 'Workers Compensation Board of Manitoba',
    acronym: 'WCB-MB',
    statute: 'Workers Compensation Act (Manitoba)',
    portalUrl: 'https://www.wcb.mb.ca',
    claimDeadlineDays: 5,
    notes: 'Employer must report within 5 business days. SAFE Work Manitoba prevention arm.',
  },
  NB: {
    name: 'WorkSafeNB',
    acronym: 'WorkSafeNB',
    statute: 'Workers\' Compensation Act (New Brunswick)',
    portalUrl: 'https://www.worksafenb.ca',
    claimDeadlineDays: 3,
    notes: 'Employer must report within 3 days of learning of injury. Form 67 (Employer Report).',
  },
  NS: {
    name: 'Workers\' Compensation Board of Nova Scotia',
    acronym: 'WCB-NS',
    statute: 'Workers\' Compensation Act (Nova Scotia)',
    portalUrl: 'https://www.wcb.ns.ca',
    claimDeadlineDays: 5,
    notes: 'Employer must report within 5 business days. Online reporting available.',
  },
  PE: {
    name: 'Workers Compensation Board of PEI',
    acronym: 'WCB-PE',
    statute: 'Workers Compensation Act (PEI)',
    portalUrl: 'https://www.wcb.pe.ca',
    claimDeadlineDays: 3,
    notes: 'Employer must report within 3 days of event. Form 7 (Employer Report).',
  },
  NL: {
    name: 'WorkplaceNL',
    acronym: 'WorkplaceNL',
    statute: 'Workplace Health, Safety and Compensation Act (NL)',
    portalUrl: 'https://www.workplacenl.ca',
    claimDeadlineDays: 3,
    notes: 'Employer must report within 3 business days. Online filing via WorkplaceNL Connect.',
  },
  QC: {
    name: 'Commission des normes, de l\'équité, de la santé et de la sécurité du travail',
    acronym: 'CNESST',
    statute: 'Loi sur les accidents du travail et les maladies professionnelles (LATMP)',
    portalUrl: 'https://www.cnesst.gouv.qc.ca',
    claimDeadlineDays: 2,
    notes: 'Employer must report within 2 days. Mon Espace CNESST portal for online filing.',
  },
  YT: {
    name: 'Yukon Workers\' Compensation Health and Safety Board',
    acronym: 'YWCHSB',
    statute: 'Workers\' Compensation Act (Yukon)',
    portalUrl: 'https://www.wcb.yk.ca',
    claimDeadlineDays: 3,
    notes: 'Employer must report within 3 days. Also covers occupational H&S.',
  },
  NT: {
    name: 'Workers\' Safety and Compensation Commission',
    acronym: 'WSCC',
    statute: 'Workers\' Compensation Act (NT)',
    portalUrl: 'https://www.wscc.nt.ca',
    claimDeadlineDays: 3,
    notes: 'Shared board for NT and NU. Employer must report within 3 days.',
  },
  NU: {
    name: 'Workers\' Safety and Compensation Commission',
    acronym: 'WSCC',
    statute: 'Workers\' Compensation Act (NU)',
    portalUrl: 'https://www.wscc.nt.ca',
    claimDeadlineDays: 3,
    notes: 'Shared board with NT. Same WSCC, separate statutory authority for NU.',
  },
};

/**
 * Get the WCB board info for a jurisdiction.
 */
export function getWCBBoard(jurisdiction: CanadianJurisdiction): WorkersCompBoard {
  return WCB_BOARDS[jurisdiction];
}

/**
 * Get the claim filing deadline in calendar days for a jurisdiction.
 */
export function getClaimDeadlineDays(jurisdiction: CanadianJurisdiction): number {
  return WCB_BOARDS[jurisdiction].claimDeadlineDays;
}
