/**
 * Tests for evidence export seal computation & verification
 *
 * PR-032: Evidence Export + Seal Verification
 *
 * These tests exercise the pure crypto functions directly —
 * no DB or API dependencies.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Local mirrors of EvidencePack shape and seal functions
// (avoids cross-package import from apps/union-eyes)
// ---------------------------------------------------------------------------

interface EvidencePack {
  version: '1.0';
  exportedAt: string;
  exportedBy: string;
  caseId: string;
  organizationId: string;
  caseRecord: Record<string, unknown>;
  notes: Record<string, unknown>[];
  auditTrail: Record<string, unknown>[];
  seal: string;
}

function computeSeal(data: Omit<EvidencePack, 'seal'>): string {
  const canonical = JSON.stringify(data);
  return createHash('sha256').update(canonical).digest('hex');
}

function verifySeal(pack: EvidencePack): boolean {
  const { seal, ...rest } = pack;
  return computeSeal(rest) === seal;
}

function buildEvidencePack(input: {
  exportedBy: string;
  caseId: string;
  organizationId: string;
  caseRecord: Record<string, unknown>;
  notes: Record<string, unknown>[];
  auditTrail: Record<string, unknown>[];
}): EvidencePack {
  const unsealedPack = {
    version: '1.0' as const,
    exportedAt: '2025-06-15T12:00:00.000Z', // fixed for deterministic tests
    exportedBy: input.exportedBy,
    caseId: input.caseId,
    organizationId: input.organizationId,
    caseRecord: input.caseRecord,
    notes: input.notes,
    auditTrail: input.auditTrail,
  };
  const seal = computeSeal(unsealedPack);
  return { ...unsealedPack, seal };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makePack(): EvidencePack {
  return buildEvidencePack({
    exportedBy: 'user_abc',
    caseId: 'case_001',
    organizationId: 'org_xyz',
    caseRecord: { id: 'case_001', status: 'resolved', type: 'workplace_safety' },
    notes: [
      { id: 'n1', text: 'Initial intake note', createdAt: '2025-06-01' },
      { id: 'n2', text: 'Follow-up', createdAt: '2025-06-05' },
    ],
    auditTrail: [
      { auditId: 'a1', action: 'create', createdAt: '2025-06-01' },
      { auditId: 'a2', action: 'update', createdAt: '2025-06-03' },
    ],
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Evidence Pack Structure', () => {
  it('has version 1.0', () => {
    expect(makePack().version).toBe('1.0');
  });

  it('includes all required sections', () => {
    const pack = makePack();
    expect(pack).toHaveProperty('exportedAt');
    expect(pack).toHaveProperty('exportedBy');
    expect(pack).toHaveProperty('caseId');
    expect(pack).toHaveProperty('organizationId');
    expect(pack).toHaveProperty('caseRecord');
    expect(pack).toHaveProperty('notes');
    expect(pack).toHaveProperty('auditTrail');
    expect(pack).toHaveProperty('seal');
  });

  it('seal is a 64-char hex string (SHA-256)', () => {
    expect(makePack().seal).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('Seal Verification', () => {
  it('verifies an untampered pack', () => {
    expect(verifySeal(makePack())).toBe(true);
  });

  it('detects tampered caseRecord', () => {
    const pack = makePack();
    pack.caseRecord.status = 'rejected'; // tamper
    expect(verifySeal(pack)).toBe(false);
  });

  it('detects tampered notes', () => {
    const pack = makePack();
    pack.notes.push({ id: 'n3', text: 'Injected note' });
    expect(verifySeal(pack)).toBe(false);
  });

  it('detects tampered auditTrail', () => {
    const pack = makePack();
    pack.auditTrail = []; // wipe audit trail
    expect(verifySeal(pack)).toBe(false);
  });

  it('detects tampered exportedBy', () => {
    const pack = makePack();
    pack.exportedBy = 'attacker_id';
    expect(verifySeal(pack)).toBe(false);
  });

  it('detects tampered seal itself', () => {
    const pack = makePack();
    pack.seal = 'a'.repeat(64);
    expect(verifySeal(pack)).toBe(false);
  });
});

describe('Deterministic Sealing', () => {
  it('same input produces same seal', () => {
    const pack1 = makePack();
    const pack2 = makePack();
    expect(pack1.seal).toBe(pack2.seal);
  });

  it('different caseId produces different seal', () => {
    const pack1 = makePack();
    const pack2 = buildEvidencePack({
      exportedBy: 'user_abc',
      caseId: 'case_002',
      organizationId: 'org_xyz',
      caseRecord: { id: 'case_002', status: 'resolved', type: 'workplace_safety' },
      notes: [],
      auditTrail: [],
    });
    expect(pack1.seal).not.toBe(pack2.seal);
  });
});

describe('computeSeal', () => {
  it('returns hex string', () => {
    const seal = computeSeal({
      version: '1.0',
      exportedAt: '2025-01-01T00:00:00Z',
      exportedBy: 'u',
      caseId: 'c',
      organizationId: 'o',
      caseRecord: {},
      notes: [],
      auditTrail: [],
    });
    expect(seal).toMatch(/^[0-9a-f]{64}$/);
  });
});
