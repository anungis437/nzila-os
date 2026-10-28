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
  // Second steward in the primary organization: the target of a reassignment, so the first steward's revocation can be proven.
  stewardPrimaryTwo: {
    userId: 'ue-qa-steward-primary-two',
    email: 'ue.qa.steward.primary.two@nzila.test',
    firstName: 'QA',
    lastName: 'StewardPrimaryTwo',
    orgId: UE_TEST_ORGS.primary.id,
    role: 'steward',
    status: 'active',
  },
  // Financial officers. The finance routes require the secretary_treasurer role AND a live financial mandate that names the duty;
  // the two hold different, segregated duties (prepare versus reconcile) on the same account.
  financePreparer: {
    userId: 'ue-qa-finance-preparer',
    email: 'ue.qa.finance.preparer@nzila.test',
    firstName: 'QA',
    lastName: 'FinancePreparer',
    orgId: UE_TEST_ORGS.primary.id,
    role: 'secretary_treasurer',
    status: 'active',
  },
  financeReconciler: {
    userId: 'ue-qa-finance-reconciler',
    email: 'ue.qa.finance.reconciler@nzila.test',
    firstName: 'QA',
    lastName: 'FinanceReconciler',
    orgId: UE_TEST_ORGS.primary.id,
    role: 'secretary_treasurer',
    status: 'active',
  },
  // Independent approver of financial issuances: holds an executive_office mandate with the approve power (a synthetic root of
  // trust labelled as a fixture). Distinct from the executive who issues and from the officers who hold the duties.
  governanceApprover: {
    userId: 'ue-qa-governance-approver',
    email: 'ue.qa.governance.approver@nzila.test',
    firstName: 'QA',
    lastName: 'GovernanceApprover',
    orgId: UE_TEST_ORGS.primary.id,
    role: 'vice_president',
    status: 'active',
  },
  // Senior representative / supervisor: oversees cases under a read-and-monitor mandate that carries no routing power.
  supervisorPrimary: {
    userId: 'ue-qa-supervisor-primary',
    email: 'ue.qa.supervisor.primary@nzila.test',
    firstName: 'QA',
    lastName: 'SupervisorPrimary',
    orgId: UE_TEST_ORGS.primary.id,
    role: 'chief_steward',
    status: 'active',
  },
  // Case coordinator: holds a synthetic supervisory mandate (see scripts/seed-test-env-kernel.ts). The role title alone
  // confers no case authority.
  chiefStewardPrimary: {
    userId: 'ue-qa-chief-steward-primary',
    email: 'ue.qa.chief.steward.primary@nzila.test',
    firstName: 'QA',
    lastName: 'ChiefStewardPrimary',
    orgId: UE_TEST_ORGS.primary.id,
    role: 'chief_steward',
    status: 'active',
  },
  staffPrimary: {
    userId: 'ue-qa-staff-primary',
    email: 'ue.qa.staff.primary@nzila.test',
    firstName: 'QA',
    lastName: 'StaffPrimary',
    orgId: UE_TEST_ORGS.primary.id,
    role: 'support_agent',
    status: 'active',
  },
  executivePrimary: {
    userId: 'ue-qa-executive-primary',
    email: 'ue.qa.executive.primary@nzila.test',
    firstName: 'QA',
    lastName: 'ExecutivePrimary',
    orgId: UE_TEST_ORGS.primary.id,
    role: 'president',
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
  // Platform operator: a supported platform role. Holds no institutional mandate, so operating the platform confers no right to read a union's cases.
  platformOperator: {
    userId: 'ue-qa-platform-operator',
    email: 'ue.qa.platform.operator@nzila.test',
    firstName: 'QA',
    lastName: 'PlatformOperator',
    orgId: UE_TEST_ORGS.primary.id,
    role: 'platform_lead',
    status: 'active',
  },
  // Federation / parent organization: members of a different tenant than the affiliate. No affiliate-oversight mandate has been issued.
  federationExecutive: {
    userId: 'ue-qa-federation-executive',
    email: 'ue.qa.federation.executive@nzila.test',
    firstName: 'QA',
    lastName: 'FederationExecutive',
    orgId: UE_TEST_ORGS.secondary.id,
    role: 'fed_executive',
    status: 'active',
  },
  federationStaff: {
    userId: 'ue-qa-federation-staff',
    email: 'ue.qa.federation.staff@nzila.test',
    firstName: 'QA',
    lastName: 'FederationStaff',
    orgId: UE_TEST_ORGS.secondary.id,
    role: 'fed_staff',
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
  auditorReadOnly: {
    userId: 'ue-qa-auditor-readonly',
    email: 'ue.qa.auditor.readonly@nzila.test',
    firstName: 'QA',
    lastName: 'AuditorReadOnly',
    orgId: UE_TEST_ORGS.primary.id,
    role: 'compliance_manager',
    status: 'active',
    metadata: {
      readOnly: true,
      auditPersona: true,
    },
  },
  wrongOrgSteward: {
    userId: 'ue-qa-steward-secondary',
    email: 'ue.qa.steward.secondary@nzila.test',
    firstName: 'QA',
    lastName: 'StewardSecondary',
    orgId: UE_TEST_ORGS.secondary.id,
    role: 'steward',
    status: 'active',
  },
  suspendedMember: {
    userId: 'ue-qa-member-suspended',
    email: 'ue.qa.member.suspended@nzila.test',
    firstName: 'QA',
    lastName: 'MemberSuspended',
    orgId: UE_TEST_ORGS.primary.id,
    role: 'member',
    status: 'inactive',
    metadata: {
      suspended: true,
    },
  },
} as const

export type UeTestUserKey = keyof typeof UE_TEST_USERS
