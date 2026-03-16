-- =============================================================================
-- CONSOLIDATED INTEGRATION MIGRATION — All Domains
-- Expands all 57 stub tables to full Drizzle schema definitions
-- Safe: uses ADD COLUMN IF NOT EXISTS, CREATE TYPE ... EXCEPTION, CREATE INDEX IF NOT EXISTS
-- =============================================================================

-- =============================================
-- SECTION 1: ENUM TYPES
-- =============================================

DO $$ BEGIN CREATE TYPE integration_type AS ENUM (
  'hris','accounting','insurance','pension','lms','communication',
  'document_management','calendar','social_media','payment'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE integration_provider AS ENUM (
  'workday','bamboohr','adp','ceridian_dayforce','ukg_pro',
  'quickbooks','xero','sage_intacct','freshbooks','wave',
  'sunlife','manulife','blue_cross','green_shield','canada_life',
  'otpp','cpp_qpp','provincial_pension',
  'linkedin_learning','udemy','coursera',
  'slack','microsoft_teams',
  'sharepoint','google_drive','dropbox',
  'custom'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE sync_type AS ENUM ('full','incremental','real_time');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE sync_status AS ENUM (
  'idle','pending','running','in_progress','success','failed','partial','cancelled'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE webhook_status AS ENUM (
  'received','processing','processed','failed','ignored'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE erp_system AS ENUM (
  'quickbooks_online','sage_intacct','xero','sap_business_one',
  'microsoft_dynamics','oracle_netsuite','custom'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE account_type AS ENUM (
  'asset','liability','equity','revenue','expense','contra_asset','contra_liability'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE sync_direction AS ENUM ('push','pull','bidirectional');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE audit_action AS ENUM (
  'create','update','delete','sync','approve','reject','void','reverse'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE clc_sync_status AS ENUM (
  'pending','in_progress','completed','failed','partial','manual_review_required'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE clc_sync_type AS ENUM (
  'full_sync','incremental','remittance','member_update','wage_update','dispute_update'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE clc_webhook_status AS ENUM (
  'pending','processing','processed','failed','retrying','manual_review'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- =============================================
-- SECTION 2: INTEGRATION INFRASTRUCTURE
-- =============================================

-- integration_configs (4 cols → 10)
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS type integration_type;
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS provider integration_provider;
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS credentials JSONB DEFAULT '{}';
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS settings JSONB;
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS webhook_url TEXT;
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

-- integration_sync_log (4 cols → 13)
ALTER TABLE integration_sync_log ADD COLUMN IF NOT EXISTS provider integration_provider;
ALTER TABLE integration_sync_log ADD COLUMN IF NOT EXISTS sync_type sync_type;
ALTER TABLE integration_sync_log ADD COLUMN IF NOT EXISTS orgs TEXT[];
ALTER TABLE integration_sync_log ADD COLUMN IF NOT EXISTS status sync_status;
ALTER TABLE integration_sync_log ADD COLUMN IF NOT EXISTS records_processed INTEGER DEFAULT 0;
ALTER TABLE integration_sync_log ADD COLUMN IF NOT EXISTS records_created INTEGER DEFAULT 0;
ALTER TABLE integration_sync_log ADD COLUMN IF NOT EXISTS records_updated INTEGER DEFAULT 0;
ALTER TABLE integration_sync_log ADD COLUMN IF NOT EXISTS records_failed INTEGER DEFAULT 0;
ALTER TABLE integration_sync_log ADD COLUMN IF NOT EXISTS cursor TEXT;
ALTER TABLE integration_sync_log ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE integration_sync_log ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE integration_sync_log ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- integration_sync_schedules (4 cols → 10)
ALTER TABLE integration_sync_schedules ADD COLUMN IF NOT EXISTS provider integration_provider;
ALTER TABLE integration_sync_schedules ADD COLUMN IF NOT EXISTS sync_type sync_type;
ALTER TABLE integration_sync_schedules ADD COLUMN IF NOT EXISTS orgs TEXT[];
ALTER TABLE integration_sync_schedules ADD COLUMN IF NOT EXISTS schedule TEXT;
ALTER TABLE integration_sync_schedules ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;
ALTER TABLE integration_sync_schedules ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;
ALTER TABLE integration_sync_schedules ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ;

-- webhook_events (4 cols → 10)
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS provider integration_provider;
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}';
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS status webhook_status DEFAULT 'received';
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- integration_api_keys (13 cols — already well-populated, skip)

-- integration_webhooks (4 cols → 14)
ALTER TABLE integration_webhooks ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE integration_webhooks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE integration_webhooks ADD COLUMN IF NOT EXISTS events TEXT[];
ALTER TABLE integration_webhooks ADD COLUMN IF NOT EXISTS secret VARCHAR(255);
ALTER TABLE integration_webhooks ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE integration_webhooks ADD COLUMN IF NOT EXISTS delivery_count INTEGER DEFAULT 0;
ALTER TABLE integration_webhooks ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0;
ALTER TABLE integration_webhooks ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ;
ALTER TABLE integration_webhooks ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ;
ALTER TABLE integration_webhooks ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ;
ALTER TABLE integration_webhooks ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);

-- webhook_deliveries (4 cols → 10)
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS webhook_id UUID;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS event_type VARCHAR(100);
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}';
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS status_code INTEGER;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS response_body TEXT;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS duration INTEGER;


-- =============================================
-- SECTION 3: ERP / FINANCIAL
-- =============================================

-- erp_connectors (4 cols → 15)
ALTER TABLE erp_connectors ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE erp_connectors ADD COLUMN IF NOT EXISTS system_type erp_system;
ALTER TABLE erp_connectors ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE erp_connectors ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;
ALTER TABLE erp_connectors ADD COLUMN IF NOT EXISTS encrypted_credentials TEXT;
ALTER TABLE erp_connectors ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';
ALTER TABLE erp_connectors ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE erp_connectors ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ;
ALTER TABLE erp_connectors ADD COLUMN IF NOT EXISTS last_error_message TEXT;
ALTER TABLE erp_connectors ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE erp_connectors ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
ALTER TABLE erp_connectors ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255);

-- chart_of_accounts (5 cols → 17)
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS connector_id UUID;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS account_number VARCHAR(100);
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS account_name VARCHAR(255);
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS account_type account_type;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS parent_account_id UUID;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS is_header BOOLEAN DEFAULT false;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'CAD';
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS balance DECIMAL(19,4) DEFAULT 0;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS balance_date TIMESTAMPTZ;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS tax_classification VARCHAR(100);
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

-- gl_account_mappings (4 cols → 10)
ALTER TABLE gl_account_mappings ADD COLUMN IF NOT EXISTS connector_id UUID;
ALTER TABLE gl_account_mappings ADD COLUMN IF NOT EXISTS union_eyes_account VARCHAR(255);
ALTER TABLE gl_account_mappings ADD COLUMN IF NOT EXISTS erp_account_id UUID;
ALTER TABLE gl_account_mappings ADD COLUMN IF NOT EXISTS account_type account_type;
ALTER TABLE gl_account_mappings ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE gl_account_mappings ADD COLUMN IF NOT EXISTS auto_sync BOOLEAN DEFAULT true;
ALTER TABLE gl_account_mappings ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
ALTER TABLE gl_account_mappings ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255);

-- journal_entries (12 cols — partially populated, add missing)
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS connector_id UUID;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS entry_number VARCHAR(100);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS entry_date TIMESTAMPTZ;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS posting_date TIMESTAMPTZ;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reference VARCHAR(255);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'CAD';
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS total_debit DECIMAL(19,4);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS total_credit DECIMAL(19,4);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS is_posted BOOLEAN DEFAULT false;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS is_reversed BOOLEAN DEFAULT false;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reversal_entry_id UUID;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

-- journal_entry_lines (9 cols — partially populated, add missing)
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS entry_id UUID;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS line_number INTEGER;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS account_id UUID;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS debit_amount DECIMAL(19,4) DEFAULT 0;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS credit_amount DECIMAL(19,4) DEFAULT 0;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS member_id UUID;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS bargaining_unit_id UUID;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS department_id VARCHAR(255);
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS location_id VARCHAR(255);
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS project_id VARCHAR(255);
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS metadata JSONB;

-- erp_invoices (4 cols → 22)
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS connector_id UUID;
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100);
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS invoice_date TIMESTAMPTZ;
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS customer_id VARCHAR(255);
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS billing_address JSONB;
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS shipping_address JSONB;
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'CAD';
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS subtotal DECIMAL(19,4);
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(19,4) DEFAULT 0;
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS total_amount DECIMAL(19,4);
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(19,4) DEFAULT 0;
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS amount_due DECIMAL(19,4);
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS terms TEXT;
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS memo TEXT;
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE erp_invoices ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

-- bank_accounts (4 cols → 20)
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS connector_id UUID;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255);
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_number VARCHAR(255);
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_type VARCHAR(50);
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'CAD';
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS current_balance DECIMAL(19,4) DEFAULT 0;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS available_balance DECIMAL(19,4) DEFAULT 0;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS gl_account_id UUID;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS bank_feed_provider VARCHAR(50);
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS bank_feed_enabled BOOLEAN DEFAULT false;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS encrypted_bank_credentials TEXT;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS last_sync_date TIMESTAMPTZ;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS metadata JSONB;

-- bank_transactions (4 cols → 15)
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMPTZ;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS posting_date TIMESTAMPTZ;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS amount DECIMAL(19,4);
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS type VARCHAR(10);
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS balance DECIMAL(19,4);
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS reference VARCHAR(255);
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS payee VARCHAR(255);
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS category VARCHAR(255);
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS is_reconciled BOOLEAN DEFAULT false;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS matched_transaction_id UUID;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS metadata JSONB;

-- bank_reconciliations (4 cols → 14)
ALTER TABLE bank_reconciliations ADD COLUMN IF NOT EXISTS bank_account_id UUID;
ALTER TABLE bank_reconciliations ADD COLUMN IF NOT EXISTS statement_date TIMESTAMPTZ;
ALTER TABLE bank_reconciliations ADD COLUMN IF NOT EXISTS statement_balance DECIMAL(19,4);
ALTER TABLE bank_reconciliations ADD COLUMN IF NOT EXISTS gl_balance DECIMAL(19,4);
ALTER TABLE bank_reconciliations ADD COLUMN IF NOT EXISTS difference DECIMAL(19,4);
ALTER TABLE bank_reconciliations ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'in_progress';
ALTER TABLE bank_reconciliations ADD COLUMN IF NOT EXISTS reconciled_by VARCHAR(255);
ALTER TABLE bank_reconciliations ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;
ALTER TABLE bank_reconciliations ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255);
ALTER TABLE bank_reconciliations ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE bank_reconciliations ADD COLUMN IF NOT EXISTS metadata JSONB;

-- sync_jobs (4 cols → 13)
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS connector_id UUID;
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS entity_type VARCHAR(100);
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS direction sync_direction;
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS status sync_status DEFAULT 'pending';
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS records_processed INTEGER DEFAULT 0;
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS records_succeeded INTEGER DEFAULT 0;
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS records_failed INTEGER DEFAULT 0;
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS errors JSONB;
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS metadata JSONB;

-- financial_audit_log (4 cols → 12)
ALTER TABLE financial_audit_log ADD COLUMN IF NOT EXISTS entity_type VARCHAR(100);
ALTER TABLE financial_audit_log ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE financial_audit_log ADD COLUMN IF NOT EXISTS action audit_action;
ALTER TABLE financial_audit_log ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE financial_audit_log ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);
ALTER TABLE financial_audit_log ADD COLUMN IF NOT EXISTS changes JSONB;
ALTER TABLE financial_audit_log ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE financial_audit_log ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE financial_audit_log ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE financial_audit_log ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();

-- currency_exchange_rates (4 cols → 8)
ALTER TABLE currency_exchange_rates ADD COLUMN IF NOT EXISTS base_currency VARCHAR(3);
ALTER TABLE currency_exchange_rates ADD COLUMN IF NOT EXISTS target_currency VARCHAR(3);
ALTER TABLE currency_exchange_rates ADD COLUMN IF NOT EXISTS rate DECIMAL(19,8);
ALTER TABLE currency_exchange_rates ADD COLUMN IF NOT EXISTS effective_date TIMESTAMPTZ;
ALTER TABLE currency_exchange_rates ADD COLUMN IF NOT EXISTS source VARCHAR(100);
ALTER TABLE currency_exchange_rates ADD COLUMN IF NOT EXISTS metadata JSONB;


-- =============================================
-- SECTION 4: CLC DOMAIN
-- =============================================

-- clc_sync_log (4 cols → 25)
ALTER TABLE clc_sync_log ADD COLUMN IF NOT EXISTS sync_type VARCHAR(50);
ALTER TABLE clc_sync_log ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE clc_sync_log ADD COLUMN IF NOT EXISTS direction VARCHAR(20) DEFAULT 'pull';
ALTER TABLE clc_sync_log ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE clc_sync_log ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE clc_sync_log ADD COLUMN IF NOT EXISTS records_processed INTEGER DEFAULT 0;
ALTER TABLE clc_sync_log ADD COLUMN IF NOT EXISTS records_succeeded INTEGER DEFAULT 0;
ALTER TABLE clc_sync_log ADD COLUMN IF NOT EXISTS records_failed INTEGER DEFAULT 0;
ALTER TABLE clc_sync_log ADD COLUMN IF NOT EXISTS records_skipped INTEGER DEFAULT 0;
ALTER TABLE clc_sync_log ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE clc_sync_log ADD COLUMN IF NOT EXISTS error_details JSONB;
ALTER TABLE clc_sync_log ADD COLUMN IF NOT EXISTS data_hash VARCHAR(64);
ALTER TABLE clc_sync_log ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64);
ALTER TABLE clc_sync_log ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
ALTER TABLE clc_sync_log ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE clc_sync_log ADD COLUMN IF NOT EXISTS verified_by VARCHAR(255);
ALTER TABLE clc_sync_log ADD COLUMN IF NOT EXISTS sync_id VARCHAR(255);
ALTER TABLE clc_sync_log ADD COLUMN IF NOT EXISTS trigger_source VARCHAR(50);
ALTER TABLE clc_sync_log ADD COLUMN IF NOT EXISTS metadata JSONB;

-- clc_webhook_log (4 cols → 20)
ALTER TABLE clc_webhook_log ADD COLUMN IF NOT EXISTS webhook_url TEXT;
ALTER TABLE clc_webhook_log ADD COLUMN IF NOT EXISTS webhook_event_type VARCHAR(100);
ALTER TABLE clc_webhook_log ADD COLUMN IF NOT EXISTS external_webhook_id VARCHAR(255);
ALTER TABLE clc_webhook_log ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE clc_webhook_log ADD COLUMN IF NOT EXISTS http_status_code INTEGER;
ALTER TABLE clc_webhook_log ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE clc_webhook_log ADD COLUMN IF NOT EXISTS payload_hash VARCHAR(64);
ALTER TABLE clc_webhook_log ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE clc_webhook_log ADD COLUMN IF NOT EXISTS response_body TEXT;
ALTER TABLE clc_webhook_log ADD COLUMN IF NOT EXISTS response_time INTEGER;
ALTER TABLE clc_webhook_log ADD COLUMN IF NOT EXISTS sync_log_id UUID;
ALTER TABLE clc_webhook_log ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;
ALTER TABLE clc_webhook_log ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMPTZ;
ALTER TABLE clc_webhook_log ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE clc_webhook_log ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE clc_webhook_log ADD COLUMN IF NOT EXISTS requires_manual_review BOOLEAN DEFAULT false;
ALTER TABLE clc_webhook_log ADD COLUMN IF NOT EXISTS error_message TEXT;

-- clc_organization_sync_log (5 cols → 12)
ALTER TABLE clc_organization_sync_log ADD COLUMN IF NOT EXISTS action VARCHAR(50);
ALTER TABLE clc_organization_sync_log ADD COLUMN IF NOT EXISTS changes TEXT;
ALTER TABLE clc_organization_sync_log ADD COLUMN IF NOT EXISTS conflicts JSONB;
ALTER TABLE clc_organization_sync_log ADD COLUMN IF NOT EXISTS duration INTEGER;
ALTER TABLE clc_organization_sync_log ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE clc_organization_sync_log ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE clc_organization_sync_log ADD COLUMN IF NOT EXISTS synced_by VARCHAR(255);

-- clc_chart_of_accounts (4 cols → 14)
ALTER TABLE clc_chart_of_accounts ADD COLUMN IF NOT EXISTS account_name VARCHAR(255);
ALTER TABLE clc_chart_of_accounts ADD COLUMN IF NOT EXISTS account_type VARCHAR(100);
ALTER TABLE clc_chart_of_accounts ADD COLUMN IF NOT EXISTS account_category VARCHAR(100);
ALTER TABLE clc_chart_of_accounts ADD COLUMN IF NOT EXISTS statcan_mapping VARCHAR(100);
ALTER TABLE clc_chart_of_accounts ADD COLUMN IF NOT EXISTS clc_category VARCHAR(100);
ALTER TABLE clc_chart_of_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE clc_chart_of_accounts ADD COLUMN IF NOT EXISTS parent_account_id UUID;
ALTER TABLE clc_chart_of_accounts ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE clc_chart_of_accounts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE clc_chart_of_accounts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE clc_chart_of_accounts ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);

-- clc_per_capita_benchmarks (4 cols → 25)
ALTER TABLE clc_per_capita_benchmarks ADD COLUMN IF NOT EXISTS organization_name VARCHAR(500);
ALTER TABLE clc_per_capita_benchmarks ADD COLUMN IF NOT EXISTS organization_type VARCHAR(100);
ALTER TABLE clc_per_capita_benchmarks ADD COLUMN IF NOT EXISTS fiscal_year INTEGER;
ALTER TABLE clc_per_capita_benchmarks ADD COLUMN IF NOT EXISTS quarter INTEGER;
ALTER TABLE clc_per_capita_benchmarks ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE clc_per_capita_benchmarks ADD COLUMN IF NOT EXISTS period_end DATE;
ALTER TABLE clc_per_capita_benchmarks ADD COLUMN IF NOT EXISTS total_membership INTEGER;
ALTER TABLE clc_per_capita_benchmarks ADD COLUMN IF NOT EXISTS active_membership INTEGER;
ALTER TABLE clc_per_capita_benchmarks ADD COLUMN IF NOT EXISTS per_capita_rate DECIMAL(10,2);
ALTER TABLE clc_per_capita_benchmarks ADD COLUMN IF NOT EXISTS total_remittance DECIMAL(12,2);
ALTER TABLE clc_per_capita_benchmarks ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'CAD';
ALTER TABLE clc_per_capita_benchmarks ADD COLUMN IF NOT EXISTS national_average DECIMAL(10,2);
ALTER TABLE clc_per_capita_benchmarks ADD COLUMN IF NOT EXISTS provincial_average DECIMAL(10,2);
ALTER TABLE clc_per_capita_benchmarks ADD COLUMN IF NOT EXISTS percentile_rank INTEGER;
ALTER TABLE clc_per_capita_benchmarks ADD COLUMN IF NOT EXISTS size_comparison TEXT;
ALTER TABLE clc_per_capita_benchmarks ADD COLUMN IF NOT EXISTS sector_comparison TEXT;
ALTER TABLE clc_per_capita_benchmarks ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE clc_per_capita_benchmarks ADD COLUMN IF NOT EXISTS verification_date TIMESTAMPTZ;
ALTER TABLE clc_per_capita_benchmarks ADD COLUMN IF NOT EXISTS sync_id VARCHAR(255);
ALTER TABLE clc_per_capita_benchmarks ADD COLUMN IF NOT EXISTS source VARCHAR(100);

-- clc_union_density (4 cols → 20)
ALTER TABLE clc_union_density ADD COLUMN IF NOT EXISTS sub_sector VARCHAR(255);
ALTER TABLE clc_union_density ADD COLUMN IF NOT EXISTS industry_code VARCHAR(20);
ALTER TABLE clc_union_density ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(50);
ALTER TABLE clc_union_density ADD COLUMN IF NOT EXISTS region_name VARCHAR(255);
ALTER TABLE clc_union_density ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE clc_union_density ADD COLUMN IF NOT EXISTS month INTEGER;
ALTER TABLE clc_union_density ADD COLUMN IF NOT EXISTS total_workforce INTEGER;
ALTER TABLE clc_union_density ADD COLUMN IF NOT EXISTS union_members INTEGER;
ALTER TABLE clc_union_density ADD COLUMN IF NOT EXISTS union_covered INTEGER;
ALTER TABLE clc_union_density ADD COLUMN IF NOT EXISTS density_percent DECIMAL(5,2);
ALTER TABLE clc_union_density ADD COLUMN IF NOT EXISTS coverage_percent DECIMAL(5,2);
ALTER TABLE clc_union_density ADD COLUMN IF NOT EXISTS year_over_year_change DECIMAL(5,2);
ALTER TABLE clc_union_density ADD COLUMN IF NOT EXISTS month_over_month_change DECIMAL(5,2);
ALTER TABLE clc_union_density ADD COLUMN IF NOT EXISTS national_density DECIMAL(5,2);
ALTER TABLE clc_union_density ADD COLUMN IF NOT EXISTS provincial_density DECIMAL(5,2);

-- clc_bargaining_trends (4 cols → 20)
ALTER TABLE clc_bargaining_trends ADD COLUMN IF NOT EXISTS sub_sector VARCHAR(255);
ALTER TABLE clc_bargaining_trends ADD COLUMN IF NOT EXISTS bargaining_unit_size VARCHAR(50);
ALTER TABLE clc_bargaining_trends ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE clc_bargaining_trends ADD COLUMN IF NOT EXISTS quarter INTEGER;
ALTER TABLE clc_bargaining_trends ADD COLUMN IF NOT EXISTS total_agreements INTEGER DEFAULT 0;
ALTER TABLE clc_bargaining_trends ADD COLUMN IF NOT EXISTS settled INTEGER DEFAULT 0;
ALTER TABLE clc_bargaining_trends ADD COLUMN IF NOT EXISTS unsettled INTEGER DEFAULT 0;
ALTER TABLE clc_bargaining_trends ADD COLUMN IF NOT EXISTS strikes_lockouts INTEGER DEFAULT 0;
ALTER TABLE clc_bargaining_trends ADD COLUMN IF NOT EXISTS avg_wage_increase DECIMAL(5,2);
ALTER TABLE clc_bargaining_trends ADD COLUMN IF NOT EXISTS median_wage_increase DECIMAL(5,2);
ALTER TABLE clc_bargaining_trends ADD COLUMN IF NOT EXISTS wage_increase_range_low DECIMAL(5,2);
ALTER TABLE clc_bargaining_trends ADD COLUMN IF NOT EXISTS wage_increase_range_high DECIMAL(5,2);
ALTER TABLE clc_bargaining_trends ADD COLUMN IF NOT EXISTS average_duration_months DECIMAL(5,1);
ALTER TABLE clc_bargaining_trends ADD COLUMN IF NOT EXISTS cola_settlements INTEGER DEFAULT 0;

-- clc_remittance_mapping (4 cols → 10)
ALTER TABLE clc_remittance_mapping ADD COLUMN IF NOT EXISTS from_organization_id UUID;
ALTER TABLE clc_remittance_mapping ADD COLUMN IF NOT EXISTS to_organization_id UUID;
ALTER TABLE clc_remittance_mapping ADD COLUMN IF NOT EXISTS affiliate_code VARCHAR(50);
ALTER TABLE clc_remittance_mapping ADD COLUMN IF NOT EXISTS mapping_type VARCHAR(50);
ALTER TABLE clc_remittance_mapping ADD COLUMN IF NOT EXISTS gl_account VARCHAR(100);
ALTER TABLE clc_remittance_mapping ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- clc_api_config (4 cols → 12)
ALTER TABLE clc_api_config ADD COLUMN IF NOT EXISTS api_base_url TEXT;
ALTER TABLE clc_api_config ADD COLUMN IF NOT EXISTS client_id VARCHAR(255);
ALTER TABLE clc_api_config ADD COLUMN IF NOT EXISTS client_secret TEXT;
ALTER TABLE clc_api_config ADD COLUMN IF NOT EXISTS token_url TEXT;
ALTER TABLE clc_api_config ADD COLUMN IF NOT EXISTS scopes TEXT;
ALTER TABLE clc_api_config ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE clc_api_config ADD COLUMN IF NOT EXISTS environment VARCHAR(20) DEFAULT 'sandbox';
ALTER TABLE clc_api_config ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(255);

-- clc_oauth_tokens (6 cols — add remaining)
ALTER TABLE clc_oauth_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE clc_oauth_tokens ADD COLUMN IF NOT EXISTS scope TEXT;
ALTER TABLE clc_oauth_tokens ADD COLUMN IF NOT EXISTS token_refreshed_at TIMESTAMPTZ;

-- per_capita_remittances (13 cols → 30)
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS from_organization_id UUID;
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS to_organization_id UUID;
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS remittance_month INTEGER;
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS remittance_year INTEGER;
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS total_members INTEGER;
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS good_standing_members INTEGER;
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS remittable_members INTEGER;
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS per_capita_rate DECIMAL(10,2);
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2);
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'CAD';
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS clc_account_code VARCHAR(100);
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS gl_account VARCHAR(100);
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50);
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255);
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS submitted_by VARCHAR(255);
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255);
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS payment_date DATE;
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS invoice_url TEXT;
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE per_capita_remittances ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);


-- =============================================
-- SECTION 5: LRB DOMAIN
-- =============================================

-- lrb_agreements (4 cols → 30)
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS source VARCHAR(50);
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS source_id VARCHAR(255);
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS employer_name VARCHAR(500);
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS employer_address TEXT;
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS union_name VARCHAR(500);
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS union_code VARCHAR(50);
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS bargaining_unit TEXT;
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS bargaining_unit_size INTEGER;
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS effective_date DATE;
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS signed_date DATE;
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS sector VARCHAR(100);
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS industry_code VARCHAR(20);
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS industry_name VARCHAR(255);
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS geographic_scope VARCHAR(100);
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(50);
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS wage_floor DECIMAL(10,2);
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS wage_ceiling DECIMAL(10,2);
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS document_url TEXT;
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS document_pdf_url TEXT;
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS extracted_content TEXT;
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS key_terms JSONB;
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS search_keywords TEXT[];
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS noc_codes TEXT[];
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS occupation_category VARCHAR(100);
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3,2);
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE lrb_agreements ADD COLUMN IF NOT EXISTS sync_id VARCHAR(255);

-- lrb_employers (4 cols → 12)
ALTER TABLE lrb_employers ADD COLUMN IF NOT EXISTS employer_name VARCHAR(500);
ALTER TABLE lrb_employers ADD COLUMN IF NOT EXISTS name_alt VARCHAR(500);
ALTER TABLE lrb_employers ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(50);
ALTER TABLE lrb_employers ADD COLUMN IF NOT EXISTS city VARCHAR(255);
ALTER TABLE lrb_employers ADD COLUMN IF NOT EXISTS province VARCHAR(50);
ALTER TABLE lrb_employers ADD COLUMN IF NOT EXISTS industry_code VARCHAR(20);
ALTER TABLE lrb_employers ADD COLUMN IF NOT EXISTS industry_name VARCHAR(255);
ALTER TABLE lrb_employers ADD COLUMN IF NOT EXISTS total_agreements INTEGER DEFAULT 0;
ALTER TABLE lrb_employers ADD COLUMN IF NOT EXISTS active_agreements INTEGER DEFAULT 0;
ALTER TABLE lrb_employers ADD COLUMN IF NOT EXISTS last_agreement_date DATE;
ALTER TABLE lrb_employers ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ;
ALTER TABLE lrb_employers ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- lrb_unions (4 cols → 14)
ALTER TABLE lrb_unions ADD COLUMN IF NOT EXISTS union_name VARCHAR(500);
ALTER TABLE lrb_unions ADD COLUMN IF NOT EXISTS union_code VARCHAR(50);
ALTER TABLE lrb_unions ADD COLUMN IF NOT EXISTS acronym VARCHAR(50);
ALTER TABLE lrb_unions ADD COLUMN IF NOT EXISTS parent_organization VARCHAR(500);
ALTER TABLE lrb_unions ADD COLUMN IF NOT EXISTS affiliation_level VARCHAR(100);
ALTER TABLE lrb_unions ADD COLUMN IF NOT EXISTS primary_jurisdiction VARCHAR(50);
ALTER TABLE lrb_unions ADD COLUMN IF NOT EXISTS total_agreements INTEGER DEFAULT 0;
ALTER TABLE lrb_unions ADD COLUMN IF NOT EXISTS active_agreements INTEGER DEFAULT 0;
ALTER TABLE lrb_unions ADD COLUMN IF NOT EXISTS total_members INTEGER;
ALTER TABLE lrb_unions ADD COLUMN IF NOT EXISTS last_agreement_date DATE;
ALTER TABLE lrb_unions ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ;
ALTER TABLE lrb_unions ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- lrb_sync_log (4 cols → 12)
ALTER TABLE lrb_sync_log ADD COLUMN IF NOT EXISTS source VARCHAR(50);
ALTER TABLE lrb_sync_log ADD COLUMN IF NOT EXISTS sync_id VARCHAR(255);
ALTER TABLE lrb_sync_log ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE lrb_sync_log ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE lrb_sync_log ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE lrb_sync_log ADD COLUMN IF NOT EXISTS pages_processed INTEGER DEFAULT 0;
ALTER TABLE lrb_sync_log ADD COLUMN IF NOT EXISTS agreements_found INTEGER DEFAULT 0;
ALTER TABLE lrb_sync_log ADD COLUMN IF NOT EXISTS agreements_inserted INTEGER DEFAULT 0;
ALTER TABLE lrb_sync_log ADD COLUMN IF NOT EXISTS agreements_updated INTEGER DEFAULT 0;
ALTER TABLE lrb_sync_log ADD COLUMN IF NOT EXISTS agreements_failed INTEGER DEFAULT 0;
ALTER TABLE lrb_sync_log ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE lrb_sync_log ADD COLUMN IF NOT EXISTS error_details JSONB;


-- =============================================
-- SECTION 6: LMS DOMAIN
-- =============================================

-- external_lms_courses (4 cols → 13)
ALTER TABLE external_lms_courses ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE external_lms_courses ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_lms_courses ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_lms_courses ADD COLUMN IF NOT EXISTS course_name VARCHAR(500);
ALTER TABLE external_lms_courses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE external_lms_courses ADD COLUMN IF NOT EXISTS difficulty_level VARCHAR(50);
ALTER TABLE external_lms_courses ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE external_lms_courses ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE external_lms_courses ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ;
ALTER TABLE external_lms_courses ADD COLUMN IF NOT EXISTS provider VARCHAR(255);
ALTER TABLE external_lms_courses ADD COLUMN IF NOT EXISTS category_id VARCHAR(255);
ALTER TABLE external_lms_courses ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

-- external_lms_enrollments (4 cols → 12)
ALTER TABLE external_lms_enrollments ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE external_lms_enrollments ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_lms_enrollments ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_lms_enrollments ADD COLUMN IF NOT EXISTS course_id VARCHAR(255);
ALTER TABLE external_lms_enrollments ADD COLUMN IF NOT EXISTS learner_id VARCHAR(255);
ALTER TABLE external_lms_enrollments ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMPTZ;
ALTER TABLE external_lms_enrollments ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE external_lms_enrollments ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0;
ALTER TABLE external_lms_enrollments ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;
ALTER TABLE external_lms_enrollments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE external_lms_enrollments ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

-- external_lms_progress (4 cols → 12)
ALTER TABLE external_lms_progress ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE external_lms_progress ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_lms_progress ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_lms_progress ADD COLUMN IF NOT EXISTS course_id VARCHAR(255);
ALTER TABLE external_lms_progress ADD COLUMN IF NOT EXISTS learner_id VARCHAR(255);
ALTER TABLE external_lms_progress ADD COLUMN IF NOT EXISTS content_id VARCHAR(255);
ALTER TABLE external_lms_progress ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0;
ALTER TABLE external_lms_progress ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER DEFAULT 0;
ALTER TABLE external_lms_progress ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE external_lms_progress ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

-- external_lms_completions (4 cols → 10)
ALTER TABLE external_lms_completions ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE external_lms_completions ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_lms_completions ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_lms_completions ADD COLUMN IF NOT EXISTS course_id VARCHAR(255);
ALTER TABLE external_lms_completions ADD COLUMN IF NOT EXISTS learner_id VARCHAR(255);
ALTER TABLE external_lms_completions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE external_lms_completions ADD COLUMN IF NOT EXISTS certificate_id VARCHAR(255);
ALTER TABLE external_lms_completions ADD COLUMN IF NOT EXISTS grade DECIMAL(5,2);
ALTER TABLE external_lms_completions ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

-- external_lms_learners (4 cols → 9)
ALTER TABLE external_lms_learners ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE external_lms_learners ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_lms_learners ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_lms_learners ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE external_lms_learners ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE external_lms_learners ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE external_lms_learners ADD COLUMN IF NOT EXISTS profile_url TEXT;
ALTER TABLE external_lms_learners ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();


-- =============================================
-- SECTION 7: COMMUNICATION DOMAIN
-- =============================================

-- external_communication_channels (4 cols → 15)
ALTER TABLE external_communication_channels ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE external_communication_channels ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_communication_channels ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_communication_channels ADD COLUMN IF NOT EXISTS channel_name VARCHAR(255);
ALTER TABLE external_communication_channels ADD COLUMN IF NOT EXISTS channel_type VARCHAR(50);
ALTER TABLE external_communication_channels ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE external_communication_channels ADD COLUMN IF NOT EXISTS creator_id VARCHAR(255);
ALTER TABLE external_communication_channels ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0;
ALTER TABLE external_communication_channels ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE external_communication_channels ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE external_communication_channels ADD COLUMN IF NOT EXISTS parent_channel_id VARCHAR(255);
ALTER TABLE external_communication_channels ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

-- external_communication_messages (4 cols → 15)
ALTER TABLE external_communication_messages ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE external_communication_messages ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_communication_messages ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_communication_messages ADD COLUMN IF NOT EXISTS channel_id UUID;
ALTER TABLE external_communication_messages ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE external_communication_messages ADD COLUMN IF NOT EXISTS message_text TEXT;
ALTER TABLE external_communication_messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(50);
ALTER TABLE external_communication_messages ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMPTZ;
ALTER TABLE external_communication_messages ADD COLUMN IF NOT EXISTS thread_id VARCHAR(255);
ALTER TABLE external_communication_messages ADD COLUMN IF NOT EXISTS reply_count INTEGER DEFAULT 0;
ALTER TABLE external_communication_messages ADD COLUMN IF NOT EXISTS reaction_count INTEGER DEFAULT 0;
ALTER TABLE external_communication_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE external_communication_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE external_communication_messages ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

-- external_communication_users (4 cols → 18)
ALTER TABLE external_communication_users ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE external_communication_users ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_communication_users ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_communication_users ADD COLUMN IF NOT EXISTS username VARCHAR(255);
ALTER TABLE external_communication_users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
ALTER TABLE external_communication_users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE external_communication_users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE external_communication_users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE external_communication_users ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE external_communication_users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE external_communication_users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false;
ALTER TABLE external_communication_users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE external_communication_users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE external_communication_users ADD COLUMN IF NOT EXISTS status_text VARCHAR(255);
ALTER TABLE external_communication_users ADD COLUMN IF NOT EXISTS status_emoji VARCHAR(50);
ALTER TABLE external_communication_users ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

-- external_communication_files (4 cols → 14)
ALTER TABLE external_communication_files ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE external_communication_files ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_communication_files ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_communication_files ADD COLUMN IF NOT EXISTS channel_id UUID;
ALTER TABLE external_communication_files ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE external_communication_files ADD COLUMN IF NOT EXISTS file_name VARCHAR(500);
ALTER TABLE external_communication_files ADD COLUMN IF NOT EXISTS file_type VARCHAR(50);
ALTER TABLE external_communication_files ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);
ALTER TABLE external_communication_files ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE external_communication_files ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE external_communication_files ADD COLUMN IF NOT EXISTS download_url TEXT;
ALTER TABLE external_communication_files ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;
ALTER TABLE external_communication_files ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();


-- =============================================
-- SECTION 8: DOCUMENT MANAGEMENT DOMAIN
-- =============================================

-- external_document_sites (4 cols → 10)
ALTER TABLE external_document_sites ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE external_document_sites ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_document_sites ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_document_sites ADD COLUMN IF NOT EXISTS site_name VARCHAR(255);
ALTER TABLE external_document_sites ADD COLUMN IF NOT EXISTS site_url TEXT;
ALTER TABLE external_document_sites ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE external_document_sites ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMPTZ;
ALTER TABLE external_document_sites ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

-- external_document_libraries (4 cols → 12)
ALTER TABLE external_document_libraries ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE external_document_libraries ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_document_libraries ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_document_libraries ADD COLUMN IF NOT EXISTS site_id VARCHAR(255);
ALTER TABLE external_document_libraries ADD COLUMN IF NOT EXISTS library_name VARCHAR(255);
ALTER TABLE external_document_libraries ADD COLUMN IF NOT EXISTS library_url TEXT;
ALTER TABLE external_document_libraries ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE external_document_libraries ADD COLUMN IF NOT EXISTS drive_type VARCHAR(50);
ALTER TABLE external_document_libraries ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
ALTER TABLE external_document_libraries ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

-- external_document_files (4 cols → 17)
ALTER TABLE external_document_files ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE external_document_files ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_document_files ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_document_files ADD COLUMN IF NOT EXISTS library_id UUID;
ALTER TABLE external_document_files ADD COLUMN IF NOT EXISTS file_name VARCHAR(500);
ALTER TABLE external_document_files ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE external_document_files ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE external_document_files ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);
ALTER TABLE external_document_files ADD COLUMN IF NOT EXISTS is_folder BOOLEAN DEFAULT false;
ALTER TABLE external_document_files ADD COLUMN IF NOT EXISTS folder_child_count INTEGER;
ALTER TABLE external_document_files ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
ALTER TABLE external_document_files ADD COLUMN IF NOT EXISTS created_by_email VARCHAR(255);
ALTER TABLE external_document_files ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMPTZ;
ALTER TABLE external_document_files ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(255);
ALTER TABLE external_document_files ADD COLUMN IF NOT EXISTS parent_path TEXT;
ALTER TABLE external_document_files ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

-- external_document_permissions (4 cols → 12)
ALTER TABLE external_document_permissions ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE external_document_permissions ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_document_permissions ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_document_permissions ADD COLUMN IF NOT EXISTS file_id UUID;
ALTER TABLE external_document_permissions ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE external_document_permissions ADD COLUMN IF NOT EXISTS group_id VARCHAR(255);
ALTER TABLE external_document_permissions ADD COLUMN IF NOT EXISTS roles VARCHAR(255);
ALTER TABLE external_document_permissions ADD COLUMN IF NOT EXISTS permission_type VARCHAR(50);
ALTER TABLE external_document_permissions ADD COLUMN IF NOT EXISTS scope VARCHAR(50);
ALTER TABLE external_document_permissions ADD COLUMN IF NOT EXISTS granted_to VARCHAR(255);
ALTER TABLE external_document_permissions ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();


-- =============================================
-- SECTION 9: INSURANCE / BENEFITS DOMAIN
-- =============================================

-- external_benefit_plans (4 cols → 16)
ALTER TABLE external_benefit_plans ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_benefit_plans ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_benefit_plans ADD COLUMN IF NOT EXISTS plan_name VARCHAR(500);
ALTER TABLE external_benefit_plans ADD COLUMN IF NOT EXISTS plan_type VARCHAR(100);
ALTER TABLE external_benefit_plans ADD COLUMN IF NOT EXISTS coverage_level VARCHAR(100);
ALTER TABLE external_benefit_plans ADD COLUMN IF NOT EXISTS effective_date DATE;
ALTER TABLE external_benefit_plans ADD COLUMN IF NOT EXISTS termination_date DATE;
ALTER TABLE external_benefit_plans ADD COLUMN IF NOT EXISTS premium DECIMAL(12,2);
ALTER TABLE external_benefit_plans ADD COLUMN IF NOT EXISTS employer_contribution DECIMAL(12,2);
ALTER TABLE external_benefit_plans ADD COLUMN IF NOT EXISTS employee_contribution DECIMAL(12,2);
ALTER TABLE external_benefit_plans ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE external_benefit_plans ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- external_benefit_enrollments (4 cols → 16)
ALTER TABLE external_benefit_enrollments ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_benefit_enrollments ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_benefit_enrollments ADD COLUMN IF NOT EXISTS employee_id VARCHAR(255);
ALTER TABLE external_benefit_enrollments ADD COLUMN IF NOT EXISTS employee_name VARCHAR(500);
ALTER TABLE external_benefit_enrollments ADD COLUMN IF NOT EXISTS plan_id VARCHAR(255);
ALTER TABLE external_benefit_enrollments ADD COLUMN IF NOT EXISTS plan_name VARCHAR(500);
ALTER TABLE external_benefit_enrollments ADD COLUMN IF NOT EXISTS coverage_level VARCHAR(100);
ALTER TABLE external_benefit_enrollments ADD COLUMN IF NOT EXISTS enrollment_date DATE;
ALTER TABLE external_benefit_enrollments ADD COLUMN IF NOT EXISTS effective_date DATE;
ALTER TABLE external_benefit_enrollments ADD COLUMN IF NOT EXISTS termination_date DATE;
ALTER TABLE external_benefit_enrollments ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE external_benefit_enrollments ADD COLUMN IF NOT EXISTS premium DECIMAL(12,2);
ALTER TABLE external_benefit_enrollments ADD COLUMN IF NOT EXISTS employee_contribution DECIMAL(12,2);
ALTER TABLE external_benefit_enrollments ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- external_benefit_dependents (4 cols → 12)
ALTER TABLE external_benefit_dependents ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_benefit_dependents ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_benefit_dependents ADD COLUMN IF NOT EXISTS employee_id VARCHAR(255);
ALTER TABLE external_benefit_dependents ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);
ALTER TABLE external_benefit_dependents ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);
ALTER TABLE external_benefit_dependents ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE external_benefit_dependents ADD COLUMN IF NOT EXISTS relationship VARCHAR(100);
ALTER TABLE external_benefit_dependents ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE external_benefit_dependents ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- external_benefit_coverage (4 cols → 14)
ALTER TABLE external_benefit_coverage ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_benefit_coverage ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_benefit_coverage ADD COLUMN IF NOT EXISTS enrollment_id VARCHAR(255);
ALTER TABLE external_benefit_coverage ADD COLUMN IF NOT EXISTS employee_id VARCHAR(255);
ALTER TABLE external_benefit_coverage ADD COLUMN IF NOT EXISTS plan_id VARCHAR(255);
ALTER TABLE external_benefit_coverage ADD COLUMN IF NOT EXISTS plan_type VARCHAR(100);
ALTER TABLE external_benefit_coverage ADD COLUMN IF NOT EXISTS coverage_amount DECIMAL(15,2);
ALTER TABLE external_benefit_coverage ADD COLUMN IF NOT EXISTS deductible DECIMAL(12,2);
ALTER TABLE external_benefit_coverage ADD COLUMN IF NOT EXISTS effective_date DATE;
ALTER TABLE external_benefit_coverage ADD COLUMN IF NOT EXISTS termination_date DATE;
ALTER TABLE external_benefit_coverage ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE external_benefit_coverage ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- external_insurance_claims (4 cols → 22)
ALTER TABLE external_insurance_claims ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_insurance_claims ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_insurance_claims ADD COLUMN IF NOT EXISTS claim_number VARCHAR(255);
ALTER TABLE external_insurance_claims ADD COLUMN IF NOT EXISTS employee_id VARCHAR(255);
ALTER TABLE external_insurance_claims ADD COLUMN IF NOT EXISTS employee_name VARCHAR(500);
ALTER TABLE external_insurance_claims ADD COLUMN IF NOT EXISTS policy_number VARCHAR(255);
ALTER TABLE external_insurance_claims ADD COLUMN IF NOT EXISTS claim_type VARCHAR(100);
ALTER TABLE external_insurance_claims ADD COLUMN IF NOT EXISTS service_date DATE;
ALTER TABLE external_insurance_claims ADD COLUMN IF NOT EXISTS submission_date DATE;
ALTER TABLE external_insurance_claims ADD COLUMN IF NOT EXISTS processed_date DATE;
ALTER TABLE external_insurance_claims ADD COLUMN IF NOT EXISTS claim_amount DECIMAL(12,2);
ALTER TABLE external_insurance_claims ADD COLUMN IF NOT EXISTS approved_amount DECIMAL(12,2);
ALTER TABLE external_insurance_claims ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2);
ALTER TABLE external_insurance_claims ADD COLUMN IF NOT EXISTS denied_amount DECIMAL(12,2);
ALTER TABLE external_insurance_claims ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE external_insurance_claims ADD COLUMN IF NOT EXISTS denial_reason TEXT;
ALTER TABLE external_insurance_claims ADD COLUMN IF NOT EXISTS provider_id VARCHAR(255);
ALTER TABLE external_insurance_claims ADD COLUMN IF NOT EXISTS provider_name VARCHAR(500);
ALTER TABLE external_insurance_claims ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- external_insurance_policies (4 cols → 14)
ALTER TABLE external_insurance_policies ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_insurance_policies ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_insurance_policies ADD COLUMN IF NOT EXISTS policy_number VARCHAR(255);
ALTER TABLE external_insurance_policies ADD COLUMN IF NOT EXISTS policy_type VARCHAR(100);
ALTER TABLE external_insurance_policies ADD COLUMN IF NOT EXISTS employee_id VARCHAR(255);
ALTER TABLE external_insurance_policies ADD COLUMN IF NOT EXISTS effective_date DATE;
ALTER TABLE external_insurance_policies ADD COLUMN IF NOT EXISTS termination_date DATE;
ALTER TABLE external_insurance_policies ADD COLUMN IF NOT EXISTS coverage_amount DECIMAL(15,2);
ALTER TABLE external_insurance_policies ADD COLUMN IF NOT EXISTS premium DECIMAL(12,2);
ALTER TABLE external_insurance_policies ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE external_insurance_policies ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- external_insurance_beneficiaries (4 cols → 14)
ALTER TABLE external_insurance_beneficiaries ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_insurance_beneficiaries ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_insurance_beneficiaries ADD COLUMN IF NOT EXISTS policy_id VARCHAR(255);
ALTER TABLE external_insurance_beneficiaries ADD COLUMN IF NOT EXISTS employee_id VARCHAR(255);
ALTER TABLE external_insurance_beneficiaries ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);
ALTER TABLE external_insurance_beneficiaries ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);
ALTER TABLE external_insurance_beneficiaries ADD COLUMN IF NOT EXISTS relationship VARCHAR(100);
ALTER TABLE external_insurance_beneficiaries ADD COLUMN IF NOT EXISTS percentage INTEGER;
ALTER TABLE external_insurance_beneficiaries ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;
ALTER TABLE external_insurance_beneficiaries ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE external_insurance_beneficiaries ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- external_benefit_utilization (4 cols → 14)
ALTER TABLE external_benefit_utilization ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_benefit_utilization ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_benefit_utilization ADD COLUMN IF NOT EXISTS employee_id VARCHAR(255);
ALTER TABLE external_benefit_utilization ADD COLUMN IF NOT EXISTS policy_id VARCHAR(255);
ALTER TABLE external_benefit_utilization ADD COLUMN IF NOT EXISTS benefit_type VARCHAR(100);
ALTER TABLE external_benefit_utilization ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE external_benefit_utilization ADD COLUMN IF NOT EXISTS period_end DATE;
ALTER TABLE external_benefit_utilization ADD COLUMN IF NOT EXISTS maximum_benefit DECIMAL(12,2);
ALTER TABLE external_benefit_utilization ADD COLUMN IF NOT EXISTS utilized DECIMAL(12,2);
ALTER TABLE external_benefit_utilization ADD COLUMN IF NOT EXISTS remaining DECIMAL(12,2);
ALTER TABLE external_benefit_utilization ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;


-- =============================================
-- SECTION 10: ACCOUNTING DOMAIN
-- =============================================

-- external_invoices (4 cols → 14)
ALTER TABLE external_invoices ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_invoices ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_invoices ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(255);
ALTER TABLE external_invoices ADD COLUMN IF NOT EXISTS customer_id VARCHAR(255);
ALTER TABLE external_invoices ADD COLUMN IF NOT EXISTS customer_name VARCHAR(500);
ALTER TABLE external_invoices ADD COLUMN IF NOT EXISTS invoice_date DATE;
ALTER TABLE external_invoices ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE external_invoices ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2);
ALTER TABLE external_invoices ADD COLUMN IF NOT EXISTS balance_amount DECIMAL(12,2);
ALTER TABLE external_invoices ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE external_invoices ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

-- external_payments (4 cols → 10)
ALTER TABLE external_payments ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_payments ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_payments ADD COLUMN IF NOT EXISTS customer_id VARCHAR(255);
ALTER TABLE external_payments ADD COLUMN IF NOT EXISTS customer_name VARCHAR(500);
ALTER TABLE external_payments ADD COLUMN IF NOT EXISTS payment_date DATE;
ALTER TABLE external_payments ADD COLUMN IF NOT EXISTS amount DECIMAL(12,2);
ALTER TABLE external_payments ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

-- external_customers (4 cols → 11)
ALTER TABLE external_customers ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_customers ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_customers ADD COLUMN IF NOT EXISTS name VARCHAR(500);
ALTER TABLE external_customers ADD COLUMN IF NOT EXISTS company_name VARCHAR(500);
ALTER TABLE external_customers ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE external_customers ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE external_customers ADD COLUMN IF NOT EXISTS balance DECIMAL(12,2);
ALTER TABLE external_customers ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

-- external_accounts (4 cols → 12)
ALTER TABLE external_accounts ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE external_accounts ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50);
ALTER TABLE external_accounts ADD COLUMN IF NOT EXISTS account_name VARCHAR(500);
ALTER TABLE external_accounts ADD COLUMN IF NOT EXISTS account_type VARCHAR(100);
ALTER TABLE external_accounts ADD COLUMN IF NOT EXISTS account_sub_type VARCHAR(100);
ALTER TABLE external_accounts ADD COLUMN IF NOT EXISTS classification VARCHAR(100);
ALTER TABLE external_accounts ADD COLUMN IF NOT EXISTS current_balance DECIMAL(15,2);
ALTER TABLE external_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE external_accounts ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();


-- =============================================
-- SECTION 11: INDEXES
-- =============================================

-- Integration Infrastructure
CREATE INDEX IF NOT EXISTS integration_configs_org_idx ON integration_configs(organization_id);
CREATE INDEX IF NOT EXISTS integration_configs_type_idx ON integration_configs(type);
CREATE INDEX IF NOT EXISTS integration_configs_provider_idx ON integration_configs(provider);
CREATE INDEX IF NOT EXISTS integration_sync_log_org_idx ON integration_sync_log(organization_id);
CREATE INDEX IF NOT EXISTS integration_sync_log_provider_idx ON integration_sync_log(provider);
CREATE INDEX IF NOT EXISTS integration_sync_log_status_idx ON integration_sync_log(status);
CREATE INDEX IF NOT EXISTS integration_sync_schedules_org_idx ON integration_sync_schedules(organization_id);
CREATE INDEX IF NOT EXISTS webhook_events_org_idx ON webhook_events(organization_id);
CREATE INDEX IF NOT EXISTS webhook_events_provider_idx ON webhook_events(provider);
CREATE INDEX IF NOT EXISTS webhook_events_status_idx ON webhook_events(status);
CREATE INDEX IF NOT EXISTS integration_webhooks_org_idx ON integration_webhooks(organization_id);
CREATE INDEX IF NOT EXISTS integration_webhooks_active_idx ON integration_webhooks(is_active);
CREATE INDEX IF NOT EXISTS webhook_deliveries_webhook_idx ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS webhook_deliveries_delivered_at_idx ON webhook_deliveries(delivered_at);

-- ERP / Financial
CREATE INDEX IF NOT EXISTS erp_connectors_organization_idx ON erp_connectors(organization_id);
CREATE INDEX IF NOT EXISTS erp_connectors_system_type_idx ON erp_connectors(system_type);
CREATE INDEX IF NOT EXISTS coa_organization_idx ON chart_of_accounts(organization_id);
CREATE INDEX IF NOT EXISTS coa_connector_idx ON chart_of_accounts(connector_id);
CREATE INDEX IF NOT EXISTS coa_account_number_idx ON chart_of_accounts(account_number);
CREATE INDEX IF NOT EXISTS gl_mappings_organization_idx ON gl_account_mappings(organization_id);
CREATE INDEX IF NOT EXISTS gl_mappings_union_account_idx ON gl_account_mappings(union_eyes_account);
CREATE INDEX IF NOT EXISTS je_organization_idx ON journal_entries(organization_id);
CREATE INDEX IF NOT EXISTS je_entry_number_idx ON journal_entries(entry_number);
CREATE INDEX IF NOT EXISTS je_entry_date_idx ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS jel_entry_idx ON journal_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS jel_account_idx ON journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS invoices_organization_idx ON erp_invoices(organization_id);
CREATE INDEX IF NOT EXISTS invoices_number_idx ON erp_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON erp_invoices(status);
CREATE INDEX IF NOT EXISTS invoices_due_date_idx ON erp_invoices(due_date);
CREATE INDEX IF NOT EXISTS bank_accounts_organization_idx ON bank_accounts(organization_id);
CREATE INDEX IF NOT EXISTS bank_txns_account_idx ON bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS bank_txns_date_idx ON bank_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS bank_txns_reconciled_idx ON bank_transactions(is_reconciled);
CREATE INDEX IF NOT EXISTS bank_recon_organization_idx ON bank_reconciliations(organization_id);
CREATE INDEX IF NOT EXISTS bank_recon_account_idx ON bank_reconciliations(bank_account_id);
CREATE INDEX IF NOT EXISTS sync_jobs_organization_idx ON sync_jobs(organization_id);
CREATE INDEX IF NOT EXISTS sync_jobs_connector_idx ON sync_jobs(connector_id);
CREATE INDEX IF NOT EXISTS sync_jobs_status_idx ON sync_jobs(status);
CREATE INDEX IF NOT EXISTS audit_organization_idx ON financial_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS audit_entity_idx ON financial_audit_log(entity_type, org_id);
CREATE INDEX IF NOT EXISTS audit_user_idx ON financial_audit_log(user_id);
CREATE INDEX IF NOT EXISTS audit_timestamp_idx ON financial_audit_log("timestamp");
CREATE INDEX IF NOT EXISTS fx_rates_organization_idx ON currency_exchange_rates(organization_id);
CREATE INDEX IF NOT EXISTS fx_rates_currency_idx ON currency_exchange_rates(base_currency, target_currency);

-- CLC
CREATE INDEX IF NOT EXISTS clc_sync_log_status_idx ON clc_sync_log(status);
CREATE INDEX IF NOT EXISTS clc_webhook_log_status_idx ON clc_webhook_log(status);
CREATE INDEX IF NOT EXISTS clc_org_sync_log_org_idx ON clc_organization_sync_log(organization_id);
CREATE INDEX IF NOT EXISTS clc_org_sync_log_affiliate_idx ON clc_organization_sync_log(affiliate_code);
CREATE INDEX IF NOT EXISTS clc_coa_code_idx ON clc_chart_of_accounts(account_code);
CREATE INDEX IF NOT EXISTS clc_per_capita_bench_org_idx ON clc_per_capita_benchmarks(organization_id);
CREATE INDEX IF NOT EXISTS clc_union_density_sector_idx ON clc_union_density(sector);
CREATE INDEX IF NOT EXISTS clc_bargaining_trends_sector_idx ON clc_bargaining_trends(sector);
CREATE INDEX IF NOT EXISTS per_capita_remittances_from_idx ON per_capita_remittances(from_organization_id);
CREATE INDEX IF NOT EXISTS per_capita_remittances_to_idx ON per_capita_remittances(to_organization_id);

-- LRB
CREATE INDEX IF NOT EXISTS lrb_agreements_source_idx ON lrb_agreements(source);
CREATE INDEX IF NOT EXISTS lrb_agreements_status_idx ON lrb_agreements(status);
CREATE INDEX IF NOT EXISTS lrb_agreements_sector_idx ON lrb_agreements(sector);
CREATE INDEX IF NOT EXISTS lrb_agreements_jurisdiction_idx ON lrb_agreements(jurisdiction);
CREATE INDEX IF NOT EXISTS lrb_employers_name_idx ON lrb_employers(employer_name);
CREATE INDEX IF NOT EXISTS lrb_unions_name_idx ON lrb_unions(union_name);
CREATE INDEX IF NOT EXISTS lrb_unions_code_idx ON lrb_unions(union_code);
CREATE INDEX IF NOT EXISTS lrb_sync_log_source_idx ON lrb_sync_log(source);

-- LMS
CREATE INDEX IF NOT EXISTS lms_courses_org_id_idx ON external_lms_courses(org_id);
CREATE INDEX IF NOT EXISTS lms_courses_provider_idx ON external_lms_courses(external_provider);
CREATE INDEX IF NOT EXISTS lms_enrollments_org_id_idx ON external_lms_enrollments(org_id);
CREATE INDEX IF NOT EXISTS lms_enrollments_course_id_idx ON external_lms_enrollments(course_id);
CREATE INDEX IF NOT EXISTS lms_enrollments_learner_id_idx ON external_lms_enrollments(learner_id);
CREATE INDEX IF NOT EXISTS lms_progress_org_id_idx ON external_lms_progress(org_id);
CREATE INDEX IF NOT EXISTS lms_progress_course_id_idx ON external_lms_progress(course_id);
CREATE INDEX IF NOT EXISTS lms_completions_org_id_idx ON external_lms_completions(org_id);
CREATE INDEX IF NOT EXISTS lms_completions_course_id_idx ON external_lms_completions(course_id);
CREATE INDEX IF NOT EXISTS lms_learners_org_id_idx ON external_lms_learners(org_id);
CREATE INDEX IF NOT EXISTS lms_learners_email_idx ON external_lms_learners(email);

-- Communication
CREATE INDEX IF NOT EXISTS comm_channels_org_id_idx ON external_communication_channels(org_id);
CREATE INDEX IF NOT EXISTS comm_channels_provider_idx ON external_communication_channels(external_provider);
CREATE INDEX IF NOT EXISTS comm_channels_type_idx ON external_communication_channels(channel_type);
CREATE INDEX IF NOT EXISTS comm_messages_org_id_idx ON external_communication_messages(org_id);
CREATE INDEX IF NOT EXISTS comm_messages_channel_id_idx ON external_communication_messages(channel_id);
CREATE INDEX IF NOT EXISTS comm_messages_timestamp_idx ON external_communication_messages("timestamp");
CREATE INDEX IF NOT EXISTS comm_users_org_id_idx ON external_communication_users(org_id);
CREATE INDEX IF NOT EXISTS comm_users_email_idx ON external_communication_users(email);
CREATE INDEX IF NOT EXISTS comm_files_org_id_idx ON external_communication_files(org_id);
CREATE INDEX IF NOT EXISTS comm_files_channel_id_idx ON external_communication_files(channel_id);

-- Documents
CREATE INDEX IF NOT EXISTS doc_sites_org_id_idx ON external_document_sites(org_id);
CREATE INDEX IF NOT EXISTS doc_sites_provider_idx ON external_document_sites(external_provider);
CREATE INDEX IF NOT EXISTS doc_libraries_org_id_idx ON external_document_libraries(org_id);
CREATE INDEX IF NOT EXISTS doc_libraries_site_id_idx ON external_document_libraries(site_id);
CREATE INDEX IF NOT EXISTS doc_files_org_id_idx ON external_document_files(org_id);
CREATE INDEX IF NOT EXISTS doc_files_library_id_idx ON external_document_files(library_id);
CREATE INDEX IF NOT EXISTS doc_files_is_folder_idx ON external_document_files(is_folder);
CREATE INDEX IF NOT EXISTS doc_permissions_org_id_idx ON external_document_permissions(org_id);
CREATE INDEX IF NOT EXISTS doc_permissions_file_id_idx ON external_document_permissions(file_id);

-- Insurance / Benefits
CREATE INDEX IF NOT EXISTS external_benefit_plans_org_provider_idx ON external_benefit_plans(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS external_benefit_plans_status_idx ON external_benefit_plans(status);
CREATE INDEX IF NOT EXISTS external_benefit_plans_plan_type_idx ON external_benefit_plans(plan_type);
CREATE INDEX IF NOT EXISTS external_benefit_enrollments_org_provider_idx ON external_benefit_enrollments(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS external_benefit_enrollments_employee_idx ON external_benefit_enrollments(employee_id);
CREATE INDEX IF NOT EXISTS external_benefit_enrollments_status_idx ON external_benefit_enrollments(status);
CREATE INDEX IF NOT EXISTS external_benefit_dependents_org_provider_idx ON external_benefit_dependents(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS external_benefit_dependents_employee_idx ON external_benefit_dependents(employee_id);
CREATE INDEX IF NOT EXISTS external_benefit_coverage_org_provider_idx ON external_benefit_coverage(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS external_benefit_coverage_employee_idx ON external_benefit_coverage(employee_id);
CREATE INDEX IF NOT EXISTS external_insurance_claims_org_provider_idx ON external_insurance_claims(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS external_insurance_claims_claim_number_idx ON external_insurance_claims(claim_number);
CREATE INDEX IF NOT EXISTS external_insurance_claims_employee_idx ON external_insurance_claims(employee_id);
CREATE INDEX IF NOT EXISTS external_insurance_claims_status_idx ON external_insurance_claims(status);
CREATE INDEX IF NOT EXISTS external_insurance_policies_org_provider_idx ON external_insurance_policies(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS external_insurance_policies_policy_number_idx ON external_insurance_policies(policy_number);
CREATE INDEX IF NOT EXISTS external_insurance_policies_employee_idx ON external_insurance_policies(employee_id);
CREATE INDEX IF NOT EXISTS external_insurance_beneficiaries_org_provider_idx ON external_insurance_beneficiaries(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS external_insurance_beneficiaries_policy_idx ON external_insurance_beneficiaries(policy_id);
CREATE INDEX IF NOT EXISTS external_benefit_utilization_org_provider_idx ON external_benefit_utilization(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS external_benefit_utilization_employee_idx ON external_benefit_utilization(employee_id);

-- Accounting
CREATE INDEX IF NOT EXISTS external_invoices_org_provider_idx ON external_invoices(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS external_invoices_invoice_number_idx ON external_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS external_invoices_status_idx ON external_invoices(status);
CREATE INDEX IF NOT EXISTS external_payments_org_provider_idx ON external_payments(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS external_payments_customer_idx ON external_payments(customer_id);
CREATE INDEX IF NOT EXISTS external_customers_org_provider_idx ON external_customers(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS external_customers_name_idx ON external_customers(name);
CREATE INDEX IF NOT EXISTS external_customers_email_idx ON external_customers(email);
CREATE INDEX IF NOT EXISTS external_accounts_org_provider_idx ON external_accounts(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS external_accounts_type_idx ON external_accounts(account_type);
CREATE INDEX IF NOT EXISTS external_accounts_active_idx ON external_accounts(is_active);

-- Done
SELECT 'Migration complete: all integration tables expanded' AS result;
