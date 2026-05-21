/**
 * End-to-end Evidence Lifecycle Integration Test (PR-031 / PR-032)
 *
 * Verifies the full CUPE case audit + evidence path:
 *   1. A case is created and transitioned through its lifecycle, each
 *      mutation flowing through `auditCaseMutation()` -> `auditDataMutation()`
 *      -> `auditLog()`.
 *   2. The captured audit trail is fed into `buildEvidencePackage()`.
 *   3. The resulting package is verified for seal integrity, manifest
 *      completeness, attachment malware-scan provenance, tamper detection,
 *      and that every lifecycle event landed in the trail.
 *
 * This guards the make-or-break arbitration-defensibility surface called out
 * in `docs/categories/platform-and-operations/reference/UNION_EYES_CURRENT_STATE.md`.
 *
 * Pure in-memory; no DB, no auth provider, no blob — the audit-logger module is mocked
 * to write into a captured ring buffer so we can assert against the trail
 * shape directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Audit capture — must be hoisted before module imports that depend on it.
// ---------------------------------------------------------------------------

const captured = vi.hoisted(() => ({
  trail: [] as Array<{
    eventType: string;
    severity: string;
    userId?: string;
    organizationId?: string;
    resource?: string;
    resourceId?: string;
    action?: string;
    details?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    outcome?: string;
    timestamp: string;
  }>,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock the audit-logger but keep the in-process call graph: auditCaseMutation
// -> auditDataMutation -> auditLog. We capture at auditLog level so we see
// what would persist to the audit_logs table in production.
vi.mock('@/lib/audit-logger', () => {
  const AuditEventType = {
    DATA_CREATE: 'data.create',
    DATA_UPDATE: 'data.update',
    DATA_DELETE: 'data.delete',
  } as const;
  const AuditSeverity = {
    LOW: 'info',
    MEDIUM: 'warning',
    HIGH: 'error',
    CRITICAL: 'critical',
  } as const;

  const auditLog = vi.fn(async (entry: Record<string, unknown>) => {
    captured.trail.push({
      eventType: String(entry.eventType),
      severity: String(entry.severity ?? AuditSeverity.MEDIUM),
      userId: entry.userId as string | undefined,
      organizationId: entry.organizationId as string | undefined,
      resource: entry.resource as string | undefined,
      resourceId: entry.resourceId as string | undefined,
      action: entry.action as string | undefined,
      details: entry.details as Record<string, unknown> | undefined,
      metadata: entry.metadata as Record<string, unknown> | undefined,
      outcome: (entry.outcome as string | undefined) ?? 'success',
      timestamp: new Date().toISOString(),
    });
  });

  const auditDataMutation = vi.fn(
    async (params: {
      userId: string;
      organizationId: string;
      resource: string;
      resourceId?: string;
      action: 'create' | 'update' | 'delete';
      details?: Record<string, unknown>;
      previousState?: Record<string, unknown>;
      newState?: Record<string, unknown>;
    }) => {
      const map: Record<string, string> = {
        create: AuditEventType.DATA_CREATE,
        update: AuditEventType.DATA_UPDATE,
        delete: AuditEventType.DATA_DELETE,
      };
      await auditLog({
        eventType: map[params.action],
        severity: params.action === 'delete' ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
        userId: params.userId,
        organizationId: params.organizationId,
        resource: params.resource,
        resourceId: params.resourceId,
        action: params.action,
        details: {
          ...params.details,
          previousState: params.previousState,
          newState: params.newState,
        },
      });
    },
  );

  return { auditLog, auditDataMutation, AuditEventType, AuditSeverity };
});

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------

import {
  auditCaseMutation,
  auditCaseExport,
  CaseAuditEvent,
} from '../audited-case-mutations';
import {
  buildEvidencePackage,
  verifySeal,
  computeSeal,
} from '../evidence-export';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG = 'org-cupe-local-12';
const ACTOR = 'user-steward-alex';
const CASE_ID = 'case-2026-0001';

/**
 * Drive a realistic case through the unified lifecycle FSM
 * (draft → submitted → triage → investigation → resolved → closed),
 * emitting a CASE_TRANSITIONED audit event at each step.
 */
async function driveLifecycle(): Promise<void> {
  await auditCaseMutation({
    event: CaseAuditEvent.CASE_CREATED,
    userId: ACTOR,
    organizationId: ORG,
    caseId: CASE_ID,
    action: 'create',
    newState: { status: 'draft', priority: 'high' },
    details: { source: 'intake-form', stewardPath: 'alex-the-steward' },
  });

  const transitions: Array<[string, string]> = [
    ['draft', 'submitted'],
    ['submitted', 'triage'],
    ['triage', 'investigation'],
    ['investigation', 'resolved'],
    ['resolved', 'closed'],
  ];

  for (const [from, to] of transitions) {
    await auditCaseMutation({
      event: CaseAuditEvent.CASE_TRANSITIONED,
      userId: ACTOR,
      organizationId: ORG,
      caseId: CASE_ID,
      action: 'update',
      previousState: { status: from },
      newState: { status: to },
      details: { transitionedBy: ACTOR, reason: 'lifecycle test' },
    });
  }

  await auditCaseExport({
    userId: ACTOR,
    organizationId: ORG,
    caseId: CASE_ID,
    format: 'zip',
  });
}

function buildSampleCaseRecord(): Record<string, unknown> {
  return {
    id: CASE_ID,
    organizationId: ORG,
    type: 'grievance',
    status: 'closed',
    priority: 'high',
    title: 'Discipline grievance — duty of fair representation',
    description: 'Member reports unjust suspension pending investigation.',
    createdAt: '2026-05-01T09:00:00Z',
    closedAt: '2026-05-29T17:30:00Z',
    attachments: [
      {
        fileName: 'discipline-letter.pdf',
        malwareScan: {
          status: 'clean',
          scannedAt: '2026-05-01T09:00:42Z',
          signature: 'clamav-0.103.10',
        },
      },
      {
        fileName: 'witness-statement.docx',
        malwareScan: {
          status: 'clean',
          scannedAt: '2026-05-03T11:14:01Z',
          signature: 'clamav-0.103.10',
        },
      },
      {
        fileName: 'unscanned-photo.jpg',
        // intentionally no malwareScan — exercises the "unscanned" path
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Evidence lifecycle — mutation chain → audit trail → sealed export', () => {
  beforeEach(() => {
    captured.trail.length = 0;
    vi.clearAllMocks();
  });

  it('captures every lifecycle event through the audit chain', async () => {
    await driveLifecycle();

    expect(captured.trail.length).toBe(7); // 1 create + 5 transitions + 1 export

    const eventNames = captured.trail.map((e) => e.details?.event ?? e.eventType);
    expect(eventNames).toContain(CaseAuditEvent.CASE_CREATED);
    expect(eventNames.filter((n) => n === CaseAuditEvent.CASE_TRANSITIONED)).toHaveLength(
      5,
    );
    expect(eventNames).toContain(CaseAuditEvent.CASE_EVIDENCE_EXPORTED);

    // Every persisted event scopes to the org and resource.
    for (const entry of captured.trail) {
      expect(entry.organizationId).toBe(ORG);
      expect(entry.resource).toBe('claims');
      expect(entry.resourceId).toBe(CASE_ID);
    }
  });

  it('builds a verifiable evidence package from the captured audit trail', async () => {
    await driveLifecycle();

    const caseRecord = buildSampleCaseRecord();
    const notes = [
      { id: 'note-1', text: 'Initial intake — member shaken but coherent.' },
      { id: 'note-2', text: 'Investigator interviewed two witnesses.' },
    ];

    const pkg = buildEvidencePackage({
      exportedBy: ACTOR,
      caseId: CASE_ID,
      organizationId: ORG,
      caseRecord,
      notes,
      auditTrail: captured.trail,
    });

    // Seal is valid right out of the builder.
    expect(pkg.verification.sealValid).toBe(true);
    expect(verifySeal(pkg.pack)).toBe(true);

    // Manifest covers all four artifacts with non-zero sizes + sha256 hashes.
    expect(pkg.manifest.artifacts).toHaveLength(4);
    const names = pkg.manifest.artifacts.map((a) => a.name).sort();
    expect(names).toEqual(['auditTrail', 'caseRecord', 'evidencePack', 'notes']);
    for (const artifact of pkg.manifest.artifacts) {
      expect(artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(artifact.bytes).toBeGreaterThan(0);
    }
  });

  it('reports per-attachment malware-scan provenance in the manifest', async () => {
    await driveLifecycle();
    const caseRecord = buildSampleCaseRecord();

    const pkg = buildEvidencePackage({
      exportedBy: ACTOR,
      caseId: CASE_ID,
      organizationId: ORG,
      caseRecord,
      notes: [],
      auditTrail: captured.trail,
    });

    const sec = pkg.manifest.attachmentSecurity;
    expect(sec).toBeDefined();
    expect(sec!.totalAttachments).toBe(3);
    expect(sec!.clean).toBe(2);
    expect(sec!.unscanned).toBe(1);
    expect(sec!.infected).toBe(0);

    const unscanned = sec!.entries.find((e) => e.fileName === 'unscanned-photo.jpg');
    expect(unscanned?.status).toBe('unscanned');
  });

  it('detects tampering of the case record after sealing', async () => {
    await driveLifecycle();
    const caseRecord = buildSampleCaseRecord();

    const pkg = buildEvidencePackage({
      exportedBy: ACTOR,
      caseId: CASE_ID,
      organizationId: ORG,
      caseRecord,
      notes: [],
      auditTrail: captured.trail,
    });

    // Mutate the pack post-seal — an attacker swapping the case status.
    const tampered = {
      ...pkg.pack,
      caseRecord: { ...pkg.pack.caseRecord, status: 'resolved-in-favour-of-employer' },
    };

    expect(verifySeal(tampered)).toBe(false);

    // And a freshly-computed seal over the tampered payload will not match
    // the original seal — proves the HMAC chains the case record.
    const reseal = computeSeal({ ...tampered, seal: undefined as unknown as string });
    expect(reseal).not.toBe(pkg.pack.seal);
  });

  it('detects tampering of the audit trail after sealing', async () => {
    await driveLifecycle();
    const caseRecord = buildSampleCaseRecord();

    const pkg = buildEvidencePackage({
      exportedBy: ACTOR,
      caseId: CASE_ID,
      organizationId: ORG,
      caseRecord,
      notes: [],
      auditTrail: captured.trail,
    });

    // Drop the CASE_CREATED entry — simulates an attempt to hide that
    // a case ever existed before transitioning it.
    const censored = pkg.pack.auditTrail.filter(
      (e) => (e as { details?: { event?: string } }).details?.event !==
        CaseAuditEvent.CASE_CREATED,
    );
    const tampered = { ...pkg.pack, auditTrail: censored };

    expect(verifySeal(tampered)).toBe(false);
  });

  it('produces a deterministic seal for identical input', async () => {
    await driveLifecycle();
    const caseRecord = buildSampleCaseRecord();

    // Use a frozen exportedAt so re-running buildEvidencePack twice produces
    // identical seals (otherwise the timestamp differs).
    const fixedExport = {
      version: '1.0' as const,
      exportedAt: '2026-05-30T12:00:00Z',
      exportedBy: ACTOR,
      caseId: CASE_ID,
      organizationId: ORG,
      caseRecord,
      notes: [],
      auditTrail: captured.trail,
    };

    const sealA = computeSeal(fixedExport);
    const sealB = computeSeal(fixedExport);
    expect(sealA).toBe(sealB);
    expect(sealA).toMatch(/^[a-f0-9]{64}$/);
  });
});
