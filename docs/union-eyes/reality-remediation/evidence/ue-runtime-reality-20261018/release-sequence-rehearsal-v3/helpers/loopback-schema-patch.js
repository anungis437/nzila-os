// Loopback-only synthetic patch for the rehearsal: creates the deadline_reassignment_convergence table, the ONLY schema
// prerequisite of the candidate worker that is not delivered by a candidate migration (it needs its own security-scope
// migration: table + RLS + system-only grants). Nothing else is patched; grievance_deadlines.due_date/status now come from the
// candidate Django migrations.
const { Client } = require('pg');
const env = (k) => { const v = process.env[k]; if (!v) throw new Error('missing env ' + k); return v; };
(async () => {
  const c = new Client({ host: '127.0.0.1', port: Number(env('REHEARSAL_PG_PORT')), user: 'ue_admin', password: env('REHEARSAL_PW_ADMIN'), database: process.argv[2] }); await c.connect();
  await c.query(`create table if not exists deadline_reassignment_convergence (id uuid primary key default gen_random_uuid(), organization_id uuid not null, grievance_id uuid not null, previous_assignee_id varchar(255), new_assignee_id varchar(255) not null, status text not null default 'pending' check (status in ('pending','converged')), attempt_count integer not null default 0, last_error text, correlation_id text not null, requested_at timestamptz not null default now(), last_attempted_at timestamptz, converged_at timestamptz, updated_at timestamptz not null default now())`);
  const hasHelper = (await c.query("select to_regproc('ue_create_direct_org_rls_policy') as p")).rows[0].p;
  if (hasHelper) await c.query(`select ue_create_direct_org_rls_policy('deadline_reassignment_convergence','organization_id',false)`);
  else await c.query(`alter table deadline_reassignment_convergence enable row level security; create policy ue_system_full_access on deadline_reassignment_convergence for all to union_eyes_system using (true) with check (true)`); // pre-0010 legacy pre-state has no helper
  await c.query(`grant select, insert, update on deadline_reassignment_convergence to union_eyes_system`);
  await c.end(); console.log('patched ' + process.argv[2]);
})().catch((e) => { console.error('FAIL ' + e.message); process.exit(1); });