import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const PACK = join(
  ROOT,
  'docs/categories/products-and-market/union-eyes/liuna-opdc-cecof-readiness',
);

const requiredFiles = [
  'README.md',
  '09-pre-video-synthetic-scenario.md',
  '10-recording-script-and-shot-list.md',
  '11-pre-video-claim-lock.md',
  '12-gate-2-continuity-authorization-proof.md',
  '13-gate-3a-confidential-document-boundary-proof.md',
  '14-gate-3b-case-access-revocation-proof.md',
  '15-gate-4-leadership-transition-fixture.md',
  '16-gate-5-federated-visibility-proof.md',
  '17-gate-6-bilingual-mobile-recording-readiness.md',
  '18-gate-7-evidence-export-boundary-proof.md',
  '19-gate-8-legal-hold-retention-proof.md',
  '20-gate-9-ai-advisory-boundary-proof.md',
  '21-current-readiness-ledger.md',
  '22-gate-10-notification-offboarding-proof.md',
  '23-gate-10b-session-direct-link-offboarding-proof.md',
  '24-gate-10c-pending-ai-action-proof.md',
  '25-gate-11-case-evidence-legal-hold-proof.md',
  '26-gate-12-central-aggregate-reporting-proof.md',
];

function readPackFile(file: string) {
  return readFileSync(join(PACK, file), 'utf8');
}

describe('LIUNA readiness pack contract', () => {
  it('keeps the gate artifacts present', () => {
    for (const file of requiredFiles) {
      expect(existsSync(join(PACK, file)), file).toBe(true);
    }
  });

  it('keeps the pre-video recording disclaimer explicit', () => {
    const script = readPackFile('10-recording-script-and-shot-list.md');
    const claimLock = readPackFile('11-pre-video-claim-lock.md');

    expect(script).toContain('synthetic continuity scenario, not LIUNA production data');
    expect(script).toContain('It must not imply approval, procurement, deployment, legal certification, or production readiness for LIUNA');
    expect(claimLock).toContain('does not represent a LIUNA deployment, endorsement, or legal compliance certification');
  });

  it('keeps prohibited claims locked out', () => {
    const claimLock = readPackFile('11-pre-video-claim-lock.md');

    for (const phrase of [
      'LIUNA is a tenant, customer, sponsor, approver, or production user',
      'Union Eyes guarantees solicitor-client privilege',
      'Central bodies can safely see all local records',
      'Complete legal hold is implemented',
      'AI makes legal, organizing, bargaining, or governance decisions',
    ]) {
      expect(claimLock).toContain(phrase);
    }
  });

  it('keeps bilingual and mobile recording limits visible', () => {
    const gate6 = readPackFile('17-gate-6-bilingual-mobile-recording-readiness.md');

    expect(gate6).toContain('LIUNA_GATE_6_BILINGUAL_MOBILE_RECORDING = READY_WITH_LIMITATIONS');
    expect(gate6).toContain('English Recording Language');
    expect(gate6).toContain('French-Canadian Recording Language');
    expect(gate6).toContain('Mobile Recording Constraints');
    expect(gate6).toContain('does not prove full bilingual production UI readiness');
    expect(gate6).toContain("Il s'agit d'une presentation synthetique pour discussion");
  });

  it('keeps AI framed as advisory and human-reviewed', () => {
    const gate9 = readPackFile('20-gate-9-ai-advisory-boundary-proof.md');
    const claimLock = readPackFile('11-pre-video-claim-lock.md');

    expect(gate9).toContain('LIUNA_GATE_9_AI_COPILOT_BOUNDARY = ADVISORY_GOVERNED_PROVEN');
    expect(gate9).toContain('reviewRequired: true');
    expect(gate9).toContain('audited, human-reviewed steward support');
    expect(gate9).toContain('does not prove privileged legal advice');
    expect(claimLock).toContain('AI makes legal, organizing, bargaining, or governance decisions');
  });

  it('keeps sensitive-pilot blockers explicit in the current ledger', () => {
    const ledger = readPackFile('21-current-readiness-ledger.md');

    expect(ledger).toContain('READY_TO_RECORD_WITH_EXPLICIT_LIMITATIONS');
    expect(ledger).toContain('Sensitive Legal Pilot');
    expect(ledger).toContain('NOT_READY');
    expect(ledger).toContain('LIUNA_BACKGROUND_JOB_AND_PROVIDER_ARTIFACT_CANCELLATION');
    expect(ledger).toContain('Do not claim sensitive pilot readiness');
  });

  it('keeps notification offboarding proof bounded to queued delivery', () => {
    const gate10 = readPackFile('22-gate-10-notification-offboarding-proof.md');

    expect(gate10).toContain('LIUNA_GATE_10A_NOTIFICATION_OFFBOARDING = CLOSED');
    expect(gate10).toContain('delivery-time guard');
    expect(gate10).toContain('LIUNA_GATE_10B_SESSION_AND_DIRECT_LINK_OFFBOARDING = OPEN');
    expect(gate10).toContain('does not prove full session invalidation');
  });

  it('keeps session and direct-link offboarding proof bounded to app auth', () => {
    const gate10b = readPackFile('23-gate-10b-session-direct-link-offboarding-proof.md');

    expect(gate10b).toContain('LIUNA_GATE_10B_SESSION_AND_DIRECT_LINK_OFFBOARDING = CLOSED_FOR_APP_AUTH_BOUNDARY');
    expect(gate10b).toContain('active and non-deleted');
    expect(gate10b).toContain('does not prove identity-provider token revocation latency');
    expect(gate10b).toContain('LIUNA_GATE_10C_PENDING_AI_ACTION = OPEN');
  });

  it('keeps pending AI action proof bounded to steward copilot', () => {
    const gate10c = readPackFile('24-gate-10c-pending-ai-action-proof.md');

    expect(gate10c).toContain('LIUNA_GATE_10C_PENDING_AI_ACTION = CLOSED_FOR_STEWARD_COPILOT');
    expect(gate10c).toContain('does not enqueue delayed AI work');
    expect(gate10c).toContain('LIUNA_BACKGROUND_JOB_AND_PROVIDER_ARTIFACT_CANCELLATION = OPEN_OPERATING_LIMITATION');
  });

  it('keeps case-evidence legal-hold proof bounded to destructive deletion', () => {
    const gate11 = readPackFile('25-gate-11-case-evidence-legal-hold-proof.md');
    const ledger = readPackFile('21-current-readiness-ledger.md');

    expect(gate11).toContain('LIUNA_GATE_11_CASE_EVIDENCE_LEGAL_HOLD = CLOSED_FOR_DESTRUCTIVE_DELETE');
    expect(gate11).toContain('before blob deletion or attachment metadata mutation');
    expect(gate11).toContain('does not prove complete matter-wide legal-hold orchestration');
    expect(ledger).toContain('case evidence delete legal-hold/retention guard');
  });

  it('keeps central reporting proof bounded to aggregate-only API output', () => {
    const gate12 = readPackFile('26-gate-12-central-aggregate-reporting-proof.md');
    const ledger = readPackFile('21-current-readiness-ledger.md');

    expect(gate12).toContain('LIUNA_GATE_12_CENTRAL_AGGREGATE_REPORTING = CLOSED_FOR_AGGREGATE_API');
    expect(gate12).toContain('rawRowsExposed: false');
    expect(gate12).toContain('does not prove a complete OPDC/CECOF dashboard workflow');
    expect(ledger).toContain('central aggregate reporting API without raw local rows');
  });
});
