import { describe, it, expect } from 'vitest';
import {
  buildIncidentCreateValues,
  generateIncidentNumber,
  resolveIncidentDate,
  INCIDENT_TYPE_MAP,
  SEVERITY_MAP,
} from '../route';

describe('health-safety/incidents route helpers', () => {
  describe('generateIncidentNumber', () => {
    it('produces an INC-<year>-<suffix> formatted number', () => {
      expect(generateIncidentNumber()).toMatch(/^INC-\d{4}-[0-9A-F]{6}$/);
    });
  });

  describe('resolveIncidentDate', () => {
    it('combines a date and time-of-day into a single ISO timestamp', () => {
      const iso = resolveIncidentDate({ incidentDate: '2026-03-15T00:00:00.000Z', incidentTime: '14:30' });
      const parsed = new Date(iso);
      expect(parsed.getHours()).toBe(14);
      expect(parsed.getMinutes()).toBe(30);
    });

    it('falls back to now when incidentDate is missing or invalid', () => {
      const iso = resolveIncidentDate({});
      expect(() => new Date(iso).toISOString()).not.toThrow();
      expect(new Date(iso).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('buildIncidentCreateValues', () => {
    it('maps every known client incidentType to a valid incidentType enum value', () => {
      for (const [incidentType, expected] of Object.entries(INCIDENT_TYPE_MAP)) {
        const result = buildIncidentCreateValues({ incidentType, severity: 'minor', location: 'Site A', description: 'desc' });
        expect(result.incidentType).toBe(expected);
      }
    });

    it('maps every known client severity to a valid severity enum value', () => {
      for (const [severity, expected] of Object.entries(SEVERITY_MAP)) {
        const result = buildIncidentCreateValues({ incidentType: 'other', severity, location: 'Site A', description: 'desc' });
        expect(result.severity).toBe(expected);
      }
    });

    it('falls back to other/minor for unrecognized values', () => {
      const result = buildIncidentCreateValues({ incidentType: 'unknown', severity: 'unknown' });
      expect(result.incidentType).toBe('other');
      expect(result.severity).toBe('minor');
    });

    it('maps location/description to schema column names', () => {
      const result = buildIncidentCreateValues({
        incidentType: 'injury',
        severity: 'minor',
        location: 'Loading dock',
        department: 'Warehouse',
        description: 'Worker slipped on wet floor',
      });
      expect(result.locationDescription).toBe('Loading dock');
      expect(result.departmentName).toBe('Warehouse');
      expect(result.description).toBe('Worker slipped on wet floor');
    });

    it('generates an incidentNumber when the client does not supply one', () => {
      const result = buildIncidentCreateValues({ incidentType: 'injury', severity: 'minor' });
      expect(result.incidentNumber).toMatch(/^INC-\d{4}-[0-9A-F]{6}$/);
    });

    it('preserves a client-supplied incidentNumber', () => {
      const result = buildIncidentCreateValues({ incidentType: 'injury', severity: 'minor', incidentNumber: 'INC-2020-000001' });
      expect(result.incidentNumber).toBe('INC-2020-000001');
    });

    it('suppresses reporter identity fields in metadata when isAnonymous is true', () => {
      const result = buildIncidentCreateValues({
        incidentType: 'injury',
        severity: 'minor',
        isAnonymous: true,
        reportedBy: 'Jane Doe',
        reporterContact: 'jane@example.com',
      });
      const metadata = result.metadata as Record<string, unknown>;
      expect(metadata.reportedBy).toBeUndefined();
      expect(metadata.reporterContact).toBeUndefined();
    });

    it('preserves organizationId and createdBy passed through by the crud factory', () => {
      const result = buildIncidentCreateValues({
        incidentType: 'injury',
        severity: 'minor',
        organizationId: 'org-123',
        createdBy: 'user-456',
      });
      expect(result.organizationId).toBe('org-123');
      expect(result.createdBy).toBe('user-456');
    });
  });
});
