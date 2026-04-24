-- =============================================================
-- @nzila/staging-seed — Phase 3A.0 schema (audit log + JSONB store)
-- =============================================================
-- Run ONCE per staging Postgres database. Idempotent.
--
-- These tables are the persistence backbone for the staging-seed
-- framework. They never touch real tenant data: the org_id column on
-- `staging_seed_artifacts` is referenced by reset() through a strict
-- allowlist enforced in code (`isSafeStagingOrgId`).
--
-- Phase 3B (per-app native-table writers) will read from these tables
-- via small adapter scripts; the seeder framework itself only ever
-- writes here.

create extension if not exists "pgcrypto";

create table if not exists staging_seed_runs (
  id              uuid primary key,
  app             text not null,
  profile         text not null,
  seed            integer not null,
  command         text not null check (command in ('seed', 'reseed', 'reset')),
  dry_run         boolean not null default false,
  org_id          text,
  status          text not null default 'in_progress'
                  check (status in ('in_progress', 'ok', 'error', 'dry-run')),
  totals          jsonb not null default '{}'::jsonb,
  error_message   text,
  started_at      timestamptz not null,
  finished_at     timestamptz,
  duration_ms     integer
);

create index if not exists ix_staging_seed_runs_app_started
  on staging_seed_runs (app, started_at desc);

create index if not exists ix_staging_seed_runs_status
  on staging_seed_runs (status);

create table if not exists staging_seed_artifacts (
  id              uuid primary key default gen_random_uuid(),
  app             text not null,
  org_id          text not null,
  entity_type     text not null,
  entity_id       text not null,
  profile         text not null,
  seed            integer not null,
  run_id          uuid not null references staging_seed_runs(id) on delete cascade,
  payload         jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Idempotency key: rerunning the same seed for the same app+org+entity
  -- replaces the row in place via on conflict do update.
  constraint uq_staging_seed_artifacts unique (app, org_id, entity_type, entity_id)
);

create index if not exists ix_staging_seed_artifacts_org
  on staging_seed_artifacts (org_id);

create index if not exists ix_staging_seed_artifacts_app_entity
  on staging_seed_artifacts (app, entity_type);

create index if not exists ix_staging_seed_artifacts_run
  on staging_seed_artifacts (run_id);

-- Defensive: reject any attempt to insert a row whose org_id does not
-- look like a staging id. Belt-and-braces with the application-level
-- `isSafeStagingOrgId` gate.
create or replace function staging_seed_assert_staging_org()
returns trigger language plpgsql as $$
begin
  if new.org_id is null then
    return new;
  end if;
  if new.org_id not like 'org-%' then
    raise exception 'staging_seed_artifacts.org_id "%" must start with "org-"', new.org_id;
  end if;
  if position('staging' in lower(new.org_id)) = 0 then
    raise exception 'staging_seed_artifacts.org_id "%" must contain "staging"', new.org_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_staging_seed_artifacts_safe on staging_seed_artifacts;
create trigger trg_staging_seed_artifacts_safe
  before insert or update on staging_seed_artifacts
  for each row execute function staging_seed_assert_staging_org();
