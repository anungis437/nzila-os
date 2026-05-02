import { UE_TEST_ORGS } from './test-orgs'

export const UE_TEST_USER_PASSWORD = 'NzilaQa!2026'

export const UE_TEST_USERS = {
  memberPrimary: {
    userId: 'ue-qa-member-primary',
    email: 'ue.qa.member.primary@nzila.test',
    firstName: 'QA',
    lastName: 'MemberPrimary',
    orgId: UE_TEST_ORGS.primary.id,
    role: 'member',
    status: 'active',
  },
  stewardPrimary: {
    userId: 'ue-qa-steward-primary',
    email: 'ue.qa.steward.primary@nzila.test',
    firstName: 'QA',
    lastName: 'StewardPrimary',
    orgId: UE_TEST_ORGS.primary.id,
    role: 'steward',
    status: 'active',
  },
  adminPrimary: {
    userId: 'ue-qa-admin-primary',
    email: 'ue.qa.admin.primary@nzila.test',
    firstName: 'QA',
    lastName: 'AdminPrimary',
    orgId: UE_TEST_ORGS.primary.id,
    role: 'admin',
    status: 'active',
  },
  memberSecondary: {
    userId: 'ue-qa-member-secondary',
    email: 'ue.qa.member.secondary@nzila.test',
    firstName: 'QA',
    lastName: 'MemberSecondary',
    orgId: UE_TEST_ORGS.secondary.id,
    role: 'member',
    status: 'active',
  },
  restrictedUxTester: {
    userId: 'ue-qa-ux-tester-001',
    email: 'ue.qa.ux.tester@nzila.test',
    firstName: 'QA',
    lastName: 'UxTester',
    orgId: UE_TEST_ORGS.uxTesterIsolated.id,
    role: 'member',
    status: 'active',
    metadata: {
      externalTester: true,
      monitored: true,
      sandboxOnly: true,
    },
  },
} as const

export type UeTestUserKey = keyof typeof UE_TEST_USERS
