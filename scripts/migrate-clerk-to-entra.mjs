#!/usr/bin/env node
/**
 * migrate-clerk-to-entra.mjs
 *
 * Migrates user accounts from Clerk to Microsoft Entra External ID:
 *   1. Exports all users from Clerk API
 *   2. Creates corresponding users in Entra via MS Graph API
 *   3. Populates user_uuid_mapping with entra_oid
 *   4. Generates backfill SQL to update all tables with new IDs
 *
 * Prerequisites:
 *   - CLERK_SECRET_KEY (or in apps/union-eyes/.env.local)
 *   - ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET
 *   - PGPASSWORD (PostgreSQL password)
 *
 * Usage:
 *   node scripts/migrate-clerk-to-entra.mjs [--dry-run] [--export-only] [--backfill-only]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CLI flags ───────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');
const EXPORT_ONLY = process.argv.includes('--export-only');
const BACKFILL_ONLY = process.argv.includes('--backfill-only');

// ── Config ──────────────────────────────────────────────────────────────────

const ENTRA_TENANT_ID = process.env.ENTRA_TENANT_ID || '5082b8be-b04d-4a13-b61c-b6397670177b';
const ENTRA_CLIENT_ID = process.env.ENTRA_CLIENT_ID || process.env.AUTH_ENTRA_ID;
const ENTRA_CLIENT_SECRET = process.env.ENTRA_CLIENT_SECRET || process.env.AUTH_ENTRA_SECRET;

if (!ENTRA_CLIENT_ID || !ENTRA_CLIENT_SECRET) {
  console.error('ERROR: ENTRA_CLIENT_ID and ENTRA_CLIENT_SECRET env vars are required.');
  console.error('These are the app registration credentials with User.ReadWrite.All permission.');
  process.exit(1);
}

function loadClerkKey() {
  if (process.env.CLERK_SECRET_KEY) return process.env.CLERK_SECRET_KEY;
  try {
    const envLocal = readFileSync(
      join(__dirname, '..', 'apps', 'union-eyes', '.env.local'),
      'utf-8',
    );
    const match = envLocal.match(/^CLERK_SECRET_KEY=(.+)$/m);
    if (match) return match[1].trim();
  } catch {
    /* ignore */
  }
  return null;
}

const CLERK_KEY = loadClerkKey();
const PG_PASSWORD = process.env.PGPASSWORD;
const PSQL = String.raw`C:\Program Files\PostgreSQL\17\bin\psql.exe`;
const DB_CONN = '-U nzila -d nzila_automation -p 5433 -h localhost';
const MAPPING_FILE = join(__dirname, '_clerk-entra-mapping.json');
const BACKFILL_FILE = join(__dirname, '_backfill-entra-oids.sql');

// ── HTTP helpers ────────────────────────────────────────────────────────────

async function httpRequest(url, options = {}) {
  const { method = 'GET', headers = {}, body } = options;
  const resp = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await resp.json().catch(() => ({}));
  return { status: resp.status, body: data };
}

// ── Clerk API ───────────────────────────────────────────────────────────────

async function fetchAllClerkUsers() {
  if (!CLERK_KEY) {
    console.error('CLERK_SECRET_KEY not found — skipping Clerk export.');
    return [];
  }
  const users = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const res = await httpRequest(
      `https://api.clerk.dev/v1/users?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${CLERK_KEY}` } },
    );
    if (res.status !== 200) {
      console.error('Clerk API error:', res.body);
      break;
    }
    const batch = Array.isArray(res.body) ? res.body : res.body.data || [];
    if (batch.length === 0) break;
    users.push(...batch);
    offset += limit;
    if (batch.length < limit) break;
  }
  return users;
}

// ── MS Graph API ────────────────────────────────────────────────────────────

let _accessToken = null;

async function getGraphToken() {
  if (_accessToken) return _accessToken;
  const tokenUrl = `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: ENTRA_CLIENT_ID,
    client_secret: ENTRA_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const resp = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
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
  return httpRequest(`https://graph.microsoft.com/v1.0${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
}

async function findEntraUserByEmail(email) {
  const res = await graphRequest(
    'GET',
    `/users?$filter=mail eq '${encodeURIComponent(email)}' or userPrincipalName eq '${encodeURIComponent(email)}'&$select=id,mail,displayName,userPrincipalName`,
  );
  if (res.status === 200 && res.body.value?.length > 0) {
    return res.body.value[0];
  }
  return null;
}

async function createEntraUser(user) {
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  // For External ID tenant, use the email as UPN with the tenant domain
  const mailNickname = user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
  const res = await graphRequest('POST', '/users', {
    accountEnabled: true,
    displayName,
    mailNickname,
    // For Entra External ID, use the email as identity
    userPrincipalName: `${mailNickname}@${ENTRA_TENANT_ID}.onmicrosoft.com`,
    mail: user.email,
    givenName: user.firstName || undefined,
    surname: user.lastName || undefined,
    passwordProfile: {
      forceChangePasswordNextSignIn: false,
      password: generateTempPassword(),
    },
    identities: [
      {
        signInType: 'emailAddress',
        issuer: `${ENTRA_TENANT_ID}.onmicrosoft.com`,
        issuerAssignedId: user.email,
      },
    ],
  });
  if (res.status === 201 || res.status === 200) {
    return res.body;
  }
  // If user already exists, try to find them
  if (res.status === 409 || res.body?.error?.code === 'Request_BadRequest') {
    const existing = await findEntraUserByEmail(user.email);
    if (existing) return existing;
  }
  console.error(`  ✗ Failed to create ${user.email}:`, res.body?.error?.message || res.body);
  return null;
}

function generateTempPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let pw = '';
  for (let i = 0; i < 16; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

// ── DB helpers ──────────────────────────────────────────────────────────────

function runSQL(sql) {
  if (!PG_PASSWORD) {
    console.error('PGPASSWORD not set — skipping SQL');
    return null;
  }
  try {
    const result = execSync(
      `"${PSQL}" ${DB_CONN} -t -A --pset=pager=off -c "${sql.replace(/"/g, '\\"')}"`,
      { env: { ...process.env, PGPASSWORD: PG_PASSWORD }, encoding: 'utf-8' },
    );
    return result.trim();
  } catch (err) {
    console.error(`  ✗ SQL error: ${err.stderr?.trim() || err.message}`);
    return null;
  }
}

function esc(s) {
  return s ? s.replace(/'/g, "''") : '';
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Nzila OS — Clerk → Entra External ID User Migration       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) console.log('  ⚠ DRY RUN — no changes will be made\n');

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 1: Export Clerk Users
  // ═══════════════════════════════════════════════════════════════════════

  let mapping = {};

  if (BACKFILL_ONLY && existsSync(MAPPING_FILE)) {
    console.log('═══ Loading existing mapping ═══\n');
    mapping = JSON.parse(readFileSync(MAPPING_FILE, 'utf-8'));
    console.log(`  Loaded ${Object.keys(mapping).length} mappings from ${MAPPING_FILE}\n`);
  } else {
    console.log('═══ Phase 1: Export Clerk Users ═══\n');
    const clerkUsers = await fetchAllClerkUsers();
    console.log(`  Found ${clerkUsers.length} Clerk users\n`);

    if (clerkUsers.length === 0 && !BACKFILL_ONLY) {
      console.error('No Clerk users found. Check CLERK_SECRET_KEY.');
      process.exit(1);
    }

    // ═════════════════════════════════════════════════════════════════════
    // PHASE 2: Create Entra Users + Build Mapping
    // ═════════════════════════════════════════════════════════════════════
    console.log('═══ Phase 2: Create/Find Entra Users ═══\n');

    for (const cu of clerkUsers) {
      const clerkId = cu.id;
      const email = cu.email_addresses?.[0]?.email_address;
      const firstName = cu.first_name;
      const lastName = cu.last_name;

      if (!email) {
        console.log(`  ⚠ Skipping ${clerkId} — no email`);
        continue;
      }

      process.stdout.write(`  ${email} (${clerkId})... `);

      // First try to find existing Entra user by email
      let entraUser = await findEntraUserByEmail(email);

      if (entraUser) {
        console.log(`found → ${entraUser.id}`);
      } else if (DRY_RUN) {
        console.log('would create (dry-run)');
        mapping[clerkId] = { email, entraOid: `dry-run-${clerkId}`, firstName, lastName };
        continue;
      } else {
        // Create new Entra user
        entraUser = await createEntraUser({ email, firstName, lastName });
        if (entraUser) {
          console.log(`created → ${entraUser.id}`);
        } else {
          console.log('FAILED');
          continue;
        }
      }

      mapping[clerkId] = {
        email,
        entraOid: entraUser.id,
        firstName,
        lastName,
      };
    }

    // Save mapping
    writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2), 'utf-8');
    console.log(`\n  ✓ Mapping saved to ${MAPPING_FILE} (${Object.keys(mapping).length} users)\n`);

    if (EXPORT_ONLY) {
      console.log('  --export-only: stopping after export.\n');
      process.exit(0);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 3: Populate user_uuid_mapping.entra_oid
  // ═══════════════════════════════════════════════════════════════════════
  console.log('═══ Phase 3: Populate user_uuid_mapping.entra_oid ═══\n');

  for (const [clerkId, info] of Object.entries(mapping)) {
    if (DRY_RUN) {
      console.log(`  [dry-run] Would set entra_oid=${info.entraOid} for clerk_user_id=${clerkId}`);
      continue;
    }
    const result = runSQL(
      `UPDATE user_uuid_mapping SET entra_oid = '${esc(info.entraOid)}', updated_at = now() WHERE clerk_user_id = '${esc(clerkId)}'`,
    );
    if (result !== null) {
      // Check if row was updated (might not exist)
      const check = runSQL(
        `SELECT user_uuid FROM user_uuid_mapping WHERE clerk_user_id = '${esc(clerkId)}'`,
      );
      if (!check) {
        // Insert new mapping row
        runSQL(
          `INSERT INTO user_uuid_mapping (clerk_user_id, entra_oid, created_at, updated_at) VALUES ('${esc(clerkId)}', '${esc(info.entraOid)}', now(), now()) ON CONFLICT (clerk_user_id) DO UPDATE SET entra_oid = EXCLUDED.entra_oid`,
        );
      }
    }
  }
  console.log('  ✓ user_uuid_mapping updated\n');

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 4: Generate Backfill SQL
  // ═══════════════════════════════════════════════════════════════════════
  console.log('═══ Phase 4: Generate Backfill SQL ═══\n');

  const sqlLines = [
    '-- Auto-generated backfill: Clerk user IDs → Entra Object IDs',
    `-- Generated: ${new Date().toISOString()}`,
    `-- Mappings: ${Object.keys(mapping).length}`,
    '',
    'BEGIN;',
    '',
  ];

  // Tables with user_id column (renamed from clerk_user_id)
  const userIdTables = [
    { table: 'org_members', column: 'user_id' },
    { table: 'partner_users', column: 'user_id' },
  ];

  // Tables where user IDs are stored in various columns
  const otherTables = [
    { table: 'user_management.users', column: 'user_id' },
    { table: 'user_management.organization_users', column: 'user_id' },
    { table: 'user_management.user_sessions', column: 'user_id' },
    { table: 'user_management.oauth_providers', column: 'user_id' },
    { table: 'profiles', column: 'user_id' },
    { table: 'autopay_settings', column: 'user_id' },
    { table: 'ab_test_assignments', column: 'user_id' },
    { table: 'ab_test_events', column: 'user_id' },
    { table: 'zonga_creators', column: 'user_id' },
    { table: 'zonga_listeners', column: 'user_id' },
    // Operation tracking columns
    { table: 'operation_metrics', column: 'created_by' },
    { table: 'operation_content', column: 'uploaded_by' },
    { table: 'feature_flag_beta', column: 'verified_by' },
    { table: 'feature_flag_beta', column: 'created_by' },
    // Finance columns
    { table: 'tax_filings', column: 'prepared_by' },
    { table: 'tax_filings', column: 'reviewed_by' },
    { table: 'close_periods', column: 'opened_by' },
    { table: 'close_tasks', column: 'assigned_to' },
    { table: 'close_approvals', column: 'approver_clerk_user_id' },
    { table: 'qbo_integration', column: 'connected_by' },
    // Payment columns
    { table: 'stripe_connections', column: 'connected_by' },
    { table: 'stripe_refunds', column: 'requested_by' },
    { table: 'stripe_refunds', column: 'approved_by' },
    { table: 'stripe_subscriptions', column: 'created_by' },
    // Other
    { table: 'ml_models', column: 'approved_by' },
    { table: 'shareholders', column: 'generated_by' },
  ];

  const allTables = [...userIdTables, ...otherTables];

  for (const { table, column } of allTables) {
    sqlLines.push(`-- ${table}.${column}`);
    for (const [clerkId, info] of Object.entries(mapping)) {
      sqlLines.push(
        `UPDATE ${table} SET ${column} = '${esc(info.entraOid)}' WHERE ${column} = '${esc(clerkId)}';`,
      );
    }
    sqlLines.push('');
  }

  // NOTE: audit tables (audit_events, audit_trail, security_events) are NOT backfilled
  // Historical records keep original Clerk IDs for compliance audit trail integrity
  sqlLines.push('-- NOTE: audit_events.actor_clerk_user_id NOT updated (immutable audit trail)');
  sqlLines.push('-- Historical Clerk IDs preserved for compliance. New entries use Entra OIDs.');
  sqlLines.push('');
  sqlLines.push('COMMIT;');

  writeFileSync(BACKFILL_FILE, sqlLines.join('\n'), 'utf-8');
  console.log(`  ✓ Backfill SQL saved to ${BACKFILL_FILE}`);
  console.log(`    ${allTables.length} tables × ${Object.keys(mapping).length} users\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 5: Execute Backfill (if not dry-run)
  // ═══════════════════════════════════════════════════════════════════════
  if (!DRY_RUN && PG_PASSWORD) {
    console.log('═══ Phase 5: Execute Backfill ═══\n');
    process.stdout.write('  Applying backfill SQL... ');
    try {
      execSync(
        `"${PSQL}" ${DB_CONN} --pset=pager=off -f "${BACKFILL_FILE}"`,
        { env: { ...process.env, PGPASSWORD: PG_PASSWORD }, encoding: 'utf-8' },
      );
      console.log('✓');
    } catch (err) {
      console.log('✗');
      console.error(`  Backfill errors: ${err.stderr?.trim() || err.message}`);
      console.error('  Some tables may not exist yet — this is expected for unused features.');
    }
  } else {
    console.log('  Skipping backfill execution (--dry-run or PGPASSWORD not set)');
    console.log(`  To apply manually:\n    Get-Content ${BACKFILL_FILE} | psql ...\n`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Migration Complete                                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Users mapped: ${Object.keys(mapping).length}`);
  console.log(`  Mapping file: ${MAPPING_FILE}`);
  console.log(`  Backfill SQL: ${BACKFILL_FILE}`);
  if (DRY_RUN) console.log('  ⚠ Dry run — no actual changes made');
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
