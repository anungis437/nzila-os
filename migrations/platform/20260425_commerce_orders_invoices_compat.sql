-- Console commerce compatibility: orders + invoices
-- Adds missing commerce order/invoice enums and tables used by finance/CEO pages.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commerce_order_status') THEN
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
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commerce_invoice_status') THEN
    CREATE TYPE commerce_invoice_status AS ENUM (
      'draft',
      'issued',
      'sent',
      'partial_paid',
      'paid',
      'overdue',
      'disputed',
      'resolved',
      'refunded',
      'credit_note',
      'cancelled'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS commerce_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  customer_id UUID NOT NULL REFERENCES commerce_customers(id),
  quote_id UUID REFERENCES commerce_quotes(id),
  ref VARCHAR(30) NOT NULL,
  status commerce_order_status NOT NULL DEFAULT 'created',
  currency VARCHAR(3) NOT NULL DEFAULT 'CAD',
  subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  total NUMERIC(18,2) NOT NULL DEFAULT 0,
  shipping_address JSONB,
  billing_address JSONB,
  notes TEXT,
  order_locked_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  payment_status VARCHAR(30),
  production_status VARCHAR(30),
  fulfillment_status VARCHAR(30),
  margin_actual NUMERIC(18,2),
  confirmed_at TIMESTAMPTZ,
  created_by TEXT NOT NULL DEFAULT 'system_migrated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commerce_orders_org_created_idx
  ON commerce_orders (org_id, created_at);

CREATE INDEX IF NOT EXISTS commerce_orders_org_status_idx
  ON commerce_orders (org_id, status);

CREATE TABLE IF NOT EXISTS commerce_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  order_id UUID NOT NULL REFERENCES commerce_orders(id),
  customer_id UUID NOT NULL REFERENCES commerce_customers(id),
  ref VARCHAR(30) NOT NULL,
  status commerce_invoice_status NOT NULL DEFAULT 'draft',
  currency VARCHAR(3) NOT NULL DEFAULT 'CAD',
  subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  total NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_due NUMERIC(18,2) NOT NULL DEFAULT 0,
  due_date TIMESTAMPTZ,
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'system_migrated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commerce_invoices_org_created_idx
  ON commerce_invoices (org_id, created_at);

CREATE INDEX IF NOT EXISTS commerce_invoices_org_status_idx
  ON commerce_invoices (org_id, status);

CREATE INDEX IF NOT EXISTS commerce_invoices_org_due_idx
  ON commerce_invoices (org_id, due_date);
