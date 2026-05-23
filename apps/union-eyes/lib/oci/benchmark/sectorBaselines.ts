/**
 * OCI Benchmark Intelligence — sector baselines.
 *
 * Characteristic profiles for organizational sectors the method recognises.
 * Baselines ground a pilot in sector-appropriate expectation. They are
 * never used to rank institutions against each other.
 *
 * Ranges are intentionally wide. An institution outside a range is not
 * deficient; it is differently shaped. The facilitator names the
 * difference institutionally rather than evaluating it numerically.
 *
 * See: docs/oci/OCI_METHOD.md (Sections 3.6, 6), docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md.
 */

import type { SectorBaseline } from './types';

export const SECTOR_BASELINES: readonly SectorBaseline[] = [
  {
    sectorId: 'union-cba-administration',
    displayName: { 'en-CA': 'Union — collective agreement administration' },
    description: {
      'en-CA':
        'Locals and federations whose continuity depends on the organizational reading of collective agreements, grievance precedent, and bargaining history.',
    },
    governanceShape: 'representative-elected',
    typicalStewardshipDensityRange: { low: 2, median: 4, high: 8 },
    typicalContinuityFragilityRange: { low: 6, median: 12, high: 25 },
    commonBurdenPatternIds: [
      'id-single-interpreter',
      'id-oral-interpretation-record',
      'op-process-by-one-steward',
      'cf-unrecognised-load',
      'ss-load-not-in-job-description',
    ],
    modernizationPressureProfile: 'moderate',
    regulatoryEnvironmentProfile: 'high',
    facilitationPostureNotes: {
      'en-CA':
        'Approach grievance precedent and bargaining memory as organizational record. Avoid characterising past chief stewards or business agents personally. Respect the elected character of the governance body throughout.',
    },
  },
  {
    sectorId: 'union-pension-administration',
    displayName: { 'en-CA': 'Union — pension administration' },
    description: {
      'en-CA':
        'Plan administration bodies whose continuity exposure is concentrated in trustees, actuarial counsel relationships, and member-record stewardship.',
    },
    governanceShape: 'representative-delegated',
    typicalStewardshipDensityRange: { low: 1, median: 3, high: 6 },
    typicalContinuityFragilityRange: { low: 10, median: 18, high: 30 },
    commonBurdenPatternIds: [
      'gd-officer-overlap',
      'id-oral-interpretation-record',
      'em-external-memory-holder',
      'em-vendor-rationale-keeper',
      'mo-modernization-rationale-loss',
    ],
    modernizationPressureProfile: 'moderate',
    regulatoryEnvironmentProfile: 'multi-jurisdictional',
    facilitationPostureNotes: {
      'en-CA':
        'Respect fiduciary discretion. Do not enter matters under regulator review. Treat actuarial and legal counsel as organizational counterparts rather than as facilitation participants.',
    },
  },
  {
    sectorId: 'healthcare-clinical-governance',
    displayName: { 'en-CA': 'Healthcare — clinical governance' },
    description: {
      'en-CA':
        'Clinical leadership bodies whose continuity touches patient-care commitments, professional college obligations, and operating-protocol stewardship.',
    },
    governanceShape: 'hybrid-public-mandate',
    typicalStewardshipDensityRange: { low: 3, median: 6, high: 10 },
    typicalContinuityFragilityRange: { low: 5, median: 10, high: 18 },
    commonBurdenPatternIds: [
      'gd-chair-concentration',
      'op-undocumented-decision-points',
      'om-mentor-dependency',
      'em-regulator-context-holder',
      'cf-load-on-quieter-voice',
    ],
    modernizationPressureProfile: 'high',
    regulatoryEnvironmentProfile: 'high',
    facilitationPostureNotes: {
      'en-CA':
        'Hold clinical safety as the organizational priority. Treat clinical leaders\u2019 time as scarce. Avoid any framing that could be received as performance evaluation.',
    },
  },
  {
    sectorId: 'healthcare-administrative-governance',
    displayName: { 'en-CA': 'Healthcare — administrative governance' },
    description: {
      'en-CA':
        'Administrative bodies whose continuity touches operating budgets, regulatory reporting, and the interface between clinical and non-clinical organizational memory.',
    },
    governanceShape: 'hybrid-public-mandate',
    typicalStewardshipDensityRange: { low: 4, median: 8, high: 14 },
    typicalContinuityFragilityRange: { low: 4, median: 9, high: 16 },
    commonBurdenPatternIds: [
      'gd-committee-quorum-fragility',
      'op-process-rationale-loss',
      'em-regulator-context-holder',
      'mo-modernization-with-day-job',
      'ss-invisible-role',
    ],
    modernizationPressureProfile: 'high',
    regulatoryEnvironmentProfile: 'high',
    facilitationPostureNotes: {
      'en-CA':
        'Recognise that administrative continuity supports clinical continuity. Do not frame administrative load in terms borrowed from clinical evaluation.',
    },
  },
  {
    sectorId: 'municipal-government',
    displayName: { 'en-CA': 'Municipal government' },
    description: {
      'en-CA':
        'Municipal councils, secretariat offices, and standing committees whose continuity touches bylaw history, council precedent, and inter-departmental organizational memory.',
    },
    governanceShape: 'representative-elected',
    typicalStewardshipDensityRange: { low: 3, median: 6, high: 11 },
    typicalContinuityFragilityRange: { low: 8, median: 15, high: 28 },
    commonBurdenPatternIds: [
      'id-drift-without-witness',
      'op-process-rationale-loss',
      'om-cohort-gap',
      'em-regulator-context-holder',
      'cf-unrecognised-load',
    ],
    modernizationPressureProfile: 'moderate',
    regulatoryEnvironmentProfile: 'high',
    facilitationPostureNotes: {
      'en-CA':
        'Respect the elected nature of council. Distinguish council continuity from administration continuity. Do not enter active political matters.',
    },
  },
  {
    sectorId: 'regional-government',
    displayName: { 'en-CA': 'Regional government' },
    description: {
      'en-CA':
        'Regional and inter-municipal bodies whose continuity touches inter-jurisdictional agreements, shared-service stewardship, and program history.',
    },
    governanceShape: 'representative-delegated',
    typicalStewardshipDensityRange: { low: 3, median: 7, high: 12 },
    typicalContinuityFragilityRange: { low: 7, median: 14, high: 25 },
    commonBurdenPatternIds: [
      'gd-committee-quorum-fragility',
      'id-single-interpreter',
      'em-external-memory-holder',
      'mo-modernization-by-one-steward',
      'cf-reciprocity-gap',
    ],
    modernizationPressureProfile: 'moderate',
    regulatoryEnvironmentProfile: 'multi-jurisdictional',
    facilitationPostureNotes: {
      'en-CA':
        'Hold the inter-jurisdictional character of the body. Do not assume continuity exposures are uniform across constituent municipalities.',
    },
  },
  {
    sectorId: 'federal-program-administration',
    displayName: { 'en-CA': 'Federal program administration' },
    description: {
      'en-CA':
        'Program administration bodies whose continuity touches statutory authority, departmental rotation, and central-agency relationships.',
    },
    governanceShape: 'hybrid-public-mandate',
    typicalStewardshipDensityRange: { low: 4, median: 9, high: 16 },
    typicalContinuityFragilityRange: { low: 3, median: 8, high: 14 },
    commonBurdenPatternIds: [
      'id-oral-interpretation-record',
      'op-undocumented-decision-points',
      'em-regulator-context-holder',
      'mo-modernization-with-day-job',
      'ss-cohort-load-on-one-person',
    ],
    modernizationPressureProfile: 'high',
    regulatoryEnvironmentProfile: 'multi-jurisdictional',
    facilitationPostureNotes: {
      'en-CA':
        'Respect the public-service character of the institution. Hold statutory boundaries firmly. Do not produce material the institution cannot defend in central-agency review.',
    },
  },
  {
    sectorId: 'post-secondary-academic-governance',
    displayName: { 'en-CA': 'Post-secondary — academic governance' },
    description: {
      'en-CA':
        'Senate, faculty council, and academic standing bodies whose continuity touches academic precedent, accreditation history, and curriculum stewardship.',
    },
    governanceShape: 'professional-self-governing',
    typicalStewardshipDensityRange: { low: 5, median: 10, high: 18 },
    typicalContinuityFragilityRange: { low: 8, median: 16, high: 30 },
    commonBurdenPatternIds: [
      'id-single-interpreter',
      'id-drift-without-witness',
      'om-mentor-dependency',
      'cf-load-on-quieter-voice',
      'ss-cohort-load-on-one-person',
    ],
    modernizationPressureProfile: 'moderate',
    regulatoryEnvironmentProfile: 'moderate',
    facilitationPostureNotes: {
      'en-CA':
        'Hold collegial governance as a real form. Do not import corporate framings. Recognise that academic continuity often lives in long-tenured chairs and graduate program coordinators.',
    },
  },
  {
    sectorId: 'post-secondary-administrative-governance',
    displayName: { 'en-CA': 'Post-secondary — administrative governance' },
    description: {
      'en-CA':
        'Boards of governors, registrar offices, and finance committees whose continuity touches operating envelopes, regulatory reporting, and inter-faculty memory.',
    },
    governanceShape: 'hybrid-public-mandate',
    typicalStewardshipDensityRange: { low: 4, median: 7, high: 13 },
    typicalContinuityFragilityRange: { low: 5, median: 11, high: 20 },
    commonBurdenPatternIds: [
      'gd-officer-overlap',
      'op-process-rationale-loss',
      'em-regulator-context-holder',
      'mo-modernization-rationale-loss',
      'cf-reciprocity-gap',
    ],
    modernizationPressureProfile: 'high',
    regulatoryEnvironmentProfile: 'high',
    facilitationPostureNotes: {
      'en-CA':
        'Distinguish board continuity from administration continuity. Respect the bicameral relationship with academic governance.',
    },
  },
  {
    sectorId: 'non-profit-federation',
    displayName: { 'en-CA': 'Non-profit federation' },
    description: {
      'en-CA':
        'Federations whose continuity touches member-organisation stewardship, federation-level governance memory, and the long-tenured executive role.',
    },
    governanceShape: 'representative-delegated',
    typicalStewardshipDensityRange: { low: 2, median: 4, high: 9 },
    typicalContinuityFragilityRange: { low: 8, median: 17, high: 32 },
    commonBurdenPatternIds: [
      'gd-chair-concentration',
      'gd-officer-overlap',
      'op-process-by-one-steward',
      'cf-unrecognised-load',
      'ss-invisible-role',
    ],
    modernizationPressureProfile: 'low',
    regulatoryEnvironmentProfile: 'moderate',
    facilitationPostureNotes: {
      'en-CA':
        'Hold the federation\u2019s relationship to member organisations as the central continuity surface. Do not displace member-organisation stewardship by federation initiative.',
    },
  },
  {
    sectorId: 'cooperative-governance',
    displayName: { 'en-CA': 'Cooperative governance' },
    description: {
      'en-CA':
        'Cooperatives whose continuity touches member-democracy commitments, founding rationale, and the long-tenured general manager or executive director.',
    },
    governanceShape: 'representative-elected',
    typicalStewardshipDensityRange: { low: 2, median: 5, high: 10 },
    typicalContinuityFragilityRange: { low: 9, median: 18, high: 35 },
    commonBurdenPatternIds: [
      'gd-chair-concentration',
      'id-oral-interpretation-record',
      'op-process-rationale-loss',
      'om-cohort-gap',
      'cf-unrecognised-load',
    ],
    modernizationPressureProfile: 'moderate',
    regulatoryEnvironmentProfile: 'moderate',
    facilitationPostureNotes: {
      'en-CA':
        'Recognise member-democracy as the organizational ground. Do not frame founding rationale as legacy to be modernised away.',
    },
  },
  {
    sectorId: 'regulated-professional-college',
    displayName: { 'en-CA': 'Regulated professional college' },
    description: {
      'en-CA':
        'Professional self-regulating bodies whose continuity touches statutory mandate, public-interest discipline, and registrar stewardship.',
    },
    governanceShape: 'professional-self-governing',
    typicalStewardshipDensityRange: { low: 3, median: 6, high: 11 },
    typicalContinuityFragilityRange: { low: 6, median: 13, high: 24 },
    commonBurdenPatternIds: [
      'id-single-interpreter',
      'id-drift-without-witness',
      'op-undocumented-decision-points',
      'em-regulator-context-holder',
      'cf-reciprocity-gap',
    ],
    modernizationPressureProfile: 'moderate',
    regulatoryEnvironmentProfile: 'high',
    facilitationPostureNotes: {
      'en-CA':
        'Hold the public-interest mandate as binding. Distinguish the college\u2019s governance from the profession\u2019s practice. Respect statutory boundaries firmly.',
    },
  },
];

export const SECTOR_BASELINES_BY_ID: Readonly<
  Record<SectorBaseline['sectorId'], SectorBaseline>
> = Object.freeze(
  SECTOR_BASELINES.reduce(
    (acc, baseline) => {
      acc[baseline.sectorId] = baseline;
      return acc;
    },
    {} as Record<SectorBaseline['sectorId'], SectorBaseline>,
  ),
);
