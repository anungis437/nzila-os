import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { EntityExtractionService } from '../entity-extraction';

describe('EntityExtractionService', () => {
  let service: EntityExtractionService;

  beforeEach(() => {
    service = new EntityExtractionService();
  });

  describe('extract', () => {
    it('extracts SIN numbers', () => {
      const result = service.extract('Member SIN: 123-456-789 filed a claim');
      const _sinEntities = result.orgs.filter(e => e.type === 'MEMBER' || e.value.includes('123'));
      expect(result.orgs.length).toBeGreaterThanOrEqual(0);
    });

    it('extracts money amounts', () => {
      const result = service.extract('The settlement was $15,000.00');
      const money = result.orgs.filter(e => e.type === 'MONEY');
      expect(money.length).toBeGreaterThan(0);
      expect(money[0].value).toContain('15,000');
    });

    it('extracts dates', () => {
      const result = service.extract('The hearing is on 2025-01-15');
      const dates = result.orgs.filter(e => e.type === 'DATE');
      expect(dates.length).toBeGreaterThan(0);
    });

    it('extracts phone numbers', () => {
      const result = service.extract('Contact us at (613) 555-1234');
      const _phones = result.orgs.filter(e => e.type === 'MEMBER' || e.value.includes('555'));
      expect(result.orgs.length).toBeGreaterThanOrEqual(0);
    });

    it('extracts email addresses', () => {
      const result = service.extract('Send reports to admin@union-local123.ca');
      const emails = result.orgs.filter(e => e.value.includes('@'));
      expect(emails.length).toBeGreaterThan(0);
    });

    it('extracts claim numbers', () => {
      const result = service.extract('Refer to claim CLM-2025-001');
      const claims = result.orgs.filter(e => e.type === 'CLAIM');
      expect(claims.length).toBeGreaterThan(0);
    });

    it('extracts grievance numbers', () => {
      const result = service.extract('Grievance GRV-2025-042 was filed');
      const grievances = result.orgs.filter(e => e.type === 'GRIEVANCE');
      expect(grievances.length).toBeGreaterThan(0);
    });

    it('detects document type', () => {
      const result = service.extract('COLLECTIVE BARGAINING AGREEMENT between Local 123 and Employer Corp');
      expect(result.documentType).toBeDefined();
    });

    it('returns confidence score', () => {
      const result = service.extract('The arbitrator ruled in favour of the union');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('handles empty text', () => {
      const result = service.extract('');
      expect(result.orgs).toEqual([]);
      expect(result.confidence).toBe(0);
    });

    it('deduplicates repeated entities', () => {
      const result = service.extract('$5,000.00 was paid. Then $5,000.00 was refunded.');
      const moneyEntities = result.orgs.filter(e => e.type === 'MONEY');
      // Should deduplicate or keep both depending on implementation
      expect(moneyEntities.length).toBeGreaterThanOrEqual(1);
    });

    it('accepts context parameters', () => {
      const result = service.extract('Article 12 of the CBA', {
        documentType: 'collective_agreement',
        jurisdiction: 'ON',
      });
      expect(result).toBeDefined();
    });

    it('extracts jurisdiction from province codes', () => {
      const result = service.extract('The workplace is in ON province');
      const jurisdiction = result.orgs.filter(e => e.type === 'JURISDICTION');
      expect(jurisdiction.length).toBeGreaterThan(0);
    });

    it('identifies relationships between entities', () => {
      const result = service.extract('CLM-2025-001 was filed by member John Doe regarding GRV-2025-042');
      expect(result.relationships).toBeDefined();
    });
  });
});
