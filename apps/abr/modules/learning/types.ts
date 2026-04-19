export interface LearningTrack {
  id: string;
  orgId: string;
  title: string;
  completionRate: number;
  recertificationWindowDays: number;
  owner: string;
  audience: string;
  certificateTemplate: string;
}

export interface LearningCourse {
  id: string;
  title: string;
  description: string;
  targetRoles: string[];
  durationMinutes: number;
  certificationTrack: 'manager' | 'investigator' | 'executive' | 'frontline';
}

export interface LearningAssignment {
  id: string;
  orgId: string;
  userId: string;
  courseId: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'overdue';
  dueDate: string;
}

export interface LearningCohort {
  id: string;
  orgId: string;
  name: string;
  memberCount: number;
  completionRate: number;
}

export interface LearningRecommendation {
  incidentCategory: string;
  recommendedCourseId: string;
  reason: string;
}

export interface LearningAnalyticsSummary {
  organizationId: string;
  completionRate: number;
  renewalDueCount: number;
  downloadableCertificates: number;
  overdueAssignments: number;
}
