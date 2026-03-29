import { describe, it, expect } from 'vitest';
import {
  createEmployerSchema,
  updateEmployerSchema,
  employerQuerySchema,
  createWorksiteSchema,
  updateWorksiteSchema,
  worksiteQuerySchema,
  classificationSchema,
  createBargainingUnitSchema,
  updateBargainingUnitSchema,
  bargainingUnitQuerySchema,
  createCommitteeSchema,
  updateCommitteeSchema,
  committeeQuerySchema,
  createCommitteeMembershipSchema,
  updateCommitteeMembershipSchema,
  committeeMembershipQuerySchema,
  createStewardAssignmentSchema,
  updateStewardAssignmentSchema,
  stewardAssignmentQuerySchema,
  createRoleTenureHistorySchema,
  updateRoleTenureHistorySchema,
  roleTenureHistoryQuerySchema,
  bulkCreateEmployersSchema,
  bulkCreateWorksitesSchema,
  bulkCreateBargainingUnitsSchema,
} from '../union-structure-schemas';

const uuid = '00000000-0000-4000-8000-000000000001';
const uuid2 = '00000000-0000-4000-8000-000000000002';

// ── createEmployerSchema ─────────────────────────────────────────────────────

describe('createEmployerSchema', () => {
  const valid = {
    organizationId: uuid,
    name: 'Acme Corp',
    employerType: 'private',
  };

  it('accepts valid minimal input with defaults', () => {
    const r = createEmployerSchema.parse(valid);
    expect(r.name).toBe('Acme Corp');
    expect(r.status).toBe('active');
  });

  it('accepts full input', () => {
    const r = createEmployerSchema.parse({
      ...valid,
      legalName: 'Acme Corporation Inc.',
      employerType: 'crown_corporation',
      status: 'in_bargaining',
      businessNumber: 'BN12345',
      email: 'hr@acme.com',
      phone: '613-555-1234',
      website: 'https://acme.com',
      totalEmployees: 500,
      unionizedEmployees: 350,
      establishedDate: '2000-01-15',
      primaryContactName: 'Jane Doe',
      parentCompanyId: uuid2,
      notes: 'Key employer',
      customFields: { sector: 'energy' },
    });
    expect(r.employerType).toBe('crown_corporation');
    expect(r.totalEmployees).toBe(500);
  });

  it('rejects empty name', () => {
    expect(() => createEmployerSchema.parse({ ...valid, name: '' })).toThrow();
  });

  it('rejects invalid employer type', () => {
    expect(() => createEmployerSchema.parse({ ...valid, employerType: 'startup' })).toThrow();
  });

  it('rejects invalid status', () => {
    expect(() => createEmployerSchema.parse({ ...valid, status: 'pending' })).toThrow();
  });

  it('rejects non-uuid organizationId', () => {
    expect(() => createEmployerSchema.parse({ ...valid, organizationId: 'abc' })).toThrow();
  });

  it('rejects invalid email', () => {
    expect(() => createEmployerSchema.parse({ ...valid, email: 'not-an-email' })).toThrow();
  });

  it('rejects invalid website URL', () => {
    expect(() => createEmployerSchema.parse({ ...valid, website: 'not-a-url' })).toThrow();
  });

  it('rejects negative totalEmployees', () => {
    expect(() => createEmployerSchema.parse({ ...valid, totalEmployees: -1 })).toThrow();
  });
});

describe('updateEmployerSchema', () => {
  it('allows partial fields without organizationId', () => {
    const r = updateEmployerSchema.parse({ name: 'Updated Name', status: 'inactive' });
    expect(r.name).toBe('Updated Name');
  });

  it('allows empty update', () => {
    const r = updateEmployerSchema.parse({});
    expect(r).toBeDefined();
  });
});

describe('employerQuerySchema', () => {
  it('applies defaults', () => {
    const r = employerQuerySchema.parse({});
    expect(r.page).toBe(1);
    expect(r.limit).toBe(20);
  });

  it('accepts filters', () => {
    const r = employerQuerySchema.parse({
      status: 'active',
      employerType: 'public',
      search: 'Acme',
      page: 2,
      limit: 50,
    });
    expect(r.status).toBe('active');
    expect(r.page).toBe(2);
  });

  it('rejects page < 1', () => {
    expect(() => employerQuerySchema.parse({ page: 0 })).toThrow();
  });

  it('rejects limit > 100', () => {
    expect(() => employerQuerySchema.parse({ limit: 200 })).toThrow();
  });
});

// ── createWorksiteSchema ─────────────────────────────────────────────────────

describe('createWorksiteSchema', () => {
  const valid = {
    organizationId: uuid,
    employerId: uuid2,
    name: 'Main Plant',
  };

  it('accepts valid minimal input with defaults', () => {
    const r = createWorksiteSchema.parse(valid);
    expect(r.status).toBe('active');
    expect(r.operatesWeekends).toBe(false);
    expect(r.operates24Hours).toBe(false);
  });

  it('accepts full input', () => {
    const r = createWorksiteSchema.parse({
      ...valid,
      code: 'MP-001',
      status: 'seasonal',
      address: { city: 'Ottawa', province: 'ON', country: 'Canada' },
      employeeCount: 200,
      shiftCount: 3,
      operatesWeekends: true,
      operates24Hours: true,
      siteManagerName: 'Bob',
      siteManagerEmail: 'bob@plant.com',
    });
    expect(r.employeeCount).toBe(200);
    expect(r.operatesWeekends).toBe(true);
  });

  it('rejects empty name', () => {
    expect(() => createWorksiteSchema.parse({ ...valid, name: '' })).toThrow();
  });

  it('rejects invalid status', () => {
    expect(() => createWorksiteSchema.parse({ ...valid, status: 'open' })).toThrow();
  });
});

describe('updateWorksiteSchema', () => {
  it('allows partial update', () => {
    const r = updateWorksiteSchema.parse({ name: 'Satellite Plant', employeeCount: 50 });
    expect(r.name).toBe('Satellite Plant');
  });
});

describe('worksiteQuerySchema', () => {
  it('applies defaults', () => {
    const r = worksiteQuerySchema.parse({});
    expect(r.page).toBe(1);
    expect(r.limit).toBe(20);
  });

  it('accepts employer filter', () => {
    const r = worksiteQuerySchema.parse({ employerId: uuid });
    expect(r.employerId).toBe(uuid);
  });
});

// ── classificationSchema ─────────────────────────────────────────────────────

describe('classificationSchema', () => {
  it('accepts valid classification', () => {
    const r = classificationSchema.parse({ title: 'Electrician', count: 10, payGrade: 'A3' });
    expect(r.title).toBe('Electrician');
  });

  it('rejects empty title', () => {
    expect(() => classificationSchema.parse({ title: '' })).toThrow();
  });
});

// ── createBargainingUnitSchema ───────────────────────────────────────────────

describe('createBargainingUnitSchema', () => {
  const valid = {
    organizationId: uuid,
    employerId: uuid2,
    name: 'Unit 1',
    unitType: 'full_time',
  };

  it('accepts valid minimal input with defaults', () => {
    const r = createBargainingUnitSchema.parse(valid);
    expect(r.status).toBe('active');
    expect(r.memberCount).toBe(0);
  });

  it('accepts certification and classifications', () => {
    const r = createBargainingUnitSchema.parse({
      ...valid,
      certificationNumber: 'CERT-001',
      certificationDate: '2020-06-15',
      contractExpiryDate: '2027-06-14',
      classifications: [{ title: 'Electrician', count: 15 }],
    });
    expect(r.certificationNumber).toBe('CERT-001');
    expect(r.classifications).toHaveLength(1);
  });

  it('rejects invalid unit type', () => {
    expect(() => createBargainingUnitSchema.parse({ ...valid, unitType: 'freelance' })).toThrow();
  });

  it('rejects invalid status', () => {
    expect(() => createBargainingUnitSchema.parse({ ...valid, status: 'pending' })).toThrow();
  });

  it('rejects invalid date format', () => {
    expect(() => createBargainingUnitSchema.parse({ ...valid, certificationDate: '2020/06/15' })).toThrow();
  });
});

describe('updateBargainingUnitSchema', () => {
  it('allows partial update', () => {
    const r = updateBargainingUnitSchema.parse({ name: 'Unit 1A', memberCount: 42 });
    expect(r.memberCount).toBe(42);
  });
});

describe('bargainingUnitQuerySchema', () => {
  it('applies defaults', () => {
    const r = bargainingUnitQuerySchema.parse({});
    expect(r.page).toBe(1);
    expect(r.limit).toBe(20);
  });

  it('accepts contractExpiring filter', () => {
    const r = bargainingUnitQuerySchema.parse({ contractExpiring: true });
    expect(r.contractExpiring).toBe(true);
  });
});

// ── createCommitteeSchema ────────────────────────────────────────────────────

describe('createCommitteeSchema', () => {
  const valid = {
    organizationId: uuid,
    name: 'H&S Committee',
    committeeType: 'health_safety',
  };

  it('accepts valid minimal input with defaults', () => {
    const r = createCommitteeSchema.parse(valid);
    expect(r.status).toBe('active');
    expect(r.isOrganizationWide).toBe(false);
    expect(r.currentMemberCount).toBe(0);
    expect(r.requiresAppointment).toBe(false);
    expect(r.requiresElection).toBe(false);
  });

  it('accepts full input', () => {
    const r = createCommitteeSchema.parse({
      ...valid,
      committeeType: 'bargaining',
      unitId: uuid,
      mandate: 'Bargain new CBA',
      meetingFrequency: 'Monthly',
      meetingDay: 'Tuesday',
      maxMembers: 12,
      requiresElection: true,
      termLength: 24,
      chairId: 'member-1',
    });
    expect(r.committeeType).toBe('bargaining');
    expect(r.termLength).toBe(24);
  });

  it.each([
    'bargaining', 'grievance', 'health_safety', 'political_action',
    'equity', 'education', 'organizing', 'steward', 'executive',
    'finance', 'communications', 'social', 'pension_benefits', 'other',
  ])('accepts committee type %s', (t) => {
    expect(createCommitteeSchema.parse({ ...valid, committeeType: t }).committeeType).toBe(t);
  });

  it('rejects invalid committee type', () => {
    expect(() => createCommitteeSchema.parse({ ...valid, committeeType: 'ad_hoc' })).toThrow();
  });
});

describe('updateCommitteeSchema', () => {
  it('allows partial update', () => {
    const r = updateCommitteeSchema.parse({ name: 'Updated Name' });
    expect(r.name).toBe('Updated Name');
  });
});

describe('committeeQuerySchema', () => {
  it('applies defaults', () => {
    const r = committeeQuerySchema.parse({});
    expect(r.page).toBe(1);
  });

  it('accepts type filter', () => {
    const r = committeeQuerySchema.parse({ committeeType: 'grievance' });
    expect(r.committeeType).toBe('grievance');
  });
});

// ── createCommitteeMembershipSchema ──────────────────────────────────────────

describe('createCommitteeMembershipSchema', () => {
  const valid = {
    committeeId: uuid,
    memberId: 'member-1',
    startDate: '2026-01-15',
  };

  it('accepts valid minimal input with defaults', () => {
    const r = createCommitteeMembershipSchema.parse(valid);
    expect(r.role).toBe('member');
    expect(r.status).toBe('active');
    expect(r.termNumber).toBe(1);
    expect(r.meetingsAttended).toBe(0);
    expect(r.meetingsTotal).toBe(0);
  });

  it('accepts full input', () => {
    const r = createCommitteeMembershipSchema.parse({
      ...valid,
      role: 'chair',
      endDate: '2028-01-14',
      appointmentMethod: 'elected',
      electionDate: '2025-12-01',
      votesReceived: 48,
      meetingsAttended: 10,
      meetingsTotal: 12,
    });
    expect(r.role).toBe('chair');
    expect(r.votesReceived).toBe(48);
  });

  it.each(['chair', 'vice_chair', 'secretary', 'treasurer', 'member', 'alternate', 'advisor', 'ex_officio'])(
    'accepts role %s', (role) => {
      expect(createCommitteeMembershipSchema.parse({ ...valid, role }).role).toBe(role);
    },
  );

  it('rejects invalid date format', () => {
    expect(() => createCommitteeMembershipSchema.parse({ ...valid, startDate: 'Jan 15 2026' })).toThrow();
  });

  it('rejects negative votes', () => {
    expect(() => createCommitteeMembershipSchema.parse({ ...valid, votesReceived: -1 })).toThrow();
  });
});

describe('updateCommitteeMembershipSchema', () => {
  it('allows partial update', () => {
    const r = updateCommitteeMembershipSchema.parse({ role: 'vice_chair' });
    expect(r.role).toBe('vice_chair');
  });
});

describe('committeeMembershipQuerySchema', () => {
  it('applies defaults', () => {
    const r = committeeMembershipQuerySchema.parse({});
    expect(r.page).toBe(1);
  });

  it('accepts active filter', () => {
    const r = committeeMembershipQuerySchema.parse({ active: true });
    expect(r.active).toBe(true);
  });
});

// ── createStewardAssignmentSchema ────────────────────────────────────────────

describe('createStewardAssignmentSchema', () => {
  const valid = {
    organizationId: uuid,
    stewardId: 'member-1',
    stewardType: 'steward',
    startDate: '2026-01-15',
  };

  it('accepts valid minimal input with defaults', () => {
    const r = createStewardAssignmentSchema.parse(valid);
    expect(r.status).toBe('active');
    expect(r.isInterim).toBe(false);
    expect(r.trainingCompleted).toBe(false);
  });

  it('accepts full input', () => {
    const r = createStewardAssignmentSchema.parse({
      ...valid,
      stewardType: 'chief_steward',
      unitId: uuid2,
      department: 'Production',
      shift: 'Day',
      responsibilityAreas: ['Grievances', 'H&S'],
      membersCovered: 50,
      trainingCompleted: true,
      trainingCompletionDate: '2025-12-01',
      workPhone: '613-555-9999',
    });
    expect(r.stewardType).toBe('chief_steward');
    expect(r.responsibilityAreas).toHaveLength(2);
  });

  it.each(['chief_steward', 'steward', 'alternate_steward', 'health_safety_rep'])(
    'accepts steward type %s', (t) => {
      expect(createStewardAssignmentSchema.parse({ ...valid, stewardType: t }).stewardType).toBe(t);
    },
  );

  it('rejects invalid steward type', () => {
    expect(() => createStewardAssignmentSchema.parse({ ...valid, stewardType: 'delegate' })).toThrow();
  });
});

describe('updateStewardAssignmentSchema', () => {
  it('allows partial update', () => {
    const r = updateStewardAssignmentSchema.parse({ trainingCompleted: true });
    expect(r.trainingCompleted).toBe(true);
  });
});

describe('stewardAssignmentQuerySchema', () => {
  it('applies defaults', () => {
    const r = stewardAssignmentQuerySchema.parse({});
    expect(r.page).toBe(1);
  });

  it('accepts active filter', () => {
    const r = stewardAssignmentQuerySchema.parse({ active: true, stewardType: 'chief_steward' });
    expect(r.active).toBe(true);
  });
});

// ── createRoleTenureHistorySchema ────────────────────────────────────────────

describe('createRoleTenureHistorySchema', () => {
  const valid = {
    organizationId: uuid,
    memberId: 'member-1',
    roleType: 'steward',
    roleTitle: 'Chief Steward',
    startDate: '2020-06-15',
  };

  it('accepts valid minimal input with defaults', () => {
    const r = createRoleTenureHistorySchema.parse(valid);
    expect(r.isCurrentRole).toBe(true);
  });

  it('accepts full input', () => {
    const r = createRoleTenureHistorySchema.parse({
      ...valid,
      roleLevel: 'senior',
      relatedEntityType: 'committee',
      relatedEntityId: uuid2,
      endDate: '2024-06-14',
      isCurrentRole: false,
    });
    expect(r.isCurrentRole).toBe(false);
    expect(r.relatedEntityType).toBe('committee');
  });

  it.each(['committee', 'unit', 'organization'])(
    'accepts related entity type %s', (t) => {
      expect(createRoleTenureHistorySchema.parse({ ...valid, relatedEntityType: t }).relatedEntityType).toBe(t);
    },
  );

  it('rejects invalid related entity type', () => {
    expect(() => createRoleTenureHistorySchema.parse({ ...valid, relatedEntityType: 'project' })).toThrow();
  });

  it('rejects empty role type', () => {
    expect(() => createRoleTenureHistorySchema.parse({ ...valid, roleType: '' })).toThrow();
  });
});

describe('updateRoleTenureHistorySchema', () => {
  it('allows partial update', () => {
    const r = updateRoleTenureHistorySchema.parse({ roleTitle: 'Senior Steward', isCurrentRole: false });
    expect(r.roleTitle).toBe('Senior Steward');
  });
});

describe('roleTenureHistoryQuerySchema', () => {
  it('applies defaults', () => {
    const r = roleTenureHistoryQuerySchema.parse({});
    expect(r.page).toBe(1);
  });
});

// ── Bulk schemas ─────────────────────────────────────────────────────────────

describe('bulkCreateEmployersSchema', () => {
  it('accepts valid array', () => {
    const r = bulkCreateEmployersSchema.parse({
      organizationId: uuid,
      employers: [{ organizationId: uuid, name: 'Employer A', employerType: 'private' }],
    });
    expect(r.employers).toHaveLength(1);
  });
});

describe('bulkCreateWorksitesSchema', () => {
  it('accepts valid array', () => {
    const r = bulkCreateWorksitesSchema.parse({
      organizationId: uuid,
      employerId: uuid2,
      worksites: [{ organizationId: uuid, employerId: uuid2, name: 'Site A' }],
    });
    expect(r.worksites).toHaveLength(1);
  });
});

describe('bulkCreateBargainingUnitsSchema', () => {
  it('accepts valid array', () => {
    const r = bulkCreateBargainingUnitsSchema.parse({
      organizationId: uuid,
      employerId: uuid2,
      units: [{ organizationId: uuid, employerId: uuid2, name: 'Unit A', unitType: 'full_time' }],
    });
    expect(r.units).toHaveLength(1);
  });
});
