-- Flow Domain Tables Migration
-- Creates Flow-specific enums and tables required by the Flow app.
-- These tables reference commerce_* and orgs tables that must already exist.
-- Run after the commerce migration and initial schema are in place.

-- ── Flow Enums ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE flow_production_job_status AS ENUM (
    'pending_proof', 'proof_sent', 'proof_approved', 'in_production',
    'quality_check', 'ready_to_ship', 'completed', 'blocked'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE flow_shipment_status AS ENUM (
    'pending', 'packed', 'shipped', 'in_transit',
    'delivered', 'failed', 'returned'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE flow_payment_status AS ENUM (
    'not_required', 'pending_deposit', 'partially_paid', 'paid',
    'overdue', 'failed', 'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE flow_quote_status AS ENUM (
    'draft', 'internal_review', 'sent_to_client', 'revision_requested',
    'accepted', 'rejected', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE flow_order_status AS ENUM (
    'created', 'confirmed', 'deposit_required', 'payment_partial',
    'payment_complete', 'ready_for_procurement', 'in_production',
    'ready_to_ship', 'shipped', 'delivered', 'closed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE flow_purchase_order_status AS ENUM (
    'draft', 'sent', 'confirmed', 'in_production',
    'shipped', 'received', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE flow_invoice_status AS ENUM (
    'draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE flow_event_type AS ENUM (
    'quote_created', 'quote_sent', 'quote_accepted', 'quote_revision_requested',
    'order_created', 'deposit_required', 'payment_received',
    'po_created', 'po_sent', 'po_confirmed',
    'production_started', 'production_completed',
    'shipment_created', 'order_delivered'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Flow Tables ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS flow_domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_type flow_event_type NOT NULL,
  actor_id text,
  payload_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flow_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  order_id uuid NOT NULL REFERENCES commerce_orders(id),
  customer_id uuid REFERENCES commerce_customers(id),
  status flow_payment_status NOT NULL DEFAULT 'pending_deposit',
  provider text,
  provider_ref text,
  amount_due numeric(18,2) NOT NULL,
  amount_paid numeric(18,2) NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'CAD',
  deposit_required boolean NOT NULL DEFAULT false,
  deposit_percent numeric(5,2),
  due_before_production boolean NOT NULL DEFAULT false,
  recorded_at timestamptz,
  confirmed_at timestamptz,
  metadata_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flow_production_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  order_id uuid NOT NULL REFERENCES commerce_orders(id),
  purchase_order_id uuid REFERENCES commerce_purchase_orders(id),
  status flow_production_job_status NOT NULL DEFAULT 'pending_proof',
  assigned_vendor_id uuid REFERENCES commerce_suppliers(id),
  proof_required boolean NOT NULL DEFAULT false,
  proof_sent_at timestamptz,
  proof_approved_at timestamptz,
  production_started_at timestamptz,
  quality_checked_at timestamptz,
  blocked_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flow_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  order_id uuid NOT NULL REFERENCES commerce_orders(id),
  production_job_id uuid REFERENCES flow_production_jobs(id),
  status flow_shipment_status NOT NULL DEFAULT 'pending',
  carrier text,
  tracking_number text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  shipping_address_json jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flow_vendor_product_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  vendor_id uuid NOT NULL REFERENCES commerce_suppliers(id),
  product_id uuid NOT NULL REFERENCES commerce_products(id),
  vendor_sku text,
  vendor_cost numeric(18,2),
  lead_time_days integer,
  preference_rank integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS flow_domain_events_org_id_idx ON flow_domain_events(org_id);
CREATE INDEX IF NOT EXISTS flow_domain_events_entity_idx ON flow_domain_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS flow_domain_events_event_type_idx ON flow_domain_events(event_type);
CREATE INDEX IF NOT EXISTS flow_domain_events_created_at_idx ON flow_domain_events(created_at);

CREATE INDEX IF NOT EXISTS flow_payments_org_id_idx ON flow_payments(org_id);
CREATE INDEX IF NOT EXISTS flow_payments_order_id_idx ON flow_payments(order_id);
CREATE INDEX IF NOT EXISTS flow_payments_status_idx ON flow_payments(status);
CREATE INDEX IF NOT EXISTS flow_payments_provider_ref_idx ON flow_payments(provider_ref);

CREATE INDEX IF NOT EXISTS flow_production_jobs_org_id_idx ON flow_production_jobs(org_id);
CREATE INDEX IF NOT EXISTS flow_production_jobs_order_id_idx ON flow_production_jobs(order_id);
CREATE INDEX IF NOT EXISTS flow_production_jobs_status_idx ON flow_production_jobs(status);

CREATE INDEX IF NOT EXISTS flow_shipments_org_id_idx ON flow_shipments(org_id);
CREATE INDEX IF NOT EXISTS flow_shipments_order_id_idx ON flow_shipments(order_id);
CREATE INDEX IF NOT EXISTS flow_shipments_status_idx ON flow_shipments(status);
CREATE INDEX IF NOT EXISTS flow_shipments_tracking_number_idx ON flow_shipments(tracking_number);

CREATE INDEX IF NOT EXISTS flow_vendor_product_links_org_id_idx ON flow_vendor_product_links(org_id);
CREATE INDEX IF NOT EXISTS flow_vendor_product_links_vendor_id_idx ON flow_vendor_product_links(vendor_id);
CREATE INDEX IF NOT EXISTS flow_vendor_product_links_product_id_idx ON flow_vendor_product_links(product_id);
