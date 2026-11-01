import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const API = join(fileURLToPath(new URL('../../../', import.meta.url)), 'app', 'api');
const read = (route: string) => readFileSync(join(API, ...route.split('/'), 'route.ts'), 'utf8');

describe('F05 commercial and employer-execution routes bound their inputs and floors', () => {
  // DEF-0B6-CMP-CONTRACT-CREATE-REFERENCES-UNVERIFIED
  it('a contract create checks its billing account and subscription against the caller organization', () => {
    const text = read('contracts');
    expect(text).toContain('assertOrganizationOwns');
    expect(text).toContain('billingAccountId');
    expect(text.indexOf('assertOrganizationOwns([')).toBeLessThan(text.indexOf('await createContract('));
  });

  // DEF-0B6-CMP-CONTRACT-READ-AT-MEMBER-FLOOR / DEF-0B3-SUBSCRIPTION-ROLE-TITLE-AND-MEMBER-READ
  it.each(['contracts', 'contracts/[id]/clauses', 'billing/subscriptions', 'billing/subscriptions/[id]'])('%s is read at the officer floor', (route) => {
    expect(read(route)).toContain("minRole: 'officer'");
  });

  it('pausing or resuming a subscription is an administrator act', () => {
    expect(read('billing/subscriptions')).toMatch(/\/\/ Pausing[^\n]*\n\s*auth: \{ minRole: 'admin' \}/);
  });

  // DEF-0B6-EMP-TIMESHEET-INGEST-STEWARD-FLOOR-UNBOUNDED
  it('a timesheet batch has validated dates, a capped file and an officer-level, bounded list', () => {
    const text = read('employer-execution/timesheets');
    expect(text).toContain('MAX_CSV_CHARACTERS');
    expect(text).toContain('YYYY-MM-DD');
    expect(text).toContain('.limit(200)');
    expect(text).toContain('auth: { roles: FINANCIAL_MEMBER_DATA_ROLES }');
    expect(text).toContain('requireLiveFinancialMandate(tx, { organizationId, userId, action: "finance:prepare", employerId: body.employerId })');
    expect(text).toContain('rowsVisibleToGrant(grant, organizationId, employerTimesheetBatches.organizationId, employerTimesheetBatches.employerId)');
  });

  // DEF-0B11-SOC-ANALYTICS-EXPORT-IS-A-DELETE-VERB-READ-AT-MEMBER-FLOOR-WITH-UNBOUNDED-ROWS-UNNEUTRALISED-CSV-AND-MISMATCHED-COLUMNS
  it('social analytics validates its range and bounds its rows', () => {
    const text = read('social-media/analytics');
    expect(text).toContain('366 days');
    expect(text).toContain('MAX_ANALYTICS_ROWS');
  });
});
