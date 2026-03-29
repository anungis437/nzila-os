/**
 * Tests for evidence-export.ts
 */
import { describe, it, expect } from 'vitest';
import { buildEvidencePack, computeSeal, verifySeal } from '../evidence-export';

describe('evidence-export', () => {
  const sampleInput = {
    exportedBy: 'user-1',
    caseId: 'case-123',
    organizationId: 'org-456',
    caseRecord: { id: 'case-123', status: 'open', type: 'grievance' },
    notes: [{ id: 'n1', text: 'First note' }],
    auditTrail: [{ id: 'a1', action: 'created', timestamp: '2026-01-01' }],
  };

  describe('buildEvidencePack', () => {
    it('builds a complete evidence pack with seal', () => {
      const pack = buildEvidencePack(sampleInput);
      expect(pack.version).toBe('1.0');
      expect(pack.exportedBy).toBe('user-1');
      expect(pack.caseId).toBe('case-123');
      expect(pack.organizationId).toBe('org-456');
      expect(pack.caseRecord).toEqual(sampleInput.caseRecord);
      expect(pack.notes).toEqual(sampleInput.notes);
      expect(pack.auditTrail).toEqual(sampleInput.auditTrail);
      expect(pack.seal).toBeDefined();
      expect(typeof pack.seal).toBe('string');
      expect(pack.seal.length).toBe(64); // SHA-256 hex
    });

    it('includes exportedAt timestamp', () => {
      const pack = buildEvidencePack(sampleInput);
      expect(pack.exportedAt).toBeDefined();
      expect(new Date(pack.exportedAt).getTime()).not.toBeNaN();
    });
  });

  describe('computeSeal', () => {
    it('produces a 64-char hex SHA-256 digest', () => {
      const seal = computeSeal({
        version: '1.0',
        exportedAt: '2026-01-01T00:00:00Z',
        exportedBy: 'user-1',
        caseId: 'c1',
        organizationId: 'o1',
        caseRecord: {},
        notes: [],
        auditTrail: [],
      });
      expect(seal).toMatch(/^[a-f0-9]{64}$/);
    });

    it('is deterministic for the same input', () => {
      const data = {
        version: '1.0' as const,
        exportedAt: '2026-03-01T00:00:00Z',
        exportedBy: 'u1',
        caseId: 'c1',
        organizationId: 'o1',
        caseRecord: { x: 1 },
        notes: [],
        auditTrail: [],
      };
      expect(computeSeal(data)).toBe(computeSeal(data));
    });

    it('changes when data changes', () => {
      const base = {
        version: '1.0' as const,
        exportedAt: '2026-01-01T00:00:00Z',
        exportedBy: 'u1',
        caseId: 'c1',
        organizationId: 'o1',
        caseRecord: {},
        notes: [],
        auditTrail: [],
      };
      const modified = { ...base, caseId: 'c2' };
      expect(computeSeal(base)).not.toBe(computeSeal(modified));
    });
  });

  describe('verifySeal', () => {
    it('returns true for untampered pack', () => {
      const pack = buildEvidencePack(sampleInput);
      expect(verifySeal(pack)).toBe(true);
    });

    it('returns false when pack is tampered', () => {
      const pack = buildEvidencePack(sampleInput);
      const tampered = { ...pack, caseId: 'tamperedId' };
      expect(verifySeal(tampered)).toBe(false);
    });

    it('returns false when seal is replaced', () => {
      const pack = buildEvidencePack(sampleInput);
      const tampered = { ...pack, seal: 'a'.repeat(64) };
      expect(verifySeal(tampered)).toBe(false);
    });
  });
});
