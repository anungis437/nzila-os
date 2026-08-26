-- ============================================================================
-- Platform Schema Prerequisites — checked-in bootstrap baseline
-- ============================================================================
--
--   Artifact identifier : 0000_platform_schema_prerequisites
--   Owner               : packages/db (platform schema)
--   Runner              : tooling/scripts/apply-platform-migrations.mjs
--   Runner mode         : --bootstrap-apply (empty DB) | --bootstrap-reconcile
--                         (existing DB)
--   Manifest            : packages/db/bootstrap/platform-schema-prerequisites.json
--
-- Purpose
-- -------
-- This file materializes the minimum set of database objects that the
-- incremental migrations under packages/db/drizzle/*.sql assume already
-- exist on a fresh database. Those incremental migrations reference the
-- tables and enums declared here (see "First-dependent migration" column of
-- the manifest for each object) but never create them; historically they
-- were materialized out-of-band by `drizzle-kit push`, which does not
-- produce a checked-in artifact and therefore cannot be replayed
-- deterministically.
--
-- This bootstrap is executed **before** the numbered incremental migration
-- chain. The runner refuses to proceed if this file has not been applied
-- or reconciled.
--
-- Canonical source
-- ----------------
-- Every object below is a faithful projection of its canonical TypeScript
-- definition. The manifest cross-references each object to its schema
-- module and export symbol.
--
--   orgs                       ← packages/db/src/schema/orgs.ts        · orgs
--   org_status enum            ← packages/db/src/schema/orgs.ts        · orgStatusEnum
--   commerce_customers         ← packages/db/src/schema/commerce.ts    · commerceCustomers
--   commerce_orders            ← packages/db/src/schema/commerce.ts    · commerceOrders
--   commerce_order_status enum ← packages/db/src/schema/commerce.ts    · commerceOrderStatusEnum
--   commerce_suppliers         ← packages/db/src/schema/commerce.ts    · commerceSuppliers
--   commerce_supplier_status   ← packages/db/src/schema/commerce.ts    · commerceSupplierStatusEnum
--   commerce_products          ← packages/db/src/schema/commerce.ts    · commerceProducts
--   commerce_product_status    ← packages/db/src/schema/commerce.ts    · commerceProductStatusEnum
--   commerce_purchase_orders   ← packages/db/src/schema/commerce.ts    · commercePurchaseOrders
--   commerce_purchase_order_status ← packages/db/src/schema/commerce.ts · commercePurchaseOrderStatusEnum
--
-- Scope discipline
-- ----------------
-- FK columns that would depend on tables outside the baseline set
-- (e.g. commerce_orders.quote_id → commerce_quotes) are intentionally
-- declared without the REFERENCES clause. Reconciliation permits an
-- existing environment to carry a stricter FK, but a fresh environment
-- installs the minimum viable schema. Subsequent migrations that ship
-- commerce_quotes may add the FK explicitly.
--
-- Idempotency
-- -----------
-- Every statement is guarded by `IF NOT EXISTS` or a `DO $$ … duplicate_object $$`
-- block. Running this file twice against the same database is a no-op.
--
-- History
-- -------
-- Introduced during Phase 0A · Migration Lineage Closure (branch
-- fix/union-eyes-reality-remediation). Diagnosis documented in
-- reports/audits/cupe-national-phase-0/migration-lineage-gap.md.
-- ============================================================================

BEGIN;

-- ── Required extensions (safe if already present) ──────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- ── org_status ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE org_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── commerce_order_status ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE commerce_order_status AS ENUM (
    'created',
    'confirmed',
    'fulfillment',
    'shipped',
    'delivered',
    'completed',
    'cancelled',
    'return_requested',
    'needs_attention'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── commerce_supplier_status ───────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE commerce_supplier_status AS ENUM (
    'active',
    'inactive',
    'pending',
    'blocked'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── commerce_product_status ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE commerce_product_status AS ENUM (
    'active',
    'inactive',
    'discontinued'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── commerce_purchase_order_status ─────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE commerce_purchase_order_status AS ENUM (
    'draft',
    'sent',
    'acknowledged',
    'partial_received',
    'received',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── orgs ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orgs (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id              varchar(255) UNIQUE,
  legal_name                text        NOT NULL,
  jurisdiction              varchar(10) NOT NULL,
  incorporation_number      text,
  registered_office_address jsonb,
  fiscal_year_end           varchar(5),
  policy_config             jsonb       DEFAULT '{}'::jsonb,
  status                    org_status  NOT NULL DEFAULT 'active',
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- ── commerce_customers ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commerce_customers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES orgs(id),
  name       text NOT NULL,
  email      text,
  phone      text,
  company    text,
  address    jsonb,
  notes      text,
  metadata   jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── commerce_orders ────────────────────────────────────────────────────────
-- NOTE: quote_id column is present because canonical schema declares it,
-- but the FK to commerce_quotes is intentionally NOT emitted here.
-- Rationale: commerce_quotes is not part of the baseline set (no numbered
-- migration depends on it). An environment that already carries the FK is
-- accepted by reconciliation as additive-strict.
CREATE TABLE IF NOT EXISTS commerce_orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES orgs(id),
  customer_id         uuid NOT NULL REFERENCES commerce_customers(id),
  quote_id            uuid,
  ref                 varchar(30) NOT NULL,
  status              commerce_order_status NOT NULL DEFAULT 'created',
  currency            varchar(3)  NOT NULL DEFAULT 'CAD',
  subtotal            numeric(18,2) NOT NULL,
  tax_total           numeric(18,2) NOT NULL,
  total               numeric(18,2) NOT NULL,
  shipping_address    jsonb,
  billing_address     jsonb,
  notes               text,
  order_locked_at     timestamptz,
  metadata            jsonb DEFAULT '{}'::jsonb,
  payment_status      varchar(30),
  production_status   varchar(30),
  fulfillment_status  varchar(30),
  margin_actual       numeric(18,2),
  confirmed_at        timestamptz,
  created_by          text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── commerce_suppliers ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commerce_suppliers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id),
  name            text NOT NULL,
  contact_name    text,
  email           text,
  phone           text,
  address         jsonb,
  payment_terms   varchar(30),
  lead_time_days  integer NOT NULL DEFAULT 14,
  rating          numeric(2,1) DEFAULT '0',
  status          commerce_supplier_status NOT NULL DEFAULT 'active',
  zoho_vendor_id  text,
  notes           text,
  tags            jsonb DEFAULT '[]'::jsonb,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── commerce_products ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commerce_products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id),
  sku             varchar(50) NOT NULL,
  name            text NOT NULL,
  name_fr         text,
  description     text,
  description_fr  text,
  category        varchar(50) NOT NULL,
  subcategory     varchar(50),
  base_price      numeric(18,2) NOT NULL,
  cost_price      numeric(18,2) NOT NULL,
  supplier_id     uuid REFERENCES commerce_suppliers(id),
  status          commerce_product_status NOT NULL DEFAULT 'active',
  weight_grams    integer,
  dimensions      text,
  packaging_type  varchar(30),
  image_url       text,
  tags            jsonb DEFAULT '[]'::jsonb,
  customizable    boolean NOT NULL DEFAULT false,
  zoho_item_id    text,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── commerce_purchase_orders ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commerce_purchase_orders (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES orgs(id),
  supplier_id             uuid NOT NULL REFERENCES commerce_suppliers(id),
  order_id                uuid REFERENCES commerce_orders(id),
  ref                     varchar(30) NOT NULL,
  status                  commerce_purchase_order_status NOT NULL DEFAULT 'draft',
  currency                varchar(3)  NOT NULL DEFAULT 'CAD',
  subtotal                numeric(18,2) NOT NULL DEFAULT 0,
  tax_total               numeric(18,2) NOT NULL DEFAULT 0,
  shipping_cost           numeric(18,2) NOT NULL DEFAULT 0,
  total                   numeric(18,2) NOT NULL DEFAULT 0,
  expected_delivery_date  timestamptz,
  actual_delivery_date    timestamptz,
  sent_at                 timestamptz,
  notes                   text,
  zoho_po_id              text,
  metadata                jsonb DEFAULT '{}'::jsonb,
  created_by              text NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMIT;
