ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_periods"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "platform_invoice_line_items" ADD CONSTRAINT "platform_invoice_line_items_invoice_id_platform_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."platform_invoices"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "platform_payments" ADD CONSTRAINT "platform_payments_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "platform_payments" ADD CONSTRAINT "platform_payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_platform_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."platform_payments"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_id_platform_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."platform_invoices"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "org_subscriptions" ADD CONSTRAINT "org_subscriptions_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "org_subscriptions" ADD CONSTRAINT "org_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "org_subscriptions" ADD CONSTRAINT "org_subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "billing_adjustments" ADD CONSTRAINT "billing_adjustments_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "billing_adjustments" ADD CONSTRAINT "billing_adjustments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "billing_adjustments" ADD CONSTRAINT "billing_adjustments_invoice_id_platform_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."platform_invoices"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "allocation_rules" ADD CONSTRAINT "allocation_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "allocation_rule_versions" ADD CONSTRAINT "allocation_rule_versions_rule_id_allocation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."allocation_rules"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "allocation_runs" ADD CONSTRAINT "allocation_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "allocation_runs" ADD CONSTRAINT "allocation_runs_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_periods"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "allocation_runs" ADD CONSTRAINT "allocation_runs_rule_version_id_allocation_rule_versions_id_fk" FOREIGN KEY ("rule_version_id") REFERENCES "public"."allocation_rule_versions"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "allocation_run_lines" ADD CONSTRAINT "allocation_run_lines_run_id_allocation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."allocation_runs"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "allocation_basis_snapshots" ADD CONSTRAINT "allocation_basis_snapshots_run_id_allocation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."allocation_runs"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "chargeback_statements" ADD CONSTRAINT "chargeback_statements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "chargeback_statements" ADD CONSTRAINT "chargeback_statements_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_periods"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "chargeback_statements" ADD CONSTRAINT "chargeback_statements_allocation_run_id_allocation_runs_id_fk" FOREIGN KEY ("allocation_run_id") REFERENCES "public"."allocation_runs"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "platform_cost_ledger_entries" ADD CONSTRAINT "platform_cost_ledger_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "platform_cost_ledger_entries" ADD CONSTRAINT "platform_cost_ledger_entries_parent_organization_id_organizations_id_fk" FOREIGN KEY ("parent_organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "platform_cost_ledger_entries" ADD CONSTRAINT "platform_cost_ledger_entries_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_periods"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "platform_cost_ledger_entries" ADD CONSTRAINT "platform_cost_ledger_entries_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE restrict ON UPDATE no action;

CREATE UNIQUE INDEX "billing_accounts_org_idx" ON "billing_accounts" USING btree ("organization_id");

CREATE INDEX "billing_accounts_status_idx" ON "billing_accounts" USING btree ("status");

CREATE INDEX "platform_invoices_org_idx" ON "platform_invoices" USING btree ("organization_id");

CREATE INDEX "platform_invoices_billing_acct_idx" ON "platform_invoices" USING btree ("billing_account_id");

CREATE INDEX "platform_invoices_status_idx" ON "platform_invoices" USING btree ("status");

CREATE INDEX "platform_invoices_period_idx" ON "platform_invoices" USING btree ("billing_period_id");

CREATE INDEX "platform_line_items_invoice_idx" ON "platform_invoice_line_items" USING btree ("invoice_id");

CREATE INDEX "platform_payments_org_idx" ON "platform_payments" USING btree ("organization_id");

CREATE INDEX "platform_payments_billing_acct_idx" ON "platform_payments" USING btree ("billing_account_id");

CREATE INDEX "platform_payments_status_idx" ON "platform_payments" USING btree ("status");

CREATE INDEX "payment_allocations_payment_idx" ON "payment_allocations" USING btree ("payment_id");

CREATE INDEX "payment_allocations_invoice_idx" ON "payment_allocations" USING btree ("invoice_id");

CREATE INDEX "org_subscriptions_billing_idx" ON "org_subscriptions" USING btree ("billing_account_id");

CREATE INDEX "org_subscriptions_org_idx" ON "org_subscriptions" USING btree ("organization_id");

CREATE INDEX "org_subscriptions_status_idx" ON "org_subscriptions" USING btree ("status");

CREATE UNIQUE INDEX "billing_periods_org_label_idx" ON "billing_periods" USING btree ("organization_id","label");

CREATE INDEX "billing_adjustments_org_idx" ON "billing_adjustments" USING btree ("organization_id");

CREATE INDEX "billing_adjustments_billing_acct_idx" ON "billing_adjustments" USING btree ("billing_account_id");

CREATE INDEX "allocation_rules_org_idx" ON "allocation_rules" USING btree ("organization_id");

CREATE INDEX "arv_rule_idx" ON "allocation_rule_versions" USING btree ("rule_id");

CREATE INDEX "arv_effective_idx" ON "allocation_rule_versions" USING btree ("effective_from","effective_to");

CREATE INDEX "allocation_runs_org_idx" ON "allocation_runs" USING btree ("organization_id");

CREATE INDEX "allocation_runs_period_idx" ON "allocation_runs" USING btree ("billing_period_id");

CREATE INDEX "allocation_runs_status_idx" ON "allocation_runs" USING btree ("status");

CREATE INDEX "arl_run_idx" ON "allocation_run_lines" USING btree ("run_id");

CREATE INDEX "arl_local_idx" ON "allocation_run_lines" USING btree ("local_id");

CREATE INDEX "abs_run_idx" ON "allocation_basis_snapshots" USING btree ("run_id");

CREATE INDEX "abs_local_idx" ON "allocation_basis_snapshots" USING btree ("local_id");

CREATE INDEX "chargeback_org_idx" ON "chargeback_statements" USING btree ("organization_id");

CREATE INDEX "chargeback_local_idx" ON "chargeback_statements" USING btree ("local_id");

CREATE INDEX "chargeback_period_idx" ON "chargeback_statements" USING btree ("billing_period_id");

CREATE INDEX "pcle_org_idx" ON "platform_cost_ledger_entries" USING btree ("organization_id");

CREATE INDEX "pcle_period_idx" ON "platform_cost_ledger_entries" USING btree ("billing_period_id");

CREATE INDEX "pcle_cost_type_idx" ON "platform_cost_ledger_entries" USING btree ("cost_type");

CREATE INDEX "pcle_event_type_idx" ON "platform_cost_ledger_entries" USING btree ("event_type");

CREATE INDEX "pcle_source_idx" ON "platform_cost_ledger_entries" USING btree ("source_type","source_id");

CREATE INDEX "pcle_allocation_idx" ON "platform_cost_ledger_entries" USING btree ("allocation_status");

CREATE INDEX "pcle_created_idx" ON "platform_cost_ledger_entries" USING btree ("created_at");

CREATE INDEX "pcle_local_idx" ON "platform_cost_ledger_entries" USING btree ("local_id");

