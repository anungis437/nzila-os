-- Idempotent Zonga revenue schema migration (local recovery)
-- Source of truth: packages/db/src/schema/zonga.ts

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Enum guards needed by creators/assets/releases/revenue
-- ---------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE zonga_creator_status AS ENUM ('pending','active','suspended','deactivated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE zonga_creator_plan AS ENUM ('artist','label','enterprise'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE zonga_subscription_status AS ENUM ('active','past_due','canceled','trialing','incomplete'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE zonga_asset_type AS ENUM ('track','album','video','podcast'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE zonga_asset_status AS ENUM ('draft','processing','review','published','taken_down','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE zonga_release_status AS ENUM ('draft','under_review','scheduled','published','released','held','rejected','archived','withdrawn'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE zonga_revenue_type AS ENUM ('stream','download','tip','subscription_share','ticket_sale','merchandise','sync_license'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Creators (dependency)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zonga_creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id),
  user_id text NOT NULL,
  display_name varchar(255) NOT NULL,
  bio text,
  avatar_url text,
  status zonga_creator_status NOT NULL DEFAULT 'pending',
  plan zonga_creator_plan NOT NULL DEFAULT 'artist',
  stripe_customer_id varchar(255),
  stripe_subscription_id varchar(255),
  subscription_status zonga_subscription_status,
  genre varchar(100),
  country varchar(100),
  payout_currency varchar(3) NOT NULL DEFAULT 'USD',
  verified boolean NOT NULL DEFAULT false,
  legal_name varchar(255),
  city varchar(100),
  payout_status varchar(50),
  verification_status varchar(50),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Asset/release dependencies for revenue events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zonga_content_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  creator_id uuid NOT NULL REFERENCES zonga_creators(id),
  title varchar(255) NOT NULL,
  type zonga_asset_type NOT NULL,
  status zonga_asset_status NOT NULL DEFAULT 'draft',
  description text,
  storage_url text,
  cover_art_url text,
  duration_seconds integer,
  genre varchar(100),
  fingerprint_ref varchar(255),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS zonga_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  creator_id uuid NOT NULL REFERENCES zonga_creators(id),
  title varchar(255) NOT NULL,
  status zonga_release_status NOT NULL DEFAULT 'draft',
  release_date timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  release_type varchar(50),
  description text,
  cover_asset_id uuid,
  moderation_status varchar(50),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Revenue events table used by platform metrics
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zonga_revenue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  creator_id uuid NOT NULL REFERENCES zonga_creators(id),
  asset_id uuid REFERENCES zonga_content_assets(id),
  release_id uuid REFERENCES zonga_releases(id),
  type zonga_revenue_type NOT NULL,
  amount numeric(18,6) NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'USD',
  asset_title varchar(255),
  source varchar(100),
  description text,
  external_ref varchar(255),
  created_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
