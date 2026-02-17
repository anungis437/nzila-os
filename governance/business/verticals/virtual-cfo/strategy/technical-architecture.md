# Virtual-CFO — Technical Architecture

> System architecture for Insight CFO — Supabase-powered financial analytics platform for SMBs and CPA firms.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                            │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │ SMB App  │  │ CPA Portal   │  │ Mobile (Future)    │    │
│  │ (React)  │  │ (React)      │  │ (React Native)     │    │
│  └────┬─────┘  └──────┬───────┘  └────────┬───────────┘    │
└───────┼───────────────┼────────────────────┼────────────────┘
        │               │                    │
┌───────┼───────────────┼────────────────────┼────────────────┐
│       ▼               ▼                    ▼                │
│  ┌─────────────────────────────────────────────┐            │
│  │         Supabase API Gateway (PostgREST)    │            │
│  │         + Edge Functions (Deno)              │            │
│  └──────────────────┬──────────────────────────┘            │
│                     │                                       │
│  ┌──────────────────┼──────────────────────────┐            │
│  │           CORE SERVICES LAYER               │            │
│  │  ┌────────────┐ ┌────────────┐ ┌──────────┐ │           │
│  │  │ Financial  │ │ Advisory   │ │ Tax      │ │           │
│  │  │ Engine     │ │ Engine     │ │ Engine   │ │           │
│  │  └────────────┘ └────────────┘ └──────────┘ │           │
│  │  ┌────────────┐ ┌────────────┐ ┌──────────┐ │           │
│  │  │ Forecast   │ │ Report     │ │ Sync     │ │           │
│  │  │ Engine     │ │ Generator  │ │ Engine   │ │           │
│  │  └────────────┘ └────────────┘ └──────────┘ │           │
│  └──────────────────┬──────────────────────────┘            │
│                     │                                       │
│  ┌──────────────────▼──────────────────────────┐            │
│  │         PostgreSQL (Supabase Managed)        │            │
│  │         30 Tables + RLS Policies             │            │
│  └──────────────────┬──────────────────────────┘            │
│                SUPABASE PLATFORM                            │
└───────────────────────────────────────────────────────────── ┘
        │               │                    │
┌───────┼───────────────┼────────────────────┼────────────────┐
│       ▼               ▼                    ▼                │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │ QBO API  │  │ Xero API     │  │ Wave/Sage APIs     │    │
│  │ (OAuth2) │  │ (OAuth2)     │  │ (Future)           │    │
│  └──────────┘  └──────────────┘  └────────────────────┘    │
│              ACCOUNTING PLATFORM INTEGRATIONS               │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Architecture

### Core Schema (30 Tables)

#### Organization & Users
```sql
-- Multi-tenant with RLS
organizations (
  id UUID PK,
  name TEXT,
  industry TEXT,           -- For benchmarking
  province TEXT,           -- Tax jurisdiction
  fiscal_year_end DATE,
  currency TEXT DEFAULT 'CAD',
  qbo_realm_id TEXT,       -- QuickBooks connection
  xero_tenant_id TEXT,     -- Xero connection
  created_at TIMESTAMPTZ
)

users (
  id UUID PK REFERENCES auth.users,
  organization_id UUID FK,
  role TEXT CHECK (role IN ('owner', 'admin', 'viewer', 'cpa')),
  email TEXT UNIQUE
)

-- CPA multi-client support
cpa_firms (
  id UUID PK,
  name TEXT,
  cpa_number TEXT,
  province TEXT
)

cpa_client_links (
  cpa_firm_id UUID FK,
  organization_id UUID FK,
  access_level TEXT DEFAULT 'read',
  PRIMARY KEY (cpa_firm_id, organization_id)
)
```

#### Financial Data
```sql
accounts (
  id UUID PK,
  organization_id UUID FK,
  name TEXT,
  account_type TEXT,      -- asset, liability, equity, revenue, expense
  account_number TEXT,
  parent_id UUID FK,      -- Chart of accounts hierarchy
  external_id TEXT,       -- QBO/Xero account ID
  is_active BOOLEAN DEFAULT true
)

transactions (
  id UUID PK,
  organization_id UUID FK,
  date DATE,
  description TEXT,
  amount NUMERIC(15,2),
  account_id UUID FK,
  category TEXT,
  vendor_id UUID FK,
  external_id TEXT,
  sync_source TEXT,       -- 'qbo', 'xero', 'csv', 'manual'
  created_at TIMESTAMPTZ
)

journal_entries (
  id UUID PK,
  organization_id UUID FK,
  date DATE,
  memo TEXT,
  is_adjusting BOOLEAN DEFAULT false
)

journal_lines (
  id UUID PK,
  journal_entry_id UUID FK,
  account_id UUID FK,
  debit NUMERIC(15,2),
  credit NUMERIC(15,2)
)

vendors (id, organization_id, name, category, total_spend_ytd)
customers (id, organization_id, name, revenue_ytd, outstanding_balance)
invoices (id, organization_id, customer_id, amount, date, due_date, status)
bills (id, organization_id, vendor_id, amount, date, due_date, status)
```

#### Analytics & Intelligence
```sql
financial_snapshots (
  id UUID PK,
  organization_id UUID FK,
  period_start DATE,
  period_end DATE,
  revenue NUMERIC, expenses NUMERIC, net_income NUMERIC,
  total_assets NUMERIC, total_liabilities NUMERIC, equity NUMERIC,
  cash_balance NUMERIC, ar_balance NUMERIC, ap_balance NUMERIC,
  created_at TIMESTAMPTZ
)

kpi_metrics (
  id UUID PK,
  organization_id UUID FK,
  period DATE,
  metric_name TEXT,       -- gross_margin, current_ratio, dso, dpo, burn_rate, etc.
  value NUMERIC,
  benchmark_value NUMERIC -- Industry comparison
)

forecasts (
  id UUID PK,
  organization_id UUID FK,
  forecast_date DATE,
  horizon_days INTEGER,   -- 30, 60, 90
  predicted_cash NUMERIC,
  predicted_revenue NUMERIC,
  confidence NUMERIC,
  model_version TEXT
)

advisory_insights (
  id UUID PK,
  organization_id UUID FK,
  insight_type TEXT,      -- 'cash_warning', 'growth_opp', 'cost_saving', 'tax_prep'
  title TEXT,
  description TEXT,
  severity TEXT,          -- 'info', 'warning', 'critical'
  is_dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ
)

budgets (id, organization_id, name, period_start, period_end)
budget_lines (id, budget_id, account_id, planned_amount)
```

#### Tax & Compliance
```sql
tax_events (
  id UUID PK,
  organization_id UUID FK,
  tax_type TEXT,          -- 'gst_hst', 'payroll', 'corporate_t2', 'pst'
  due_date DATE,
  estimated_amount NUMERIC,
  status TEXT,            -- 'upcoming', 'ready', 'filed', 'overdue'
  notes TEXT
)

tax_filings (
  id UUID PK,
  organization_id UUID FK,
  filing_type TEXT,
  period TEXT,
  filed_date DATE,
  amount_remitted NUMERIC,
  confirmation_number TEXT
)

documents (
  id UUID PK,
  organization_id UUID FK,
  name TEXT,
  file_path TEXT,         -- Supabase Storage path
  document_type TEXT,     -- 'receipt', 'invoice', 'statement', 'tax_form'
  uploaded_at TIMESTAMPTZ
)
```

#### Reporting
```sql
reports (
  id UUID PK,
  organization_id UUID FK,
  report_type TEXT,       -- 'monthly_cfo', 'tax_prep', 'board_deck', 'custom'
  title TEXT,
  content JSONB,
  generated_at TIMESTAMPTZ
)

report_schedules (
  id UUID PK,
  organization_id UUID FK,
  report_type TEXT,
  frequency TEXT,         -- 'monthly', 'quarterly', 'annually'
  recipients TEXT[],
  next_run TIMESTAMPTZ
)
```

### Row-Level Security
```sql
-- Organization isolation (every table)
CREATE POLICY "org_isolation" ON transactions
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
    UNION
    SELECT organization_id FROM cpa_client_links
    WHERE cpa_firm_id IN (
      SELECT cpa_firm_id FROM cpa_firm_users WHERE user_id = auth.uid()
    )
  ));
```

---

## Core Service Architecture

### Financial Engine
- **Transaction sync**: Pull from QBO/Xero API on schedule (hourly) or on-demand
- **Categorization**: Auto-categorize based on account mapping + ML suggestions
- **Reconciliation**: Match imported transactions to existing records
- **Financial statements**: Generate P&L, balance sheet, cash flow from transaction data
- **Period close**: Lock periods, generate snapshots, calculate KPIs

### Forecast Engine
- **Cash flow model**: Time-series analysis on historical cash flows
- **Revenue forecast**: Trend + seasonality decomposition
- **Expense prediction**: Category-level forecasting with anomaly flags
- **Scenario engine**: What-if parameter changes → re-forecast
- **Accuracy tracking**: Compare predictions to actuals, retrain weekly

### Advisory Engine
- **Rule-based alerts**: Cash below threshold, DSO exceeding benchmark, margin decline
- **Pattern detection**: Month-over-month trend analysis, seasonal patterns
- **Benchmark comparison**: Industry + size-matched peer metrics (Statistics Canada data)
- **Narrative generation**: Convert data points to plain-English insights
- **Priority scoring**: Rank insights by financial impact and urgency

### Tax Engine
- **Calendar management**: Provincial + federal deadline tracking
- **Liability estimation**: Real-time estimated GST/HST, payroll remittance, T2
- **Checklist generation**: Year-end closing checklist, T2 preparation documents
- **CRA integration** (future): Read-only access to My Business Account

---

## Integration Architecture

### QuickBooks Online (Primary)
```
OAuth 2.0 Flow:
User → Supabase Edge Function → QBO Authorization → Callback → Store tokens

Data Sync:
QBO API → Edge Function (transform) → PostgreSQL tables
- Chart of Accounts → accounts
- Transactions (Purchase, Sale, Journal) → transactions
- Invoices → invoices
- Bills → bills  
- Customers → customers
- Vendors → vendors

Sync Strategy:
- Initial: Full sync (last 24 months)
- Ongoing: CDC (Change Data Capture) via QBO webhooks
- Fallback: Polling every 60 minutes
```

### Data Pipeline
```
Source → Extract → Transform → Load → Compute → Present

QBO/Xero → Edge Function → Normalize Schema → PostgreSQL → 
  ┌→ Financial Snapshots (nightly)
  ├→ KPI Calculations (nightly)
  ├→ Forecast Models (weekly)
  ├→ Advisory Insights (real-time rules)
  └→ Tax Estimates (on transaction insert)
```

---

## Infrastructure

### Supabase Platform
| Component | Purpose | Tier |
|---|---|---|
| **PostgreSQL** | Relational data, 30 tables | Pro ($25/mo) |
| **Auth** | User authentication + RBAC | Included |
| **Storage** | Receipt/document uploads | 100GB included |
| **Edge Functions** | API endpoints, sync jobs, computations | 2M invocations/mo |
| **Realtime** | Live dashboard updates | Included |

### Estimated Infrastructure Costs
| Phase | Users | Monthly Cost | Per-User Cost |
|---|---|---|---|
| MVP (2025) | 40 | $50 | $1.25 |
| Growth (2026) | 500 | $200 | $0.40 |
| Scale (2027) | 1,500 | $500 | $0.33 |
| Mature (2028) | 3,000 | $1,000 | $0.33 |

### Monitoring & Observability
- **Supabase Dashboard**: Database performance, API latency, auth events
- **Custom metrics**: Sync success rate, forecast accuracy, insight engagement
- **Alerts**: Sync failures, RLS violations, storage limits, slow queries
- **Error tracking**: Sentry for Edge Function errors

### Security Architecture
- Supabase RLS on every table (zero-trust data access)
- OAuth 2.0 for accounting platform connections (no password storage)
- Encrypted tokens at rest (Supabase Vault)
- TLS 1.3 for all data in transit
- SOC 2 Type II (Supabase platform-level — inherited)
- Canadian data residency (Supabase region: ca-central-1 or us-east-1 with data processing agreement)
