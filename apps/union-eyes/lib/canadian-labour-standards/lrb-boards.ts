/**
 * Canadian Labour Standards — Labour Relations Boards
 *
 * Registry of the labour relations board (or equivalent tribunal)
 * for each Canadian jurisdiction. Used for certification, unfair
 * labour practice complaints, and other proceedings.
 *
 * @module canadian-labour-standards/lrb-boards
 */

import type { LabourRelationsBoard, CanadianJurisdiction } from './types';

export const LRB_BOARDS: Record<CanadianJurisdiction, LabourRelationsBoard> = {
  federal: {
    name: 'Canada Industrial Relations Board',
    acronym: 'CIRB',
    statute: 'Canada Labour Code, Part I',
    filingUrl: 'https://www.cirb-ccri.gc.ca',
    notes: 'Covers federally-regulated industries: banking, telecom, inter-provincial transport, ports, etc.',
  },
  ON: {
    name: 'Ontario Labour Relations Board',
    acronym: 'OLRB',
    statute: 'Labour Relations Act, 1995',
    filingUrl: 'https://www.olrb.gov.on.ca',
    notes: 'E-filing available. Also handles OHSA reprisal complaints and ESA referrals.',
  },
  BC: {
    name: 'British Columbia Labour Relations Board',
    acronym: 'BCLRB',
    statute: 'Labour Relations Code',
    filingUrl: 'https://www.lrb.bc.ca',
    notes: 'E-filing available. Handles certification, unfair labour practices, essential services designations.',
  },
  AB: {
    name: 'Alberta Labour Relations Board',
    acronym: 'ALRB',
    statute: 'Alberta Labour Relations Code',
    filingUrl: 'https://www.alrb.gov.ab.ca',
    notes: 'Handles private and public sector labour relations. Online filing available.',
  },
  SK: {
    name: 'Saskatchewan Labour Relations Board',
    acronym: 'SLRB',
    statute: 'Saskatchewan Employment Act, Part VI',
    filingUrl: 'https://www.sasklabourrelationsboard.com',
    notes: 'Handles certification, bargaining unit determinations, ULP complaints.',
  },
  MB: {
    name: 'Manitoba Labour Board',
    acronym: 'MLB',
    statute: 'Labour Relations Act (Manitoba)',
    filingUrl: 'https://www.gov.mb.ca/labour/labbrd/',
    notes: 'Handles applications under the Labour Relations Act, the Employment Standards Code, and related statutes.',
  },
  NB: {
    name: 'New Brunswick Labour and Employment Board',
    acronym: 'NBLEB',
    statute: 'Industrial Relations Act (New Brunswick)',
    filingUrl: 'https://www2.gnb.ca/content/gnb/en/services/services_renderer.201246.Labour_and_Employment_Board.html',
    notes: 'Combined board covering labour relations, employment standards, and workplace H&S appeals.',
  },
  NS: {
    name: 'Nova Scotia Labour Board',
    acronym: 'NSLB',
    statute: 'Trade Union Act (Nova Scotia)',
    filingUrl: 'https://novascotia.ca/lae/labourboard/',
    notes: 'Handles certification, ULP, first-contract arbitration under Trade Union Act.',
  },
  PE: {
    name: 'Prince Edward Island Labour Relations Board',
    acronym: 'PELRB',
    statute: 'Labour Act (PEI)',
    filingUrl: 'https://www.princeedwardisland.ca/en/information/economic-growth-tourism-and-culture/labour-relations-board',
    notes: 'Handles applications under the Labour Act and Civil Service Act.',
  },
  NL: {
    name: 'Newfoundland and Labrador Labour Relations Board',
    acronym: 'NLLRB',
    statute: 'Labour Relations Act (NL)',
    filingUrl: 'https://www.gov.nl.ca/exec/hrs/labour-relations/',
    notes: 'Handles certification, ULP, first-contract arbitration, strike/lockout regulation.',
  },
  QC: {
    name: 'Tribunal administratif du travail',
    acronym: 'TAT',
    statute: 'Code du travail du Québec',
    filingUrl: 'https://www.tat.gouv.qc.ca',
    notes: 'Handles labour relations (certification, ULP) and occupational diseases/injuries. Bilingual proceedings.',
  },
  YT: {
    name: 'Yukon Employment Standards Board / Adjudication',
    acronym: 'YESB',
    statute: 'Employment Standards Act (Yukon)',
    filingUrl: 'https://yukon.ca/en/employment/employment-standards',
    notes: 'No separate LRB. Labour disputes handled by adjudication under ESA and the Public Service Labour Relations Act.',
  },
  NT: {
    name: 'Northwest Territories Employment Standards Adjudication',
    acronym: 'NT-ESA',
    statute: 'Employment Standards Act (NT)',
    filingUrl: 'https://www.ece.gov.nt.ca/en/services/employment-standards',
    notes: 'No separate LRB. Labour relations governed by the Public Service Act and handled by adjudicators.',
  },
  NU: {
    name: 'Nunavut Employment Standards Adjudication',
    acronym: 'NU-ESA',
    statute: 'Labour Standards Act (NU)',
    filingUrl: 'https://www.gov.nu.ca/finance/information/labour-standards',
    notes: 'No separate LRB. Labour matters handled under the Labour Standards Act and Public Service Act.',
  },
};

/**
 * Get the labour relations board for a jurisdiction.
 */
export function getLRBoard(jurisdiction: CanadianJurisdiction): LabourRelationsBoard {
  return LRB_BOARDS[jurisdiction];
}
