#!/usr/bin/env node
/**
 * provision-entra-test-users.mjs
 *
 * Replaces provision-all-test-users.mjs — uses MS Graph API instead of Clerk.
 * Creates test users in Microsoft Entra External ID and provisions their
 * DB records (org memberships, Zonga profiles, etc.).
 *
 * Usage:
 *   node scripts/provision-entra-test-users.mjs
 *
 * Requires:
 *   - ENTRA_TENANT_ID (defaults to Nzila staging tenant)
 *   - ENTRA_CLIENT_ID + ENTRA_CLIENT_SECRET (app registration with User.ReadWrite.All)
 *   - PGPASSWORD (PostgreSQL password)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────────────────

const ENTRA_TENANT_ID = process.env.ENTRA_TENANT_ID || '5082b8be-b04d-4a13-b61c-b6397670177b';
const ENTRA_CLIENT_ID = process.env.ENTRA_CLIENT_ID || process.env.AUTH_ENTRA_ID;
const ENTRA_CLIENT_SECRET = process.env.ENTRA_CLIENT_SECRET || process.env.AUTH_ENTRA_SECRET;

if (!ENTRA_CLIENT_ID || !ENTRA_CLIENT_SECRET) {
  console.error('ERROR: ENTRA_CLIENT_ID and ENTRA_CLIENT_SECRET env vars are required.');
  process.exit(1);
}

const PG_PASSWORD = process.env.PGPASSWORD;
if (!PG_PASSWORD) throw new Error('PGPASSWORD env var is required');

const TEST_PASSWORD = process.env.PROVISION_USER_PASSWORD || 'NzilaTest2026!';
const PSQL = String.raw`C:\Program Files\PostgreSQL\17\bin\psql.exe`;

// Support staging DB via DATABASE_URL or individual vars
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '5433';
const DB_NAME = process.env.DB_NAME || 'nzila_automation';
const DB_USER = process.env.DB_USER || 'nzila';
const DB_SSLMODE = DB_HOST !== 'localhost' ? 'require' : 'prefer';
const DB_CONN = `-U ${DB_USER} -d ${DB_NAME} -p ${DB_PORT} -h ${DB_HOST}`;

const DB_ORGS = {
  nzila: process.env.ORG_NZILA || '458a56cb-251a-4c91-a0b5-81bb8ac39087',
  clc: process.env.ORG_CLC || '873cf59b-cef5-4d51-9a62-151512810449',
  cape: process.env.ORG_CAPE || '885aa4e0-5dc1-45bf-ad32-86477868e8ea',
  cupe: process.env.ORG_CUPE || '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  zonga: process.env.ORG_ZONGA || '33333333-3333-3333-3333-333333333333',
};

// ── MS Graph API ────────────────────────────────────────────────────────────

let _accessToken = null;

async function getGraphToken() {
  if (_accessToken) return _accessToken;
  const body = new URLSearchParams({
    client_id: ENTRA_CLIENT_ID,
    client_secret: ENTRA_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const resp = await fetch(
    `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body },
  );
  const data = await resp.json();
  if (!data.access_token) {
    console.error('Failed to get Graph API token:', data);
    process.exit(1);
  }
  _accessToken = data.access_token;
  return _accessToken;
}

async function graphRequest(method, path, body) {
  const token = await getGraphToken();
  const resp = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await resp.json().catch(() => ({}));
  return { status: resp.status, body: data };
}

async function createOrFindUser(first, last, email) {
  // Try to find existing user by email
  const search = await graphRequest(
    'GET',
    `/users?$filter=mail eq '${encodeURIComponent(email)}' or userPrincipalName eq '${encodeURIComponent(email)}'&$select=id,mail,displayName`,
  );
  if (search.status === 200 && search.body.value?.length > 0) {
    return search.body.value[0].id;
  }

  // Create new user — use tenant's default domain for UPN/issuer
  const TENANT_DOMAIN = process.env.ENTRA_DOMAIN || 'onelabtech.onmicrosoft.com';
  // Include email domain in mailNickname to avoid UPN collisions across orgs
  const emailPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
  const emailDomain = email.split('@')[1].split('.')[0].replace(/[^a-zA-Z0-9]/g, '');
  const mailNickname = `${emailPrefix}.${emailDomain}`;
  const res = await graphRequest('POST', '/users', {
    accountEnabled: true,
    displayName: `${first} ${last}`,
    mailNickname,
    userPrincipalName: `${mailNickname}@${TENANT_DOMAIN}`,
    mail: email,
    givenName: first,
    surname: last,
    passwordProfile: {
      forceChangePasswordNextSignIn: false,
      password: TEST_PASSWORD,
    },
  });

  if (res.status === 201 || res.status === 200) return res.body.id;

  // Handle conflict
  if (res.status === 409 || res.body?.error?.code === 'Request_BadRequest') {
    const retry = await graphRequest(
      'GET',
      `/users?$filter=mail eq '${encodeURIComponent(email)}'&$select=id`,
    );
    if (retry.body.value?.length > 0) return retry.body.value[0].id;
  }

  console.error(`  ✗ Failed to create ${email}:`, res.body?.error?.message || JSON.stringify(res.body));
  return null;
}

// ── DB helpers ──────────────────────────────────────────────────────────────

function runSQL(sql) {
  // Collapse to single line to avoid shell escaping issues with -c
  const oneLine = sql.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  try {
    return execSync(
      `"${PSQL}" ${DB_CONN} -t -A --pset=pager=off -c "${oneLine.replace(/"/g, '\\"')}"`,
      { env: { ...process.env, PGPASSWORD: PG_PASSWORD, PGSSLMODE: DB_SSLMODE }, encoding: 'utf-8' },
    ).trim();
  } catch (err) {
    console.error(`  ✗ SQL: ${err.stderr?.trim() || err.message}`);
    return null;
  }
}

function esc(s) {
  return s ? s.replace(/'/g, "''") : '';
}

// ── User Definitions ────────────────────────────────────────────────────────

const ALL_USERS = [
  // ── NZILA Ventures Tier 1–2 ──
  { first: 'Michel', last: 'Ouimet', email: 'test.coo@nzilaventures.com', org: 'nzila', role: 'coo' },
  { first: 'David', last: 'Nkemdirim', email: 'test.cto@nzilaventures.com', org: 'nzila', role: 'cto' },
  { first: 'Tania', last: 'Da Silva', email: 'test.platformlead@nzilaventures.com', org: 'nzila', role: 'platform_lead' },
  { first: 'Tim', last: 'Maguire', email: 'test.csdir@nzilaventures.com', org: 'nzila', role: 'customer_success_director' },
  { first: 'Mark', last: 'Hancock', email: 'test.supportmgr@nzilaventures.com', org: 'nzila', role: 'support_manager' },
  { first: 'Patty', last: 'Coates', email: 'test.analyticsmgr@nzilaventures.com', org: 'nzila', role: 'data_analytics_manager' },
  { first: 'Keisha', last: 'Brown', email: 'test.billingmgr@nzilaventures.com', org: 'nzila', role: 'billing_manager' },
  { first: 'Carlos', last: 'Rivera', email: 'test.integmgr@nzilaventures.com', org: 'nzila', role: 'integration_manager' },
  { first: 'Priya', last: 'Sharma', email: 'test.complmgr@nzilaventures.com', org: 'nzila', role: 'compliance_manager' },
  { first: 'Ahmed', last: 'Hassan', email: 'test.secmgr@nzilaventures.com', org: 'nzila', role: 'security_manager' },
  { first: 'Sandra', last: 'Weatherby', email: 'test.sysadmin2@nzilaventures.com', org: 'nzila', role: 'system_admin' },
  { first: 'Rachel', last: 'Torres', email: 'rachel.torres@nzilaventures.com', org: 'nzila', role: 'integration_specialist' },
  { first: 'Yuki', last: 'Tanaka', email: 'yuki.tanaka@nzilaventures.com', org: 'nzila', role: 'content_manager' },
  { first: 'Omar', last: 'El-Amin', email: 'omar.elamin@nzilaventures.com', org: 'nzila', role: 'training_coordinator' },
  { first: 'Aubert', last: 'Nungisa', email: 'a_nungisa@yahoo.ca', org: 'nzila', role: 'app_owner' },

  // ── CLC Tier 3 ──
  { first: 'Hassan', last: 'Yussuff', email: 'test.clcexec@labourcc.ca', org: 'clc', role: 'clc_executive' },
  { first: 'Marie', last: 'Clarke Walker', email: 'test.clcstaff@labourcc.ca', org: 'clc', role: 'clc_staff' },

  // ── CAPE Tier 4–6 ──
  { first: 'Jane', last: 'Doe', email: 'test.president@capeunion.ca', org: 'cape', role: 'president' },
  { first: 'Marc-André', last: 'Dubois', email: 'test.vp@capeunion.ca', org: 'cape', role: 'vice_president' },
  { first: 'Brian', last: 'Faulkner', email: 'test.natofficer@capeunion.ca', org: 'cape', role: 'national_officer' },
  { first: 'Chantal', last: 'Bertrand', email: 'test.sectreasurer@capeunion.ca', org: 'cape', role: 'secretary_treasurer' },
  { first: 'Mike', last: 'Savard', email: 'test.fedexec@capeunion.ca', org: 'cape', role: 'fed_executive' },
  { first: 'Nadia', last: 'Ouellet', email: 'test.fedstaff@capeunion.ca', org: 'cape', role: 'fed_staff' },
  { first: 'Daniel', last: 'Kim', email: 'test.officer@capeunion.ca', org: 'cape', role: 'officer' },
  { first: 'Sarah', last: 'Lefebvre', email: 'test.chiefsteward@capeunion.ca', org: 'cape', role: 'chief_steward' },
  { first: 'Alexandre', last: 'Moreau', email: 'test.steward@capeunion.ca', org: 'cape', role: 'steward' },
  { first: 'Jennifer', last: 'Walsh', email: 'test.bargcom@capeunion.ca', org: 'cape', role: 'bargaining_committee' },
  { first: 'Pierre', last: 'Desmarais', email: 'test.hsr@capeunion.ca', org: 'cape', role: 'health_safety_rep' },

  // ── CUPE L123 Tier 6 ──
  { first: 'Alice', last: 'Johnson', email: 'test.president@cupel123.ca', org: 'cupe', role: 'president' },
  { first: 'Marie-Claire', last: 'Dubois', email: 'test.vp@cupel123.ca', org: 'cupe', role: 'vice_president' },
  { first: 'Jean-Pierre', last: 'Tremblay', email: 'test.sectreasurer@cupel123.ca', org: 'cupe', role: 'secretary_treasurer' },
  { first: 'Marco', last: 'Rossi', email: 'test.chiefsteward@cupel123.ca', org: 'cupe', role: 'chief_steward' },
  { first: 'Priya', last: 'Patel', email: 'test.officer@cupel123.ca', org: 'cupe', role: 'officer' },
  { first: 'David', last: 'Thompson', email: 'test.bargcom@cupel123.ca', org: 'cupe', role: 'bargaining_committee' },
  { first: 'Kevin', last: "O'Brien", email: 'test.hsr@cupel123.ca', org: 'cupe', role: 'health_safety_rep' },

  // ── Zonga (Afrobeats Records) ──
  { first: 'Kofi', last: 'Mensah', email: 'kofi@afrobeatsrecords.com', org: 'zonga', role: 'admin' },
  { first: 'Ama', last: 'Adjei', email: 'ama@afrobeatsrecords.com', org: 'zonga', role: 'manager' },
  { first: 'Kwame', last: 'Asante', email: 'kwame@afrobeatsrecords.com', org: 'zonga', role: 'creator' },
  { first: 'Adwoa', last: 'Boateng', email: 'adwoa@afrobeatsrecords.com', org: 'zonga', role: 'viewer' },
];

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Nzila OS — Entra External ID Test User Provisioning        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const results = [];

  for (const user of ALL_USERS) {
    const displayName = `${user.first} ${user.last}`;
    process.stdout.write(`  ${displayName} <${user.email}> → ${user.org}/${user.role}... `);

    const entraOid = await createOrFindUser(user.first, user.last, user.email);
    if (!entraOid) {
      console.log('SKIP (no OID)');
      continue;
    }
    console.log(`✓ ${entraOid}`);

    results.push({ ...user, entraOid });

    // Map functional role to DB enum (org_member_role: org_admin | org_secretary | org_viewer)
    const adminRoles = ['app_owner', 'coo', 'cto', 'platform_lead', 'system_admin', 'security_manager', 'admin', 'president', 'clc_executive'];
    const secretaryRoles = ['secretary_treasurer', 'sectreasurer', 'fed_executive', 'national_officer', 'manager', 'clc_staff'];
    let dbRole = 'org_viewer';
    if (adminRoles.includes(user.role)) dbRole = 'org_admin';
    else if (secretaryRoles.includes(user.role)) dbRole = 'org_secretary';

    // Upsert into org_members (uses renamed user_id column)
    const orgDbId = DB_ORGS[user.org];
    if (orgDbId) {
      // Check if member already exists (no unique constraint on org_id+user_id)
      const existing = runSQL(
        `SELECT id FROM org_members WHERE org_id='${orgDbId}' AND user_id='${esc(entraOid)}' LIMIT 1`,
      );
      if (!existing) {
        runSQL(
          `INSERT INTO org_members (id, org_id, user_id, role, status, created_at, updated_at)
           VALUES (gen_random_uuid(), '${orgDbId}', '${esc(entraOid)}', '${dbRole}', 'active', now(), now())`,
        );
      }
    }

    // Upsert into user_uuid_mapping (no unique on clerk_user_id — check first)
    const existingMapping = runSQL(
      `SELECT user_uuid FROM user_uuid_mapping WHERE clerk_user_id='${esc(entraOid)}' OR entra_oid='${esc(entraOid)}' LIMIT 1`,
    );
    if (!existingMapping) {
      runSQL(
        `INSERT INTO user_uuid_mapping (clerk_user_id, entra_oid, created_at, updated_at) VALUES ('${esc(entraOid)}', '${esc(entraOid)}', now(), now())`,
      );
    }

    // UE organization_users (stores functional role)
    if (orgDbId) {
      const existingOrgUser = runSQL(
        `SELECT organization_user_id FROM user_management.organization_users WHERE organization_id='${orgDbId}' AND user_id='${esc(entraOid)}' LIMIT 1`,
      );
      if (!existingOrgUser) {
        runSQL(
          `INSERT INTO user_management.organization_users (organization_user_id, organization_id, user_id, role, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), '${orgDbId}', '${esc(entraOid)}', '${esc(user.role)}', true, now(), now())`,
        );
      }
    }

    // organization_members — the table getUserRole() in rbac-server.ts actually reads
    if (orgDbId) {
      const existingOrgMember = runSQL(
        `SELECT id FROM organization_members WHERE organization_id='${orgDbId}' AND user_id='${esc(entraOid)}' LIMIT 1`,
      );
      if (!existingOrgMember) {
        runSQL(
          `INSERT INTO organization_members (id, user_id, organization_id, name, email, role, status, created_at)
           VALUES (gen_random_uuid(), '${esc(entraOid)}', '${orgDbId}', '${esc(displayName)}', '${esc(user.email)}', '${esc(user.role)}', 'active', now())`,
        );
      }
    }
  }

  // Save results
  const outputPath = join(__dirname, '_entra-provisioned-users.json');
  writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Provisioning Complete                                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Users provisioned: ${results.length}`);
  console.log(`  Results saved: ${outputPath}`);
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
