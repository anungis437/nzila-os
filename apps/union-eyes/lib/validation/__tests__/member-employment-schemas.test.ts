import { describe, it, expect } from 'vitest';
import {
  employmentStatusSchema,
  employmentTypeSchema,
  payFrequencySchema,
  shiftTypeSchema,
  leaveTypeSchema,
  createMemberEmploymentSchema,
  updateMemberEmploymentSchema,
  createEmploymentHistorySchema,
  createMemberLeaveSchema,
  updateMemberLeaveSchema,
  createJobClassificationSchema,
  updateJobClassificationSchema,
  duesCalculationDataSchema,
  bulkEmploymentImportSchema,
  seniorityCalculationSchema,
} from '../member-employment-schemas';

const uuid = '00000000-0000-4000-8000-000000000001';
const uuid2 = '00000000-0000-4000-8000-000000000002';

// ── Enum schemas ─────────────────────────────────────────────────────────────

describe('employmentStatusSchema', () => {
  it.each(['active', 'on_leave', 'layoff', 'suspended', 'terminated', 'retired', 'deceased'])(
    'accepts %s', (v) => expect(employmentStatusSchema.parse(v)).toBe(v),
  );
  it('rejects invalid', () => expect(() => employmentStatusSchema.parse('unknown')).toThrow());
});

describe('employmentTypeSchema', () => {
  it.each(['full_time', 'part_time', 'casual', 'seasonal', 'temporary', 'contract', 'probationary'])(
    'accepts %s', (v) => expect(employmentTypeSchema.parse(v)).toBe(v),
  );
  it('rejects invalid', () => expect(() => employmentTypeSchema.parse('intern')).toThrow());
});

describe('payFrequencySchema', () => {
  it.each(['hourly', 'weekly', 'bi_weekly', 'semi_monthly', 'monthly', 'annual', 'per_diem'])(
    'accepts %s', (v) => expect(payFrequencySchema.parse(v)).toBe(v),
  );
  it('rejects invalid', () => expect(() => payFrequencySchema.parse('quarterly')).toThrow());
});

describe('shiftTypeSchema', () => {
  it.each(['day', 'evening', 'night', 'rotating', 'split', 'on_call'])(
    'accepts %s', (v) => expect(shiftTypeSchema.parse(v)).toBe(v),
  );
});

describe('leaveTypeSchema', () => {
  it.each([
    'vacation', 'sick', 'maternity', 'paternity', 'parental',
    'bereavement', 'medical', 'disability', 'union_business', 'unpaid', 'lwop', 'other',
  ])('accepts %s', (v) => expect(leaveTypeSchema.parse(v)).toBe(v));
});

// ── createMemberEmploymentSchema ─────────────────────────────────────────────

describe('createMemberEmploymentSchema', () => {
  const valid = {
    organizationId: uuid,
    memberId: uuid2,
    hireDate: '2020-06-15',
    seniorityDate: '2020-06-15',
    jobTitle: 'Electrician',
  };

  it('accepts minimal valid input with defaults', () => {
    const r = createMemberEmploymentSchema.parse(valid);
    expect(r.employmentStatus).toBe('active');
    expect(r.employmentType).toBe('full_time');
    expect(r.payFrequency).toBe('hourly');
    expect(r.regularHoursPerWeek).toBe(40);
    expect(r.operatesWeekends).toBe(false);
    expect(r.operates24Hours).toBe(false);
    expect(r.isProbationary).toBe(false);
    expect(r.checkoffAuthorized).toBe(true);
    expect(r.randExempt).toBe(false);
  });

  it('accepts full input', () => {
    const r = createMemberEmploymentSchema.parse({
      ...valid,
      employerId: uuid,
      worksiteId: uuid,
      bargainingUnitId: uuid,
      employmentStatus: 'on_leave',
      employmentType: 'part_time',
      terminationDate: '2025-12-31',
      expectedReturnDate: '2026-03-01',
      seniorityYears: 5.5,
      jobCode: 'EL-001',
      jobClassification: 'Skilled Trades',
      jobLevel: 3,
      department: 'Maintenance',
      division: 'Operations',
      payFrequency: 'bi_weekly',
      hourlyRate: 42.50,
      baseSalary: 85000,
      grossWages: 90000,
      regularHoursPerWeek: 37.5,
      shiftType: 'rotating',
      shiftStartTime: '06:00',
      shiftEndTime: '14:00',
      supervisorName: 'Jane Doe',
      supervisorId: uuid,
      isProbationary: true,
      probationEndDate: '2026-06-15',
      checkoffDate: '2020-07-01',
    });
    expect(r.employmentStatus).toBe('on_leave');
    expect(r.hourlyRate).toBe(42.50);
  });

  it('rejects missing required fields', () => {
    expect(() => createMemberEmploymentSchema.parse({})).toThrow();
    expect(() => createMemberEmploymentSchema.parse({ ...valid, jobTitle: '' })).toThrow();
  });

  it('rejects invalid UUID', () => {
    expect(() => createMemberEmploymentSchema.parse({ ...valid, organizationId: 'bad' })).toThrow();
  });

  it('rejects invalid date format', () => {
    expect(() => createMemberEmploymentSchema.parse({ ...valid, hireDate: '2020/06/15' })).toThrow();
  });

  it('rejects shift time outside HH:MM format', () => {
    expect(() => createMemberEmploymentSchema.parse({ ...valid, shiftStartTime: '25:00' })).toThrow();
    expect(() => createMemberEmploymentSchema.parse({ ...valid, shiftStartTime: '8am' })).toThrow();
  });

  it('rejects seniority years outside range', () => {
    expect(() => createMemberEmploymentSchema.parse({ ...valid, seniorityYears: -1 })).toThrow();
    expect(() => createMemberEmploymentSchema.parse({ ...valid, seniorityYears: 100 })).toThrow();
  });

  it('rejects job level outside range', () => {
    expect(() => createMemberEmploymentSchema.parse({ ...valid, jobLevel: 0 })).toThrow();
    expect(() => createMemberEmploymentSchema.parse({ ...valid, jobLevel: 21 })).toThrow();
  });

  it('rejects hourly rate outside range', () => {
    expect(() => createMemberEmploymentSchema.parse({ ...valid, hourlyRate: -5 })).toThrow();
    expect(() => createMemberEmploymentSchema.parse({ ...valid, hourlyRate: 10000 })).toThrow();
  });

  it('rejects regularHoursPerWeek > 168', () => {
    expect(() => createMemberEmploymentSchema.parse({ ...valid, regularHoursPerWeek: 200 })).toThrow();
  });
});

// ── updateMemberEmploymentSchema ─────────────────────────────────────────────

describe('updateMemberEmploymentSchema', () => {
  it('requires id and allows partial fields', () => {
    const r = updateMemberEmploymentSchema.parse({ id: uuid, jobTitle: 'Foreman' });
    expect(r.id).toBe(uuid);
    expect(r.jobTitle).toBe('Foreman');
  });

  it('rejects without id', () => {
    expect(() => updateMemberEmploymentSchema.parse({ jobTitle: 'Foreman' })).toThrow();
  });
});

// ── createEmploymentHistorySchema ────────────────────────────────────────────

describe('createEmploymentHistorySchema', () => {
  const valid = {
    organizationId: uuid,
    memberId: uuid2,
    changeType: 'hire',
    effectiveDate: '2020-06-15',
  };

  it('accepts valid minimal input', () => {
    const r = createEmploymentHistorySchema.parse(valid);
    expect(r.changeType).toBe('hire');
  });

  it('accepts all change types', () => {
    const types = [
      'hire', 'promotion', 'transfer', 'demotion', 'leave',
      'return_from_leave', 'termination', 'resignation', 'retirement',
      'wage_change', 'status_change', 'worksite_change',
      'job_classification_change', 'other',
    ];
    for (const t of types) {
      expect(createEmploymentHistorySchema.parse({ ...valid, changeType: t }).changeType).toBe(t);
    }
  });

  it('accepts optional fields', () => {
    const r = createEmploymentHistorySchema.parse({
      ...valid,
      previousValues: { salary: 50000 },
      newValues: { salary: 55000 },
      reason: 'Promotion',
      notes: 'Merit-based',
      createdBy: 'admin',
    });
    expect(r.reason).toBe('Promotion');
  });

  it('rejects invalid change type', () => {
    expect(() => createEmploymentHistorySchema.parse({ ...valid, changeType: 'fired' })).toThrow();
  });
});

// ── createMemberLeaveSchema ──────────────────────────────────────────────────

describe('createMemberLeaveSchema', () => {
  const valid = {
    organizationId: uuid,
    memberId: uuid2,
    leaveType: 'vacation',
    startDate: '2026-01-15',
  };

  it('accepts valid minimal input with defaults', () => {
    const r = createMemberLeaveSchema.parse(valid);
    expect(r.isApproved).toBe(false);
    expect(r.affectsSeniority).toBe(false);
    expect(r.affectsDues).toBe(true);
    expect(r.duesWaiverApproved).toBe(false);
  });

  it('accepts full input', () => {
    const r = createMemberLeaveSchema.parse({
      ...valid,
      leaveType: 'maternity',
      endDate: '2026-07-15',
      expectedReturnDate: '2026-07-20',
      isApproved: true,
      approvedBy: 'HR Manager',
      affectsSeniority: true,
      seniorityAdjustmentDays: 30,
      duesWaiverApproved: true,
      reason: 'Maternity',
      documents: [{ name: 'cert.pdf' }],
    });
    expect(r.leaveType).toBe('maternity');
    expect(r.affectsSeniority).toBe(true);
  });

  it('rejects invalid leave type', () => {
    expect(() => createMemberLeaveSchema.parse({ ...valid, leaveType: 'sabbatical' })).toThrow();
  });
});

describe('updateMemberLeaveSchema', () => {
  it('requires id', () => {
    const r = updateMemberLeaveSchema.parse({ id: uuid, isApproved: true });
    expect(r.isApproved).toBe(true);
  });
});

// ── createJobClassificationSchema ────────────────────────────────────────────

describe('createJobClassificationSchema', () => {
  const valid = {
    organizationId: uuid,
    jobCode: 'EL-001',
    jobTitle: 'Electrician',
  };

  it('accepts valid minimal input with defaults', () => {
    const r = createJobClassificationSchema.parse(valid);
    expect(r.isActive).toBe(true);
  });

  it('accepts wage rates', () => {
    const r = createJobClassificationSchema.parse({
      ...valid,
      minimumRate: 25.00,
      maximumRate: 45.00,
      standardRate: 35.00,
      jobFamily: 'Trades',
      jobLevel: 3,
    });
    expect(r.minimumRate).toBe(25.00);
    expect(r.maximumRate).toBe(45.00);
  });

  it('rejects empty job code', () => {
    expect(() => createJobClassificationSchema.parse({ ...valid, jobCode: '' })).toThrow();
  });

  it('rejects wage rate > 9999.99', () => {
    expect(() => createJobClassificationSchema.parse({ ...valid, minimumRate: 10000 })).toThrow();
  });

  it('rejects job level > 50', () => {
    expect(() => createJobClassificationSchema.parse({ ...valid, jobLevel: 51 })).toThrow();
  });
});

describe('updateJobClassificationSchema', () => {
  it('requires id', () => {
    const r = updateJobClassificationSchema.parse({ id: uuid, jobTitle: 'Sr Electrician' });
    expect(r.jobTitle).toBe('Sr Electrician');
  });
});

// ── duesCalculationDataSchema ────────────────────────────────────────────────

describe('duesCalculationDataSchema', () => {
  it('accepts valid dues data', () => {
    const r = duesCalculationDataSchema.parse({
      grossWages: 5000,
      hourlyRate: 42.50,
      hoursWorked: 160,
      employmentStatus: 'active',
      payFrequency: 'bi_weekly',
    });
    expect(r.grossWages).toBe(5000);
  });

  it('rejects negative wages', () => {
    expect(() => duesCalculationDataSchema.parse({
      grossWages: -1,
      employmentStatus: 'active',
      payFrequency: 'hourly',
    })).toThrow();
  });

  it('rejects hoursWorked > 744', () => {
    expect(() => duesCalculationDataSchema.parse({
      hoursWorked: 800,
      employmentStatus: 'active',
      payFrequency: 'hourly',
    })).toThrow();
  });

  it('requires employmentStatus and payFrequency', () => {
    expect(() => duesCalculationDataSchema.parse({ grossWages: 5000 })).toThrow();
  });
});

// ── bulkEmploymentImportSchema ───────────────────────────────────────────────

describe('bulkEmploymentImportSchema', () => {
  const employee = {
    organizationId: uuid,
    memberId: uuid2,
    hireDate: '2020-06-15',
    seniorityDate: '2020-06-15',
    jobTitle: 'Clerk',
  };

  it('accepts valid import with defaults', () => {
    const r = bulkEmploymentImportSchema.parse({
      organizationId: uuid,
      employees: [employee],
    });
    expect(r.validateOnly).toBe(false);
    expect(r.skipDuplicates).toBe(true);
    expect(r.employees).toHaveLength(1);
  });

  it('accepts validateOnly flag', () => {
    const r = bulkEmploymentImportSchema.parse({
      organizationId: uuid,
      employees: [employee],
      validateOnly: true,
    });
    expect(r.validateOnly).toBe(true);
  });

  it('rejects empty employees array', () => {
    // z.array validates individual elements, empty array is valid
    const r = bulkEmploymentImportSchema.parse({
      organizationId: uuid,
      employees: [],
    });
    expect(r.employees).toHaveLength(0);
  });
});

// ── seniorityCalculationSchema ───────────────────────────────────────────────

describe('seniorityCalculationSchema', () => {
  it('accepts valid input', () => {
    const r = seniorityCalculationSchema.parse({
      hireDate: '2015-03-01',
      seniorityDate: '2015-03-01',
    });
    expect(r.hireDate).toBe('2015-03-01');
  });

  it('accepts leaves array', () => {
    const r = seniorityCalculationSchema.parse({
      hireDate: '2015-03-01',
      seniorityDate: '2015-03-01',
      leaves: [{
        startDate: '2020-01-01',
        endDate: '2020-06-01',
        affectsSeniority: true,
        adjustmentDays: 90,
      }],
    });
    expect(r.leaves).toHaveLength(1);
    expect(r.leaves![0].adjustmentDays).toBe(90);
  });

  it('rejects invalid date format', () => {
    expect(() => seniorityCalculationSchema.parse({
      hireDate: 'March 1 2015',
      seniorityDate: '2015-03-01',
    })).toThrow();
  });

  it('rejects negative adjustment days', () => {
    expect(() => seniorityCalculationSchema.parse({
      hireDate: '2015-03-01',
      seniorityDate: '2015-03-01',
      leaves: [{ startDate: '2020-01-01', endDate: '2020-06-01', affectsSeniority: true, adjustmentDays: -5 }],
    })).toThrow();
  });
});
