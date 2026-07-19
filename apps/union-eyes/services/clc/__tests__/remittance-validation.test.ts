import { describe, it, expect } from 'vitest';
import { RemittanceValidationService, remittanceValidator } from '../remittance-validation';

const UUID = '11111111-1111-1111-1111-111111111111';
const svc = new RemittanceValidationService();

function validRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID,
    fromOrgId: UUID,
    fromOrgName: 'Local 1',
    fromOrgCode: 'AB-1234',
    toOrgId: UUID,
    toOrgName: 'National',
    toOrgCode: 'NA-001',
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-03-31'),
    remittableMembers: 10,
    perCapitaRate: '5.00',
    totalAmount: '50.00',
    status: 'pending',
    dueDate: new Date('2024-04-30'),
    clcAccountCode: 'CLC-1',
    ...overrides,
  };
}

describe('validateRecord', () => {
  it('passes a fully valid record', () => {
    const r = svc.validateRecord(validRecord());
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('reports schema, period, amount and paid-date errors', () => {
    const r = svc.validateRecord(validRecord({
      periodStart: new Date('2024-04-01'),
      periodEnd: new Date('2024-01-01'),
      totalAmount: '99.99',
      status: 'paid',
      paidDate: undefined,
      dueDate: new Date('2023-12-01'),
    }));
    expect(r.valid).toBe(false);
    const fields = r.errors.map((e) => e.field);
    expect(fields).toContain('periodEnd');
    expect(fields).toContain('totalAmount');
    expect(fields).toContain('paidDate');
    expect(r.warnings.some((w) => w.field === 'dueDate')).toBe(true);
  });

  it('warns about zero amounts and zero members', () => {
    const r = svc.validateRecord(validRecord({ remittableMembers: 0, totalAmount: '0.00' }));
    const wfields = r.warnings.map((w) => w.field);
    expect(wfields).toContain('totalAmount');
    expect(wfields).toContain('remittableMembers');
  });
});

describe('validateBatch', () => {
  it('aggregates errors with record-indexed field names', () => {
    const r = svc.validateBatch([validRecord(), validRecord({ totalAmount: '1.00' })]);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.field.startsWith('record[1].'))).toBe(true);
  });

  it('flags an empty batch', () => {
    const r = svc.validateBatch([]);
    expect(r.valid).toBe(false);
    expect(r.errors[0].field).toBe('batch');
  });

  it('passes a batch of valid records', () => {
    const r = svc.validateBatch([validRecord()]);
    expect(r.valid).toBe(true);
  });
});

describe('validateCLCFormat', () => {
  it('passes well-formed CLC codes', () => {
    const r = svc.validateCLCFormat(validRecord());
    expect(r.valid).toBe(true);
    expect(r.warnings).toHaveLength(0);
  });

  it('warns about malformed codes and missing account code', () => {
    const r = svc.validateCLCFormat(validRecord({ fromOrgCode: 'X', toOrgCode: 'Y', clcAccountCode: undefined }));
    const wfields = r.warnings.map((w) => w.field);
    expect(wfields).toContain('fromOrgCode');
    expect(wfields).toContain('toOrgCode');
    expect(wfields).toContain('clcAccountCode');
  });
});

describe('validateStatCanFormat', () => {
  it('passes StatCan-compliant records', () => {
    const r = svc.validateStatCanFormat(validRecord({ fromOrgCode: 'AB1234' }));
    expect(r.valid).toBe(true);
  });

  it('reports format, required-field and member-count errors', () => {
    const r = svc.validateStatCanFormat({ fromOrgCode: 'AB-1234', remittableMembers: 0 });
    expect(r.valid).toBe(false);
    const fields = r.errors.map((e) => e.field);
    expect(fields).toContain('fromOrgCode');
    expect(fields).toContain('fromOrgName');
    expect(fields).toContain('remittableMembers');
  });
});

describe('formatValidationErrors', () => {
  it('formats both errors and warnings', () => {
    const msg = svc.formatValidationErrors({
      valid: false,
      errors: [{ field: 'a', message: 'bad', severity: 'error' }],
      warnings: [{ field: 'b', message: 'careful', severity: 'warning' }],
    });
    expect(msg).toContain('ERRORS:');
    expect(msg).toContain('WARNINGS:');
    expect(msg).toContain('a: bad');
  });

  it('returns an empty string for a clean result', () => {
    expect(svc.formatValidationErrors({ valid: true, errors: [], warnings: [] })).toBe('');
  });
});

it('exposes a singleton instance', () => {
  expect(remittanceValidator).toBeInstanceOf(RemittanceValidationService);
});
