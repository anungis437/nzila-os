#!/usr/bin/env node
/**
 * zonga-clerk-provision.mjs
 *
 * Creates all Clerk test data needed for Zonga stakeholder testing:
 *   - 1 demo label org ("Afrobeats Records")
 *   - 4 test users (admin, manager, creator, viewer) in the label org
 *   - 2 platform-side users (manager, viewer) in the Nzila platform org
 *
 * Also outputs the SQL to seed the DB org_members table.
 *
 * Usage:
 *   node scripts/zonga-clerk-provision.mjs
 *
 * Requires CLERK_SECRET_KEY env or uses the hardcoded dev key below.
 */
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────────────

const CLERK_KEY = process.env.CLERK_SECRET_KEY;
if (!CLERK_KEY) {
  console.error('ERROR: CLERK_SECRET_KEY env var is required. Set it before running this script.');
  process.exit(1);
}

// Existing Nzila platform org
const NZILA_CLERK_ORG_ID = 'org_3BEaESt8ZIC4XEdJ7hmmB6nu6pp';
const NZILA_DB_ORG_ID = '8b97760c-1122-4fdf-8721-68e20d0ab3f5';

// Demo label org UUID (will be inserted into DB after Clerk creates the org)
const LABEL_DB_ORG_ID = '33333333-3333-3333-3333-333333333333';

// Password for ALL test users (dev-only)
const TEST_PASSWORD = 'ZongaTest2026!';

// Test users to create
const LABEL_USERS = [
  {
    firstName: 'Zonga', lastName: 'LabelAdmin',
    username: 'zonga-label-admin',
    email: 'label-admin@zonga-test.dev',
    phone: '+12025550101',
    clerkRole: 'org:admin',
    dbRole: 'org_admin',
    zongaRole: 'admin',
  },
  {
    firstName: 'Zonga', lastName: 'LabelManager',
    username: 'zonga-label-manager',
    email: 'label-manager@zonga-test.dev',
    phone: '+12025550102',
    clerkRole: 'org:member',
    dbRole: 'org_secretary',
    zongaRole: 'manager',
  },
  {
    firstName: 'Zonga', lastName: 'Creator',
    username: 'zonga-creator',
    email: 'creator@zonga-test.dev',
    phone: '+12025550103',
    clerkRole: 'org:member',
    dbRole: 'org_creator',
    zongaRole: 'creator',
  },
  {
    firstName: 'Zonga', lastName: 'Viewer',
    username: 'zonga-viewer',
    email: 'viewer@zonga-test.dev',
    phone: '+12025550104',
    clerkRole: 'org:member',
    dbRole: 'org_viewer',
    zongaRole: 'viewer',
  },
];

// Additional users for Nzila platform org (non-admin roles)
const PLATFORM_USERS = [
  {
    firstName: 'Zonga', lastName: 'PlatformManager',
    username: 'zonga-platform-manager',
    email: 'platform-manager@zonga-test.dev',
    phone: '+12025550105',
    clerkRole: 'org:member',
    dbRole: 'org_secretary',
    zongaRole: 'manager',
  },
  {
    firstName: 'Zonga', lastName: 'PlatformViewer',
    username: 'zonga-platform-viewer',
    email: 'platform-viewer@zonga-test.dev',
    phone: '+12025550106',
    clerkRole: 'org:member',
    dbRole: 'org_viewer',
    zongaRole: 'viewer',
  },
];

// Listener users (stored in zonga_listeners, NOT org_members)
const LISTENER_USERS = [
  {
    firstName: 'Zonga', lastName: 'ListenerFree',
    username: 'zonga-listener-free',
    email: 'listener-free@zonga-test.dev',
    phone: '+12025550107',
    plan: 'free',
    displayName: 'FreeBeats Fan',
  },
  {
    firstName: 'Zonga', lastName: 'ListenerPremium',
    username: 'zonga-listener-premium',
    email: 'listener-premium@zonga-test.dev',
    phone: '+12025550108',
    plan: 'premium',
    displayName: 'PremiumBeats VIP',
  },
];

// ── Clerk API helpers ───────────────────────────────────────────────────

function clerkApi(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.clerk.com',
      path: urlPath,
      method,
      headers: {
        Authorization: `Bearer ${CLERK_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            // 422 with "already exists" is expected for re-runs
            resolve({ __error: true, status: res.statusCode, ...parsed });
          } else {
            resolve(parsed);
          }
        } catch {
          resolve({ __error: true, status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Zonga Clerk Test Data Provisioning ===\n');

  // ── Step 1: Create/find orgs ───────────────────────────────────────
  console.log('1. Finding/creating organizations...');

  // Check existing orgs
  const existingOrgs = await clerkApi('GET', '/v1/organizations?limit=50');
  const orgList = existingOrgs?.data ?? [];

  // Label org
  let labelClerkOrgId;
  const existingLabel = orgList.find((o) => o.name === 'Afrobeats Records');
  if (existingLabel) {
    labelClerkOrgId = existingLabel.id;
    console.log(`   ✓ Label org already exists: ${labelClerkOrgId}`);
  } else {
    const orgResult = await clerkApi('POST', '/v1/organizations', {
      name: 'Afrobeats Records',
      public_metadata: { domain: 'music-label', tier: 'demo' },
    });
    if (orgResult.__error) {
      console.error('   ✗ Failed to create label org:', JSON.stringify(orgResult));
      process.exit(1);
    }
    labelClerkOrgId = orgResult.id;
    console.log(`   ✓ Created label org: ${labelClerkOrgId}`);
  }

  // Nzila platform org
  let nzilaClerkOrgId;
  const existingNzila = orgList.find((o) => o.name === 'Nzila' || o.name === 'Nzila Ventures');
  if (existingNzila) {
    nzilaClerkOrgId = existingNzila.id;
    console.log(`   ✓ Nzila platform org already exists: ${nzilaClerkOrgId}`);
  } else {
    const orgResult = await clerkApi('POST', '/v1/organizations', {
      name: 'Nzila',
      public_metadata: { domain: 'platform', tier: 'platform' },
    });
    if (orgResult.__error) {
      console.error('   ✗ Failed to create Nzila org:', JSON.stringify(orgResult));
      process.exit(1);
    }
    nzilaClerkOrgId = orgResult.id;
    console.log(`   ✓ Created Nzila platform org: ${nzilaClerkOrgId}`);
    console.log(`     ⚠ UPDATE .env: NZILA_CLERK_ORG_ID=${nzilaClerkOrgId}`);
  }

  await sleep(500);

  // ── Step 2: List existing users to avoid duplicates ───────────────────
  console.log('\n2. Checking existing users...');
  const existingUsers = await clerkApi('GET', '/v1/users?limit=100');
  // Clerk /v1/users returns a plain array, not { data: [...] }
  const userList = Array.isArray(existingUsers) ? existingUsers : (existingUsers?.data ?? []);
  const existingEmails = new Map();
  for (const u of userList) {
    for (const ea of u.email_addresses ?? []) {
      existingEmails.set(ea.email_address, u.id);
    }
  }

  // ── Step 3: Create test users ─────────────────────────────────────────
  const allUsers = [
    ...LABEL_USERS.map((u) => ({ ...u, orgClerkId: labelClerkOrgId, orgDbId: LABEL_DB_ORG_ID })),
    ...PLATFORM_USERS.map((u) => ({ ...u, orgClerkId: nzilaClerkOrgId, orgDbId: NZILA_DB_ORG_ID })),
  ];

  const createdUsers = [];

  console.log(`\n3. Creating ${allUsers.length} test users...`);
  for (const u of allUsers) {
    const tag = `${u.firstName} ${u.lastName} <${u.email}>`;

    if (existingEmails.has(u.email)) {
      const userId = existingEmails.get(u.email);
      console.log(`   ⊘ ${tag} — already exists: ${userId}`);

      // Update publicMetadata anyway
      await clerkApi('PATCH', `/v1/users/${userId}`, {
        public_metadata: { zongaRole: u.zongaRole },
      });
      console.log(`     ↳ Updated publicMetadata.zongaRole = "${u.zongaRole}"`);

      createdUsers.push({ ...u, clerkUserId: userId, existed: true });
      await sleep(300);
      continue;
    }

    const result = await clerkApi('POST', '/v1/users', {
      first_name: u.firstName,
      last_name: u.lastName,
      username: u.username,
      email_address: [u.email],
      phone_number: [u.phone],
      password: TEST_PASSWORD,
      public_metadata: { zongaRole: u.zongaRole },
      skip_password_checks: true,
    });

    if (result.__error) {
      console.error(`   ✗ ${tag} — FAILED:`, JSON.stringify(result));
      // Try to continue
      createdUsers.push({ ...u, clerkUserId: null, error: result });
    } else {
      console.log(`   ✓ ${tag} — ${result.id}`);
      createdUsers.push({ ...u, clerkUserId: result.id });
    }
    await sleep(300);
  }

  // ── Step 4: Add users to their orgs ───────────────────────────────────
  console.log('\n4. Adding users to Clerk organizations...');
  for (const u of createdUsers) {
    if (!u.clerkUserId) continue;

    const result = await clerkApi(
      'POST',
      `/v1/organizations/${u.orgClerkId}/memberships`,
      { user_id: u.clerkUserId, role: u.clerkRole },
    );

    const tag = `${u.firstName} ${u.lastName}`;
    if (result.__error) {
      if (result?.errors?.[0]?.code === 'duplicate_record'
        || result?.errors?.[0]?.code === 'already_a_member_in_organization') {
        console.log(`   ⊘ ${tag} — already member of ${u.orgClerkId}`);
      } else {
        console.error(`   ✗ ${tag} — FAILED:`, JSON.stringify(result));
      }
    } else {
      console.log(`   ✓ ${tag} → ${u.orgClerkId} as ${u.clerkRole}`);
    }
    await sleep(300);
  }

  // ── Step 5: Create listener Clerk users ────────────────────────────────
  console.log('\n5. Creating listener Clerk users...');
  const createdListeners = [];
  for (const u of LISTENER_USERS) {
    const tag = `${u.firstName} ${u.lastName} <${u.email}>`;

    if (existingEmails.has(u.email)) {
      const userId = existingEmails.get(u.email);
      console.log(`   ⊘ ${tag} — already exists: ${userId}`);
      createdListeners.push({ ...u, clerkUserId: userId, existed: true });
      await sleep(300);
      continue;
    }

    const result = await clerkApi('POST', '/v1/users', {
      first_name: u.firstName,
      last_name: u.lastName,
      username: u.username,
      email_address: [u.email],
      phone_number: [u.phone],
      password: TEST_PASSWORD,
      public_metadata: { zongaRole: 'listener', listenerPlan: u.plan },
      skip_password_checks: true,
    });

    if (result.__error) {
      console.error(`   ✗ ${tag} — FAILED:`, JSON.stringify(result));
      createdListeners.push({ ...u, clerkUserId: null, error: result });
    } else {
      console.log(`   ✓ ${tag} — ${result.id}`);
      createdListeners.push({ ...u, clerkUserId: result.id });
    }
    await sleep(300);
  }

  // ── Step 6: Generate SQL for DB ───────────────────────────────────────
  console.log('\n6. Generating DB seed SQL...');

  const sqlLines = [
    '-- Zonga test data: orgs + org_members',
    '-- Generated by scripts/zonga-clerk-provision.mjs',
    `-- Date: ${new Date().toISOString()}`,
    '',
    '-- Ensure label org exists in DB',
    `INSERT INTO orgs (id, legal_name, jurisdiction, clerk_org_id, status, created_at, updated_at)`,
    `VALUES ('${LABEL_DB_ORG_ID}', 'Afrobeats Records', 'NG', '${labelClerkOrgId}', 'active', NOW(), NOW())`,
    `ON CONFLICT (id) DO UPDATE SET clerk_org_id = EXCLUDED.clerk_org_id, updated_at = NOW();`,
    '',
    '-- Ensure Nzila platform org clerk_org_id is up to date',
    `UPDATE orgs SET clerk_org_id = '${nzilaClerkOrgId}', updated_at = NOW() WHERE id = '${NZILA_DB_ORG_ID}';`,
    '',
    '-- Test user org memberships (delete-then-insert since no composite unique constraint)',
  ];

  for (const u of createdUsers) {
    if (!u.clerkUserId) continue;
    sqlLines.push(
      `DELETE FROM org_members WHERE org_id = '${u.orgDbId}' AND clerk_user_id = '${u.clerkUserId}';`,
      `INSERT INTO org_members (org_id, clerk_user_id, role, status, created_at, updated_at)`,
      `VALUES ('${u.orgDbId}', '${u.clerkUserId}', '${u.dbRole}', 'active', NOW(), NOW());`,
    );
  }

  // Listener profiles in zonga_listeners (NOT org_members)
  sqlLines.push('', '-- Listener profiles (zonga_listeners table)');
  for (const u of createdListeners) {
    if (!u.clerkUserId) continue;
    const listenerId = u.plan === 'free'
      ? '44444444-4444-4444-4444-444444444401'
      : '44444444-4444-4444-4444-444444444402';
    const subStatus = u.plan === 'premium' ? "'active'" : 'NULL';
    sqlLines.push(
      `DELETE FROM zonga_listeners WHERE id = '${listenerId}';`,
      `INSERT INTO zonga_listeners (id, org_id, display_name, email, country, plan, subscription_status, preferences_json, created_at, updated_at)`,
      `VALUES ('${listenerId}', '${LABEL_DB_ORG_ID}', '${u.displayName}', '${u.email}', 'NG', '${u.plan}', ${subStatus}, '{}', NOW(), NOW());`,
    );
  }

  const sqlPath = path.join(__dirname, 'zonga-clerk-seed.sql');
  fs.writeFileSync(sqlPath, sqlLines.join('\n') + '\n');
  console.log(`   ✓ Wrote ${sqlPath}`);

  // ── Summary ───────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║              ZONGA TEST ACCOUNTS SUMMARY                    ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║ Password (all): ${TEST_PASSWORD.padEnd(42)}║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║ LABEL ORG: Afrobeats Records                               ║');
  console.log(`║   Clerk ID: ${(labelClerkOrgId ?? 'N/A').padEnd(47)}║`);
  console.log('╠──────────────────────────────────────────────────────────────╣');

  for (const u of createdUsers) {
    const org = u.orgClerkId === nzilaClerkOrgId ? 'PLATFORM' : 'LABEL   ';
    const line = `${org} | ${u.zongaRole.padEnd(8)} | ${u.email}`;
    console.log(`║ ${line.padEnd(59)}║`);
  }

  console.log('╠──────────────────────────────────────────────────────────────╣');
  console.log('║ LISTENERS (zonga_listeners)                                 ║');
  for (const u of createdListeners) {
    const line = `LISTENER | ${u.plan.padEnd(8)} | ${u.email}`;
    console.log(`║ ${line.padEnd(59)}║`);
  }

  console.log('╠──────────────────────────────────────────────────────────────╣');
  console.log('║ NEXT STEPS:                                                 ║');
  console.log('║ 1. Run the generated SQL:                                   ║');
  console.log('║    psql < scripts/zonga-clerk-seed.sql                      ║');
  console.log('║ 2. Log into http://localhost:3011/sign-in                   ║');
  console.log('║ 3. Switch org in Clerk org-switcher to see role diffs       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
