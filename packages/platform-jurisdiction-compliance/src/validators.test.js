import { describe, expect, it } from 'vitest';
import { calculateTax, validateAddress, validateCooperativeRecord, validateEmployeeRecord, validateJurisdiction, validateTaxId, } from './validators';
describe('platform-jurisdiction-compliance validators', () => {
    it('validates supported and unsupported jurisdictions', () => {
        expect(validateJurisdiction('KE').valid).toBe(true);
        expect(validateJurisdiction('UG').valid).toBe(true);
        expect(validateJurisdiction('NG').valid).toBe(true);
        const unsupported = validateJurisdiction('CA');
        expect(unsupported.valid).toBe(false);
        expect(unsupported.error).toContain('Unsupported jurisdiction');
    });
    it('validates tax ID format by jurisdiction', () => {
        expect(validateTaxId('KE-TAX-12345678', 'KE').valid).toBe(true);
        expect(validateTaxId('UG-TAX-87654321', 'UG').valid).toBe(true);
        const bad = validateTaxId('KE-TAX-123', 'KE');
        expect(bad.valid).toBe(false);
        expect(bad.error).toBeDefined();
    });
    it('computes expected tax for a supported jurisdiction', () => {
        const result = calculateTax(1000, 'KE', 'standard');
        expect(result.valid).toBe(true);
        expect(result.taxAmount).toBe(160);
    });
    it('enforces required address fields per jurisdiction', () => {
        const valid = validateAddress({
            street: 'P.O. Box 12345',
            city: 'Nairobi',
            county: 'Nairobi County',
            postalCode: '00100',
        }, 'KE');
        expect(valid.valid).toBe(true);
        const missing = validateAddress({
            street: 'P.O. Box 12345',
            city: 'Nairobi',
        }, 'KE');
        expect(missing.valid).toBe(false);
        expect(missing.error).toContain('Missing required address fields');
    });
    it('validates composite employee and cooperative records', () => {
        const employee = validateEmployeeRecord({
            name: 'Alice',
            wage: 50000,
            hoursPerWeek: 40,
            annualLeaveDays: 24,
            pensionContribution: 10000,
            jurisdiction: 'KE',
        });
        expect(employee.valid).toBe(true);
        const coop = validateCooperativeRecord({
            name: 'Nairobi Coop',
            taxId: 'KE-TAX-12345678',
            registrationNumber: 'KE-COOP-00123',
            address: {
                street: 'P.O. Box 12345',
                city: 'Nairobi',
                county: 'Nairobi County',
                postalCode: '00100',
            },
            jurisdiction: 'KE',
        });
        expect(coop.valid).toBe(true);
    });
});
//# sourceMappingURL=validators.test.js.map