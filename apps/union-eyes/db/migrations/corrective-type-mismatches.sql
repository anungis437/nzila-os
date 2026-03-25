-- =============================================================================
-- CORRECTIVE MIGRATION: Fix 46 type mismatches between Drizzle schema and DB
-- Generated: 2026-03-16
-- =============================================================================
-- Strategy:
--   Group A (31 cols): DB uuid → text  (schema uses text() + createId()/CUID2)
--   Group B (4 cols):  DB text → varchar (schema uses varchar())
--   Group C (10 cols): DB varchar/text → enum (schema uses pgEnum())
--   Group D (1 col):   DB document_category enum → text (schema uses text())
-- =============================================================================

-- =========================================================================
-- PRE-TRANSACTION: Add missing enum values (must be outside transaction)
-- =========================================================================

-- Ensure all enum types exist first (idempotent)
DO $$ BEGIN CREATE TYPE claim_type AS ENUM ('grievance_discipline','grievance_schedule','grievance_pay','workplace_safety','discrimination_age','discrimination_gender','discrimination_race','discrimination_disability','discrimination_other','harassment_sexual','harassment_workplace','wage_dispute','contract_dispute','retaliation','wrongful_termination','other','harassment_verbal','harassment_physical','grievance_benefits','grievance_leave'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE claim_status AS ENUM ('submitted','under_review','assigned','investigation','pending_documentation','resolved','rejected','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE claim_priority AS ENUM ('low','medium','high','critical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE transition_trigger_type AS ENUM ('manual','automatic','deadline','approval','rejection'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_type AS ENUM ('payment_confirmation','payment_failed','payment_reminder','donation_received','stipend_approved','stipend_disbursed','low_balance_alert','arrears_warning','strike_announcement','picket_reminder','claim_update','document_update','deadline_alert','system_announcement','security_alert','general'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_status AS ENUM ('sent','failed','partial','pending'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_priority AS ENUM ('low','normal','high','urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ticket_category AS ENUM ('bug_report','feature_request','technical_support','account_issue','billing_question','data_issue','performance','security_concern','training_request','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ticket_priority AS ENUM ('low','medium','high','urgent','critical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ticket_status AS ENUM ('open','in_progress','waiting_customer','waiting_internal','resolved','closed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add missing values to existing enum types (must be outside transaction)
ALTER TYPE claim_type ADD VALUE IF NOT EXISTS 'grievance_benefits';
ALTER TYPE claim_type ADD VALUE IF NOT EXISTS 'grievance_leave';

BEGIN;

-- =========================================================================
-- STEP 0: Drop Django-legacy FK constraints that block uuid→text conversion
-- =========================================================================

ALTER TABLE access_justification_requests DROP CONSTRAINT IF EXISTS "access_justification_data_type_id_b44a067d_fk_data_clas";
ALTER TABLE account_balance_reconciliation DROP CONSTRAINT IF EXISTS "account_balance_reco_account_id_677de182_fk_stripe_co";
ALTER TABLE cookie_consents DROP CONSTRAINT IF EXISTS "cookie_consents_user_id_e2ac15b7_fk_profiles_id";
ALTER TABLE employer_access_attempts DROP CONSTRAINT IF EXISTS "employer_access_atte_data_type_id_0678eb21_fk_data_clas";
ALTER TABLE firewall_access_rules DROP CONSTRAINT IF EXISTS "firewall_access_rule_data_type_id_ad63e2ed_fk_data_clas";
ALTER TABLE firewall_violations DROP CONSTRAINT IF EXISTS "firewall_violations_data_type_id_9c078dbf_fk_data_clas";
ALTER TABLE payment_routing_rules DROP CONSTRAINT IF EXISTS "payment_routing_rule_destination_account__d3b18ebb_fk_stripe_co";
ALTER TABLE payment_routing_rules DROP CONSTRAINT IF EXISTS "payment_routing_rule_fallback_account_id_e3b846d4_fk_stripe_co";
ALTER TABLE separated_payment_transactions DROP CONSTRAINT IF EXISTS "separated_payment_tr_routed_to_account_id_533cce42_fk_stripe_co";
ALTER TABLE separated_payment_transactions DROP CONSTRAINT IF EXISTS "separated_payment_tr_routing_rule_id_2ee5eb69_fk_payment_r";
ALTER TABLE whiplash_prevention_audit DROP CONSTRAINT IF EXISTS "whiplash_prevention__account_id_347e3e05_fk_stripe_co";
ALTER TABLE whiplash_prevention_audit DROP CONSTRAINT IF EXISTS "whiplash_prevention__transaction_id_9a2c89d3_fk_separated";
ALTER TABLE whiplash_violations DROP CONSTRAINT IF EXISTS "whiplash_violations_expected_account_id_62b1997e_fk_stripe_co";
ALTER TABLE whiplash_violations DROP CONSTRAINT IF EXISTS "whiplash_violations_transaction_id_68b5600e_fk_separated";
ALTER TABLE whiplash_violations DROP CONSTRAINT IF EXISTS "whiplash_violations_actual_account_id_38cfa07d_fk_stripe_co";

-- =========================================================================
-- GROUP A: ALTER uuid → text (31 columns)
-- These tables were created w/ uuid columns but schema uses text + CUID2 IDs
-- Order: parent PKs first, then child FKs
-- =========================================================================

-- Parent tables first (PKs)
ALTER TABLE data_classification_policy ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE data_classification_registry ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE stripe_connect_accounts ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE payment_classification_policy ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE payment_routing_rules ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE separated_payment_transactions ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE strike_fund_payment_audit ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE firewall_access_rules ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE employer_access_attempts ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE access_justification_requests ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE union_only_data_tags ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE firewall_violations ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE firewall_compliance_audit ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE whiplash_violations ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE account_balance_reconciliation ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE whiplash_prevention_audit ALTER COLUMN id TYPE text USING id::text;

-- Child columns (FKs referencing the above PKs)
ALTER TABLE firewall_access_rules ALTER COLUMN data_type_id TYPE text USING data_type_id::text;
ALTER TABLE employer_access_attempts ALTER COLUMN data_type_id TYPE text USING data_type_id::text;
ALTER TABLE access_justification_requests ALTER COLUMN data_type_id TYPE text USING data_type_id::text;
ALTER TABLE firewall_violations ALTER COLUMN data_type_id TYPE text USING data_type_id::text;

ALTER TABLE payment_routing_rules ALTER COLUMN destination_account_id TYPE text USING destination_account_id::text;
ALTER TABLE payment_routing_rules ALTER COLUMN fallback_account_id TYPE text USING fallback_account_id::text;

ALTER TABLE separated_payment_transactions ALTER COLUMN routed_to_account_id TYPE text USING routed_to_account_id::text;
ALTER TABLE separated_payment_transactions ALTER COLUMN routing_rule_id TYPE text USING routing_rule_id::text;

ALTER TABLE whiplash_violations ALTER COLUMN transaction_id TYPE text USING transaction_id::text;
ALTER TABLE whiplash_violations ALTER COLUMN expected_account_id TYPE text USING expected_account_id::text;
ALTER TABLE whiplash_violations ALTER COLUMN actual_account_id TYPE text USING actual_account_id::text;

ALTER TABLE account_balance_reconciliation ALTER COLUMN account_id TYPE text USING account_id::text;

ALTER TABLE whiplash_prevention_audit ALTER COLUMN account_id TYPE text USING account_id::text;
ALTER TABLE whiplash_prevention_audit ALTER COLUMN transaction_id TYPE text USING transaction_id::text;

-- cookie_consents (user_id is Clerk user ID, not a UUID)
ALTER TABLE cookie_consents ALTER COLUMN user_id TYPE text USING user_id::text;

-- =========================================================================
-- STEP 2: Re-add FK constraints using Drizzle-matching references
-- =========================================================================

ALTER TABLE access_justification_requests ADD CONSTRAINT access_justification_requests_data_type_id_fk FOREIGN KEY (data_type_id) REFERENCES data_classification_registry(id);
ALTER TABLE employer_access_attempts ADD CONSTRAINT employer_access_attempts_data_type_id_fk FOREIGN KEY (data_type_id) REFERENCES data_classification_registry(id);
ALTER TABLE firewall_access_rules ADD CONSTRAINT firewall_access_rules_data_type_id_fk FOREIGN KEY (data_type_id) REFERENCES data_classification_registry(id);
ALTER TABLE firewall_violations ADD CONSTRAINT firewall_violations_data_type_id_fk FOREIGN KEY (data_type_id) REFERENCES data_classification_registry(id);

ALTER TABLE account_balance_reconciliation ADD CONSTRAINT account_balance_reconciliation_account_id_fk FOREIGN KEY (account_id) REFERENCES stripe_connect_accounts(id);
ALTER TABLE payment_routing_rules ADD CONSTRAINT payment_routing_rules_destination_account_id_fk FOREIGN KEY (destination_account_id) REFERENCES stripe_connect_accounts(id);
ALTER TABLE payment_routing_rules ADD CONSTRAINT payment_routing_rules_fallback_account_id_fk FOREIGN KEY (fallback_account_id) REFERENCES stripe_connect_accounts(id);
ALTER TABLE separated_payment_transactions ADD CONSTRAINT separated_payment_transactions_routed_to_account_id_fk FOREIGN KEY (routed_to_account_id) REFERENCES stripe_connect_accounts(id);
ALTER TABLE separated_payment_transactions ADD CONSTRAINT separated_payment_transactions_routing_rule_id_fk FOREIGN KEY (routing_rule_id) REFERENCES payment_routing_rules(id);
ALTER TABLE whiplash_prevention_audit ADD CONSTRAINT whiplash_prevention_audit_account_id_fk FOREIGN KEY (account_id) REFERENCES stripe_connect_accounts(id);
ALTER TABLE whiplash_prevention_audit ADD CONSTRAINT whiplash_prevention_audit_transaction_id_fk FOREIGN KEY (transaction_id) REFERENCES separated_payment_transactions(id);
ALTER TABLE whiplash_violations ADD CONSTRAINT whiplash_violations_expected_account_id_fk FOREIGN KEY (expected_account_id) REFERENCES stripe_connect_accounts(id);
ALTER TABLE whiplash_violations ADD CONSTRAINT whiplash_violations_actual_account_id_fk FOREIGN KEY (actual_account_id) REFERENCES stripe_connect_accounts(id);
ALTER TABLE whiplash_violations ADD CONSTRAINT whiplash_violations_transaction_id_fk FOREIGN KEY (transaction_id) REFERENCES separated_payment_transactions(id);

-- =========================================================================
-- GROUP B: ALTER text → varchar (4 columns)
-- Schema defines varchar() but DB has text
-- =========================================================================

ALTER TABLE ml_predictions ALTER COLUMN prediction_type TYPE varchar(50) USING prediction_type::varchar(50);

ALTER TABLE claims ALTER COLUMN member_id TYPE varchar(255) USING member_id::varchar(255);

ALTER TABLE organization_sharing_settings ALTER COLUMN default_sharing_level TYPE varchar(50) USING default_sharing_level::varchar(50);
ALTER TABLE organization_sharing_settings ALTER COLUMN sharing_approver_role TYPE varchar(50) USING sharing_approver_role::varchar(50);

-- =========================================================================
-- GROUP C: ALTER varchar/text → enum (10 columns)
-- Schema defines pgEnum but DB columns use varchar/text
-- First correct data, ensure enum types exist, then alter columns
-- =========================================================================

-- STEP C.1: Correct data values to match enum definitions

-- claims.claim_type: map out-of-enum values
UPDATE claims SET claim_type = 'contract_dispute' WHERE claim_type = 'contract_violation';

-- claims.priority: 'urgent' is not in enum (low,medium,high,critical) → map to 'critical'
UPDATE claims SET priority = 'critical' WHERE priority = 'urgent';

-- support_tickets.category: map legacy values to enum values
UPDATE support_tickets SET category = 'account_issue' WHERE category = 'access';
UPDATE support_tickets SET category = 'billing_question' WHERE category = 'billing';
UPDATE support_tickets SET category = 'bug_report' WHERE category = 'bug';
UPDATE support_tickets SET category = 'feature_request' WHERE category = 'feature-request';
UPDATE support_tickets SET category = 'technical_support' WHERE category = 'how-to';
UPDATE support_tickets SET category = 'data_issue' WHERE category = 'integration';
UPDATE support_tickets SET category = 'training_request' WHERE category = 'training';

-- support_tickets.status: map hyphenated to underscored
UPDATE support_tickets SET status = 'in_progress' WHERE status = 'in-progress';

-- STEP C.2: ALTER columns to enum types
-- Claims table: varchar → enum
ALTER TABLE claims ALTER COLUMN claim_type TYPE claim_type USING claim_type::claim_type;
ALTER TABLE claims ALTER COLUMN status TYPE claim_status USING status::claim_status;
ALTER TABLE claims ALTER COLUMN priority TYPE claim_priority USING priority::claim_priority;

-- Grievance transitions: text → enum
ALTER TABLE grievance_transitions ALTER COLUMN trigger_type TYPE transition_trigger_type USING trigger_type::transition_trigger_type;

-- Notification tracking: text → enum
ALTER TABLE notification_tracking ALTER COLUMN type TYPE notification_type USING type::notification_type;
ALTER TABLE notification_tracking ALTER COLUMN status TYPE notification_status USING status::notification_status;
ALTER TABLE notification_tracking ALTER COLUMN priority TYPE notification_priority USING priority::notification_priority;

-- Support tickets: varchar → enum (must drop defaults first, re-add after)
ALTER TABLE support_tickets ALTER COLUMN priority DROP DEFAULT;
ALTER TABLE support_tickets ALTER COLUMN status DROP DEFAULT;
ALTER TABLE support_tickets ALTER COLUMN category TYPE ticket_category USING category::ticket_category;
ALTER TABLE support_tickets ALTER COLUMN priority TYPE ticket_priority USING priority::ticket_priority;
ALTER TABLE support_tickets ALTER COLUMN status TYPE ticket_status USING status::ticket_status;
ALTER TABLE support_tickets ALTER COLUMN priority SET DEFAULT 'medium'::ticket_priority;
ALTER TABLE support_tickets ALTER COLUMN status SET DEFAULT 'open'::ticket_status;

-- =========================================================================
-- GROUP D: ALTER document_category enum → text (1 column)
-- Schema defines text() but DB has document_category enum
-- =========================================================================

ALTER TABLE documents ALTER COLUMN category TYPE text USING category::text;

COMMIT;
