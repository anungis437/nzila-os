#!/usr/bin/env node

import { assertNotProduction } from '../lib/runtime/production-guard.mjs'

assertNotProduction('seed-cupe-pilot')

/**
 * Seed Script: Load CUPE Pilot Fixtures
 * 
 * Usage:
 *   node scripts/seed-cupe-pilot.mjs [--reset]
 * 
 * Loads:
 * - CUPE pilot org (Local 123) with 3 worksites
 * - 7 demo members (6 union + 1 admin) with various roles
 * - 5 demo cases (3 open, 1 in-progress, 1 settled)
 * 
 * v0.1: SQL insert statements (idempotent via upsert)
 * v0.2+: Admin form-based seeding (per user requirements)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CUPE_PILOT_JSON = path.join(__dirname, '../fixtures/cupe/pilot-org/cupe-pilot-setup.json');
const PG_PASSWORD = process.env.PGPASSWORD || 'nzila_dev';
const PG_USER = process.env.PGUSER || 'nzila';
const PG_DB = process.env.PGDATABASE || 'nzila_automation';
const PG_HOST = process.env.PGHOST || 'localhost';
const PG_PORT = process.env.PGPORT || '5433';

const resetMode = process.argv.includes('--reset');

async function loadFixture() {
  try {
    const jsonContent = fs.readFileSync(CUPE_PILOT_JSON, 'utf-8');
    return JSON.parse(jsonContent);
  } catch (error) {
    console.error('❌ Failed to load fixture:', error.message);
    process.exit(1);
  }
}

async function resetData() {
  if (!resetMode) return;

  console.log('🧹 Resetting CUPE pilot data...');
  const queries = [
    'DELETE FROM union_eyes.case_assignments WHERE case_id IN (SELECT id FROM union_eyes.cases WHERE org_id = \'cupe-local-123\')',
    'DELETE FROM union_eyes.case_notes WHERE case_id IN (SELECT id FROM union_eyes.cases WHERE org_id = \'cupe-local-123\')',
    'DELETE FROM union_eyes.cases WHERE org_id = \'cupe-local-123\'',
    'DELETE FROM union_eyes.members WHERE org_id = \'cupe-local-123\'',
    'DELETE FROM union_eyes.worksites WHERE org_id = \'cupe-local-123\'',
    'DELETE FROM auth.org WHERE id = \'cupe-local-123\'',
  ];

  for (const query of queries) {
    try {
      const cmd = `PGPASSWORD='${PG_PASSWORD}' psql -U ${PG_USER} -d ${PG_DB} -h ${PG_HOST} -p ${PG_PORT} -c "${query}"`;
      await execAsync(cmd);
      console.log(`  ✓ Cleared table`);
    } catch (error) {
      console.error(`  ⚠️  Query warning: ${error.message.split('\n')[0]}`);
    }
  }
}

async function seedOrg(fixture) {
  console.log('📦 Seeding CUPE organization...');
  const { org } = fixture;

  const insertOrg = `
    INSERT INTO auth.org (id, name, slug, type)
    VALUES ('${org.id}', '${org.name.replace(/'/g, "''")}', '${org.slug}', '${org.type}')
    ON CONFLICT(id) DO UPDATE SET name = EXCLUDED.name
  `;

  try {
    const cmd = `PGPASSWORD='${PG_PASSWORD}' psql -U ${PG_USER} -d ${PG_DB} -h ${PG_HOST} -p ${PG_PORT} -c "${insertOrg}"`;
    await execAsync(cmd);
    console.log(`  ✓ Organization seeded: ${org.name}`);
  } catch (error) {
    console.error(`  ❌ Failed to seed org:`, error.message);
    throw error;
  }
}

async function seedWorksites(fixture) {
  console.log('🏢 Seeding worksites...');
  const { worksites } = fixture;

  for (const worksite of worksites) {
    const insertWorksite = `
      INSERT INTO union_eyes.worksites (id, org_id, name, address, city, province, member_count)
      VALUES (
        '${worksite.id}',
        '${worksite.org_id}',
        '${worksite.name.replace(/'/g, "''")}',
        '${worksite.address.replace(/'/g, "''")}',
        '${worksite.city}',
        '${worksite.province}',
        ${worksite.member_count}
      )
      ON CONFLICT(id) DO UPDATE SET name = EXCLUDED.name
    `;

    try {
      const cmd = `PGPASSWORD='${PG_PASSWORD}' psql -U ${PG_USER} -d ${PG_DB} -h ${PG_HOST} -p ${PG_PORT} -c "${insertWorksite}"`;
      await execAsync(cmd);
      console.log(`  ✓ Worksite: ${worksite.name} (${worksite.member_count} members)`);
    } catch (error) {
      console.error(`  ❌ Failed to seed worksite:`, error.message);
      throw error;
    }
  }
}

async function seedMembers(fixture) {
  console.log('👥 Seeding members...');
  const { members } = fixture;

  for (const member of members) {
    const insertMember = `
      INSERT INTO union_eyes.members (id, org_id, worksite_id, first_name, last_name, email, role, member_number, hire_date)
      VALUES (
        '${member.id}',
        '${member.org_id}',
        '${member.worksite_id}',
        '${member.first_name.replace(/'/g, "''")}',
        '${member.last_name.replace(/'/g, "''")}',
        '${member.email}',
        '${member.role}',
        '${member.member_number}',
        '${member.hire_date}'
      )
      ON CONFLICT(id) DO UPDATE SET role = EXCLUDED.role
    `;

    try {
      const cmd = `PGPASSWORD='${PG_PASSWORD}' psql -U ${PG_USER} -d ${PG_DB} -h ${PG_HOST} -p ${PG_PORT} -c "${insertMember}"`;
      await execAsync(cmd);
      console.log(`  ✓ Member: ${member.first_name} ${member.last_name} (${member.role})`);
    } catch (error) {
      console.error(`  ❌ Failed to seed member:`, error.message);
      throw error;
    }
  }
}

async function seedCases(fixture) {
  console.log('📋 Seeding cases...');
  const { cases } = fixture;

  for (const caseData of cases) {
    const assignedTo = caseData.assigned_to ? `'${caseData.assigned_to}'` : 'NULL';
    const insertCase = `
      INSERT INTO union_eyes.cases (
        id, org_id, number, filed_by, assigned_to, case_type, priority, severity, status, title, description, filed_at, created_at
      )
      VALUES (
        '${caseData.id}',
        '${caseData.org_id}',
        '${caseData.number}',
        '${caseData.filed_by}',
        ${assignedTo},
        '${caseData.case_type}',
        '${caseData.priority}',
        '${caseData.severity}',
        '${caseData.status}',
        '${caseData.title.replace(/'/g, "''")}',
        '${caseData.description.replace(/'/g, "''")}',
        '${caseData.filed_at}',
        '${caseData.created_at}'
      )
      ON CONFLICT(id) DO UPDATE SET status = EXCLUDED.status
    `;

    try {
      const cmd = `PGPASSWORD='${PG_PASSWORD}' psql -U ${PG_USER} -d ${PG_DB} -h ${PG_HOST} -p ${PG_PORT} -c "${insertCase}"`;
      await execAsync(cmd);
      console.log(`  ✓ Case: ${caseData.number} (${caseData.case_type})`);
    } catch (error) {
      console.error(`  ❌ Failed to seed case:`, error.message);
      throw error;
    }
  }
}

async function main() {
  console.log('🚀 CUPE Pilot Fixture Seeder v0.1');
  console.log('=====================================\n');

  if (resetMode) {
    console.log('⚠️  Running in RESET mode (--reset flag detected)');
    console.log('   All CUPE Local 123 data will be deleted.\n');
  }

  try {
    const fixture = await loadFixture();
    await resetData();
    await seedOrg(fixture);
    await seedWorksites(fixture);
    await seedMembers(fixture);
    await seedCases(fixture);

    console.log('\n✅ CUPE Pilot fixtures seeded successfully!');
    console.log(`   Org: ${fixture.org.name}`);
    console.log(`   Worksites: ${fixture.worksites.length}`);
    console.log(`   Members: ${fixture.members.length}`);
    console.log(`   Cases: ${fixture.cases.length}`);
  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

main();
