import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const API = join(fileURLToPath(new URL('../../../', import.meta.url)), 'app', 'api');
const read = (route: string) => readFileSync(join(API, ...route.split('/'), 'route.ts'), 'utf8');

describe('F04 generic CRUD routes name what a body may write and what a response omits', () => {
  // DEF-0B12-CRUD-BARGAINING-UNIT-CERTIFICATION-AND-REPRESENTATION-FIELDS-WRITABLE-BY-ANY-STEWARD / DEF-0B12-CRUD-BARGAINING-UNIT-ROWS-READABLE-BY-ANY-MEMBER-WITH-CERTIFICATION-NOTES-AND-CUSTOM-FIELDS
  it('bargaining units accept no certification or representation field and return no notes', () => {
    const collection = read('units');
    const writable = /writableFields: \[([^\]]*)\]/.exec(collection)?.[1] ?? '';
    for (const field of ['certificationNumber', 'certificationDate', 'certificationBody', 'chiefStewardId', 'bargainingChairId', 'currentCollectiveAgreementId', 'status', 'memberCount']) {
      expect(writable, field).not.toContain(`'${field}'`);
    }
    expect(collection).toContain("omitFromResponse: ['notes', 'customFields']");
    const item = read('units/[id]');
    expect(item).toMatch(/blockedPatchFields: \[[^\]]*'certificationNumber'[^\]]*'chiefStewardId'/);
    expect(item).toContain("omitFromResponse: ['notes', 'customFields']");
  });

  // DEF-0B12-CRUD-WORKSITE-ROWS-READABLE-BY-ANY-MEMBER-WITH-SITE-MANAGER-CONTACT-AND-NOTES
  it.each(['worksites', 'worksites/[id]'])('%s omits the site manager contact, notes and custom fields', (route) => {
    const text = read(route);
    for (const column of ['siteManagerName', 'siteManagerEmail', 'siteManagerPhone', 'notes', 'customFields']) expect(text).toContain(`'${column}'`);
  });

  // DEF-0B12-CRUD-WCB-ASSESSMENT-PREMIUM-AND-PAYROLL-READABLE-BY-ANY-STEWARD
  it.each(['wcb/assessments', 'wcb/assessments/[id]'])('%s is read at the officer floor', (route) => {
    expect(read(route)).toContain("readRole: 'officer'");
  });

  // DEF-0B7-EXP-REPORT-WRITES-ANY-STEWARD-ANY-FIELD
  it.each(['reports', 'reports/[id]'])('%s writes only the author fields', (route) => {
    const writable = /writableFields: \[([^\]]*)\]/.exec(read(route))?.[1] ?? '';
    expect(writable).toContain("'config'");
    for (const field of ['createdBy', 'runCount', 'lastRunAt', 'organizationId', 'isTemplate']) expect(writable, field).not.toContain(`'${field}'`);
  });

  // DEF-0B12-CRUD-TAX-SLIP-RL1-T106-AND-COPE-RECEIPT-PATHS-ISSUE-NOTHING-AND-REFUSE-EVERY-WRITE
  it.each(['tax/slips', 'tax/t106', 'tax/rl-1/generate', 'tax/cope/receipts'])('%s answers 501 and reads or writes nothing', (route) => {
    const text = read(route);
    expect(text).toContain('ApiError.notImplemented');
    expect(text).not.toContain('crudRoutes');
  });

  // DEF-0B3-BULK-IMPORT-INERT / DEF-0B2-UPDATE-ROLE-INERT / DEF-0B1-FIX-SUPER-ADMIN-INERT
  it.each(['members/bulk', 'admin/update-role', 'admin/fix-super-admin-roles'])('%s answers 501 rather than pretending to act', (route) => {
    expect(read(route)).toMatch(/ApiError\.notImplemented|status: 501/);
  });
});
