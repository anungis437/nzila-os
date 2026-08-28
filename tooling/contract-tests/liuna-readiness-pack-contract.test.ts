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
  '27-gate-13-background-job-provider-artifact-cancellation-proof.md',
  '28-oci-workshop-pack.md',
  '29-recording-package-v1-handoff-baseline.md',
  '30-synthetic-fixtures-manifest.md',
  '31-synthetic-fixtures-v1.json',
  '32-opdc-cecof-provisional-vocabulary.md',
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
    expect(ledger).toContain('LIUNA_GATE_13_BACKGROUND_JOB_AND_PROVIDER_ARTIFACT_CANCELLATION');
    expect(ledger).toContain('Do not claim sensitive pilot readiness');
  });

  it('keeps case access revocation proof bounded to app auth and notification containment', () => {
    const gate3b = readPackFile('14-gate-3b-case-access-revocation-proof.md');
    const ledger = readPackFile('21-current-readiness-ledger.md');

    expect(gate3b).toContain(
      'LIUNA_GATE_3B_CASE_ACCESS_REVOCATION = CLOSED_FOR_APP_AUTH_BOUNDARY_WITH_NOTIFICATION_CONTAINMENT',
    );
    expect(gate3b).toContain('does not prove identity-provider token revocation latency');
    expect(gate3b).toContain('OPEN_OPERATING_LIMITATION');
    expect(ledger).toContain(
      '`CLOSED_FOR_APP_AUTH_BOUNDARY_WITH_NOTIFICATION_CONTAINMENT`',
    );
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

  it('pins the closed foundational gates by classification token', () => {
    const gate2 = readPackFile('12-gate-2-continuity-authorization-proof.md');
    const gate3a = readPackFile('13-gate-3a-confidential-document-boundary-proof.md');
    const gate4 = readPackFile('15-gate-4-leadership-transition-fixture.md');
    const gate5 = readPackFile('16-gate-5-federated-visibility-proof.md');
    const gate7 = readPackFile('18-gate-7-evidence-export-boundary-proof.md');
    const gate8 = readPackFile('19-gate-8-legal-hold-retention-proof.md');

    expect(gate2).toContain('LIUNA_GATE_2A_CONTINUITY_INHERITANCE_AUTH = CLOSED');
    expect(gate3a).toContain('LIUNA_GATE_3A_CONFIDENTIAL_DOCUMENT_BOUNDARY = CLOSED');
    expect(gate4).toContain('LIUNA_GATE_4_LEADERSHIP_TRANSITION_FIXTURE = CLOSED_FOR_RUNTIME_PROOF');
    expect(gate5).toContain('LIUNA_GATE_5_FEDERATED_VISIBILITY_MODEL = CLOSED_FOR_GOVERNANCE_MODEL');
    expect(gate7).toContain('LIUNA_GATE_7_EVIDENCE_EXPORT = STAFF_SCOPED_SAFE_SNAPSHOT_PROVEN');
    expect(gate8).toContain('LIUNA_GATE_8_DOCUMENT_MUTATION_GUARD = PROVEN');
  });

  it('keeps Gate 13 scoped as a bounded operating control, not yet proven', () => {
    const gate13 = readPackFile('27-gate-13-background-job-provider-artifact-cancellation-proof.md');
    const ledger = readPackFile('21-current-readiness-ledger.md');

    expect(gate13).toContain(
      'LIUNA_GATE_13_BACKGROUND_JOB_AND_PROVIDER_ARTIFACT_CANCELLATION = SCOPED_NOT_YET_PROVEN',
    );
    expect(gate13).toContain('bounded operating control');
    expect(gate13).toContain('will not claim provider-side deletion');
    expect(gate13).toContain('Local cancellation and terminal state');
    expect(gate13).toContain('Prevention of further dispatch');
    expect(gate13).toContain('Idempotency');
    expect(gate13).toContain('Reconciliation');
    expect(gate13).toContain('Observable provider-side residual state');
    expect(gate13).toContain('Operator escalation and manual cancellation procedure');
    expect(gate13).toContain('Evidence capture');
    expect(gate13).toContain('`NONE_YET`');
    expect(ledger).toContain(
      '`LIUNA_GATE_13_BACKGROUND_JOB_AND_PROVIDER_ARTIFACT_CANCELLATION`',
    );
  });

  it('pins the OCI workshop pack scope, evidence classes, and facilitator anti-patterns', () => {
    const workshop = readPackFile('28-oci-workshop-pack.md');

    expect(workshop).toContain('`WORKSHOP_PACK_V1_READY_FOR_INTERNAL_REVIEW`');
    expect(workshop).toContain('`NOT_CLIENT_VALIDATED`');
    expect(workshop).toContain('`DATE_TBD`');
    expect(workshop).toContain('6 to 10');
    expect(workshop).toContain('remote-first');
    for (const cls of [
      '`OBSERVED_FACT`',
      '`PARTICIPANT_ASSERTION`',
      '`PROPOSED_FUTURE_STATE`',
      '`UNRESOLVED_ASSUMPTION`',
    ]) {
      expect(workshop).toContain(cls);
    }
    expect(workshop).toContain('Candidate Gate Promotion Matrix Template');
    expect(workshop).toContain('`SURFACED_AS_UNIVERSAL_PLATFORM_CONTROL_ONLY`');
    expect(workshop).toContain('Do not pitch Union Eyes');
    expect(workshop).toContain('Do not promise timelines');
  });

  it('keeps the recording package frozen as V1 handoff baseline, not final take', () => {
    const rec = readPackFile('29-recording-package-v1-handoff-baseline.md');

    expect(rec).toContain('`LIUNA_RECORDING_PACKAGE = V1_HANDOFF_BASELINE`');
    expect(rec).toContain('`NOT_CLIENT_VALIDATED`');
    expect(rec).toContain('`NOT_FINAL_TAKE`');
    expect(rec).toContain('`INTERNAL_REHEARSAL_ONLY`');
    expect(rec).toContain('Not LIUNA production data');
    expect(rec).toContain('Does not imply LIUNA endorsement');
  });

  it('keeps the synthetic fixtures manifest deterministic and obviously synthetic', () => {
    const manifest = readPackFile('30-synthetic-fixtures-manifest.md');
    const fixtures = readPackFile('31-synthetic-fixtures-v1.json');
    const parsed = JSON.parse(fixtures) as {
      status: string;
      notClientValidated: boolean;
      noRealMemberData: boolean;
      seed: string;
      dateCorridor: { start: string; end: string };
      organizations: unknown[];
      matters: unknown[];
      documents: unknown[];
    };

    expect(manifest).toContain('`LIUNA_SYNTHETIC_FIXTURES = V1_DETERMINISTIC`');
    expect(manifest).toContain('`NO_REAL_MEMBER_DATA`');
    expect(manifest).toContain('LIUNA_UE_FIXTURE_SEED_V1');
    expect(manifest).toContain('@example.invalid');
    expect(manifest).toContain('2099-01-01');

    expect(parsed.status).toBe('V1_DETERMINISTIC');
    expect(parsed.notClientValidated).toBe(true);
    expect(parsed.noRealMemberData).toBe(true);
    expect(parsed.seed).toBe('LIUNA_UE_FIXTURE_SEED_V1');
    expect(parsed.dateCorridor.start.startsWith('2099-')).toBe(true);
    expect(parsed.dateCorridor.end.startsWith('2099-')).toBe(true);
    expect(parsed.organizations.length).toBeGreaterThanOrEqual(2);
    expect(parsed.matters.length).toBeGreaterThanOrEqual(3);
    expect(parsed.documents.length).toBeGreaterThanOrEqual(9);
    expect(fixtures).toContain('SYNTHETIC_DOCUMENT_FOR_DEMO_USE');
    expect(fixtures).not.toMatch(/@(?!example\.invalid)[a-z0-9.-]+\.[a-z]{2,}/i);
  });

  it('keeps the provisional vocabulary sheet flagged as unvalidated and status-tagged', () => {
    const vocab = readPackFile('32-opdc-cecof-provisional-vocabulary.md');

    expect(vocab).toContain(
      '`LIUNA_VOCABULARY_SHEET = SYNTHETIC_WORKING_DRAFT_PENDING_CLIENT_VALIDATION`',
    );
    expect(vocab).toContain('`NOT_ENDORSED_BY_LIUNA_OPDC_CECOF`');
    for (const status of [
      '`SYNTHETIC_WORKING_TERM`',
      '`REPO_DERIVED`',
      '`CLIENT_VALIDATED`',
      '`REJECTED`',
    ]) {
      expect(vocab).toContain(status);
    }
    expect(vocab).toContain('Terms Explicitly NOT Adopted Provisionally');
    expect(vocab).toContain('LIUNA-approved');
    expect(vocab).toContain('production-ready for LIUNA');
  });
});
