/**
 * Quebec Labour Law Engine
 * 
 * Comprehensive Quebec-specific labour regulations covering:
 * - CNESST integration (workplace standards, safety, pay equity)
 * - Anti-scab provisions (Code du travail art. 109.1)
 * - Loi sur les normes du travail (LNT) enforcement
 * - Break rules under LNT art. 78–79
 * - TAT certification process (art. 21–46)
 * - Essential services (art. 111.0.15–111.0.26)
 * 
 * @module quebec-labour-law
 */

// =============================================================================
// CNESST STANDARDS (Normes du travail — LNT)
// =============================================================================

export interface LNTBreakRule {
  type: 'meal' | 'weekly_rest';
  description: string;
  descriptionFr: string;
  article: string;
  consecutiveHoursTrigger: number;
  durationMinutes: number;
  paid: boolean;
  exceptions: string[];
}

/**
 * Quebec meal and rest break rules per LNT art. 78–79.
 * These are MINIMUM standards — CBAs can provide better entitlements.
 */
export const LNT_BREAK_RULES: LNTBreakRule[] = [
  {
    type: 'meal',
    description: 'Employer must grant an unpaid meal break of 30 minutes after 5 consecutive hours of work',
    descriptionFr: 'L\'employeur doit accorder une pause-repas non rémunérée de 30 minutes après 5 heures consécutives de travail',
    article: 'LNT art. 79',
    consecutiveHoursTrigger: 5,
    durationMinutes: 30,
    paid: false,
    exceptions: [
      'Break is paid if employee must remain at their workstation',
      'CBA may provide more generous break provisions',
    ],
  },
  {
    type: 'weekly_rest',
    description: 'Employee is entitled to a minimum weekly rest period of 32 consecutive hours',
    descriptionFr: 'Le salarié a droit à un repos hebdomadaire minimal de 32 heures consécutives',
    article: 'LNT art. 78',
    consecutiveHoursTrigger: 0,
    durationMinutes: 32 * 60,
    paid: false,
    exceptions: [
      'Agricultural workers during harvest season',
      'Senior management personnel exempt from LNT',
    ],
  },
];

// =============================================================================
// LNT EMPLOYMENT STANDARDS
// =============================================================================

export interface LNTStandard {
  id: string;
  name: string;
  nameFr: string;
  article: string;
  description: string;
  descriptionFr: string;
  value: string;
  enforceableBy: 'CNESST' | 'TAT' | 'both';
}

export const LNT_STANDARDS: LNTStandard[] = [
  {
    id: 'minimum_wage',
    name: 'Minimum Wage',
    nameFr: 'Salaire minimum',
    article: 'art. 40',
    description: 'Minimum hourly wage rate set annually by regulation',
    descriptionFr: 'Taux horaire minimal fixé annuellement par règlement',
    value: '$15.75/h (2026)',
    enforceableBy: 'CNESST',
  },
  {
    id: 'overtime',
    name: 'Overtime',
    nameFr: 'Heures supplémentaires',
    article: 'art. 55',
    description: 'Work exceeding 40 hours per week paid at 1.5× regular rate',
    descriptionFr: 'Travail excédant 40 heures/semaine rémunéré à 1,5 fois le taux régulier',
    value: '40h/week threshold, 1.5× rate',
    enforceableBy: 'CNESST',
  },
  {
    id: 'annual_leave',
    name: 'Annual Leave',
    nameFr: 'Congé annuel',
    article: 'art. 66–77',
    description: 'Minimum annual vacation entitlement based on years of continuous service',
    descriptionFr: 'Droit minimal au congé annuel selon les années de service continu',
    value: '<1yr: 1 day/month; 1–3yr: 2 weeks; 3+yr: 3 weeks',
    enforceableBy: 'CNESST',
  },
  {
    id: 'statutory_holidays',
    name: 'Statutory Holidays',
    nameFr: 'Jours fériés',
    article: 'art. 60–65',
    description: 'Paid statutory holidays (8 in Quebec)',
    descriptionFr: 'Jours fériés chômés et payés (8 au Québec)',
    value: 'Jan 1, Good Friday/Easter Mon, May 24, Jun 24 (St-Jean), Jul 1, 1st Mon Sep, 2nd Mon Oct, Dec 25',
    enforceableBy: 'CNESST',
  },
  {
    id: 'notice_of_termination',
    name: 'Notice of Termination',
    nameFr: 'Avis de cessation d\'emploi',
    article: 'art. 82–83',
    description: 'Minimum notice period based on years of continuous service',
    descriptionFr: 'Délai de préavis minimal selon les années de service continu',
    value: '3mo–1yr: 1 week; 1–5yr: 2 weeks; 5–10yr: 4 weeks; 10+yr: 8 weeks',
    enforceableBy: 'CNESST',
  },
  {
    id: 'psychological_harassment',
    name: 'Psychological Harassment Prevention',
    nameFr: 'Prévention du harcèlement psychologique',
    article: 'art. 81.18–81.20',
    description: 'Employer must take reasonable action to prevent and stop psychological harassment including sexual harassment',
    descriptionFr: 'L\'employeur doit prendre les moyens raisonnables pour prévenir et faire cesser le harcèlement psychologique y compris le harcèlement sexuel',
    value: 'Policy + complaint mechanism + investigation required',
    enforceableBy: 'both',
  },
  {
    id: 'unjust_dismissal',
    name: 'Unjust Dismissal Complaint',
    nameFr: 'Plainte pour congédiement sans cause juste et suffisante',
    article: 'art. 124',
    description: 'Employee with 2+ years of continuous service may file complaint for unjust dismissal',
    descriptionFr: 'Le salarié justifiant 2 ans et plus de service continu peut porter plainte pour congédiement injustifié',
    value: '45-day filing deadline from dismissal',
    enforceableBy: 'both',
  },
  {
    id: 'prohibited_practices',
    name: 'Prohibited Practices',
    nameFr: 'Pratiques interdites',
    article: 'art. 122',
    description: 'Employer cannot dismiss, suspend, or discriminate against employee for exercising LNT rights',
    descriptionFr: 'L\'employeur ne peut congédier, suspendre ou exercer de discrimination contre un salarié qui exerce un droit prévu par la LNT',
    value: 'Presumption in favor of employee — burden on employer',
    enforceableBy: 'both',
  },
];

// =============================================================================
// ANTI-SCAB PROVISIONS (Code du travail art. 109.1)
// =============================================================================

export interface AntiScabRule {
  article: string;
  description: string;
  descriptionFr: string;
  prohibitions: string[];
  prohibitionsFr: string[];
  exceptions: string[];
  exceptionsFr: string[];
  penalties: string[];
  penaltiesFr: string[];
}

/**
 * Quebec Anti-Scab Law — Code du travail art. 109.1
 * 
 * Quebec has the strongest anti-replacement-worker provisions in Canada.
 * During a strike or lockout, the employer is PROHIBITED from:
 * 1. Using replacement workers (scabs) to perform bargaining unit work
 * 2. Using employees from another establishment
 * 3. Using subcontractors to perform bargaining unit work
 * 4. Using management to perform bargaining unit work
 * 
 * Violation is a penal offence with fines of $1,000–$10,000 per day.
 */
export const ANTI_SCAB_RULES: AntiScabRule = {
  article: 'Code du travail, art. 109.1',
  description: 'During a strike or lockout, the employer cannot use replacement workers to perform the work of employees in the bargaining unit on strike or locked out',
  descriptionFr: 'Pendant une grève ou un lock-out, l\'employeur ne peut utiliser les services de personnes pour remplir les fonctions des salariés de l\'unité de négociation en grève ou en lock-out',
  prohibitions: [
    'Hiring external replacement workers (scabs)',
    'Using employees hired after the notice of negotiation was received',
    'Using employees from another establishment of the same employer',
    'Using subcontractors to perform bargaining unit work',
    'Using managers or supervisors to perform bargaining unit work (with narrow exceptions)',
  ],
  prohibitionsFr: [
    'Embaucher des travailleurs de remplacement externes (briseurs de grève)',
    'Utiliser des salariés embauchés après la réception de l\'avis de négociation',
    'Utiliser des salariés d\'un autre établissement du même employeur',
    'Utiliser des sous-traitants pour effectuer le travail de l\'unité de négociation',
    'Utiliser des cadres ou superviseurs pour effectuer le travail de l\'unité (avec exceptions limitées)',
  ],
  exceptions: [
    'Essential services personnel designated by TAT under art. 111.0.15–111.0.26',
    'Work required to prevent destruction or serious deterioration of property (maintenance only)',
    'Work necessary to avoid danger to health, safety, or life',
  ],
  exceptionsFr: [
    'Personnel des services essentiels désigné par le TAT selon art. 111.0.15–111.0.26',
    'Travaux nécessaires pour empêcher la destruction ou la détérioration grave des biens (entretien seulement)',
    'Travaux nécessaires pour éviter un danger pour la santé, la sécurité ou la vie',
  ],
  penalties: [
    'Penal offence: fine of $1,000 to $10,000 per day of violation',
    'TAT may order cessation of anti-scab violation',
    'Interim injunction available',
    'Each day of violation constitutes a separate offence',
  ],
  penaltiesFr: [
    'Infraction pénale : amende de 1 000 $ à 10 000 $ par jour d\'infraction',
    'Le TAT peut ordonner la cessation de la violation',
    'Injonction provisoire disponible',
    'Chaque jour d\'infraction constitue une infraction distincte',
  ],
};

// =============================================================================
// CNESST INTEGRATION
// =============================================================================

export interface CNESSTFiling {
  type: 'workplace_accident' | 'occupational_disease' | 'preventive_withdrawal' | 'right_of_refusal' | 'harassment_complaint' | 'standards_complaint' | 'pay_equity';
  name: string;
  nameFr: string;
  description: string;
  descriptionFr: string;
  filingDeadline: string;
  legalBasis: string;
  form?: string;
}

export const CNESST_FILING_TYPES: CNESSTFiling[] = [
  {
    type: 'workplace_accident',
    name: 'Workplace Accident Report',
    nameFr: 'Déclaration d\'accident du travail',
    description: 'Report of a work-related accident causing injury',
    descriptionFr: 'Signalement d\'un accident du travail causant une blessure',
    filingDeadline: 'Within 6 months of accident (LATMP art. 271)',
    legalBasis: 'LATMP, art. 2, 271',
    form: 'Réclamation du travailleur',
  },
  {
    type: 'occupational_disease',
    name: 'Occupational Disease Claim',
    nameFr: 'Réclamation pour maladie professionnelle',
    description: 'Claim for a disease attributable to work conditions',
    descriptionFr: 'Réclamation pour une maladie attribuable aux conditions de travail',
    filingDeadline: 'Within 6 months of diagnosis (LATMP art. 272)',
    legalBasis: 'LATMP, art. 29, 272',
  },
  {
    type: 'preventive_withdrawal',
    name: 'Preventive Withdrawal (Pregnancy)',
    nameFr: 'Retrait préventif (grossesse)',
    description: 'Request to be reassigned or withdrawn from dangerous conditions during pregnancy or breastfeeding',
    descriptionFr: 'Demande de réaffectation ou de retrait des conditions dangereuses pendant la grossesse ou l\'allaitement',
    filingDeadline: 'Immediately upon medical certificate',
    legalBasis: 'LSST, art. 40–48',
  },
  {
    type: 'right_of_refusal',
    name: 'Right of Refusal',
    nameFr: 'Droit de refus',
    description: 'Exercise of the right to refuse dangerous work',
    descriptionFr: 'Exercice du droit de refuser un travail dangereux',
    filingDeadline: 'Immediate — notify supervisor and H&S representative',
    legalBasis: 'LSST, art. 12–31',
  },
  {
    type: 'harassment_complaint',
    name: 'Psychological Harassment Complaint',
    nameFr: 'Plainte pour harcèlement psychologique',
    description: 'Complaint for psychological or sexual harassment at work',
    descriptionFr: 'Plainte pour harcèlement psychologique ou sexuel au travail',
    filingDeadline: '2 years from last incident (LNT art. 123.7)',
    legalBasis: 'LNT, art. 81.18–81.20, 123.6–123.16',
  },
  {
    type: 'standards_complaint',
    name: 'Labour Standards Complaint',
    nameFr: 'Plainte pour violation des normes du travail',
    description: 'Complaint for violation of minimum employment standards',
    descriptionFr: 'Plainte pour violation des normes minimales d\'emploi',
    filingDeadline: '1 year for wages/overtime; 45 days for unjust dismissal (LNT art. 115, 124)',
    legalBasis: 'LNT, art. 102–135',
  },
  {
    type: 'pay_equity',
    name: 'Pay Equity Complaint',
    nameFr: 'Plainte en matière d\'équité salariale',
    description: 'Complaint regarding pay equity between male- and female-dominated job classes',
    descriptionFr: 'Plainte concernant l\'équité salariale entre catégories d\'emploi à prédominance masculine et féminine',
    filingDeadline: '60 days after posting of results (Loi sur l\'équité salariale art. 76.2)',
    legalBasis: 'Loi sur l\'équité salariale',
  },
];

// =============================================================================
// TAT CERTIFICATION PROCESS
// =============================================================================

export interface TATCertificationStep {
  step: number;
  name: string;
  nameFr: string;
  description: string;
  descriptionFr: string;
  article: string;
  deadline?: string;
}

export const TAT_CERTIFICATION_PROCESS: TATCertificationStep[] = [
  {
    step: 1,
    name: 'Card Signing Campaign',
    nameFr: 'Campagne de signature de cartes',
    description: 'Collect signed membership cards from at least 50%+1 of employees in the proposed bargaining unit',
    descriptionFr: 'Recueillir les cartes d\'adhésion signées d\'au moins 50 %+1 des salariés de l\'unité de négociation proposée',
    article: 'C.t. art. 21, 22, 28',
    deadline: 'Cards valid for 12 months (art. 22(d))',
  },
  {
    step: 2,
    name: 'Application for Certification (Requête en accréditation)',
    nameFr: 'Dépôt de la requête en accréditation',
    description: 'File the application with the TAT including membership cards, employee list, union constitution',
    descriptionFr: 'Déposer la requête auprès du TAT avec les cartes d\'adhésion, la liste des salariés, les statuts du syndicat',
    article: 'C.t. art. 25–27',
  },
  {
    step: 3,
    name: 'Employer Notification & Employee List',
    nameFr: 'Avis à l\'employeur et liste des salariés',
    description: 'TAT notifies employer, who must produce employee list. Failure triggers automatic certification',
    descriptionFr: 'Le TAT avise l\'employeur qui doit produire la liste des salariés. Le défaut entraîne l\'accréditation automatique',
    article: 'C.t. art. 25',
    deadline: 'Employer has 5 days to post notice and produce employee list',
  },
  {
    step: 4,
    name: 'Verification of Membership Evidence',
    nameFr: 'Vérification des adhésions',
    description: 'TAT agent verifies that membership cards represent absolute majority (50%+1)',
    descriptionFr: 'L\'agent du TAT vérifie que les cartes d\'adhésion représentent la majorité absolue (50 %+1)',
    article: 'C.t. art. 28–32',
  },
  {
    step: 5,
    name: 'Determination of Bargaining Unit',
    nameFr: 'Détermination de l\'unité de négociation',
    description: 'TAT determines the appropriate bargaining unit if employer contests the proposed unit',
    descriptionFr: 'Le TAT détermine l\'unité de négociation appropriée si l\'employeur conteste l\'unité proposée',
    article: 'C.t. art. 32–39',
  },
  {
    step: 6,
    name: 'Vote (if ordered)',
    nameFr: 'Vote (si ordonné)',
    description: 'TAT may order a secret ballot vote if membership evidence is contested or in specific circumstances',
    descriptionFr: 'Le TAT peut ordonner un vote au scrutin secret si les adhésions sont contestées ou dans des circonstances particulières',
    article: 'C.t. art. 37–37.2',
    deadline: 'Vote held within 10 days of TAT order',
  },
  {
    step: 7,
    name: 'Certification Decision',
    nameFr: 'Décision d\'accréditation',
    description: 'TAT grants certification (accréditation) if requirements are met',
    descriptionFr: 'Le TAT accorde l\'accréditation si les conditions sont remplies',
    article: 'C.t. art. 28, 32, 37',
  },
  {
    step: 8,
    name: 'Obligation to Negotiate',
    nameFr: 'Obligation de négocier',
    description: 'Once certified, employer must negotiate in good faith within 8 days of receiving notice',
    descriptionFr: 'Une fois accrédité, l\'employeur doit négocier de bonne foi dans les 8 jours de la réception de l\'avis',
    article: 'C.t. art. 53',
    deadline: '8 days after receiving notice to bargain',
  },
];

// =============================================================================
// ESSENTIAL SERVICES (art. 111.0.15–111.0.26)
// =============================================================================

export interface EssentialServiceSector {
  id: string;
  name: string;
  nameFr: string;
  article: string;
  description: string;
  descriptionFr: string;
}

export const ESSENTIAL_SERVICE_SECTORS: EssentialServiceSector[] = [
  {
    id: 'public_sector',
    name: 'Public Sector',
    nameFr: 'Secteur public',
    article: 'C.t. art. 111.0.16',
    description: 'Government of Quebec, school boards, colleges, health and social services agencies',
    descriptionFr: 'Gouvernement du Québec, commissions scolaires, cégeps, agences de santé et de services sociaux',
  },
  {
    id: 'parapublic',
    name: 'Parapublic Sector',
    nameFr: 'Secteur parapublic',
    article: 'C.t. art. 111.0.16',
    description: 'Health care facilities, schools, social services — must maintain essential services during strike',
    descriptionFr: 'Établissements de santé, écoles, services sociaux — doivent maintenir les services essentiels pendant la grève',
  },
  {
    id: 'municipal',
    name: 'Municipal Services',
    nameFr: 'Services municipaux',
    article: 'C.t. art. 111.0.15',
    description: 'Fire, police, transit, water treatment — essential services must be maintained',
    descriptionFr: 'Pompiers, policiers, transport en commun, traitement des eaux — les services essentiels doivent être maintenus',
  },
];

// =============================================================================
// COMPLIANCE CHECKING
// =============================================================================

export interface BreakComplianceResult {
  compliant: boolean;
  rule: LNTBreakRule;
  violation?: string;
  violationFr?: string;
  recommendation?: string;
  recommendationFr?: string;
}

/**
 * Check if a shift complies with LNT break requirements.
 * 
 * @param shiftHours Total hours of the shift
 * @param mealBreakMinutes Minutes of meal break provided
 * @param mealBreakPaid Whether the meal break is paid
 * @returns Compliance result with potential violation details
 */
export function checkBreakCompliance(
  shiftHours: number,
  mealBreakMinutes: number,
  mealBreakPaid: boolean,
  employeeRemainsAtWorkstation = false,
): BreakComplianceResult {
  const mealRule = LNT_BREAK_RULES.find(r => r.type === 'meal')!;

  if (shiftHours >= mealRule.consecutiveHoursTrigger && mealBreakMinutes < mealRule.durationMinutes) {
    return {
      compliant: false,
      rule: mealRule,
      violation: `Shift of ${shiftHours}h exceeds ${mealRule.consecutiveHoursTrigger}h consecutive but only ${mealBreakMinutes}min meal break provided (minimum ${mealRule.durationMinutes}min required per ${mealRule.article})`,
      violationFr: `Quart de ${shiftHours}h dépasse ${mealRule.consecutiveHoursTrigger}h consécutives mais seulement ${mealBreakMinutes}min de pause-repas accordée (minimum ${mealRule.durationMinutes}min requis selon ${mealRule.article})`,
      recommendation: 'Schedule a minimum 30-minute meal break within the shift',
      recommendationFr: 'Prévoir une pause-repas d\'au moins 30 minutes au cours du quart de travail',
    };
  }

  // LNT art. 79: break must be paid if employee remains at workstation
  if (employeeRemainsAtWorkstation && !mealBreakPaid) {
    return {
      compliant: false,
      rule: mealRule,
      violation: `Employee remains at workstation during meal break but break is unpaid (${mealRule.article} — break must be paid when employee cannot leave)`,
      violationFr: `Le salarié reste à son poste de travail durant la pause-repas mais celle-ci n'est pas rémunérée (${mealRule.article} — la pause doit être payée si le salarié ne peut quitter)`,
      recommendation: 'Compensate meal break as paid time when employee must stay at workstation',
      recommendationFr: 'Rémunérer la pause-repas lorsque le salarié doit demeurer à son poste de travail',
    };
  }

  return { compliant: true, rule: mealRule };
}

/**
 * Check if a work week complies with LNT weekly rest requirements.
 * 
 * @param maxConsecutiveHoursWithoutRest Maximum consecutive hours worked without 32h rest
 * @returns Compliance result
 */
export function checkWeeklyRestCompliance(
  maxConsecutiveHoursWithoutRest: number,
): BreakComplianceResult {
  const restRule = LNT_BREAK_RULES.find(r => r.type === 'weekly_rest')!;
  const maxAllowed = 7 * 24 - restRule.durationMinutes / 60; // 136 hours

  if (maxConsecutiveHoursWithoutRest > maxAllowed) {
    return {
      compliant: false,
      rule: restRule,
      violation: `Employee worked ${maxConsecutiveHoursWithoutRest}h without the required 32h weekly rest period (${restRule.article})`,
      violationFr: `Le salarié a travaillé ${maxConsecutiveHoursWithoutRest}h sans la période de repos hebdomadaire de 32h requise (${restRule.article})`,
    };
  }

  return { compliant: true, rule: restRule };
}

/**
 * Validate that an employer's anti-scab practices comply with art. 109.1.
 * 
 * @param isStrikeOrLockout Whether a strike or lockout is currently active
 * @param usingReplacementWorkers Whether replacement workers are being used
 * @param usingOtherEstablishmentEmployees Whether employees from another establishment are used
 * @param usingSubcontractors Whether subcontractors are performing bargaining unit work
 * @returns Object with compliance status and violation details
 */
export function checkAntiScabCompliance(
  isStrikeOrLockout: boolean,
  usingReplacementWorkers: boolean,
  usingOtherEstablishmentEmployees: boolean,
  usingSubcontractors: boolean,
): { compliant: boolean; violations: string[]; violationsFr: string[] } {
  if (!isStrikeOrLockout) {
    return { compliant: true, violations: [], violationsFr: [] };
  }

  const violations: string[] = [];
  const violationsFr: string[] = [];

  if (usingReplacementWorkers) {
    violations.push('Use of replacement workers during strike/lockout violates C.t. art. 109.1');
    violationsFr.push('L\'utilisation de travailleurs de remplacement pendant la grève/lock-out viole l\'art. 109.1 C.t.');
  }
  if (usingOtherEstablishmentEmployees) {
    violations.push('Use of employees from another establishment during strike/lockout violates C.t. art. 109.1');
    violationsFr.push('L\'utilisation de salariés d\'un autre établissement pendant la grève/lock-out viole l\'art. 109.1 C.t.');
  }
  if (usingSubcontractors) {
    violations.push('Use of subcontractors to perform bargaining unit work during strike/lockout violates C.t. art. 109.1');
    violationsFr.push('L\'utilisation de sous-traitants pour effectuer le travail de l\'unité pendant la grève/lock-out viole l\'art. 109.1 C.t.');
  }

  return {
    compliant: violations.length === 0,
    violations,
    violationsFr,
  };
}

/**
 * Calculate notice of termination requirements under LNT art. 82–83.
 */
export function calculateTerminationNotice(
  yearsOfContinuousService: number,
): { weeks: number; article: string; description: string; descriptionFr: string } {
  let weeks: number;
  if (yearsOfContinuousService < 0.25) {
    weeks = 0; // less than 3 months — no notice required
  } else if (yearsOfContinuousService < 1) {
    weeks = 1;
  } else if (yearsOfContinuousService < 5) {
    weeks = 2;
  } else if (yearsOfContinuousService < 10) {
    weeks = 4;
  } else {
    weeks = 8;
  }

  return {
    weeks,
    article: 'LNT art. 82',
    description: `${weeks} week(s) notice required for ${yearsOfContinuousService.toFixed(1)} years of service`,
    descriptionFr: `${weeks} semaine(s) de préavis requis pour ${yearsOfContinuousService.toFixed(1)} années de service`,
  };
}

/**
 * Calculate overtime threshold under LNT art. 55.
 * Standard work week in Quebec: 40 hours. Overtime at 1.5× after 40h.
 */
export function calculateOvertime(
  hoursWorked: number,
  hourlyRate: number,
): { regularHours: number; overtimeHours: number; regularPay: number; overtimePay: number; totalPay: number } {
  const threshold = 40;
  const regularHours = Math.min(hoursWorked, threshold);
  const overtimeHours = Math.max(hoursWorked - threshold, 0);
  const regularPay = regularHours * hourlyRate;
  const overtimePay = overtimeHours * hourlyRate * 1.5;

  return {
    regularHours,
    overtimeHours,
    regularPay,
    overtimePay,
    totalPay: regularPay + overtimePay,
  };
}
