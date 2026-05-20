#!/usr/bin/env tsx
/**
 * CUPE Local 4373 — Foundation Demo Seed (Vertical 1: Cases)
 *
 * Seeds the demo DB with real rows for the Cases vertical so that
 * `/dashboard/cases` reads from Postgres instead of static TS arrays.
 *
 * This is the BLUEPRINT pattern for all future foundation client demos:
 * the data shape mapping lives in a profile module
 * (`lib/demo/profiles/cupe4373-healthcare`), the seed runner is generic.
 *
 * Idempotent: re-running upserts grievances by `grievance_number`,
 * upserts the organization by `slug`, and replaces the entity + member
 * rows for the known stable UUIDs.
 *
 * Usage (from repo root, with DATABASE_URL pointed at demo DB):
 *   pnpm -F union-eyes exec tsx scripts/seed-cupe4373-demo.ts
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';

// Load env BEFORE importing db (db.ts reads DATABASE_URL at import time).
if (!process.env.DATABASE_URL) {
  config({ path: resolve(process.cwd(), '.env.local') });
}
if (!process.env.DATABASE_URL) {
  console.error('[seed] DATABASE_URL not set. Aborting.');
  process.exit(1);
}

import { db, client } from '../db/db';
import { grievances } from '../db/schema/grievance-schema';
import { demoCases, type DemoCase } from '../lib/demo/cupe4373-demo';

// ── Stable UUIDs ────────────────────────────────────────────────────────────
// Hand-picked so seeds are deterministic across runs and across instances.
const ORG_ID = 'a4373000-0000-4000-8000-000000000001';
const ENTITY_LOCAL_ID = 'a4373000-0000-4000-8000-000000000010';
const ENTITY_EMPLOYER_ID = 'a4373000-0000-4000-8000-000000000011';

const MEMBER_USER_ID = 'demo-member-cupe4373';
const STEWARD_USER_ID = 'demo-steward-cupe4373';
const OFFICER_USER_ID = 'demo-officer-cupe4373';

// Deterministic UUID derivation from grievance number (e.g. "UE-4373-026")
function grievanceUuid(grievanceNumber: string): string {
  // Pattern: a4373001-XXXX-4000-8000-000000000NNN where NNN is the case id suffix
  const m = grievanceNumber.match(/(\d+)$/);
  const suffix = (m?.[1] ?? '000').padStart(3, '0');
  return `a4373001-0000-4000-8000-000000000${suffix}`;
}

// ── Mappers: demoCase → grievance row ───────────────────────────────────────
type GrievanceType =
  | 'individual'
  | 'group'
  | 'policy'
  | 'contract'
  | 'harassment'
  | 'discrimination'
  | 'safety'
  | 'seniority'
  | 'discipline'
  | 'termination'
  | 'other';

type GrievanceStatus =
  | 'draft'
  | 'filed'
  | 'acknowledged'
  | 'investigating'
  | 'response_due'
  | 'response_received'
  | 'escalated'
  | 'mediation'
  | 'arbitration'
  | 'settled'
  | 'withdrawn'
  | 'denied'
  | 'closed';

type GrievancePriority = 'low' | 'medium' | 'high' | 'urgent';

function mapType(c: DemoCase): GrievanceType {
  const t = c.type.toLowerCase();
  if (c.caseworkStream === 'health-safety') return 'safety';
  if (c.caseworkStream === 'accommodation') return 'individual';
  if (t.includes('seniority')) return 'seniority';
  if (t.includes('discipline')) return 'discipline';
  if (t.includes('workload') || c.worker.toLowerCase().includes('multiple')) return 'group';
  return 'individual';
}

function mapStatus(c: DemoCase): GrievanceStatus {
  const s = c.status.toLowerCase();
  if (s.includes('escalat')) return 'escalated';
  if (s.includes('follow-up due') || s.includes('response')) return 'response_due';
  if (s.includes('meeting') || s.includes('ready')) return 'acknowledged';
  if (s.includes('intake')) return 'draft';
  if (s.includes('review') || s.includes('investigat')) return 'investigating';
  if (s.includes('closed')) return 'closed';
  return 'filed';
}

function mapPriority(c: DemoCase): GrievancePriority {
  if (c.urgency === 'urgent') return 'urgent';
  if (c.urgency === 'watch') return 'high';
  return 'medium';
}

function mapTimeline(c: DemoCase) {
  return c.timeline.map((entry) => ({
    date: entry.timestamp,
    action: entry.action,
    actor: entry.actor,
    notes: entry.notes,
    // Preserve demo-specific extras as additional fields (jsonb accepts anything)
    attachments: entry.attachments,
    followUp: entry.followUp,
    entryId: entry.id,
  }));
}

function mapAttachments(c: DemoCase) {
  return c.attachments.map((name, idx) => ({
    id: `${c.id}-att-${idx + 1}`,
    name,
    url: `demo://attachments/${c.id}/${encodeURIComponent(name)}`,
    type: name.split('.').pop()?.toUpperCase() ?? 'PDF',
    uploadedAt: c.opened,
  }));
}

// Demo-rich fields we want to preserve but that don't have a grievance column
// go into `attachments` JSONB sentinel entries with a synthetic `_demoMeta` flag,
// OR we serialize them into the timeline. To keep the round-trip clean we'll
// store a single `_demoMeta` attachment object alongside real attachments.
function demoMetaAttachment(c: DemoCase) {
  return {
    id: `${c.id}-demo-meta`,
    name: '_demo-meta.json',
    url: 'demo://meta',
    type: 'JSON',
    uploadedAt: c.opened,
    _demoMeta: {
      caseworkStream: c.caseworkStream,
      worker: c.worker,
      unit: c.unit,
      location: c.location,
      assignedSteward: c.assignedSteward,
      urgencyLabel: c.urgency,
      statusLabel: c.status,
      agreementRefs: c.agreementRefs,
      continuityState: c.continuityState,
      nextStep: c.nextStep,
      relatedCases: c.relatedCases,
      flags: c.flags,
      notes: c.notes,
    },
  } as const;
}

// ── Seeding ─────────────────────────────────────────────────────────────────
async function seedEntities() {
  console.log('[seed] entities');
  await db.execute(sql`
    INSERT INTO entities (id, legal_name, jurisdiction, status, created_at, updated_at)
    VALUES
      (${ENTITY_LOCAL_ID}::uuid,
       ${'CUPE Local 4373 — Healthcare'}::text,
       ${'CA-ON'}::varchar,
       'active'::entity_status,
       now(), now()),
      (${ENTITY_EMPLOYER_ID}::uuid,
       ${'Grand River Hospital'}::text,
       ${'CA-ON'}::varchar,
       'active'::entity_status,
       now(), now())
    ON CONFLICT (id) DO UPDATE
      SET legal_name = EXCLUDED.legal_name,
          updated_at = now();
  `);
}

async function seedOrgsExecutiveLayer() {
  // `orgs` is the executive-layer table (FK target for executive_decisions,
  // execution_initiatives, treasury_snapshots, etc.). It runs in parallel
  // with `organizations` (the union-structure table). We use the SAME UUID
  // so a single foundation organization spans both layers.
  console.log('[seed] orgs (executive layer)');
  await db.execute(sql`
    INSERT INTO orgs (id, legal_name, jurisdiction, fiscal_year_end, policy_config, status, created_at, updated_at)
    VALUES (
      ${ORG_ID}::uuid,
      ${'Canadian Union of Public Employees Local 4373'}::text,
      ${'CA-ON'}::varchar,
      ${'12-31'}::varchar,
      ${'{"foundationProfile":"cupe4373-healthcare"}'}::jsonb,
      'active'::org_status,
      now(), now()
    )
    ON CONFLICT (id) DO UPDATE
      SET legal_name = EXCLUDED.legal_name,
          policy_config = EXCLUDED.policy_config,
          updated_at = now();
  `);
}

async function seedOrganization() {
  console.log('[seed] organizations');
  await db.execute(sql`
    INSERT INTO organizations (
      id, name, slug, display_name, short_name, description,
      organization_type, hierarchy_path, hierarchy_level,
      province_territory, sectors,
      email, phone, website,
      clc_affiliated, charter_number,
      status, settings, features_enabled,
      created_at, updated_at
    )
    VALUES (
      ${ORG_ID}::uuid,
      ${'Canadian Union of Public Employees Local 4373'}::text,
      ${'cupe-local-4373'}::text,
      ${'CUPE Local 4373'}::text,
      ${'CUPE 4373'}::text,
      ${'Healthcare local representing RPNs, PSWs, clerical, portering, food services, environmental services at Grand River Hospital.'}::text,
      'local'::organization_type,
      ARRAY['cupe-canada','cupe-ontario','cupe-local-4373']::text[],
      2,
      ${'ON'}::text,
      ARRAY['healthcare']::labour_sector[],
      ${'office@cupe4373.ca'}::text,
      ${'+1-519-555-0143'}::text,
      ${'https://cupe4373.example'}::text,
      true,
      ${'4373'}::text,
      ${'active'}::text,
      ${'{"foundationProfile":"cupe4373-healthcare"}'}::jsonb,
      ARRAY['cases','grievances','members','governance','communications']::text[],
      now(), now()
    )
    ON CONFLICT (slug) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          description = EXCLUDED.description,
          settings = EXCLUDED.settings,
          features_enabled = EXCLUDED.features_enabled,
          updated_at = now();
  `);
}

async function seedMembers() {
  console.log('[seed] organization_members (3 roles)');
  const rows: Array<{
    user_id: string;
    name: string;
    email: string;
    role: string;
    position: string;
    membership_number: string;
  }> = [
    {
      user_id: MEMBER_USER_ID,
      name: 'Maya Bertrand',
      email: 'maya.b@cupe4373.example',
      role: 'member',
      position: 'Registered Practical Nurse',
      membership_number: 'M-4373-1042',
    },
    {
      user_id: STEWARD_USER_ID,
      name: 'Denise Laurent',
      email: 'denise.laurent@cupe4373.example',
      role: 'steward',
      position: 'Chief Steward — 7 West',
      membership_number: 'M-4373-0118',
    },
    {
      user_id: OFFICER_USER_ID,
      name: 'Aubert N.',
      email: 'officer@cupe4373.example',
      role: 'officer',
      position: 'Local President',
      membership_number: 'M-4373-0001',
    },
  ];

  for (const row of rows) {
    await db.execute(sql`
      INSERT INTO organization_members (
        user_id, organization_id, name, email, role, status,
        is_primary, position, membership_number,
        created_at, joined_at, updated_at
      )
      VALUES (
        ${row.user_id}::text,
        ${ORG_ID}::text,
        ${row.name}::text,
        ${row.email}::text,
        ${row.role}::text,
        'active'::text,
        true,
        ${row.position}::text,
        ${row.membership_number}::text,
        now(), now(), now()
      )
      ON CONFLICT DO NOTHING;
    `);
    // ON CONFLICT DO NOTHING is safe because organization_members has no
    // (user_id, organization_id) unique constraint — re-running may insert
    // dupes. Guard with a delete-then-insert keyed by user_id below.
  }

  // Idempotency guard: keep only the latest row per (user_id, organization_id)
  await db.execute(sql`
    DELETE FROM organization_members om
    USING organization_members om2
    WHERE om.organization_id = ${ORG_ID}::text
      AND om.user_id = om2.user_id
      AND om.organization_id = om2.organization_id
      AND om.created_at < om2.created_at;
  `);
}

async function seedGrievances() {
  console.log(`[seed] grievances (${demoCases.length})`);
  for (const c of demoCases) {
    const id = grievanceUuid(c.id);
    const attachments = [demoMetaAttachment(c), ...mapAttachments(c)];

    await db.execute(sql`
      INSERT INTO grievances (
        id, grievance_number, type, status, priority, step,
        grievant_name, grievant_email,
        employer_id, employer_name, workplace_name,
        cba_article,
        title, description, background, desired_outcome,
        incident_date, filed_date, response_deadline,
        timeline, attachments,
        is_group_grievance, is_confidential,
        organization_id,
        created_at, updated_at
      )
      VALUES (
        ${id}::uuid,
        ${c.id}::varchar,
        ${mapType(c)}::grievance_type,
        ${mapStatus(c)}::grievance_status,
        ${mapPriority(c)}::grievance_priority,
        'step_1'::grievance_step,
        ${c.worker}::varchar,
        ${'member@cupe4373.example'}::varchar,
        ${ENTITY_EMPLOYER_ID}::uuid,
        ${'Grand River Hospital'}::varchar,
        ${c.location}::varchar,
        ${c.agreementRefs[0] ?? null},
        ${c.title}::varchar,
        ${c.summary}::text,
        ${c.continuityState}::text,
        ${c.desiredOutcome}::text,
        ${new Date(c.opened).toISOString()}::timestamptz,
        ${new Date(c.opened).toISOString()}::timestamptz,
        ${new Date(c.deadline).toISOString()}::timestamptz,
        ${JSON.stringify(mapTimeline(c))}::jsonb,
        ${JSON.stringify(attachments)}::jsonb,
        ${c.worker.toLowerCase().includes('multiple')}::boolean,
        ${c.flags.some((f) => /confidential|sensitive/i.test(f))}::boolean,
        ${ORG_ID}::uuid,
        ${new Date(c.opened).toISOString()}::timestamptz,
        ${new Date(c.updated).toISOString()}::timestamptz
      )
      ON CONFLICT (grievance_number) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        background = EXCLUDED.background,
        desired_outcome = EXCLUDED.desired_outcome,
        type = EXCLUDED.type,
        status = EXCLUDED.status,
        priority = EXCLUDED.priority,
        response_deadline = EXCLUDED.response_deadline,
        timeline = EXCLUDED.timeline,
        attachments = EXCLUDED.attachments,
        is_group_grievance = EXCLUDED.is_group_grievance,
        is_confidential = EXCLUDED.is_confidential,
        updated_at = EXCLUDED.updated_at;
    `);
  }
}

async function seedRoutingCases() {
  console.log('[seed] ue_cases routing rows');
  // Clear demo routing rows for this entity, then re-insert one per grievance.
  await db.execute(sql`
    DELETE FROM ue_cases WHERE entity_id = ${ENTITY_LOCAL_ID}::uuid;
  `);
  for (const c of demoCases) {
    const status = mapStatus(c);
    const priority = mapPriority(c);
    await db.execute(sql`
      INSERT INTO ue_cases (
        entity_id, category, channel, status, assigned_queue, priority,
        sla_breached, reopen_count, message_count, attachment_count,
        created_at, updated_at
      )
      VALUES (
        ${ENTITY_LOCAL_ID}::uuid,
        ${c.caseworkStream}::text,
        ${'web'}::text,
        ${status}::text,
        ${c.assignedSteward}::text,
        ${priority}::text,
        ${new Date(c.deadline).getTime() < Date.now()}::boolean,
        0,
        ${c.timeline.length}::integer,
        ${c.attachments.length}::integer,
        ${new Date(c.opened).toISOString()}::timestamptz,
        ${new Date(c.updated).toISOString()}::timestamptz
      );
    `);
  }
}

async function main() {
  console.log('[seed] CUPE 4373 foundation demo seed starting');
  console.log('[seed] DATABASE_URL host:', new URL(process.env.DATABASE_URL!).host);
  try {
    await seedEntities();
    await seedOrgsExecutiveLayer();
    await seedOrganization();
    await seedMembers();
    await seedGrievances();
    await seedRoutingCases();
    console.log('[seed] OK');
  } catch (err) {
    const cause = (err as { cause?: unknown })?.cause;
    console.error('[seed] FAILED:', err);
    if (cause) console.error('[seed] cause:', cause);
    process.exitCode = 1;
  } finally {
    await client.end({ timeout: 5 });
  }
}

void main();
