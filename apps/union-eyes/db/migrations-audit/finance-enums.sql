CREATE TYPE "public"."allocation_method" AS ENUM('per_member_count', 'per_active_user', 'per_case_volume', 'per_local_flat', 'weighted_hybrid', 'manual_override', 'subsidized');

--> statement-breakpoint
CREATE TYPE "public"."allocation_run_status" AS ENUM('draft', 'simulated', 'pending_approval', 'approved', 'posted', 'reversed', 'failed');

--> statement-breakpoint
CREATE TYPE "public"."allocation_status" AS ENUM('unallocated', 'pending', 'allocated', 'partially_allocated', 'reversed');

--> statement-breakpoint
CREATE TYPE "public"."billing_account_status" AS ENUM('active', 'suspended', 'closed', 'pending');

--> statement-breakpoint
CREATE TYPE "public"."billing_adjustment_type" AS ENUM('credit', 'debit', 'write_off', 'subsidy', 'discount', 'refund');

--> statement-breakpoint
CREATE TYPE "public"."ledger_event_type" AS ENUM('invoice_generated', 'payment_received', 'allocation_run', 'adjustment_posted', 'credit_applied', 'subsidy_applied', 'writeoff_posted', 'period_closed', 'reversal');

--> statement-breakpoint
CREATE TYPE "public"."ledger_source_type" AS ENUM('subscription', 'invoice', 'payment', 'adjustment', 'allocation', 'manual', 'system');

--> statement-breakpoint
CREATE TYPE "public"."platform_cost_type" AS ENUM('base_subscription', 'local_fee', 'seat_fee', 'module_fee', 'usage_fee', 'onboarding_fee', 'support_fee', 'adjustment', 'credit', 'subsidy', 'writeoff');

--> statement-breakpoint
CREATE TYPE "public"."platform_invoice_status" AS ENUM('draft', 'issued', 'paid', 'partially_paid', 'overdue', 'void', 'written_off');

--> statement-breakpoint
CREATE TYPE "public"."platform_payment_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'refunded');

--> statement-breakpoint
CREATE TYPE "public"."pricing_model" AS ENUM('flat', 'per_local', 'per_seat', 'per_module', 'tiered', 'hybrid');

--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'trialing', 'past_due', 'cancelled', 'paused');

--> statement-breakpoint
CREATE TYPE "public"."chargeback_status" AS ENUM('draft', 'issued', 'acknowledged', 'disputed', 'resolved');

--> statement-breakpoint
