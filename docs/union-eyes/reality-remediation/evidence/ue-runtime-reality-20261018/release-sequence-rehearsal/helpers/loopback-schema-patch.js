// Loopback-only: the schema prerequisites the candidate worker needs, which are NOT part of 0015 (synthetic patch).
const { Client } = require('pg');
const env = (k) => { const v = process.env[k]; if (!v) throw new Error('missing env ' + k); return v; };
(async () => {
  const c = new Client({ host: '127.0.0.1', port: Number(env('REHEARSAL_PG_PORT')), user: 'ue_admin', password: env('REHEARSAL_PW_ADMIN'), database: process.argv[2] }); await c.connect();
  await c.query(`create table if not exists deadline_reassignment_convergence (id uuid primary key default gen_random_uuid(), organization_id uuid not null, grievance_id uuid not null, previous_assignee_id varchar(255), new_assignee_id varchar(255) not null, status text not null default 'pending' check (status in ('pending','converged')), attempt_count integer not null default 0, last_error text, correlation_id text not null, requested_at timestamptz not null default now(), last_attempted_at timestamptz, converged_at timestamptz, updated_at timestamptz not null default now())`);
  await c.query(`select ue_create_direct_org_rls_policy('deadline_reassignment_convergence','organization_id',false)`);
  await c.query(`grant select, insert, update on deadline_reassignment_convergence to union_eyes_system`);
  await c.query(`alter table grievance_deadlines add column if not exists due_date timestamptz, add column if not exists status varchar(50) default 'pending'`);
  await c.end(); console.log('patched ' + process.argv[2]);
})().catch((e) => { console.error('FAIL ' + e.message); process.exit(1); });