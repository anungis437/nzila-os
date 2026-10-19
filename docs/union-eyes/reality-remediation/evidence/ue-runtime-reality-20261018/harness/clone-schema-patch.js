// CLONE-ONLY synthetic schema patch used to exercise the worker's claim/lease primitives once the missing
// schema exists. NOT applied to staging. Refuses to run unless the host is the disposable restore clone.
const { Client } = require('pg');
(async () => {
  const u = new URL(process.env.AD_URL);
  if (!u.hostname.startsWith('ue-phase3a-restore-')) { console.log('REFUSED: not the restore clone'); process.exit(2); }
  const a = new Client({ connectionString: process.env.AD_URL, ssl: { rejectUnauthorized: false } }); await a.connect();
  await a.query(`create table if not exists deadline_reassignment_convergence (id uuid primary key default gen_random_uuid(), organization_id uuid not null, grievance_id uuid not null, previous_assignee_id varchar(255), new_assignee_id varchar(255) not null, status text not null default 'pending' check (status in ('pending','converged')), attempt_count integer not null default 0, last_error text, correlation_id text not null, requested_at timestamptz not null default now(), last_attempted_at timestamptz, converged_at timestamptz, updated_at timestamptz not null default now())`);
  await a.query(`select ue_create_direct_org_rls_policy('deadline_reassignment_convergence','organization_id',false)`);
  await a.query(`grant select, insert, update on deadline_reassignment_convergence to union_eyes_system`);
  await a.query(`alter table grievance_deadlines add column if not exists due_date timestamptz, add column if not exists status varchar(50) default 'pending'`);
  console.log('clone schema patched'); await a.end();
})().catch(e => { console.log('FATAL ' + e.message); process.exit(1); });
