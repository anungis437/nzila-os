import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { eq, inArray, sql } from 'drizzle-orm';

import { db } from '@nzila/db/client';
import { authUserSessions, authUsers } from '@nzila/db/schema';
import { createSession } from '@nzila/platform-auth/password';

import { listIncidentUsers } from '@/modules/incidents/service';
import {
  createMatter,
  updateAiSummaryStatus,
} from '@/modules/incidents/matter-service';

type FixtureMode = 'seed' | 'cleanup';

interface FixtureManifest {
  createdAt: string;
  orgId: string;
  reviewerUserId: string;
  reviewerSessionId: string;
  reviewerSessionTokenHash: string;
  sameTenantDeniedUserId: string;
  sameTenantDeniedSessionId: string;
  sameTenantDeniedSessionTokenHash: string;
  crossTenantUserId: string;
  crossTenantSessionId: string;
  crossTenantSessionTokenHash: string;
  sameTenantDeniedMatterId: string;
  externalizableMatterId: string;
  crossTenantMatterId: string;
}

const REPO_ROOT = path.resolve(process.cwd(), '..', '..');
const PROOF_DIR = path.join(REPO_ROOT, 'artifacts', 'courtlens-gap3-fixture');
const MANIFEST_PATH = path.join(PROOF_DIR, 'fixture-manifest.json');

const TARGET_ORG = 'metro-university';
const CROSS_TENANT_ORG = 'northcare-hospital';

const REVIEWER_USER_ID = 'ue-qa-steward-primary';
const REVIEWER_EMAIL = 'ue.qa.steward.primary@nzila.test';
const REVIEWER_ROLE = 'investigator';

const SAME_TENANT_DENIED_USER_ID = 'ue-qa-member-primary';
const SAME_TENANT_DENIED_EMAIL = 'ue.qa.member.primary@nzila.test';
const SAME_TENANT_DENIED_ROLE = 'learner';

const CROSS_TENANT_USER_ID = 'ue-qa-member-secondary';
const CROSS_TENANT_EMAIL = 'ue.qa.member.secondary@nzila.test';
const CROSS_TENANT_ROLE = 'investigator';

function assertLocalOnly(): void {
  const nodeEnv = (process.env.NODE_ENV ?? '').toLowerCase();
  if (nodeEnv === 'production') {
    throw new Error('Refusing to run CourtLens gap3 fixture in production');
  }

  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const lowerUrl = databaseUrl.toLowerCase();
  const forbiddenHints = ['azure.com', 'amazonaws.com', 'rds.amazonaws.com', 'postgres.cloud', 'production'];
  if (forbiddenHints.some((hint) => lowerUrl.includes(hint))) {
    throw new Error('Refusing to run against a production-like database URL');
  }
}

async function ensureLocalAuthUser(userId: string, email: string): Promise<void> {
  const existing = await db
    .select({ userId: authUsers.userId })
    .from(authUsers)
    .where(eq(authUsers.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    throw new Error(`Required local auth user missing: ${email} (${userId})`);
  }
}

async function upsertAbrMembership(userId: string, orgId: string, role: string, email: string, name: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO abr_users (id, org_id, role, email, name, active)
    VALUES (${userId}, ${orgId}, ${role}, ${email}, ${name}, true)
    ON CONFLICT (id) DO UPDATE SET
      org_id = EXCLUDED.org_id,
      role = EXCLUDED.role,
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      active = EXCLUDED.active
  `);
}

async function createAuthSession(userId: string, tokenLabel: string): Promise<{ token: string; sessionId: string; tokenHash: string }> {
  const { token, session } = await createSession({
    userId,
    organizationId: null,
    ipAddress: '127.0.0.1',
    userAgent: 'playwright-e2e-auth',
  });

  const tokenHash = createHash('sha256').update(token).digest('hex');
  console.log(`${tokenLabel}_SESSION_ID=${session.sessionId}`);
  console.log(`${tokenLabel}_TOKEN_SHA256=${tokenHash}`);

  return { token, sessionId: session.sessionId, tokenHash };
}

async function seed(): Promise<FixtureManifest> {
  assertLocalOnly();

  await fs.mkdir(PROOF_DIR, { recursive: true });

  process.env.PLAYWRIGHT_TEST_AUTH ??= 'true';
  process.env.ABR_DEMO_ORG_ID ??= TARGET_ORG;

  await listIncidentUsers(TARGET_ORG);
  await listIncidentUsers(CROSS_TENANT_ORG);

  await ensureLocalAuthUser(REVIEWER_USER_ID, REVIEWER_EMAIL);
  await ensureLocalAuthUser(SAME_TENANT_DENIED_USER_ID, SAME_TENANT_DENIED_EMAIL);
  await ensureLocalAuthUser(CROSS_TENANT_USER_ID, CROSS_TENANT_EMAIL);

  await upsertAbrMembership(REVIEWER_USER_ID, TARGET_ORG, REVIEWER_ROLE, REVIEWER_EMAIL, 'UE Steward Primary');
  await upsertAbrMembership(SAME_TENANT_DENIED_USER_ID, TARGET_ORG, SAME_TENANT_DENIED_ROLE, SAME_TENANT_DENIED_EMAIL, 'UE Member Primary');
  await upsertAbrMembership(CROSS_TENANT_USER_ID, CROSS_TENANT_ORG, CROSS_TENANT_ROLE, CROSS_TENANT_EMAIL, 'UE Member Secondary');

  const reviewerSession = await createAuthSession(REVIEWER_USER_ID, 'REVIEWER_SESSION');
  const sameTenantDeniedSession = await createAuthSession(SAME_TENANT_DENIED_USER_ID, 'SAME_TENANT_DENIED_SESSION');
  const crossTenantSession = await createAuthSession(CROSS_TENANT_USER_ID, 'CROSS_TENANT_SESSION');

  const sameTenantDeniedMatter = await createMatter(TARGET_ORG, REVIEWER_USER_ID, {
    title: 'Gap 3 non-externalizable matter',
    category: 'service_delivery',
    severity: 'high',
    intakeChannel: 'tenant_staff',
    summary: 'Synthetic internal matter reserved for denial-path export proof.',
    practiceArea: 'housing',
    subIssue: 'eviction',
  });

  const externalizableMatter = await createMatter(TARGET_ORG, REVIEWER_USER_ID, {
    title: 'Gap 3 externalizable matter',
    category: 'service_delivery',
    severity: 'high',
    intakeChannel: 'tenant_staff',
    summary: 'Synthetic approved matter used for export proof.',
    practiceArea: 'housing',
    subIssue: 'eviction',
  });
  await updateAiSummaryStatus(TARGET_ORG, externalizableMatter.id, REVIEWER_USER_ID, 'ai_draft', 'needs_verification', 'human');
  await updateAiSummaryStatus(TARGET_ORG, externalizableMatter.id, REVIEWER_USER_ID, 'needs_verification', 'approved', 'human');

  const crossTenantMatter = await createMatter(CROSS_TENANT_ORG, CROSS_TENANT_USER_ID, {
    title: 'Gap 3 cross-tenant matter',
    category: 'service_delivery',
    severity: 'medium',
    intakeChannel: 'tenant_staff',
    summary: 'Synthetic cross-tenant matter used for denial proof.',
    practiceArea: 'employment',
    subIssue: 'termination',
  });

  const manifest: FixtureManifest = {
    createdAt: new Date().toISOString(),
    orgId: TARGET_ORG,
    reviewerUserId: REVIEWER_USER_ID,
    reviewerSessionId: reviewerSession.sessionId,
    reviewerSessionTokenHash: reviewerSession.tokenHash,
    sameTenantDeniedUserId: SAME_TENANT_DENIED_USER_ID,
    sameTenantDeniedSessionId: sameTenantDeniedSession.sessionId,
    sameTenantDeniedSessionTokenHash: sameTenantDeniedSession.tokenHash,
    crossTenantUserId: CROSS_TENANT_USER_ID,
    crossTenantSessionId: crossTenantSession.sessionId,
    crossTenantSessionTokenHash: crossTenantSession.tokenHash,
    sameTenantDeniedMatterId: sameTenantDeniedMatter.id,
    externalizableMatterId: externalizableMatter.id,
    crossTenantMatterId: crossTenantMatter.id,
  };

  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

async function cleanup(): Promise<void> {
  assertLocalOnly();

  const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(raw) as FixtureManifest;
  const matterIds = [manifest.sameTenantDeniedMatterId, manifest.externalizableMatterId, manifest.crossTenantMatterId];
  const matterPredicate = sql.join(matterIds.map((matterId) => sql`incident_id = ${matterId}`), sql` OR `);
  const abrUserPredicate = sql.join(
    [manifest.reviewerUserId, manifest.sameTenantDeniedUserId, manifest.crossTenantUserId].map(
      (userId) => sql`id = ${userId}`,
    ),
    sql` OR `,
  );

  await db.execute(sql`
    DELETE FROM abr_notes WHERE ${matterPredicate}
  `);
  await db.execute(sql`
    DELETE FROM abr_remediation_actions WHERE ${matterPredicate}
  `);
  await db.execute(sql`
    DELETE FROM abr_incident_events WHERE ${matterPredicate}
  `);
  await db.execute(sql`
    DELETE FROM abr_incidents WHERE ${sql.join(matterIds.map((matterId) => sql`id = ${matterId}`), sql` OR `)}
  `);
  await db.delete(authUserSessions).where(inArray(authUserSessions.sessionId, [
    manifest.reviewerSessionId,
    manifest.sameTenantDeniedSessionId,
    manifest.crossTenantSessionId,
  ]));
  await db.execute(sql`
    DELETE FROM abr_users WHERE ${abrUserPredicate}
  `);

  await fs.writeFile(
    path.join(PROOF_DIR, 'cleanup-report.json'),
    `${JSON.stringify({
      cleanedAt: new Date().toISOString(),
      matterIds,
      reviewerSessionAlias: 'reviewer-seed-session',
      sameTenantDeniedSessionAlias: 'same-tenant-denied-seed-session',
      crossTenantSessionAlias: 'cross-tenant-seed-session',
      reviewerSessionTokenHash: manifest.reviewerSessionTokenHash,
      sameTenantDeniedSessionTokenHash: manifest.sameTenantDeniedSessionTokenHash,
      crossTenantSessionTokenHash: manifest.crossTenantSessionTokenHash,
      sessionRevocationResult: 'deleted from user_management.user_sessions',
      sessionIdentifiersRedacted: true,
    }, null, 2)}\n`,
    'utf8',
  );

  await fs.rm(MANIFEST_PATH, { force: true });
}

async function main() {
  const mode = (process.argv.includes('--cleanup') ? 'cleanup' : 'seed') as FixtureMode;

  if (mode === 'cleanup') {
    await cleanup();
    console.log(`cleaned up fixture state from ${MANIFEST_PATH}`);
    return;
  }

  const manifest = await seed();
  console.log(JSON.stringify({
    manifestPath: MANIFEST_PATH,
    reviewerSessionId: manifest.reviewerSessionId,
    sameTenantDeniedSessionId: manifest.sameTenantDeniedSessionId,
    crossTenantSessionId: manifest.crossTenantSessionId,
    sameTenantDeniedMatterId: manifest.sameTenantDeniedMatterId,
    externalizableMatterId: manifest.externalizableMatterId,
    crossTenantMatterId: manifest.crossTenantMatterId,
  }, null, 2));
}

main().catch((error) => {
  console.error('[courtlens-gap3-fixture] failed:', error);
  process.exit(1);
});