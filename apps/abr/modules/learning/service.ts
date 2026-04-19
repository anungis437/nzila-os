import type {
  LearningAnalyticsSummary,
  LearningAssignment,
  LearningCohort,
  LearningCourse,
  LearningRecommendation,
  LearningTrack,
} from './types';

const TRACKS: LearningTrack[] = [
  {
    id: 'trk_mgr_001',
    orgId: 'metro-university',
    title: 'Manager Accountability Certification',
    completionRate: 86,
    recertificationWindowDays: 365,
    owner: 'People & Culture',
    audience: 'Managers and directors',
    certificateTemplate: 'ABR Manager Certificate',
  },
  {
    id: 'trk_inv_001',
    orgId: 'metro-university',
    title: 'Investigator Certification Track',
    completionRate: 78,
    recertificationWindowDays: 365,
    owner: 'Institutional Equity Office',
    audience: 'Internal investigators',
    certificateTemplate: 'ABR Investigator Certificate',
  },
];

const COURSES: LearningCourse[] = [
  {
    id: 'course_mgr_triage',
    title: 'ABR Intake and Escalation for People Leaders',
    description: 'Connect intake quality and escalation timing to institutional risk exposure.',
    targetRoles: ['hr_lead', 'organization_admin'],
    durationMinutes: 75,
    certificationTrack: 'manager',
  },
  {
    id: 'course_inv_evidence',
    title: 'Evidence-Grade ABR Investigations',
    description: 'Build defensible timelines, notes, and remediation records tied to real case risk.',
    targetRoles: ['investigator', 'legal_counsel'],
    durationMinutes: 110,
    certificationTrack: 'investigator',
  },
  {
    id: 'course_exec_gov',
    title: 'Executive Governance for Anti-Racism Accountability',
    description: 'Interpret dashboard trends, remediation aging, and board-ready reporting obligations.',
    targetRoles: ['executive_viewer', 'dei_lead'],
    durationMinutes: 55,
    certificationTrack: 'executive',
  },
];

const ASSIGNMENTS: LearningAssignment[] = [
  {
    id: 'asn_001',
    orgId: 'metro-university',
    userId: 'usr_metro_hr_01',
    courseId: 'course_mgr_triage',
    status: 'completed',
    dueDate: '2026-05-10',
  },
  {
    id: 'asn_002',
    orgId: 'metro-university',
    userId: 'usr_metro_inv_01',
    courseId: 'course_inv_evidence',
    status: 'in_progress',
    dueDate: '2026-05-02',
  },
  {
    id: 'asn_003',
    orgId: 'metro-university',
    userId: 'usr_metro_exec_01',
    courseId: 'course_exec_gov',
    status: 'assigned',
    dueDate: '2026-04-28',
  },
];

const COHORTS: LearningCohort[] = [
  {
    id: 'cohort_deans',
    orgId: 'metro-university',
    name: 'Faculty leadership cohort',
    memberCount: 24,
    completionRate: 83,
  },
  {
    id: 'cohort_investigators',
    orgId: 'metro-university',
    name: 'Investigation unit cohort',
    memberCount: 8,
    completionRate: 78,
  },
];

const RECOMMENDATIONS: LearningRecommendation[] = [
  {
    incidentCategory: 'hiring',
    recommendedCourseId: 'course_mgr_triage',
    reason: 'Hiring incidents correlate with weak intake and escalation discipline.',
  },
  {
    incidentCategory: 'discipline',
    recommendedCourseId: 'course_inv_evidence',
    reason: 'Discipline matters need stronger chronology and defensibility practices.',
  },
];

export function listLearningTracks(orgId: string): LearningTrack[] {
  return TRACKS.filter((item) => item.orgId === orgId);
}

export function listLearningCourses(): LearningCourse[] {
  return COURSES;
}

export function listLearningAssignments(orgId: string): LearningAssignment[] {
  return ASSIGNMENTS.filter((item) => item.orgId === orgId);
}

export function listLearningCohorts(orgId: string): LearningCohort[] {
  return COHORTS.filter((item) => item.orgId === orgId);
}

export function listLearningRecommendations(incidentCategory?: string): LearningRecommendation[] {
  if (!incidentCategory) return RECOMMENDATIONS;
  return RECOMMENDATIONS.filter((item) => item.incidentCategory === incidentCategory);
}

export function getLearningAnalyticsSummary(orgId: string): LearningAnalyticsSummary {
  const assignments = listLearningAssignments(orgId);
  const completed = assignments.filter((item) => item.status === 'completed').length;
  const completionRate = assignments.length === 0 ? 0 : Math.round((completed / assignments.length) * 100);

  return {
    organizationId: orgId,
    completionRate,
    renewalDueCount: 4,
    downloadableCertificates: completed,
    overdueAssignments: assignments.filter((item) => item.status === 'overdue').length,
  };
}
