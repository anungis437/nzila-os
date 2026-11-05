import { describe, expect, it } from 'vitest';
import { assertGenericWritePayload } from '@/lib/api/crud-factory';
import { normalizeWriteValues } from '@/lib/api/crud-write-values';
import { committees, employers, worksites } from '@/db/schema/union-structure-schema';
import { toEmployerPayload } from '../EmployerManagement';
import { toWorksitePayload } from '../WorksiteManagement';
import { toCommitteePayload } from '../CommitteeManagement';

// What the CRUD factory itself does with a body before it writes: the same functions, run on what the forms send.
const EMPLOYER_ID = '5a0b3f0e-2d1c-4f7a-9c1e-0a1b2c3d4e5f';
const UNIT_ID = '6b1c4a1f-3e2d-4a8b-8d2f-1b2c3d4e5f60';
const WORKSITE_ID = '7c2d5b20-4f3e-4b9c-9e30-2c3d4e5f6071';

const accepted = (body: Record<string, unknown>, table: typeof employers | typeof worksites | typeof committees) => {
  const checked = assertGenericWritePayload(body, table, { primaryKey: 'id', blockedFields: ['createdBy'] });
  expect(checked).toEqual(body);
  return normalizeWriteValues(checked, table);
};

describe('what the union-structure forms send is what the CRUD routes accept', () => {
  it('employer: every field is a real column, and the type and status are members of the database enums', () => {
    const body = toEmployerPayload(
      {
        name: 'Acme',
        legalName: 'Acme Inc.',
        businessNumber: '123',
        employerType: 'crown_corporation',
        status: 'in_bargaining',
        totalEmployees: '10',
        unionizedEmployees: '4',
        email: 'a@b.test',
        phone: '555',
        website: 'https://b.test',
        street: '1 Main St',
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M5A 1A1',
        notes: 'n',
      },
      null,
    );
    expect(accepted(body, employers)).toMatchObject({ employerType: 'crown_corporation', status: 'in_bargaining' });
  });

  it('employer: every type and status the form offers is a member of the database enum', () => {
    const base = {
      name: 'Acme', legalName: '', businessNumber: '', totalEmployees: '', unionizedEmployees: '', email: '', phone: '', website: '',
      street: '', city: '', province: '', postalCode: '', notes: '',
    };
    const types = (employers.employerType as unknown as { enumValues: string[] }).enumValues;
    const statuses = (employers.status as unknown as { enumValues: string[] }).enumValues;
    for (const employerType of types) expect(() => accepted(toEmployerPayload({ ...base, employerType, status: 'active' }, null), employers)).not.toThrow();
    for (const status of statuses) expect(() => accepted(toEmployerPayload({ ...base, employerType: 'private', status }, null), employers)).not.toThrow();
  });

  it('worksite: every field is a real column, the employer is a uuid and the status is a member of the database enum', () => {
    const base = { employerId: EMPLOYER_ID, name: 'Plant', code: 'WS-1', employeeCount: '12', street: '1 Plant Rd', city: 'Hamilton', province: 'ON', postalCode: 'L8P 1A1' };
    const statuses = (worksites.status as unknown as { enumValues: string[] }).enumValues;
    expect(statuses.length).toBeGreaterThan(0);
    for (const status of statuses) expect(() => accepted(toWorksitePayload({ ...base, status }, null), worksites)).not.toThrow();
    expect(accepted(toWorksitePayload({ ...base, status: 'seasonal' }, null), worksites)).toMatchObject({ employerId: EMPLOYER_ID });
  });

  it('committee: every field is a real column, the type is a member of the database enum, and the unit and worksite are uuids', () => {
    const base = {
      name: 'Safety',
      status: 'active',
      contactEmail: 'safety@union.test',
      isOrganizationWide: false,
      unitId: UNIT_ID,
      worksiteId: WORKSITE_ID,
      meetingFrequency: 'Monthly',
      meetingDay: 'First Monday',
      meetingTime: '6:00 PM',
      meetingLocation: 'Hall',
      maxMembers: '9',
      currentMemberCount: '4',
      requiresAppointment: true,
      requiresElection: false,
      termLength: '12',
      mandate: 'Keep people safe',
      description: 'd',
      notes: 'internal',
    };
    const types = (committees.committeeType as unknown as { enumValues: string[] }).enumValues;
    expect(types.length).toBeGreaterThan(0);
    for (const committeeType of types) {
      for (const editing of [true, false]) expect(() => accepted(toCommitteePayload({ ...base, committeeType }, editing), committees)).not.toThrow();
    }
  });
});
