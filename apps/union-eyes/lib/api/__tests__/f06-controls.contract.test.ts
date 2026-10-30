import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const route = (name: string) => read(join('app', 'api', ...name.split('/'), 'route.ts'));

describe('F06 audit, retention and read-floor controls', () => {
  // DEF-0B6-CMP-CONTRACT-AUDIT-NOT-ATOMIC
  it('contract create, activate and terminate audit inside the contract transaction', () => {
    const text = read('services/platform-economics/contract-service.ts');
    expect(text.match(/persistAtomicAudit\(tx as unknown as RLSTx/g)).toHaveLength(3);
    expect(text).not.toContain("from '@/lib/audit-logger'");
  });

  // DEF-0B12-PLT-VOICE-TRANSCRIBE-HAS-NO-RATE-LIMIT-ENTITLEMENT-OR-AUDIT
  it('the transcription route audits before it sends the recording', () => {
    const text = route('voice/transcribe');
    expect(text.indexOf("'voice.transcribe.requested'")).toBeGreaterThan(0);
    expect(text.indexOf("'voice.transcribe.requested'")).toBeLessThan(text.indexOf('transcribeAudioWithLanguage(buffer'));
  });

  // DEF-0B10-PEN-PLAN-DELETE-REMOVES-THE-PLAN-ROW-WITH-NO-DEPENDENT-CHECK-OR-SNAPSHOT
  it('a pension plan is terminated, never deleted', () => {
    const text = route('pension/plans/[id]');
    expect(text).not.toContain('.delete(pensionPlans)');
    expect(text).toContain("status: 'terminated'");
  });

  // DEF-0B12-WBK-MEMORY-HOLDER-ROUTES-ACCEPT-READS-AND-WRITES-ON-THE-BEARER-ID-OF-AN-UNCLAIMED-WORKBOOK-WITH-NO-LIMIT-AND-NO-AUDIT
  it('workbook memory-holder reads and writes are rate limited like every bearer route', () => {
    const text = route('workbook/[id]/memory-holders');
    expect(text.match(/guardPublicIntake\(request/g)).toHaveLength(2);
  });

  // DEF-0B5-COMMS-SUBSCRIBER-EMAILS-READ-BY-ANY-MEMBER / DEF-0B4-BATCH-STATUS-RECIPIENT-EMAILS-DISCLOSED
  it('distribution lists and their subscribers are staff reads, and the subscriber list is bounded', () => {
    expect(route('communications/distribution-lists/[id]/subscribers')).toMatch(/minRole: 'steward'/);
    expect(route('communications/distribution-lists/[id]/subscribers')).toContain('.limit(5000)');
    expect(route('communications/distribution-lists')).toContain("readRole: 'steward'");
    expect(route('communications/distribution-lists/[id]')).toContain("readRole: 'steward'");
  });

  // DEF-0B7-PLT-EXT-PATCH-STEWARD-FLOOR-REWRITES-ENDPOINT-AND-MAPPING
  it('rewriting an integration endpoint needs an administrator', () => {
    expect(route('extensions/[id]')).toMatch(/export const PATCH = withApi\(\s*\{\s*\/\/[^\n]*\n\s*auth: \{ required: true, minRole: 'admin' \}/);
  });

  // DEF-0B8-JUR-KNOWLEDGE-BASE-ITEM-GET-INCREMENTS-VIEW-COUNT-IN-SYSTEM-CONTEXT-WITHOUT-ORG-PREDICATE
  it('the knowledge-base view counter is bounded to the organization of the row that was read', () => {
    const text = route('knowledge-base/[id]');
    expect(text).toContain('AND organization_id = ${row.organizationId}::uuid');
  });
});
