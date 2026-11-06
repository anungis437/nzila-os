import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/crud-factory', () => ({
  crudRoutes: () => ({ GET: vi.fn(), POST: vi.fn() }),
}));
vi.mock('@/lib/api/org-references', () => ({ assertOrganizationOwns: vi.fn() }));

import { validateEducationSessionCreate } from '../education/sessions/route';

const valid = {
  startDate: '2028-02-29',
  endDate: '2028-03-01',
  registrationOpenDate: '2028-01-01',
  registrationCloseDate: '2028-02-28',
  sessionCode: 'EDU-1',
  deliveryMethod: 'online',
};

describe('education session calendar validation', () => {
  it('accepts real leap days and preserves four-digit years including 0001 and 0099', () => {
    expect(() => validateEducationSessionCreate(valid)).not.toThrow();
    for (const date of ['0001-01-01', '0099-12-31', '0100-01-01']) {
      expect(() => validateEducationSessionCreate({
        ...valid, startDate: date, endDate: date,
        registrationOpenDate: null, registrationCloseDate: null,
      })).not.toThrow();
    }
  });

  it.each(['2027-02-29', '2028-02-30', '2028-04-31', '2028-13-01', '2028-00-01', '2028-01-00', '2028-1-01', '2028-01-01T00:00:00Z'])(
    'rejects noncanonical or impossible calendar date %s',
    date => {
      expect(() => validateEducationSessionCreate({ ...valid, startDate: date })).toThrow();
    },
  );

  it('rejects impossible registration window dates rather than normalizing them', () => {
    expect(() => validateEducationSessionCreate({
      ...valid, registrationCloseDate: '2028-02-30',
    })).toThrow();
  });
});
