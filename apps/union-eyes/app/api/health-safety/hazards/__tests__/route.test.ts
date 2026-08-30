import { describe, it, expect } from 'vitest';
import {
  buildHazardCreateValues,
  generateReportNumber,
  HAZARD_TYPE_TO_CATEGORY,
  PRIORITY_TO_HAZARD_LEVEL,
} from '../route';

describe('health-safety/hazards route helpers', () => {
  describe('generateReportNumber', () => {
    it('produces a HAZ-<year>-<suffix> formatted number', () => {
      const num = generateReportNumber();
      expect(num).toMatch(/^HAZ-\d{4}-[0-9A-F]{6}$/);
    });

    it('produces distinct values across calls', () => {
      const a = generateReportNumber();
      const b = generateReportNumber();
      expect(a).not.toEqual(b);
    });
  });

  describe('buildHazardCreateValues', () => {
    it('maps every known client hazardType to a valid hazardCategory enum value', () => {
      for (const [hazardType, expectedCategory] of Object.entries(HAZARD_TYPE_TO_CATEGORY)) {
        const result = buildHazardCreateValues({ hazardType, priority: 'low', location: 'Site A', description: 'desc' });
        expect(result.hazardCategory).toBe(expectedCategory);
      }
    });

    it('maps every known client priority to a valid hazardLevel enum value', () => {
      for (const [priority, expectedLevel] of Object.entries(PRIORITY_TO_HAZARD_LEVEL)) {
        const result = buildHazardCreateValues({ hazardType: 'other', priority, location: 'Site A', description: 'desc' });
        expect(result.hazardLevel).toBe(expectedLevel);
      }
    });

    it('falls back to other/moderate for unrecognized values', () => {
      const result = buildHazardCreateValues({ hazardType: 'unknown_type', priority: 'unknown_priority' });
      expect(result.hazardCategory).toBe('other');
      expect(result.hazardLevel).toBe('moderate');
    });

    it('maps location/description to schema column names', () => {
      const result = buildHazardCreateValues({
        hazardType: 'fire',
        priority: 'high',
        location: 'Warehouse B',
        description: 'Sparks near flammable storage',
        potentialConsequences: 'Fire outbreak',
        recommendedAction: 'Remove flammable materials',
      });
      expect(result.specificLocation).toBe('Warehouse B');
      expect(result.hazardDescription).toBe('Sparks near flammable storage');
      expect(result.potentialConsequences).toBe('Fire outbreak');
      expect(result.suggestedCorrections).toBe('Remove flammable materials');
    });

    it('generates a reportNumber when the client does not supply one', () => {
      const result = buildHazardCreateValues({ hazardType: 'other', priority: 'low' });
      expect(typeof result.reportNumber).toBe('string');
      expect(result.reportNumber).toMatch(/^HAZ-\d{4}-[0-9A-F]{6}$/);
    });

    it('preserves a client-supplied reportNumber', () => {
      const result = buildHazardCreateValues({ hazardType: 'other', priority: 'low', reportNumber: 'HAZ-2020-000001' });
      expect(result.reportNumber).toBe('HAZ-2020-000001');
    });

    it('suppresses reporter identity fields when isAnonymous is true', () => {
      const result = buildHazardCreateValues({
        hazardType: 'other',
        priority: 'low',
        isAnonymous: true,
        reporterName: 'Jane Doe',
        reporterContact: 'jane@example.com',
      });
      expect(result.reportedByName).toBeUndefined();
      expect(result.reporterContactInfo).toBeUndefined();
    });

    it('carries reporter identity fields when not anonymous', () => {
      const result = buildHazardCreateValues({
        hazardType: 'other',
        priority: 'low',
        isAnonymous: false,
        reporterName: 'Jane Doe',
        reporterContact: 'jane@example.com',
      });
      expect(result.reportedByName).toBe('Jane Doe');
      expect(result.reporterContactInfo).toBe('jane@example.com');
    });

    it('preserves organizationId and createdBy passed through by the crud factory', () => {
      const result = buildHazardCreateValues({
        hazardType: 'other',
        priority: 'low',
        organizationId: 'org-123',
        createdBy: 'user-456',
      });
      expect(result.organizationId).toBe('org-123');
      expect(result.createdBy).toBe('user-456');
    });
  });
});
