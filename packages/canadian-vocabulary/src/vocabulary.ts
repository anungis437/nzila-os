/**
 * Canadian Vocabulary — All Jurisdictions
 *
 * Jurisdiction-specific case types, grievance workflows, roles,
 * and legal references for all 14 Canadian jurisdictions.
 */

import type {
  CanadianJurisdiction,
  CaseType,
  Priority,
  Severity,
  GrievanceRole,
  GrievanceStatus,
  JurisdictionVocabulary,
} from './types';

// ---------------------------------------------------------------------------
// SHARED: Priorities, Severities, Roles, Statuses
// (Common across all jurisdictions — labels in English)
// ---------------------------------------------------------------------------

const PRIORITIES: Priority[] = [
  { id: 'low', label: 'Low', slaHours: 168, escalationRequired: false },
  { id: 'medium', label: 'Medium', slaHours: 72, escalationRequired: false },
  { id: 'high', label: 'High', slaHours: 48, escalationRequired: true },
  { id: 'critical', label: 'Critical', slaHours: 24, escalationRequired: true },
];

const SEVERITIES: Severity[] = [
  { id: 'minor', label: 'Minor', description: 'Limited impact, no direct legal consequences', requiresLegal: false },
  { id: 'moderate', label: 'Moderate', description: 'Individual impact, may require union follow-up', requiresLegal: false },
  { id: 'serious', label: 'Serious', description: 'Affects multiple members or has legal implications', requiresLegal: true },
  { id: 'critical', label: 'Critical', description: 'Safety threat, systemic discrimination, or fundamental rights violation', requiresLegal: true },
];

const ROLES: GrievanceRole[] = [
  { id: 'member', label: 'Member', description: 'Union member', canAssign: false, canEscalate: false, canSettle: false },
  { id: 'steward', label: 'Shop Steward', description: 'Workplace union representative', canAssign: true, canEscalate: true, canSettle: false },
  { id: 'chief_steward', label: 'Chief Steward', description: 'Senior steward or grievance coordinator', canAssign: true, canEscalate: true, canSettle: true },
  { id: 'rep', label: 'Union Representative', description: 'Full-time union representative / business agent', canAssign: true, canEscalate: true, canSettle: true },
  { id: 'officer', label: 'Local Union Officer', description: 'President, VP, secretary-treasurer of the local', canAssign: true, canEscalate: true, canSettle: true },
  { id: 'admin', label: 'Administrator', description: 'System administrator', canAssign: true, canEscalate: true, canSettle: true },
];

const STATUSES: GrievanceStatus[] = [
  { id: 'draft', label: 'Draft', category: 'open', allowTransitionsTo: ['filed'] },
  { id: 'filed', label: 'Filed', category: 'open', allowTransitionsTo: ['acknowledged'] },
  { id: 'acknowledged', label: 'Acknowledged', category: 'in_progress', allowTransitionsTo: ['investigating', 'escalated'] },
  { id: 'investigating', label: 'Under Investigation', category: 'in_progress', allowTransitionsTo: ['awaiting_response', 'escalated', 'settled'] },
  { id: 'awaiting_response', label: 'Awaiting Employer Response', category: 'in_progress', allowTransitionsTo: ['escalated', 'settled', 'denied'] },
  { id: 'escalated', label: 'Escalated', category: 'in_progress', allowTransitionsTo: ['mediation', 'denied', 'settled'] },
  { id: 'mediation', label: 'In Mediation', category: 'in_progress', allowTransitionsTo: ['arbitration', 'settled', 'denied'] },
  { id: 'arbitration', label: 'In Arbitration', category: 'in_progress', allowTransitionsTo: ['settled', 'denied'] },
  { id: 'settled', label: 'Settled', category: 'resolved', allowTransitionsTo: ['closed'] },
  { id: 'denied', label: 'Denied', category: 'resolved', allowTransitionsTo: ['closed', 'escalated'] },
  { id: 'withdrawn', label: 'Withdrawn', category: 'closed', allowTransitionsTo: [] },
  { id: 'closed', label: 'Closed', category: 'closed', allowTransitionsTo: [] },
];

// ---------------------------------------------------------------------------
// CASE TYPES — Jurisdiction-specific (referencing local legislation)
// ---------------------------------------------------------------------------

const COMMON_CASE_TYPES: CaseType[] = [
  { id: 'discipline', label: 'Disciplinary Action', description: 'Verbal/written warning, suspension, or dismissal', defaultPriority: 'high', defaultSeverity: 'serious', legalBasis: 'Collective agreement' },
  { id: 'harassment', label: 'Workplace Harassment', description: 'Harassment, bullying, or psychological harm', defaultPriority: 'critical', defaultSeverity: 'critical', legalBasis: 'OHS legislation and human rights code' },
  { id: 'discrimination', label: 'Discrimination', description: 'Unequal treatment based on a prohibited ground', defaultPriority: 'critical', defaultSeverity: 'critical', legalBasis: 'Human rights legislation' },
  { id: 'wage_dispute', label: 'Wage Dispute', description: 'Dispute regarding wages, overtime, premiums, or benefits', defaultPriority: 'medium', defaultSeverity: 'serious', legalBasis: 'Employment standards legislation' },
  { id: 'health_safety', label: 'Occupational Health & Safety', description: 'Failure to meet OHS obligations', defaultPriority: 'critical', defaultSeverity: 'critical', legalBasis: 'OHS legislation' },
  { id: 'contracting_out', label: 'Contracting Out', description: 'Assignment of bargaining-unit work to outside contractors', defaultPriority: 'high', defaultSeverity: 'serious', legalBasis: 'Collective agreement' },
  { id: 'seniority', label: 'Seniority', description: 'Violation of seniority rights in staffing, layoff, or recall', defaultPriority: 'high', defaultSeverity: 'serious', legalBasis: 'Collective agreement' },
  { id: 'termination', label: 'Dismissal / Termination', description: 'Dismissal without just cause or constructive dismissal', defaultPriority: 'critical', defaultSeverity: 'critical', legalBasis: 'Employment standards; collective agreement' },
  { id: 'employment_standards', label: 'Employment Standards', description: 'Violation of minimum standards (breaks, leaves, notice)', defaultPriority: 'medium', defaultSeverity: 'moderate', legalBasis: 'Employment standards legislation' },
  { id: 'right_of_refusal', label: 'Right of Refusal', description: 'Exercise of the right to refuse dangerous work', defaultPriority: 'critical', defaultSeverity: 'critical', legalBasis: 'OHS legislation' },
  { id: 'unfair_labour_practice', label: 'Unfair Labour Practice', description: 'Employer interference, intimidation, or obstruction', defaultPriority: 'high', defaultSeverity: 'serious', legalBasis: 'Labour relations legislation' },
  { id: 'union_dues', label: 'Union Dues Issue', description: 'Issue with dues deduction or remittance', defaultPriority: 'low', defaultSeverity: 'minor', legalBasis: 'Labour relations legislation' },
  { id: 'other', label: 'Other', description: 'Grievance not covered by the above categories', defaultPriority: 'medium', defaultSeverity: 'moderate', legalBasis: 'Collective agreement' },
];

function withLegalBasis(cases: CaseType[], overrides: Record<string, Partial<CaseType>>): CaseType[] {
  return cases.map((c) => {
    const o = overrides[c.id];
    return o ? { ...c, ...o } : c;
  });
}

const JURISDICTION_CASE_TYPES: Record<CanadianJurisdiction, CaseType[]> = {
  federal: withLegalBasis(COMMON_CASE_TYPES, {
    discipline: { legalBasis: 'Canada Labour Code, Part I' },
    harassment: { legalBasis: 'Canada Labour Code, Part II, s.122.1; Canadian Human Rights Act' },
    discrimination: { legalBasis: 'Canadian Human Rights Act, s.3, 7' },
    wage_dispute: { legalBasis: 'Canada Labour Code, Part III, ss.166–267' },
    health_safety: { legalBasis: 'Canada Labour Code, Part II' },
    termination: { legalBasis: 'Canada Labour Code, Part III, ss.230–234' },
    employment_standards: { legalBasis: 'Canada Labour Code, Part III' },
    right_of_refusal: { legalBasis: 'Canada Labour Code, Part II, ss.128–129' },
    unfair_labour_practice: { legalBasis: 'Canada Labour Code, Part I, ss.94–100' },
  }),
  ON: withLegalBasis(COMMON_CASE_TYPES, {
    discipline: { legalBasis: 'Collective agreement; Labour Relations Act, 1995' },
    harassment: { legalBasis: 'OHSA, s.32.0.1; Ontario Human Rights Code' },
    discrimination: { legalBasis: 'Ontario Human Rights Code, s.5' },
    wage_dispute: { legalBasis: 'Employment Standards Act, 2000, Part V–VIII' },
    health_safety: { legalBasis: 'Occupational Health and Safety Act (OHSA)' },
    termination: { legalBasis: 'ESA 2000, s.54–62; LRA s.48' },
    employment_standards: { legalBasis: 'Employment Standards Act, 2000' },
    right_of_refusal: { legalBasis: 'OHSA, s.43' },
    unfair_labour_practice: { legalBasis: 'Labour Relations Act, 1995, s.70–85' },
  }),
  BC: withLegalBasis(COMMON_CASE_TYPES, {
    harassment: { legalBasis: 'Workers Compensation Act, OHS Regulation; BC Human Rights Code' },
    discrimination: { legalBasis: 'BC Human Rights Code, s.13' },
    wage_dispute: { legalBasis: 'Employment Standards Act, Part 4' },
    health_safety: { legalBasis: 'Workers Compensation Act, Part 3; OHS Regulation' },
    termination: { legalBasis: 'BC ESA, s.63; Labour Relations Code, s.84' },
    employment_standards: { legalBasis: 'Employment Standards Act, RSBC 1996' },
    right_of_refusal: { legalBasis: 'Workers Compensation Act, s.3.12' },
    unfair_labour_practice: { legalBasis: 'Labour Relations Code, ss.6–9' },
  }),
  AB: withLegalBasis(COMMON_CASE_TYPES, {
    harassment: { legalBasis: 'OHS Act, Part 27; Alberta Human Rights Act' },
    discrimination: { legalBasis: 'Alberta Human Rights Act, s.7' },
    wage_dispute: { legalBasis: 'Employment Standards Code, Part 2–3' },
    health_safety: { legalBasis: 'Occupational Health and Safety Act' },
    termination: { legalBasis: 'Employment Standards Code, s.54–58' },
    employment_standards: { legalBasis: 'Employment Standards Code, RSA 2000' },
    right_of_refusal: { legalBasis: 'OHS Act, s.31' },
    unfair_labour_practice: { legalBasis: 'Alberta Labour Relations Code, s.148–154' },
  }),
  SK: withLegalBasis(COMMON_CASE_TYPES, {
    harassment: { legalBasis: 'Saskatchewan Employment Act, Part III; SHRC' },
    discrimination: { legalBasis: 'Saskatchewan Human Rights Code, 2018, s.16' },
    wage_dispute: { legalBasis: 'Saskatchewan Employment Act, Part II' },
    health_safety: { legalBasis: 'Saskatchewan Employment Act, Part III' },
    termination: { legalBasis: 'SEA, Part II, Division 7' },
    employment_standards: { legalBasis: 'Saskatchewan Employment Act, Part II' },
    right_of_refusal: { legalBasis: 'SEA, Part III, s.3-31' },
    unfair_labour_practice: { legalBasis: 'SEA, Part VI, Division 6' },
  }),
  MB: withLegalBasis(COMMON_CASE_TYPES, {
    harassment: { legalBasis: 'Workplace Safety and Health Act; Manitoba Human Rights Code' },
    discrimination: { legalBasis: 'Manitoba Human Rights Code, s.14' },
    wage_dispute: { legalBasis: 'Employment Standards Code, Part 2–3' },
    health_safety: { legalBasis: 'Workplace Safety and Health Act, CCSM c.W210' },
    termination: { legalBasis: 'Employment Standards Code, Part 7' },
    employment_standards: { legalBasis: 'Employment Standards Code, CCSM c.E110' },
    right_of_refusal: { legalBasis: 'WSHA, s.43' },
    unfair_labour_practice: { legalBasis: 'Labour Relations Act, s.6–20' },
  }),
  NB: withLegalBasis(COMMON_CASE_TYPES, {
    harassment: { legalBasis: 'OHS Act, s.2.1; NB Human Rights Act' },
    discrimination: { legalBasis: 'New Brunswick Human Rights Act, s.4' },
    wage_dispute: { legalBasis: 'Employment Standards Act, Part III' },
    health_safety: { legalBasis: 'Occupational Health and Safety Act' },
    termination: { legalBasis: 'Employment Standards Act, Part V' },
    employment_standards: { legalBasis: 'Employment Standards Act, SNB 1982' },
    right_of_refusal: { legalBasis: 'OHS Act, s.19' },
    unfair_labour_practice: { legalBasis: 'Industrial Relations Act, s.3–6' },
  }),
  NS: withLegalBasis(COMMON_CASE_TYPES, {
    harassment: { legalBasis: 'Workplace Health and Safety Act; NS Human Rights Act' },
    discrimination: { legalBasis: 'Nova Scotia Human Rights Act, s.5' },
    wage_dispute: { legalBasis: 'Labour Standards Code, Part III' },
    health_safety: { legalBasis: 'Workplace Health and Safety Act' },
    termination: { legalBasis: 'Labour Standards Code, s.72–75' },
    employment_standards: { legalBasis: 'Labour Standards Code, RSNS 1989' },
    right_of_refusal: { legalBasis: 'WHSA, s.43' },
    unfair_labour_practice: { legalBasis: 'Trade Union Act, s.53–57' },
  }),
  PE: withLegalBasis(COMMON_CASE_TYPES, {
    harassment: { legalBasis: 'OHS Act regs; PEI Human Rights Act' },
    discrimination: { legalBasis: 'PEI Human Rights Act, s.6' },
    wage_dispute: { legalBasis: 'Employment Standards Act, Part 3' },
    health_safety: { legalBasis: 'Occupational Health and Safety Act' },
    termination: { legalBasis: 'Employment Standards Act, s.29–30' },
    employment_standards: { legalBasis: 'Employment Standards Act, RSPEI 1988' },
    right_of_refusal: { legalBasis: 'OHS Act, s.28' },
    unfair_labour_practice: { legalBasis: 'Labour Act, s.6–10' },
  }),
  NL: withLegalBasis(COMMON_CASE_TYPES, {
    harassment: { legalBasis: 'OHS Act regs; NL Human Rights Act, 2010' },
    discrimination: { legalBasis: 'Newfoundland and Labrador Human Rights Act, 2010, s.14' },
    wage_dispute: { legalBasis: 'Labour Standards Act, Part III' },
    health_safety: { legalBasis: 'Occupational Health and Safety Act' },
    termination: { legalBasis: 'Labour Standards Act, s.54–56' },
    employment_standards: { legalBasis: 'Labour Standards Act, RSNL 1990' },
    right_of_refusal: { legalBasis: 'OHS Act, s.45' },
    unfair_labour_practice: { legalBasis: 'Labour Relations Act, s.24–30' },
  }),
  YT: withLegalBasis(COMMON_CASE_TYPES, {
    harassment: { legalBasis: 'OHS Act regs; Yukon Human Rights Act' },
    discrimination: { legalBasis: 'Yukon Human Rights Act, s.7' },
    wage_dispute: { legalBasis: 'Employment Standards Act, Part 4' },
    health_safety: { legalBasis: 'Occupational Health and Safety Act' },
    termination: { legalBasis: 'Employment Standards Act, s.48–50' },
    employment_standards: { legalBasis: 'Employment Standards Act, RSY 2002' },
    right_of_refusal: { legalBasis: 'OHS Act, s.15' },
    unfair_labour_practice: { legalBasis: 'Public Service Labour Relations Act, s.69' },
  }),
  NT: withLegalBasis(COMMON_CASE_TYPES, {
    harassment: { legalBasis: 'Safety Act regs; NWT Human Rights Act' },
    discrimination: { legalBasis: 'NWT Human Rights Act, s.5' },
    wage_dispute: { legalBasis: 'Employment Standards Act, Part 3' },
    health_safety: { legalBasis: 'Safety Act, RSNWT 1988' },
    termination: { legalBasis: 'Employment Standards Act, s.28–30' },
    employment_standards: { legalBasis: 'Employment Standards Act, SNWT 2007' },
    right_of_refusal: { legalBasis: 'Safety Act, s.13' },
    unfair_labour_practice: { legalBasis: 'Public Service Act, Part 3' },
  }),
  NU: withLegalBasis(COMMON_CASE_TYPES, {
    harassment: { legalBasis: 'Safety Act regs; Nunavut Human Rights Act' },
    discrimination: { legalBasis: 'Nunavut Human Rights Act, s.7' },
    wage_dispute: { legalBasis: 'Labour Standards Act, Part III' },
    health_safety: { legalBasis: 'Safety Act (Nunavut)' },
    termination: { legalBasis: 'Labour Standards Act, s.28–30' },
    employment_standards: { legalBasis: 'Labour Standards Act (Nunavut)' },
    right_of_refusal: { legalBasis: 'Safety Act, s.13' },
    unfair_labour_practice: { legalBasis: 'Public Service Act, Part 3' },
  }),
  QC: withLegalBasis(COMMON_CASE_TYPES, {
    discipline: { legalBasis: 'Code du travail, art. 100.12' },
    harassment: { label: 'Psychological Harassment', legalBasis: 'Loi sur les normes du travail, art. 81.18–81.20' },
    discrimination: { legalBasis: 'Charte des droits et libertés de la personne, art. 10, 16' },
    wage_dispute: { legalBasis: 'LNT, art. 39.1–51' },
    health_safety: { legalBasis: 'LSST, art. 10, 12, 51; LATMP' },
    contracting_out: { legalBasis: 'Code du travail, art. 45–46' },
    termination: { legalBasis: 'LNT, art. 124; C.t. art. 15–17' },
    employment_standards: { legalBasis: 'Loi sur les normes du travail (LNT)' },
    right_of_refusal: { legalBasis: 'LSST, art. 12–31' },
    unfair_labour_practice: { legalBasis: 'Code du travail, art. 12–14' },
    union_dues: { legalBasis: 'Code du travail, art. 47' },
  }),
};

// ---------------------------------------------------------------------------
// LEGAL REFERENCES — Province-specific
// ---------------------------------------------------------------------------

const JURISDICTION_LEGAL_REFS: Record<CanadianJurisdiction, Record<string, { shortName: string; fullName: string; keyArticles: Record<string, string> }>> = {
  federal: {
    clc: { shortName: 'CLC', fullName: 'Canada Labour Code', keyArticles: { 'Part I': 'Industrial relations', 'Part II': 'Occupational health and safety', 'Part III': 'Employment standards', 's.128': 'Right of refusal', 's.94': 'Unfair labour practices' } },
    chra: { shortName: 'CHRA', fullName: 'Canadian Human Rights Act', keyArticles: { 's.3': 'Prohibited grounds', 's.7': 'Employment discrimination' } },
  },
  ON: {
    esa: { shortName: 'ESA', fullName: 'Employment Standards Act, 2000', keyArticles: { 's.17': 'Hours of work', 's.20': 'Eating periods', 's.22': 'Overtime pay', 's.54': 'Notice of termination' } },
    lra: { shortName: 'LRA', fullName: 'Labour Relations Act, 1995', keyArticles: { 's.48': 'Arbitration', 's.70': 'Unfair practices', 's.73': 'Employer ULP' } },
    ohsa: { shortName: 'OHSA', fullName: 'Occupational Health and Safety Act', keyArticles: { 's.25': 'Employer duties', 's.28': 'Worker duties', 's.43': 'Right to refuse', 's.32.0.1': 'Harassment' } },
    ohrc: { shortName: 'OHRC', fullName: 'Ontario Human Rights Code', keyArticles: { 's.5': 'Employment discrimination' } },
  },
  BC: {
    esa: { shortName: 'BC ESA', fullName: 'Employment Standards Act, RSBC 1996', keyArticles: { 's.32': 'Meal breaks', 's.35': 'Overtime', 's.63': 'Termination notice' } },
    lrc: { shortName: 'LRC', fullName: 'Labour Relations Code', keyArticles: { 's.6': 'Unfair practices', 's.84': 'Arbitration' } },
    wca: { shortName: 'WCA', fullName: 'Workers Compensation Act', keyArticles: { 'Part 3': 'OHS', 's.3.12': 'Right to refuse' } },
    hrc: { shortName: 'BCHRC', fullName: 'BC Human Rights Code', keyArticles: { 's.13': 'Employment discrimination' } },
  },
  AB: {
    esc: { shortName: 'ESC', fullName: 'Employment Standards Code, RSA 2000', keyArticles: { 's.18': 'Rest periods', 's.21': 'Overtime', 's.54': 'Notice of termination' } },
    alrc: { shortName: 'ALRC', fullName: 'Alberta Labour Relations Code', keyArticles: { 's.148': 'Unfair labour practices' } },
    ohsa: { shortName: 'OHS Act', fullName: 'Occupational Health and Safety Act', keyArticles: { 's.31': 'Right to refuse', 'Part 27': 'Harassment' } },
    ahra: { shortName: 'AHRA', fullName: 'Alberta Human Rights Act', keyArticles: { 's.7': 'Employment discrimination' } },
  },
  SK: {
    sea: { shortName: 'SEA', fullName: 'Saskatchewan Employment Act', keyArticles: { 'Part II': 'Employment standards', 'Part III': 'OHS', 'Part VI': 'Labour relations', 's.3-31': 'Right to refuse' } },
    shrc: { shortName: 'SHRC', fullName: 'Saskatchewan Human Rights Code, 2018', keyArticles: { 's.16': 'Employment discrimination' } },
  },
  MB: {
    esc: { shortName: 'ESC', fullName: 'Employment Standards Code, CCSM c.E110', keyArticles: { 'Part 2': 'Hours/breaks', 'Part 3': 'Overtime', 'Part 7': 'Termination' } },
    lra: { shortName: 'LRA', fullName: 'Labour Relations Act', keyArticles: { 's.6': 'Unfair practices' } },
    wsha: { shortName: 'WSHA', fullName: 'Workplace Safety and Health Act', keyArticles: { 's.43': 'Right to refuse' } },
    mhrc: { shortName: 'MHRC', fullName: 'Manitoba Human Rights Code', keyArticles: { 's.14': 'Employment discrimination' } },
  },
  NB: {
    esa: { shortName: 'ESA', fullName: 'Employment Standards Act, SNB 1982', keyArticles: { 'Part III': 'Wages', 'Part V': 'Termination' } },
    ira: { shortName: 'IRA', fullName: 'Industrial Relations Act', keyArticles: { 's.3': 'Unfair practices' } },
    ohsa: { shortName: 'OHS Act', fullName: 'Occupational Health and Safety Act', keyArticles: { 's.19': 'Right to refuse' } },
    nbhra: { shortName: 'NBHRA', fullName: 'New Brunswick Human Rights Act', keyArticles: { 's.4': 'Employment discrimination' } },
  },
  NS: {
    lsc: { shortName: 'LSC', fullName: 'Labour Standards Code, RSNS 1989', keyArticles: { 'Part III': 'Wages', 's.72': 'Notice of termination' } },
    tua: { shortName: 'TUA', fullName: 'Trade Union Act', keyArticles: { 's.53': 'Unfair practices' } },
    whsa: { shortName: 'WHSA', fullName: 'Workplace Health and Safety Act', keyArticles: { 's.43': 'Right to refuse' } },
    nshra: { shortName: 'NSHRA', fullName: 'Nova Scotia Human Rights Act', keyArticles: { 's.5': 'Employment discrimination' } },
  },
  PE: {
    esa: { shortName: 'ESA', fullName: 'Employment Standards Act, RSPEI 1988', keyArticles: { 'Part 3': 'Wages/hours', 's.29': 'Termination' } },
    la: { shortName: 'LA', fullName: 'Labour Act', keyArticles: { 's.6': 'Unfair practices' } },
    ohsa: { shortName: 'OHS Act', fullName: 'Occupational Health and Safety Act', keyArticles: { 's.28': 'Right to refuse' } },
    peihra: { shortName: 'PEIHRA', fullName: 'PEI Human Rights Act', keyArticles: { 's.6': 'Employment discrimination' } },
  },
  NL: {
    lsa: { shortName: 'LSA', fullName: 'Labour Standards Act, RSNL 1990', keyArticles: { 'Part III': 'Wages', 's.54': 'Notice of termination' } },
    lra: { shortName: 'LRA', fullName: 'Labour Relations Act', keyArticles: { 's.24': 'Unfair practices' } },
    ohsa: { shortName: 'OHS Act', fullName: 'Occupational Health and Safety Act', keyArticles: { 's.45': 'Right to refuse' } },
    nlhra: { shortName: 'NLHRA', fullName: 'Newfoundland and Labrador Human Rights Act, 2010', keyArticles: { 's.14': 'Employment discrimination' } },
  },
  YT: {
    esa: { shortName: 'ESA', fullName: 'Employment Standards Act, RSY 2002', keyArticles: { 'Part 4': 'Wages/hours', 's.48': 'Termination' } },
    pslra: { shortName: 'PSLRA', fullName: 'Public Service Labour Relations Act', keyArticles: { 's.69': 'Unfair practices' } },
    ohsa: { shortName: 'OHS Act', fullName: 'Occupational Health and Safety Act', keyArticles: { 's.15': 'Right to refuse' } },
    yhra: { shortName: 'YHRA', fullName: 'Yukon Human Rights Act', keyArticles: { 's.7': 'Employment discrimination' } },
  },
  NT: {
    esa: { shortName: 'ESA', fullName: 'Employment Standards Act, SNWT 2007', keyArticles: { 'Part 3': 'Wages/hours', 's.28': 'Termination' } },
    psa: { shortName: 'PSA', fullName: 'Public Service Act', keyArticles: { 'Part 3': 'Labour relations' } },
    sa: { shortName: 'Safety Act', fullName: 'Safety Act, RSNWT 1988', keyArticles: { 's.13': 'Right to refuse' } },
    nwthra: { shortName: 'NWTHRA', fullName: 'NWT Human Rights Act', keyArticles: { 's.5': 'Employment discrimination' } },
  },
  NU: {
    lsa: { shortName: 'LSA', fullName: 'Labour Standards Act (Nunavut)', keyArticles: { 'Part III': 'Wages/hours', 's.28': 'Termination' } },
    psa: { shortName: 'PSA', fullName: 'Public Service Act (Nunavut)', keyArticles: { 'Part 3': 'Labour relations' } },
    sa: { shortName: 'Safety Act', fullName: 'Safety Act (Nunavut)', keyArticles: { 's.13': 'Right to refuse' } },
    nuhra: { shortName: 'NUHRA', fullName: 'Nunavut Human Rights Act', keyArticles: { 's.7': 'Employment discrimination' } },
  },
  QC: {
    ct: { shortName: 'C.t.', fullName: 'Code du travail', keyArticles: { 'art. 12–14': 'Unfair practices', 'art. 45–46': 'Contracting out', 'art. 100.12': 'Discipline arbitration' } },
    lnt: { shortName: 'LNT', fullName: 'Loi sur les normes du travail', keyArticles: { 'art. 39.1–51': 'Wages', 'art. 79–81': 'Leaves', 'art. 81.18–81.20': 'Harassment', 'art. 124': 'Unjust dismissal' } },
    lsst: { shortName: 'LSST', fullName: 'Loi sur la santé et la sécurité du travail', keyArticles: { 'art. 10': 'Worker rights', 'art. 12–31': 'Right of refusal', 'art. 40–48': 'Preventive withdrawal' } },
    latmp: { shortName: 'LATMP', fullName: 'Loi sur les accidents du travail et les maladies professionnelles', keyArticles: { 'art. 1': 'Scope', 'art. 270': 'Claims' } },
    cdlp: { shortName: 'CDLP', fullName: 'Charte des droits et libertés de la personne', keyArticles: { 'art. 10': 'Prohibited grounds', 'art. 16': 'Employment discrimination' } },
  },
};

// ---------------------------------------------------------------------------
// BOARDS — Province-specific
// ---------------------------------------------------------------------------

const JURISDICTION_BOARDS: Record<CanadianJurisdiction, Record<string, { name: string; abbreviation: string; scope: string }>> = {
  federal: { cirb: { name: 'Canada Industrial Relations Board', abbreviation: 'CIRB', scope: 'Federal labour relations, certification, ULP' } },
  ON: { olrb: { name: 'Ontario Labour Relations Board', abbreviation: 'OLRB', scope: 'Certification, ULP, successor rights' }, wsib: { name: 'Workplace Safety and Insurance Board', abbreviation: 'WSIB', scope: 'Workers compensation claims' } },
  BC: { bclrb: { name: 'British Columbia Labour Relations Board', abbreviation: 'BCLRB', scope: 'Certification, ULP' }, worksafebc: { name: 'WorkSafeBC', abbreviation: 'WSBC', scope: 'Workers compensation and OHS' } },
  AB: { alrb: { name: 'Alberta Labour Relations Board', abbreviation: 'ALRB', scope: 'Certification, ULP' }, wcb_ab: { name: 'Workers Compensation Board – Alberta', abbreviation: 'WCB-AB', scope: 'Workers compensation claims' } },
  SK: { slrb: { name: 'Saskatchewan Labour Relations Board', abbreviation: 'SLRB', scope: 'Certification, ULP' }, wcb_sk: { name: 'Workers Compensation Board – Saskatchewan', abbreviation: 'WCB-SK', scope: 'Workers compensation claims' } },
  MB: { mlb: { name: 'Manitoba Labour Board', abbreviation: 'MLB', scope: 'Certification, ULP' }, wcb_mb: { name: 'Workers Compensation Board – Manitoba', abbreviation: 'WCB-MB', scope: 'Workers compensation claims' } },
  NB: { nbleb: { name: 'New Brunswick Labour and Employment Board', abbreviation: 'NBLEB', scope: 'Certification, ULP' }, worksafenb: { name: 'WorkSafeNB', abbreviation: 'WSNB', scope: 'Workers compensation claims' } },
  NS: { nslrb: { name: 'Nova Scotia Labour Relations Board', abbreviation: 'NSLRB', scope: 'Certification, ULP' }, wcb_ns: { name: 'Workers Compensation Board – Nova Scotia', abbreviation: 'WCB-NS', scope: 'Workers compensation claims' } },
  PE: { peilrb: { name: 'PEI Labour Relations Board', abbreviation: 'PEILRB', scope: 'Certification, ULP' }, wcb_pe: { name: 'Workers Compensation Board – PEI', abbreviation: 'WCB-PE', scope: 'Workers compensation claims' } },
  NL: { nllrb: { name: 'Newfoundland and Labrador Labour Relations Board', abbreviation: 'NLLRB', scope: 'Certification, ULP' }, whscc_nl: { name: 'Workplace Health, Safety and Compensation Commission', abbreviation: 'WHSCC', scope: 'Workers compensation claims' } },
  YT: { pslrb_yt: { name: 'Yukon Public Service Labour Relations Board', abbreviation: 'YPSLRB', scope: 'Public-sector certification, ULP' }, wcb_yt: { name: 'Yukon Workers Compensation Health and Safety Board', abbreviation: 'YWCHSB', scope: 'Workers compensation claims' } },
  NT: { psa_nt: { name: 'NWT Arbitration Board', abbreviation: 'NWT-ARB', scope: 'Public-sector labour disputes' }, wscc_nt: { name: 'Workers Safety and Compensation Commission', abbreviation: 'WSCC', scope: 'Workers compensation claims (NT + NU)' } },
  NU: { psa_nu: { name: 'Nunavut Arbitration Board', abbreviation: 'NU-ARB', scope: 'Public-sector labour disputes' }, wscc_nu: { name: 'Workers Safety and Compensation Commission', abbreviation: 'WSCC', scope: 'Workers compensation claims (NT + NU)' } },
  QC: { tat: { name: 'Tribunal administratif du travail', abbreviation: 'TAT', scope: 'Labour relations, OHS appeals, certification' }, cnesst: { name: 'Commission des normes, de l\'équité, de la santé et de la sécurité du travail', abbreviation: 'CNESST', scope: 'Labour standards, pay equity, OHS, WCB' } },
};

// ---------------------------------------------------------------------------
// VOCABULARY BUILDER
// ---------------------------------------------------------------------------

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

const ALL_JURISDICTIONS = Object.keys(JURISDICTION_NAMES) as CanadianJurisdiction[];

export function getVocabulary(jurisdiction: CanadianJurisdiction): JurisdictionVocabulary {
  return {
    jurisdiction,
    name: JURISDICTION_NAMES[jurisdiction],
    caseTypes: JURISDICTION_CASE_TYPES[jurisdiction],
    priorities: PRIORITIES,
    severities: SEVERITIES,
    roles: ROLES,
    statuses: STATUSES,
    boards: JURISDICTION_BOARDS[jurisdiction],
    legalReferences: JURISDICTION_LEGAL_REFS[jurisdiction],
    version: '1.0.0',
  };
}

export function getAllJurisdictions(): CanadianJurisdiction[] {
  return [...ALL_JURISDICTIONS];
}

export function getJurisdictionName(jurisdiction: CanadianJurisdiction): string {
  return JURISDICTION_NAMES[jurisdiction];
}

export function getCaseTypes(jurisdiction: CanadianJurisdiction): CaseType[] {
  return JURISDICTION_CASE_TYPES[jurisdiction];
}

export function getCaseTypeIds(jurisdiction: CanadianJurisdiction): string[] {
  return JURISDICTION_CASE_TYPES[jurisdiction].map((ct) => ct.id);
}

export function getPriorities(): Priority[] {
  return [...PRIORITIES];
}

export function getPriorityIds(): string[] {
  return PRIORITIES.map((p) => p.id);
}

export function getStatuses(): GrievanceStatus[] {
  return [...STATUSES];
}

export function getStatusIds(): string[] {
  return STATUSES.map((s) => s.id);
}

export function getRoles(): GrievanceRole[] {
  return [...ROLES];
}

export function getRoleIds(): string[] {
  return ROLES.map((r) => r.id);
}
