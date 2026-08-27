import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROUTE_PATH = resolve(
  process.cwd(),
  'apps/union-eyes/app/api/ai/copilot/query/route.ts',
);

const SESSION_ROUTE_PATH = resolve(
  process.cwd(),
  'apps/union-eyes/app/api/ai/copilot/sessions/[id]/route.ts',
);

const SERVICE_PATH = resolve(
  process.cwd(),
  'apps/union-eyes/lib/ai/steward-copilot.ts',
);

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('UnionEyes AI copilot boundary contract', () => {
  it('keeps copilot access steward-gated, feature-gated, entitled, and safety-checked', () => {
    const source = read(ROUTE_PATH);

    expect(source).toContain("withRoleAuth('steward'");
    expect(source).toContain('guardAiFeature(AI_FEATURES.STEWARD_COPILOT');
    expect(source).toContain("requireEntitlement(context.organizationId!, 'ai_advanced_insights')");
    expect(source).toContain("enforceAISafety({ origin: 'copilot-query'");
    expect(source).toContain("dataClass: 'internal'");
  });

  it('keeps copilot output advisory and audit referenced', () => {
    const source = read(ROUTE_PATH);

    expect(source).toContain('auditAIInvocation');
    expect(source).toContain('aiGenerated: true');
    expect(source).toContain('reviewRequired: true');
    expect(source).toContain("source: 'ai'");
  });

  it('keeps service prompts organization-scoped and sessions human-pending', () => {
    const source = read(SERVICE_PATH);

    expect(source).toContain('trace: buildOrgAiTrace(organizationId)');
    expect(source).toContain('profileKey: UE_PROFILES.STEWARD_COPILOT');
    expect(source).toContain("dataClass: 'internal'");
    expect(source).toContain('auditAiInteraction');
    expect(source).toContain("outcome: 'pending'");
    expect(source).toContain('humanApproved: outcome ===');
  });

  it('keeps copilot execution synchronous and outcome updates freshly authorized', () => {
    const queryRoute = read(ROUTE_PATH);
    const sessionRoute = read(SESSION_ROUTE_PATH);
    const service = read(SERVICE_PATH);

    expect(queryRoute).toContain('const result = await executeCopilotAction');
    expect(queryRoute).not.toContain('addNotificationJob');
    expect(queryRoute).not.toContain('addReportJob');
    expect(queryRoute).not.toContain('addEmailJob');
    expect(service).not.toContain('addNotificationJob');
    expect(service).not.toContain('addReportJob');

    expect(sessionRoute).toContain("withRoleAuth('steward'");
    expect(sessionRoute).toContain('guardAiFeature(AI_FEATURES.STEWARD_COPILOT');
    expect(sessionRoute).toContain("requireEntitlement(context.organizationId!, 'ai_advanced_insights')");
    expect(sessionRoute).toContain('recordCopilotOutcome');
    expect(service).toContain('eq(aiCopilotSessions.organizationId, organizationId)');
  });
});
