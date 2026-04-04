#!/usr/bin/env node
/**
 * clerk-provision-pilot-orgs.mjs
 *
 * Provisions Clerk test users for the 4 pilot orgs (CLC, CAPE-ACEP, CUPE)
 * and adds org memberships. NZILA Ventures users already exist.
 *
 * Usage: node scripts/clerk-provision-pilot-orgs.mjs
 *
 * Requires: CLERK_SECRET_KEY env var or reads from apps/union-eyes/.env.local
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --------------------------------------------------------------------------
// Config
// --------------------------------------------------------------------------
function loadClerkKey() {
  if (process.env.CLERK_SECRET_KEY) return process.env.CLERK_SECRET_KEY;
  try {
    const envLocal = readFileSync(join(__dirname, '..', 'apps', 'union-eyes', '.env.local'), 'utf-8');
    const match = envLocal.match(/^CLERK_SECRET_KEY=(.+)$/m);
    if (match) return match[1].trim();
  } catch { /* ignore */ }
  throw new Error('CLERK_SECRET_KEY not found');
}

const CLERK_KEY = loadClerkKey();

const ORGS = {
  nzila:  'org_3A1qYmVHWmeSbbZhlPMwVIrGHFQ',
  clc:    'org_3B3NjHnvzeSJBZQE8PGQf0nmgts',
  cape:   'org_3B3Nj6NGSY6rT9ibI8bgFhZdMRN',
  cupe:   'org_3BP6K4uezEa2CLEvUNDwhnJGNFg',
};

// Users to create: [first, last, email, phone, org, clerkRole]
// Clerk dev instance requires phone_number.
// NZILA already has 12 users.
const USERS_TO_CREATE = [
  // CLC — 10 test users
  ['Hassan',  'Yussuff',       'h.yussuff@clc-ctc.ca',    '+16135210001', 'clc',  'org:admin'],
  ['Marie',   'Clarke Walker', 'm.walker@clc-ctc.ca',     '+16135210002', 'clc',  'org:member'],
  ['Denis',   'Bolduc',        'd.bolduc@clc-ctc.ca',     '+16135210003', 'clc',  'org:member'],
  ['Sophie',  'Tremblay',      's.tremblay@clc-ctc.ca',   '+16135210004', 'clc',  'org:member'],
  ['James',   'Nguyen',        'j.nguyen@clc-ctc.ca',     '+16135210005', 'clc',  'org:member'],
  ['Rebecca', 'Martin',        'r.martin@clc-ctc.ca',     '+16135210006', 'clc',  'org:member'],
  ['Louis',   'Picard',        'l.picard@clc-ctc.ca',     '+16135210007', 'clc',  'org:member'],
  ['Angela',  'Varga',         'a.varga@clc-ctc.ca',      '+16135210008', 'clc',  'org:member'],
  ['Patrick', 'O Connor',      'p.oconnor@clc-ctc.ca',    '+16135210009', 'clc',  'org:member'],
  ['Fatima',  'Al-Rashid',     'f.alrashid@clc-ctc.ca',   '+16135210010', 'clc',  'org:member'],
  // CAPE — 12 test users
  ['Jane',    'Doe',           'j.doe@acep-cape.ca',      '+16132360001', 'cape', 'org:admin'],
  ['Marc-André','Dubois',      'ma.dubois@acep-cape.ca',  '+16132360002', 'cape', 'org:member'],
  ['Brian',   'Faulkner',      'b.faulkner@acep-cape.ca', '+16132360003', 'cape', 'org:member'],
  ['Chantal', 'Bertrand',      'c.bertrand@acep-cape.ca', '+16132360004', 'cape', 'org:member'],
  ['Mike',    'Savard',        'm.savard@acep-cape.ca',   '+16132360005', 'cape', 'org:member'],
  ['Nadia',   'Ouellet',       'n.ouellet@acep-cape.ca',  '+16132360006', 'cape', 'org:member'],
  ['Daniel',  'Kim',           'd.kim@acep-cape.ca',      '+16132360007', 'cape', 'org:member'],
  ['Sarah',   'Lefebvre',      's.lefebvre@acep-cape.ca', '+16132360008', 'cape', 'org:member'],
  ['Alexandre','Moreau',       'a.moreau@acep-cape.ca',   '+16132360009', 'cape', 'org:member'],
  ['Jennifer','Walsh',         'j.walsh@acep-cape.ca',    '+16132360010', 'cape', 'org:member'],
  ['Pierre',  'Desmarais',     'p.desmarais@acep-cape.ca','+16132360011', 'cape', 'org:member'],
  ['Amira',   'Hassan',        'a.hassan@acep-cape.ca',   '+16132360012', 'cape', 'org:member'],
  // CUPE Local 123 — 7 new users (3 francophone, 4 anglophone)
  ['Marie-Claire','Dubois',    'mc.dubois@city.toronto.ca',    '+14165550201', 'cupe', 'org:member'],
  ['Jean-Pierre', 'Tremblay', 'jp.tremblay@city.toronto.ca',  '+14165550202', 'cupe', 'org:member'],
  ['David',   'Thompson',     'd.thompson@city.toronto.ca',    '+14165550203', 'cupe', 'org:member'],
  ['Priya',   'Patel',        'p.patel@city.toronto.ca',       '+14165550204', 'cupe', 'org:member'],
  ['Marco',   'Rossi',        'm.rossi@city.toronto.ca',       '+14165550205', 'cupe', 'org:member'],
  ['Nathalie','Lafontaine',   'n.lafontaine@city.toronto.ca',  '+14165550206', 'cupe', 'org:member'],
  ['Kevin',   'O Brien',      'k.obrien@city.toronto.ca',      '+14165550207', 'cupe', 'org:member'],
];

// Existing NZILA users to add as NZILA org members (not yet in org)
const NZILA_USERS_TO_ADD = [
  'user_3A2c7Rsg6612F3BAxHxx5L29jRH', // Sandra Weatherby
  'user_3A2c3b8lVI7gxi3Keb6xE4piwGv', // Patty Coates
  'user_3A2c6sEcW7WdJSnLVVQFB28PjIU', // Tania Da Silva
  'user_3A2c7AO7bbapxh9IdAgW5kXPhHu', // Priya Sharma
  'user_3A2c75rcBNDcTYtkjnNgbYLqsEx', // Carlos Rivera
  'user_3A2c7IXYOHgNMiIdOte7C5MEwFd', // Ahmed Hassan
  'user_3A2c3apBW0oMKPX2CjIMd8b1ujq', // Mark Hancock
  'user_3A2c3SaKc0xFearcu0NbUL2lhDF', // David Nkemdirim
  'user_3A2c6rLMOmF45HEkaU7XdQp05Zk', // Tim Maguire
  'user_3A2c729gwvVEXyC6vc2ICqzihxp', // Keisha Brown
];

// Platform admins to add as admin to CLC, CAPE, CUPE for org-picker
const PLATFORM_ADMINS = [
  'user_35NlrrNcfTv0DMh2kzBHyXZRtpb', // Super Admin
  'user_37Zo7OrvP4jy0J0MU5APfkDtE2V', // Platform Admin
];

// --------------------------------------------------------------------------
// Clerk API helpers
// --------------------------------------------------------------------------
function clerkRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.clerk.dev',
      path: '/v1' + path,
      method,
      headers: {
        'Authorization': `Bearer ${CLERK_KEY}`,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
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
    password: 'NzilaTest2026!',
    skip_password_checks: true,
  });
  if (res.status === 200 || res.status === 201) {
    return res.body.id;
  }
  // If email already exists, find the existing user
  if (res.body?.errors?.[0]?.code === 'form_identifier_exists') {
    console.log(`  ⚠ ${email} already exists, finding user...`);
    const search = await clerkRequest('GET', `/users?email_address=${encodeURIComponent(email)}`);
    const users = search.body?.data || search.body;
    if (Array.isArray(users) && users.length > 0) {
      return users[0].id;
    }
  }
  console.error(`  ✗ Failed to create ${email}:`, JSON.stringify(res.body?.errors || res.body));
  return null;
}

async function addOrgMember(orgId, userId, role) {
  const res = await clerkRequest('POST', `/organizations/${orgId}/memberships`, {
    user_id: userId,
    role: role,
  });
  if (res.status === 200 || res.status === 201) return true;
  // Already a member
  if (res.body?.errors?.[0]?.code === 'duplicate_record' ||
      res.body?.errors?.[0]?.message?.includes('already')) {
    return true;
  }
  console.error(`  ✗ Failed to add ${userId} to org:`, JSON.stringify(res.body?.errors || res.body));
  return false;
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------
async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Clerk Pilot Org Provisioning                   ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // 1. Create new users and add to orgs
  const results = {};
  console.log('── Creating test users ──');
  for (const [first, last, email, phone, orgKey, role] of USERS_TO_CREATE) {
    process.stdout.write(`  ${first} ${last} (${email})... `);
    const userId = await createUser(first, last, email, phone);
    if (userId) {
      console.log(`✓ ${userId}`);
      results[email] = userId;
      // Add to org
      const added = await addOrgMember(ORGS[orgKey], userId, role);
      if (added) console.log(`    → Added to ${orgKey.toUpperCase()} as ${role}`);
    }
  }

  // 2. Add remaining NZILA users to NZILA org
  console.log('\n── Adding NZILA users to org ──');
  for (const uid of NZILA_USERS_TO_ADD) {
    process.stdout.write(`  ${uid.slice(-8)} → NZILA... `);
    const added = await addOrgMember(ORGS.nzila, uid, 'org:member');
    console.log(added ? '✓' : '✗');
  }

  // 3. Platform admins already in CLC, CAPE, CUPE from previous run
  console.log('\n── Verifying platform admins in CLC & CAPE ──');
  for (const orgKey of ['clc', 'cape']) {
    for (const uid of PLATFORM_ADMINS) {
      process.stdout.write(`  ${uid.slice(-8)} → ${orgKey.toUpperCase()}... `);
      const added = await addOrgMember(ORGS[orgKey], uid, 'org:admin');
      console.log(added ? '✓' : '✗');
    }
  }

  // 4. Print summary
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  Provisioning Complete — User ID Summary         ║');
  console.log('╠══════════════════════════════════════════════════╣');
  for (const [email, userId] of Object.entries(results)) {
    console.log(`║  ${userId} | ${email}`);
  }
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('\nOrg IDs for seed SQL:');
  for (const [key, id] of Object.entries(ORGS)) {
    console.log(`  ${key.toUpperCase()}: ${id}`);
  }
  console.log(`\nPLATFORM_ADMIN_USER_IDS=user_35NlrrNcfTv0DMh2kzBHyXZRtpb,user_37Zo7OrvP4jy0J0MU5APfkDtE2V`);
  console.log(`SUPER_ADMIN_ORG_ID=458a56cb-251a-4c91-a0b5-81bb8ac39087`);
}

main().catch(console.error);
