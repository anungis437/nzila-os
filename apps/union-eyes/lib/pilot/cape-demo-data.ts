/**
 * CAPE-style Demo Dataset
 *
 * Safe, realistic demo data for pilot environments.
 * Sample members, employers, grievances, timelines, and resolutions.
 *
 * All generators return shapes compatible with the Drizzle insert API
 * for their respective tables.
 *
 * @module lib/pilot/cape-demo-data
 */

import { v4 as uuidv4 } from 'uuid';

// ─── Helpers ──────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ─── Sample Employers (→ employers table) ─────────────────────

export function generateDemoEmployers(organizationId: string) {
  return [
    { id: uuidv4(), organizationId, name: 'Treasury Board Secretariat', employerType: 'federal' as const, email: 'lr-demo@tbs-sct.gc.ca' },
    { id: uuidv4(), organizationId, name: 'Canada Revenue Agency', employerType: 'federal' as const, email: 'lr-demo@cra-arc.gc.ca' },
    { id: uuidv4(), organizationId, name: 'Public Services and Procurement Canada', employerType: 'federal' as const, email: 'lr-demo@pspc.gc.ca' },
    { id: uuidv4(), organizationId, name: 'Statistics Canada', employerType: 'federal' as const, email: 'lr-demo@statcan.gc.ca' },
  ];
}

// ─── Sample Grievances (→ grievances table) ───────────────────
// Uses only enum values present in grievanceTypeEnum / grievanceStatusEnum / grievancePriorityEnum.

export function generateDemoGrievances(organizationId: string) {
  return [
    {
      id: uuidv4(), organizationId,
      grievanceNumber: 'GRV-DEMO-001',
      type: 'contract' as const, status: 'investigating' as const, priority: 'high' as const,
      title: 'EC-06 Classification Dispute — Policy Analyst',
      description: 'Member performing EC-07 level work for 18+ months without reclassification. Supervisory duties added without compensation adjustment.',
      employerName: 'Treasury Board Secretariat', grievantName: 'Claire Fontaine',
      filedDate: daysAgo(12), incidentDate: daysAgo(45),
    },
    {
      id: uuidv4(), organizationId,
      grievanceNumber: 'GRV-DEMO-002',
      type: 'discipline' as const, status: 'filed' as const, priority: 'urgent' as const,
      title: 'Unjust 5-Day Suspension — Alleged Insubordination',
      description: 'Member suspended for refusing unsafe overtime. No progressive discipline applied. CBA Article 17.04 violated.',
      employerName: 'Canada Revenue Agency', grievantName: 'Marc-Antoine Deschamps',
      filedDate: daysAgo(3), incidentDate: daysAgo(7),
    },
    {
      id: uuidv4(), organizationId,
      grievanceNumber: 'GRV-DEMO-003',
      type: 'contract' as const, status: 'mediation' as const, priority: 'medium' as const,
      title: 'Remote Work Accommodation Denial',
      description: 'Request for telework accommodation for medical reasons denied without proper assessment. Duty to accommodate not met.',
      employerName: 'Public Services and Procurement Canada', grievantName: 'Priya Sharma',
      filedDate: daysAgo(30), incidentDate: daysAgo(40),
    },
    {
      id: uuidv4(), organizationId,
      grievanceNumber: 'GRV-DEMO-004',
      type: 'harassment' as const, status: 'draft' as const, priority: 'urgent' as const,
      title: 'Workplace Harassment Complaint — Toxic Management',
      description: 'Persistent verbal harassment from immediate supervisor. Multiple incidents documented over 6 months. HR complaint filed but no action taken.',
      employerName: 'Treasury Board Secretariat', grievantName: 'James Makinde',
      filedDate: daysAgo(5), incidentDate: daysAgo(180),
    },
    {
      id: uuidv4(), organizationId,
      grievanceNumber: 'GRV-DEMO-005',
      type: 'contract' as const, status: 'settled' as const, priority: 'medium' as const,
      title: 'Overtime Pay Calculation Error — 3 Pay Periods',
      description: 'Overtime calculated at straight time instead of 1.5x for three consecutive pay periods. Affects approximately $4,200.',
      employerName: 'Statistics Canada', grievantName: 'Sophie Tremblay',
      filedDate: daysAgo(60), incidentDate: daysAgo(90),
    },
    {
      id: uuidv4(), organizationId,
      grievanceNumber: 'GRV-DEMO-006',
      type: 'contract' as const, status: 'arbitration' as const, priority: 'high' as const,
      title: 'Denial of Language Training — Bilingual Imperative Position',
      description: 'Member in bilingual imperative position denied access to language training for 2+ years. Career progression blocked.',
      employerName: 'Canada Revenue Agency', grievantName: 'David Chen',
      filedDate: daysAgo(90), incidentDate: daysAgo(730),
    },
    {
      id: uuidv4(), organizationId,
      grievanceNumber: 'GRV-DEMO-007',
      type: 'contract' as const, status: 'investigating' as const, priority: 'low' as const,
      title: 'Acting Pay Dispute — Temporary Assignment',
      description: 'Member acting in higher classification for 6 months. Acting pay rate disputed by employer.',
      employerName: 'Public Services and Procurement Canada', grievantName: 'Amira Hassan',
      filedDate: daysAgo(20), incidentDate: daysAgo(25),
    },
    {
      id: uuidv4(), organizationId,
      grievanceNumber: 'GRV-DEMO-008',
      type: 'safety' as const, status: 'filed' as const, priority: 'high' as const,
      title: 'Ergonomic Assessment Refusal — Chronic Injury',
      description: 'Employer refuses to conduct ergonomic assessment despite documented repetitive strain injury. OHS requirements not met.',
      employerName: 'Treasury Board Secretariat', grievantName: 'Robert Lafrenière',
      filedDate: daysAgo(2), incidentDate: daysAgo(14),
    },
  ];
}

// ─── Summary ──────────────────────────────────────────────────

export function getDemoDatasetSummary(organizationId: string): {
  members: number;
  employers: number;
  grievances: number;
  timelines: number;
  resolutions: number;
} {
  return {
    members: 0, // not seeding members table in pilot
    employers: generateDemoEmployers(organizationId).length,
    grievances: generateDemoGrievances(organizationId).length,
    timelines: 24,
    resolutions: 1,
  };
}

// ─── E2E / Test Fixture Helpers ───────────────────────────────

/**
 * Create a deterministic demo organization for test fixtures.
 * Uses a fixed UUID so tests can reference the same org across runs.
 */
export function createCapeDemoOrg() {
  const orgId = '00000000-0000-4000-a000-000000000001';
  return {
    id: orgId,
    name: 'CAPE-ACEP Test Organization',
    slug: 'cape-acep-test',
    representationPreset: 'lro-led' as const,
    employers: generateDemoEmployers(orgId),
    grievances: generateDemoGrievances(orgId),
    summary: getDemoDatasetSummary(orgId),
  };
}

/**
 * Generate leadership metrics seed data for test fixtures.
 * Returns values matching the leadership dashboard API shape.
 */
export function seedCapeLeadershipMetrics() {
  const org = createCapeDemoOrg();
  const grievances = org.grievances;

  return {
    kpi: {
      activeGrievances: grievances.filter(g => !['settled', 'withdrawn'].includes(g.status)).length,
      resolvedThisMonth: grievances.filter(g => g.status === 'settled').length,
      avgTriageDays: 3.2,
      avgResolutionDays: 45.6,
      arbitrationCount: grievances.filter(g => g.status === 'arbitration').length,
      overdueCases: 1,
      previousPeriod: {
        activeGrievances: 5,
        resolvedThisMonth: 0,
        avgTriageDays: 4.1,
        avgResolutionDays: 52.0,
        arbitrationCount: 0,
        overdueCases: 2,
      },
    },
    employers: org.employers.map(e => ({
      employerName: e.name,
      activeGrievances: grievances.filter(g => g.employerName === e.name && g.status !== 'settled').length,
      overdueCases: 0,
      resolvedThisQuarter: grievances.filter(g => g.employerName === e.name && g.status === 'settled').length,
      topCategory: 'contract',
      avgResolutionDays: 45,
      trend: 'stable' as const,
    })),
  };
}

/**
 * Generate a pilot checklist state for test fixtures.
 * Returns a shape matching the pilot onboarding API response.
 */
export function seedCapePilotChecklistState(overrides?: Partial<Record<string, boolean>>) {
  const defaults: Record<string, boolean> = {
    'org-seeded': false,
    'users-invited': false,
    'roles-assigned': false,
    'contracts-uploaded': false,
    'employers-imported': false,
    'integrations-configured': false,
    'export-verified': false,
  };
  const items = { ...defaults, ...overrides };
  const completedCount = Object.values(items).filter(Boolean).length;

  return {
    items,
    completedCount,
    totalCount: 7,
    isComplete: completedCount === 7,
  };
}
