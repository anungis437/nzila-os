import { UE_TEST_ORGS } from './test-orgs'
import { UE_TEST_USERS } from './test-users'

const QA_REFERENCE_DATE = new Date('2026-04-28T00:00:00.000Z')

export const UE_TEST_CASES = {
  primarySubmitted: {
    claimId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    claimNumber: 'UE-QA-0001',
    organizationId: UE_TEST_ORGS.primary.id,
    memberId: UE_TEST_USERS.memberPrimary.userId,
    claimType: 'grievance_pay',
    status: 'submitted',
    priority: 'medium',
    description: 'Deterministic QA case: submitted state',
    incidentDate: QA_REFERENCE_DATE,
    location: 'Test Location Primary',
    desiredOutcome: 'Resolution',
  },
  primaryAssigned: {
    claimId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    claimNumber: 'UE-QA-0002',
    organizationId: UE_TEST_ORGS.primary.id,
    memberId: UE_TEST_USERS.memberPrimary.userId,
    claimType: 'grievance_discipline',
    status: 'assigned',
    priority: 'high',
    description: 'Deterministic QA case: assigned state',
    assignedTo: UE_TEST_USERS.stewardPrimary.userId,
    incidentDate: QA_REFERENCE_DATE,
    location: 'Test Location Primary',
    desiredOutcome: 'Fair Discipline Review',
  },
  secondarySubmitted: {
    claimId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    claimNumber: 'UE-QA-1001',
    organizationId: UE_TEST_ORGS.secondary.id,
    memberId: UE_TEST_USERS.memberSecondary.userId,
    claimType: 'grievance_schedule',
    status: 'submitted',
    priority: 'low',
    description: 'Secondary org isolation case',
    incidentDate: QA_REFERENCE_DATE,
    location: 'Test Location Secondary',
    desiredOutcome: 'Schedule Correction',
  },
} as const

export const UE_VALID_TRANSITIONS = [
  { from: 'submitted', to: 'under_review' },
  { from: 'under_review', to: 'assigned' },
  { from: 'assigned', to: 'investigation' },
  { from: 'investigation', to: 'resolved' },
] as const

export const UE_INVALID_TRANSITIONS = [
  { from: 'submitted', to: 'resolved' },
  { from: 'resolved', to: 'investigation' },
  { from: 'closed', to: 'submitted' },
] as const
