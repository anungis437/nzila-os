#!/usr/bin/env node
/**
 * @deprecated This script uses the Clerk API directly and must be rewritten
 * to use Microsoft Graph API now that auth has migrated to Entra External ID.
 * See: https://learn.microsoft.com/en-us/graph/api/user-post-users
 *
 * provision-all-test-users.mjs
 *
 * Master provisioning script for UE + Zonga test users.
 * Handles: user creation, org membership, DB role updates,
 * DB inserts for new members, Zonga table creation, Zonga seeding,
 * and seed placeholder cleanup.
 *
 * Usage: node scripts/provision-all-test-users.mjs
 *
 * Requires:
 *   - AUTH_SECRET env var (was: CLERK_SECRET_KEY)
 *   - PROVISION_USER_PASSWORD env var (password for new test users)
 *   - PGPASSWORD env var (PostgreSQL password, default: reads from env)
 *   - PostgreSQL on localhost:5433
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────────────────

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
  throw new Error('CLERK_SECRET_KEY not found');
}

const CLERK_KEY = loadClerkKey();
const TEST_USER_PASSWORD = process.env.PROVISION_USER_PASSWORD;
if (!TEST_USER_PASSWORD) throw new Error('PROVISION_USER_PASSWORD env var is required');
const PG_PASSWORD = process.env.PGPASSWORD;
if (!PG_PASSWORD) throw new Error('PGPASSWORD env var is required');

const PSQL = String.raw`C:\Program Files\PostgreSQL\17\bin\psql.exe`;
const DB_CONN = '-U nzila -d nzila_automation -p 5433 -h localhost';

const CLERK_ORGS = {
  nzila: 'org_3A1qYmVHWmeSbbZhlPMwVIrGHFQ',
  clc: 'org_3B3NjHnvzeSJBZQE8PGQf0nmgts',
  cape: 'org_3B3Nj6NGSY6rT9ibI8bgFhZdMRN',
  cupe: 'org_3BP6K4uezEa2CLEvUNDwhnJGNFg',
};

const DB_ORGS = {
  nzila: '458a56cb-251a-4c91-a0b5-81bb8ac39087',
  clc: '9588c826-a543-4d43-9c22-2e477e532649',
  cape: '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6',
  cupe: '9210418f-6a4f-4dab-a7d2-4450d581dc81',
};

// ── Clerk API helpers ───────────────────────────────────────────────────────

function clerkRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.clerk.dev',
      path: '/v1' + path,
      method,
      headers: {
        Authorization: `Bearer ${CLERK_KEY}`,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function createUser(first, last, email, phone) {
  const res = await clerkRequest('POST', '/users', {
    first_name: first,
    last_name: last,
    email_address: [email],
    phone_number: [phone],
    password: TEST_USER_PASSWORD,
    skip_password_checks: true,
  });
  if (res.status === 200 || res.status === 201) return res.body.id;
  if (res.body?.errors?.[0]?.code === 'form_identifier_exists') {
    console.log(`  ⚠ ${email} already exists, finding user...`);
    const search = await clerkRequest(
      'GET',
      `/users?email_address=${encodeURIComponent(email)}`,
    );
    const users = search.body?.data || search.body;
    if (Array.isArray(users) && users.length > 0) return users[0].id;
  }
  console.error(
    `  ✗ Failed to create ${email}:`,
    JSON.stringify(res.body?.errors || res.body),
  );
  return null;
}

async function addOrgMember(orgId, userId, role) {
  const res = await clerkRequest(
    'POST',
    `/organizations/${orgId}/memberships`,
    { user_id: userId, role },
  );
  if (res.status === 200 || res.status === 201) return true;
  if (
    res.body?.errors?.[0]?.code === 'duplicate_record' ||
    res.body?.errors?.[0]?.message?.includes('already')
  )
    return true;
  console.error(
    `  ✗ Failed to add ${userId} to org:`,
    JSON.stringify(res.body?.errors || res.body),
  );
  return false;
}

async function createOrg(name, slug) {
  const res = await clerkRequest('POST', '/organizations', { name, slug });
  if (res.status === 200 || res.status === 201) return res.body.id;
  // If slug taken, try to find it
  if (res.body?.errors?.[0]?.code === 'form_identifier_exists') {
    console.log(`  ⚠ Org "${name}" already exists, searching...`);
    const search = await clerkRequest('GET', '/organizations?limit=50');
    const orgs = search.body?.data || search.body;
    if (Array.isArray(orgs)) {
      const found = orgs.find(
        (o) => o.slug === slug || o.name === name,
      );
      if (found) return found.id;
    }
  }
  console.error(
    `  ✗ Failed to create org ${name}:`,
    JSON.stringify(res.body?.errors || res.body),
  );
  return null;
}

// ── DB helpers ──────────────────────────────────────────────────────────────

function runSQL(sql) {
  try {
    const result = execSync(
      // codeql[js/incomplete-sanitization] - dev/test-only script; SQL is developer-controlled, not user input
      `"${PSQL}" ${DB_CONN} -t -A --pset=pager=off -c "${sql.replace(/"/g, '\\"')}"`,
      { env: { ...process.env, PGPASSWORD: PG_PASSWORD }, encoding: 'utf-8' },
    );
    return result.trim();
  } catch (err) {
    console.error(`  ✗ SQL error: ${err.stderr?.trim() || err.message}`);
    return null;
  }
}

function runSQLFile(filePath) {
  try {
    const result = execSync(
      `"${PSQL}" ${DB_CONN} --pset=pager=off -f "${filePath}"`,
      { env: { ...process.env, PGPASSWORD: PG_PASSWORD }, encoding: 'utf-8' },
    );
    return result.trim();
  } catch (err) {
    console.error(`  ✗ SQL file error: ${err.stderr?.trim() || err.message}`);
    return null;
  }
}

function esc(s) {
  return s.replace(/'/g, "''");
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Nzila OS — Master Test User Provisioning                   ║');
  console.log('║  UE (38 roles) + Zonga (4 roles + listeners + creators)     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // ════════════════════════════════════════════════════════════════════════
  // PHASE 1: Create Zonga DB tables
  // ════════════════════════════════════════════════════════════════════════
  console.log('═══ Phase 1: Create Zonga DB tables ═══\n');

  const createTableSQL = `
-- Enums (IF NOT EXISTS for idempotency)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_status') THEN
    CREATE TYPE org_status AS ENUM ('active', 'inactive');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'person_type') THEN
    CREATE TYPE person_type AS ENUM ('individual', 'entity');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_role_kind') THEN
    CREATE TYPE org_role_kind AS ENUM ('director', 'officer', 'shareholder', 'counsel', 'auditor');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_member_role') THEN
    CREATE TYPE org_member_role AS ENUM ('org_admin', 'org_secretary', 'org_viewer');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_member_status') THEN
    CREATE TYPE org_member_status AS ENUM ('active', 'suspended', 'removed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'zonga_creator_status') THEN
    CREATE TYPE zonga_creator_status AS ENUM ('pending', 'active', 'suspended', 'deactivated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'zonga_creator_plan') THEN
    CREATE TYPE zonga_creator_plan AS ENUM ('artist', 'label', 'enterprise');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'zonga_subscription_status') THEN
    CREATE TYPE zonga_subscription_status AS ENUM ('active', 'past_due', 'canceled', 'trialing', 'incomplete');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'zonga_listener_plan') THEN
    CREATE TYPE zonga_listener_plan AS ENUM ('free', 'premium');
  END IF;
END $$;

-- orgs table
CREATE TABLE IF NOT EXISTS orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id VARCHAR(255) UNIQUE,
  legal_name TEXT NOT NULL,
  jurisdiction VARCHAR(10) NOT NULL DEFAULT 'CA-ON',
  incorporation_number TEXT,
  registered_office_address JSONB,
  fiscal_year_end VARCHAR(5),
  policy_config JSONB DEFAULT '{}',
  status org_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- people table
CREATE TABLE IF NOT EXISTS people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type person_type NOT NULL,
  legal_name TEXT NOT NULL,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- org_roles table  
CREATE TABLE IF NOT EXISTS org_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  person_id UUID NOT NULL REFERENCES people(id),
  role org_role_kind NOT NULL,
  title TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- org_members table
CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  clerk_user_id TEXT NOT NULL,
  role org_member_role NOT NULL,
  status org_member_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- zonga_creators table
CREATE TABLE IF NOT EXISTS zonga_creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES orgs(id),
  user_id TEXT NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  status zonga_creator_status NOT NULL DEFAULT 'pending',
  plan zonga_creator_plan NOT NULL DEFAULT 'artist',
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  subscription_status zonga_subscription_status,
  genre VARCHAR(100),
  country VARCHAR(100),
  payout_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  verified BOOLEAN NOT NULL DEFAULT false,
  legal_name VARCHAR(255),
  city VARCHAR(100),
  payout_status VARCHAR(50),
  verification_status VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- zonga_listeners table
CREATE TABLE IF NOT EXISTS zonga_listeners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES orgs(id),
  user_id TEXT,
  display_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  avatar_url TEXT,
  bio TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  plan zonga_listener_plan NOT NULL DEFAULT 'free',
  subscription_status zonga_subscription_status,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  current_period_end TIMESTAMPTZ,
  preferences_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

  const sqlPath = join(__dirname, '_provision-tables.sql');
  writeFileSync(sqlPath, createTableSQL, 'utf-8');
  const tableResult = runSQLFile(sqlPath);
  if (tableResult !== null) {
    console.log('  ✓ Zonga tables created (orgs, org_members, zonga_creators, zonga_listeners)');
  }

  // Verify tables exist
  const check = runSQL(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('orgs','org_members','zonga_creators','zonga_listeners') ORDER BY table_name",
  );
  console.log(`  Tables present: ${check?.split('\n').join(', ') || 'NONE'}\n`);

  // ════════════════════════════════════════════════════════════════════════
  // PHASE 2: Update UE organization_members roles
  // ════════════════════════════════════════════════════════════════════════
  console.log('═══ Phase 2: Update UE organization_members roles ═══\n');

  const roleUpdates = [
    // NZILA Ventures — Tier 1 Platform Ops + Tier 2
    // Michel (Platform Admin) → coo
    [DB_ORGS.nzila, 'user_37Zo7OrvP4jy0J0MU5APfkDtE2V', 'coo'],
    // David Nkemdirim → cto
    [DB_ORGS.nzila, 'user_3A2c3SaKc0xFearcu0NbUL2lhDF', 'cto'],
    // Tania Da Silva → platform_lead
    [DB_ORGS.nzila, 'user_3A2c6sEcW7WdJSnLVVQFB28PjIU', 'platform_lead'],
    // Tim Maguire → customer_success_director
    [DB_ORGS.nzila, 'user_3A2c6rLMOmF45HEkaU7XdQp05Zk', 'customer_success_director'],
    // Mark Hancock → support_manager
    [DB_ORGS.nzila, 'user_3A2c3apBW0oMKPX2CjIMd8b1ujq', 'support_manager'],
    // Patty Coates → data_analytics_manager
    [DB_ORGS.nzila, 'user_3A2c3b8lVI7gxi3Keb6xE4piwGv', 'data_analytics_manager'],
    // Keisha Brown → billing_manager
    [DB_ORGS.nzila, 'user_3A2c729gwvVEXyC6vc2ICqzihxp', 'billing_manager'],
    // Carlos Rivera → integration_manager
    [DB_ORGS.nzila, 'user_3A2c75rcBNDcTYtkjnNgbYLqsEx', 'integration_manager'],
    // Priya Sharma → compliance_manager
    [DB_ORGS.nzila, 'user_3A2c7AO7bbapxh9IdAgW5kXPhHu', 'compliance_manager'],
    // Ahmed Hassan → security_manager
    [DB_ORGS.nzila, 'user_3A2c7IXYOHgNMiIdOte7C5MEwFd', 'security_manager'],
    // Sandra Weatherby → system_admin (Tier 2)
    [DB_ORGS.nzila, 'user_3A2c7Rsg6612F3BAxHxx5L29jRH', 'system_admin'],

    // CLC — Tier 3
    // Hassan Yussuff → clc_executive
    [DB_ORGS.clc, 'user_3BSyEWUb0cnQ56CSS0W0fK8g35a', 'clc_executive'],
    // Marie Clarke Walker → clc_staff
    [DB_ORGS.clc, 'user_3BSyEa51htBN51y0YxG9a9Elp2L', 'clc_staff'],

    // CAPE — Tier 4 + 5 + 6
    // Jane Doe → president
    [DB_ORGS.cape, 'user_3BSyETlaLS6t8wuol22bVECjPFM', 'president'],
    // Marc-André Dubois → vice_president
    [DB_ORGS.cape, 'user_3BSyEi6TduTzKp2mZigpD6D746h', 'vice_president'],
    // Brian Faulkner → national_officer (Tier 5)
    [DB_ORGS.cape, 'user_3BSzDo4cpXO7qTM0bY800AuLOd2', 'national_officer'],
    // Chantal Bertrand → secretary_treasurer
    [DB_ORGS.cape, 'user_3BSzDqnxMraAlxaRvhyrTabrTOE', 'secretary_treasurer'],
    // Mike Savard → fed_executive (Tier 4)
    [DB_ORGS.cape, 'user_3BSzE0qWBvXm6eP75nAukpBbpvk', 'fed_executive'],
    // Nadia Ouellet → fed_staff (Tier 4)
    [DB_ORGS.cape, 'user_3BSzDyCmU8iKsYeD1tyBqkDfBFP', 'fed_staff'],
    // Daniel Kim → officer
    [DB_ORGS.cape, 'user_3BSzEAPted20wutKC5lY8lTn9jZ', 'officer'],
    // Sarah Lefebvre → chief_steward
    [DB_ORGS.cape, 'user_3BSzE9z6NFV3hbYd4Fu2ufoL4rI', 'chief_steward'],
    // Alexandre Moreau → steward
    [DB_ORGS.cape, 'user_3BSzE5AtIbImjHukqc0yM9EXQdu', 'steward'],
    // Jennifer Walsh → bargaining_committee
    [DB_ORGS.cape, 'user_3BSzEIjI6LSWANw6ssfwXcxxnhT', 'bargaining_committee'],
    // Pierre Desmarais → health_safety_rep
    [DB_ORGS.cape, 'user_3BSzEIXiSqVXnNYgymDZ1PY6ZhY', 'health_safety_rep'],

    // CUPE L123 — Tier 6 local union hierarchy
    // Alice Johnson → president
    [DB_ORGS.cupe, 'user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', 'president'],
    // Marie-Claire Dubois → vice_president
    [DB_ORGS.cupe, 'user_3BSzhd4q6moCIlT3PhkWbdiAhtA', 'vice_president'],
    // Jean-Pierre Tremblay → secretary_treasurer
    [DB_ORGS.cupe, 'user_3BSzhdQTA7fsGN5kUPfXJpMTK1O', 'secretary_treasurer'],
    // Marco Rossi → chief_steward
    [DB_ORGS.cupe, 'user_3BSzhk06aD2b1kK5jUuMlmy7vGu', 'chief_steward'],
    // Priya Patel → officer
    [DB_ORGS.cupe, 'user_3BSzhnlEbmEnazjOxZdVE2eXO64', 'officer'],
    // David Thompson → bargaining_committee
    [DB_ORGS.cupe, 'user_3BSzhpCQGDtA22YfStHM5ksq6pI', 'bargaining_committee'],
    // Kevin O'Brien → health_safety_rep
    [DB_ORGS.cupe, 'user_3BSzhpyvCHVWm3o4QSYs87ufGGg', 'health_safety_rep'],
  ];

  for (const [orgId, userId, role] of roleUpdates) {
    const orgName =
      Object.entries(DB_ORGS).find(([, v]) => v === orgId)?.[0]?.toUpperCase() ||
      orgId.slice(0, 8);
    process.stdout.write(`  ${orgName} ${userId.slice(-8)} → ${role}... `);
    const result = runSQL(
      `UPDATE organization_members SET role = '${esc(role)}', updated_at = now() WHERE organization_id = '${orgId}' AND user_id = '${esc(userId)}'`,
    );
    console.log(result !== null ? '✓' : '✗');
  }

  // ════════════════════════════════════════════════════════════════════════
  // PHASE 3: Add orphaned Clerk users to NZILA (DB + Clerk org)
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n═══ Phase 3: Add orphaned Clerk users to NZILA ═══\n');

  const orphanedUsers = [
    {
      userId: 'user_3A2c3OxpYt48W0JlJmdkVm3amoD',
      name: 'Marie-Claire Bourassa',
      email: 'test.clcexec@nzilaventures.com',
      role: 'support_agent',
    },
    {
      userId: 'user_3A2c3JVjCye1fFzup1nkEexCBEt',
      name: 'Jordan Whitfield',
      email: 'test.sysadmin@nzilaventures.com',
      role: 'data_analyst',
    },
    {
      userId: 'user_3A2bwLcGcgpPFbL5z3NhuJQwYRa',
      name: 'Amara Okafor',
      email: 'test.appowner@nzilaventures.com',
      role: 'billing_specialist',
    },
  ];

  for (const { userId, name, email, role } of orphanedUsers) {
    process.stdout.write(`  ${name} → NZILA as ${role}... `);

    // Add to Clerk org
    await addOrgMember(CLERK_ORGS.nzila, userId, 'org:member');

    // Add to DB
    runSQL(
      `INSERT INTO organization_members (id, user_id, organization_id, role, name, email, status, created_at, updated_at) VALUES (gen_random_uuid(), '${esc(userId)}', '${DB_ORGS.nzila}', '${esc(role)}', '${esc(name)}', '${esc(email)}', 'active', now(), now()) ON CONFLICT DO NOTHING`,
    );
    console.log('✓');
  }

  // ════════════════════════════════════════════════════════════════════════
  // PHASE 4: Create new Clerk users for remaining platform ops roles
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n═══ Phase 4: Create new Clerk users for platform ops ═══\n');

  const newPlatformUsers = [
    {
      first: 'Rachel',
      last: 'Torres',
      email: 'rachel.torres@nzilaventures.com',
      phone: '+16135210020',
      role: 'integration_specialist',
    },
    {
      first: 'Yuki',
      last: 'Tanaka',
      email: 'yuki.tanaka@nzilaventures.com',
      phone: '+16135210021',
      role: 'content_manager',
    },
    {
      first: 'Omar',
      last: 'El-Amin',
      email: 'omar.elamin@nzilaventures.com',
      phone: '+16135210022',
      role: 'training_coordinator',
    },
  ];

  for (const { first, last, email, phone, role } of newPlatformUsers) {
    process.stdout.write(`  Creating ${first} ${last} (${role})... `);
    const userId = await createUser(first, last, email, phone);
    if (!userId) continue;
    console.log(`✓ ${userId}`);

    // Add to NZILA Clerk org
    process.stdout.write(`    → Adding to NZILA Clerk org... `);
    await addOrgMember(CLERK_ORGS.nzila, userId, 'org:member');
    console.log('✓');

    // Add to DB
    process.stdout.write(`    → Adding to DB as ${role}... `);
    runSQL(
      `INSERT INTO organization_members (id, user_id, organization_id, role, name, email, status, created_at, updated_at) VALUES (gen_random_uuid(), '${esc(userId)}', '${DB_ORGS.nzila}', '${esc(role)}', '${esc(first + ' ' + last)}', '${esc(email)}', 'active', now(), now()) ON CONFLICT DO NOTHING`,
    );
    console.log('✓');
  }

  // Also add Aubert personal account to NZILA DB for content_manager backup
  process.stdout.write('  Adding Aubert personal account to NZILA DB... ');
  runSQL(
    `INSERT INTO organization_members (id, user_id, organization_id, role, name, email, status, created_at, updated_at) VALUES (gen_random_uuid(), 'user_37vyDm8LHilksYNuVBcenvdktBW', '${DB_ORGS.nzila}', 'app_owner', 'Aubert Nungisa', 'a_nungisa@yahoo.ca', 'active', now(), now()) ON CONFLICT DO NOTHING`,
  );
  console.log('✓');

  // ════════════════════════════════════════════════════════════════════════
  // PHASE 5: Create Zonga Clerk org + users
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n═══ Phase 5: Create Zonga Clerk org + users ═══\n');

  // Create the "Afrobeats Records" org
  process.stdout.write('  Creating Afrobeats Records org... ');
  const zongaOrgClerkId = await createOrg('Afrobeats Records', 'afrobeats-records');
  if (!zongaOrgClerkId) {
    console.error('FATAL: Could not create Zonga org. Aborting Zonga section.');
  } else {
    console.log(`✓ ${zongaOrgClerkId}`);

    // Insert the org into the DB `orgs` table
    const ZONGA_DB_ORG_ID = '33333333-3333-3333-3333-333333333333';
    process.stdout.write('  Inserting into DB orgs table... ');
    runSQL(
      `INSERT INTO orgs (id, clerk_org_id, legal_name, jurisdiction, status) VALUES ('${ZONGA_DB_ORG_ID}', '${esc(zongaOrgClerkId)}', 'Afrobeats Records Inc.', 'CA-ON', 'active') ON CONFLICT (id) DO NOTHING`,
    );
    console.log('✓');

    // Also insert into the UE organizations table so it appears in the org picker
    process.stdout.write('  Inserting into UE organizations table... ');
    runSQL(
      `INSERT INTO organizations (id, name, slug, display_name, organization_type, status, clerk_organization_id, created_at, updated_at) VALUES ('${ZONGA_DB_ORG_ID}', 'Afrobeats Records', 'afrobeats-records', 'Afrobeats Records', 'label', 'active', '${esc(zongaOrgClerkId)}', now(), now()) ON CONFLICT (id) DO NOTHING`,
    );
    console.log('✓');

    // Zonga users to create
    const zongaUsers = [
      // Label team (org members)
      {
        first: 'Kofi',
        last: 'Mensah',
        email: 'kofi@afrobeatsrecords.com',
        phone: '+12125550301',
        clerkRole: 'org:admin',
        dbRole: 'admin',
        zongaRole: 'label_admin',
        isCreator: false,
        isListener: false,
      },
      {
        first: 'Ama',
        last: 'Adjei',
        email: 'ama@afrobeatsrecords.com',
        phone: '+12125550302',
        clerkRole: 'org:member',
        dbRole: 'manager',
        zongaRole: 'label_manager',
        isCreator: false,
        isListener: false,
      },
      {
        first: 'Kwame',
        last: 'Asante',
        email: 'kwame@afrobeatsrecords.com',
        phone: '+12125550303',
        clerkRole: 'org:member',
        dbRole: 'creator',
        zongaRole: 'creator',
        isCreator: true,
        isListener: false,
        creatorProfile: {
          displayName: 'Kwame Vibes',
          bio: 'Afrobeats producer & artist from Accra',
          genre: 'Afrobeats',
          country: 'Ghana',
          plan: 'artist',
          city: 'Accra',
        },
      },
      {
        first: 'Adwoa',
        last: 'Boateng',
        email: 'adwoa@afrobeatsrecords.com',
        phone: '+12125550304',
        clerkRole: 'org:member',
        dbRole: 'viewer',
        zongaRole: 'viewer',
        isCreator: false,
        isListener: false,
      },
      // Platform team (NZILA staff managing Zonga)
      {
        first: 'Nana',
        last: 'Osei',
        email: 'nana.osei@nzilaventures.com',
        phone: '+12125550305',
        clerkRole: 'org:member',
        dbRole: 'manager',
        zongaRole: 'platform_manager',
        isCreator: false,
        isListener: false,
      },
      {
        first: 'Akua',
        last: 'Donkor',
        email: 'akua.donkor@nzilaventures.com',
        phone: '+12125550306',
        clerkRole: 'org:member',
        dbRole: 'viewer',
        zongaRole: 'platform_viewer',
        isCreator: false,
        isListener: false,
      },
      // Listeners (end users)
      {
        first: 'Yaw',
        last: 'Mensah',
        email: 'yaw.listener@gmail.com',
        phone: '+12125550307',
        clerkRole: null,
        dbRole: null,
        zongaRole: 'listener_free',
        isCreator: false,
        isListener: true,
        listenerProfile: {
          displayName: 'Yaw M.',
          plan: 'free',
          city: 'Toronto',
          country: 'Canada',
        },
      },
      {
        first: 'Efua',
        last: 'Oppong',
        email: 'efua.premium@gmail.com',
        phone: '+12125550308',
        clerkRole: null,
        dbRole: null,
        zongaRole: 'listener_premium',
        isCreator: false,
        isListener: true,
        listenerProfile: {
          displayName: 'Efua O.',
          plan: 'premium',
          subscriptionStatus: 'active',
          city: 'London',
          country: 'United Kingdom',
        },
      },
    ];

    const zongaUserResults = {};

    for (const user of zongaUsers) {
      const { first, last, email, phone, clerkRole } = user;
      process.stdout.write(`  Creating ${first} ${last} (${user.zongaRole})... `);
      const userId = await createUser(first, last, email, phone);
      if (!userId) continue;
      console.log(`✓ ${userId}`);
      zongaUserResults[user.zongaRole] = { userId, ...user };

      // Add to Clerk org (label team + platform team only)
      if (clerkRole) {
        process.stdout.write(`    → Adding to Afrobeats Records org... `);
        await addOrgMember(zongaOrgClerkId, userId, clerkRole);
        console.log('✓');
      }

      // Also add platform team to NZILA Clerk org
      if (user.zongaRole.startsWith('platform_')) {
        process.stdout.write(`    → Adding to NZILA org... `);
        await addOrgMember(CLERK_ORGS.nzila, userId, 'org:member');
        console.log('✓');
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 6: Seed Zonga DB tables
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n═══ Phase 6: Seed Zonga DB tables ═══\n');

    // Insert org_members for label + platform team
    for (const [role, data] of Object.entries(zongaUserResults)) {
      if (!data.dbRole) continue; // listeners don't go in org_members
      const orgMemberRole =
        data.dbRole === 'admin'
          ? 'org_admin'
          : data.dbRole === 'viewer'
            ? 'org_viewer'
            : 'org_admin'; // manager/creator → org_admin for now
      process.stdout.write(`  org_members: ${data.first} ${data.last} as ${orgMemberRole}... `);
      runSQL(
        `INSERT INTO org_members (id, org_id, clerk_user_id, role, status) VALUES (gen_random_uuid(), '${ZONGA_DB_ORG_ID}', '${esc(data.userId)}', '${orgMemberRole}', 'active') ON CONFLICT DO NOTHING`,
      );
      console.log('✓');

      // Also add to UE organization_members for org-picker compatibility
      process.stdout.write(
        `  organization_members: ${data.first} ${data.last} as ${data.dbRole}... `,
      );
      runSQL(
        `INSERT INTO organization_members (id, user_id, organization_id, role, name, email, status, created_at, updated_at) VALUES (gen_random_uuid(), '${esc(data.userId)}', '${ZONGA_DB_ORG_ID}', '${esc(data.dbRole)}', '${esc(data.first + ' ' + data.last)}', '${esc(data.email)}', 'active', now(), now()) ON CONFLICT DO NOTHING`,
      );
      console.log('✓');
    }

    // Insert zonga_creators
    for (const [, data] of Object.entries(zongaUserResults)) {
      if (!data.isCreator || !data.creatorProfile) continue;
      const p = data.creatorProfile;
      process.stdout.write(`  zonga_creators: ${p.displayName}... `);
      runSQL(
        `INSERT INTO zonga_creators (id, org_id, user_id, display_name, bio, status, plan, genre, country, city, verified) VALUES (gen_random_uuid(), '${ZONGA_DB_ORG_ID}', '${esc(data.userId)}', '${esc(p.displayName)}', '${esc(p.bio || '')}', 'active', '${esc(p.plan)}', '${esc(p.genre || '')}', '${esc(p.country || '')}', '${esc(p.city || '')}', true) ON CONFLICT DO NOTHING`,
      );
      console.log('✓');
    }

    // Insert zonga_listeners
    for (const [, data] of Object.entries(zongaUserResults)) {
      if (!data.isListener || !data.listenerProfile) continue;
      const p = data.listenerProfile;
      process.stdout.write(`  zonga_listeners: ${p.displayName}... `);
      const subStatus = p.subscriptionStatus
        ? `'${esc(p.subscriptionStatus)}'`
        : 'NULL';
      runSQL(
        `INSERT INTO zonga_listeners (id, org_id, user_id, display_name, email, plan, subscription_status, city, country) VALUES (gen_random_uuid(), '${ZONGA_DB_ORG_ID}', '${esc(data.userId)}', '${esc(p.displayName)}', '${esc(data.email)}', '${esc(p.plan)}', ${subStatus}, '${esc(p.city || '')}', '${esc(p.country || '')}') ON CONFLICT DO NOTHING`,
      );
      console.log('✓');
    }

    // Add platform team to NZILA org_members in UE
    for (const [role, data] of Object.entries(zongaUserResults)) {
      if (!role.startsWith('platform_')) continue;
      const ueRole = role === 'platform_manager' ? 'content_manager' : 'member';
      process.stdout.write(
        `  NZILA org_members: ${data.first} ${data.last} as ${ueRole}... `,
      );
      runSQL(
        `INSERT INTO organization_members (id, user_id, organization_id, role, name, email, status, created_at, updated_at) VALUES (gen_random_uuid(), '${esc(data.userId)}', '${DB_ORGS.nzila}', '${esc(ueRole)}', '${esc(data.first + ' ' + data.last)}', '${esc(data.email)}', 'active', now(), now()) ON CONFLICT DO NOTHING`,
      );
      console.log('✓');
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // PHASE 7: Cleanup seed placeholders
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n═══ Phase 7: Cleanup seed placeholders ═══\n');

  const placeholderPatterns = [
    "user_id LIKE 'user_clc_%'",
    "user_id LIKE 'user_cape_%'",
    "user_id LIKE 'user_cupe_%'",
    "user_id LIKE 'cupe-natl-%'",
    "user_id LIKE 'usr-l123-%'",
  ];

  for (const pattern of placeholderPatterns) {
    const count = runSQL(
      `SELECT count(*) FROM organization_members WHERE ${pattern}`,
    );
    process.stdout.write(`  Deleting ${count || 0} rows matching ${pattern}... `);
    runSQL(`DELETE FROM organization_members WHERE ${pattern}`);
    console.log('✓');
  }

  // ════════════════════════════════════════════════════════════════════════
  // PHASE 8: Final verification
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n═══ Phase 8: Final verification ═══\n');

  // UE role coverage by org
  for (const [key, orgId] of Object.entries(DB_ORGS)) {
    console.log(`  ${key.toUpperCase()}:`);
    const roles = runSQL(
      `SELECT role, count(*) FROM organization_members WHERE organization_id = '${orgId}' GROUP BY role ORDER BY role`,
    );
    if (roles) {
      for (const line of roles.split('\n')) {
        if (line.trim()) {
          const [role, count] = line.split('|');
          console.log(`    ${role}: ${count}`);
        }
      }
    }
  }

  // Zonga tables
  console.log('\n  ZONGA:');
  const zongaOrgs = runSQL(`SELECT count(*) FROM orgs`);
  const zongaMembers = runSQL(`SELECT count(*) FROM org_members`);
  const zongaCreators = runSQL(`SELECT count(*) FROM zonga_creators`);
  const zongaListeners = runSQL(`SELECT count(*) FROM zonga_listeners`);
  console.log(`    orgs: ${zongaOrgs}`);
  console.log(`    org_members: ${zongaMembers}`);
  console.log(`    zonga_creators: ${zongaCreators}`);
  console.log(`    zonga_listeners: ${zongaListeners}`);

  // Count total Clerk-linked members (no placeholders)
  const totalMembers = runSQL(
    `SELECT count(*) FROM organization_members WHERE user_id LIKE 'user_%' AND user_id NOT LIKE 'user_clc_%' AND user_id NOT LIKE 'user_cape_%' AND user_id NOT LIKE 'user_cupe_%' AND user_id NOT LIKE 'cupe-natl-%' AND user_id NOT LIKE 'usr-l123-%'`,
  );
  console.log(`\n  Total real Clerk-linked UE members: ${totalMembers}`);

  // Unique roles
  const uniqueRoles = runSQL(
    `SELECT DISTINCT role FROM organization_members WHERE user_id LIKE 'user_%' ORDER BY role`,
  );
  console.log(
    `  Unique roles covered: ${uniqueRoles?.split('\n').filter(Boolean).length || 0}`,
  );
  if (uniqueRoles) {
    for (const r of uniqueRoles.split('\n').filter(Boolean)) {
      console.log(`    ✓ ${r}`);
    }
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Provisioning complete!                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // Clean up temp SQL file
  try {
    const { unlinkSync } = await import('node:fs');
    unlinkSync(sqlPath);
  } catch {
    /* ignore */
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
