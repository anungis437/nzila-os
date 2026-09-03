/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 30: closes a systemic blind spot found by independent
 * review of round 29/round-1 finance.ts convergence. That round's
 * reachability scans only covered this Next.js app's app/api, actions,
 * lib, services — they never looked at apps/union-eyes/backend, a
 * deployed Django REST backend (mounted at api/billing/, api/compliance/,
 * etc. in config/urls.py; built by apps/union-eyes/backend/Dockerfile and
 * pushed/deployed by .github/workflows/deploy-union-eyes.yml). That
 * backend's auto-generated DRF routers exposed 10 tables this registry
 * had marked LATENT_UNREACHABLE in finance.ts alone — including a full
 * unscoped CRUD ModelViewSet over strike_fund_disbursements, a table with
 * no tenant key at all. finance.ts's 10 have already been reopened this
 * round (see finance.ts's per-table `reason` fields).
 *
 * Running this scanner against the FULL manifest (not just finance.ts)
 * found the same blind spot is repo-wide: KNOWN_PRE_EXISTING_VIOLATIONS
 * below is the exact baseline of additional LATENT_UNREACHABLE entries,
 * outside finance.ts, that also have a live router-registered Django
 * ModelViewSet as of this round. Reclassifying all ~158 of those (each
 * needs the same individual evidence-gathering as finance.ts's 10: org
 * column presence, permission_classes, sensitivity, fail-closed decision)
 * is explicitly OUT OF SCOPE for this round — it is deferred to dedicated
 * per-domain-file remediation rounds. This test is a RATCHET, not a full
 * fix: it fails immediately on any table NOT already in the known
 * baseline (preventing new/future blind-spot regressions), and separately
 * asserts the baseline itself doesn't grow. As each domain file's
 * violations get reclassified in a future round, remove the corresponding
 * table(s) from KNOWN_PRE_EXISTING_VIOLATIONS so this test keeps ratcheting
 * toward zero.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { storageAuthorityManifest } from '../rls-storage-authority';

const BACKEND_ROOT = join(__dirname, '..', '..', 'backend');

/**
 * Baseline of LATENT_UNREACHABLE manifest entries (outside finance.ts,
 * which was fully reopened this round) already known to have a live
 * Django ModelViewSet as of PR #752 round 30. Tracked here — not silently
 * ignored — so this is a visible, shrinking TODO list rather than a
 * permanent exemption. Do not add new tables here; fix the manifest entry
 * instead. Only remove entries here once actually reclassified.
 */
const KNOWN_PRE_EXISTING_VIOLATIONS = new Set<string>([
  'ai_rate_limits', 'analytics_scheduled_reports', 'impact_metrics', 'page_analytics',
  'user_engagement_scores', 'member_documents', 'safety_committee_meetings', 'safety_audits',
  'injury_logs', 'safety_policies', 'corrective_actions', 'safety_certifications',
  'message_participants', 'message_notifications', 'grievance_assignments', 'deadline_alerts',
  'deadline_extensions', 'deadline_rules', 'claim_precedent_analysis', 'grievance_approvals',
  'grievance_communications', 'grievance_stages', 'grievance_workflows', 'union_representation_votes',
  'workflow_definitions', 'workflow_executions', 'grievance_responses', 'chatbot_analytics',
  'chatbot_suggestions', 'communication_analytics', 'communication_channels', 'mobile_notifications',
  'notification_bounces', 'notification_history', 'notification_log', 'organizing_campaign_milestones',
  'sms_rate_limits', 'federation_campaigns', 'federation_communications', 'cms_templates',
  'newsletter_templates', 'push_notification_templates', 'report_templates', 'signature_templates',
  'bank_accounts', 'bank_reconciliation', 'bank_reconciliations', 'clc_remittance_mapping',
  'donation_receipts', 'dues_rates', 'erp_invoices', 'gl_transaction_log',
  'payment_cycles', 'payment_disputes', 'federation_remittances', 'payment_classification_policy',
  'board_packet_templates', 'congress_memberships', 'board_packet_sections', 'committee_memberships',
  'conflict_review_committee', 'accessibility_audits', 'financial_audit_log', 'clc_webhook_log',
  'erp_connectors', 'webhook_deliveries', 'integration_sync_log', 'job_classifications',
  'job_postings', 'job_saved', 'stripe_webhook_events', 'webhook_subscriptions',
  'integration_sync_logs', 'signature_webhooks_log', 'job_applications', 'member_addresses',
  'member_consents', 'member_contact_preferences', 'member_employment_details', 'member_leaves',
  'member_relationship_scores', 'organization_benchmark_snapshots', 'organization_contacts',
  'organization_sharing_settings', 'role_tenure_history', 'federation_memberships', 'gss_applications',
  'indigenous_member_data', 'organization_sharing_grants', 'accessibility_issues', 'accessibility_test_suites',
  'accessibility_user_testing', 'alert_escalations', 'api_access_tokens', 'calendar_sharing',
  'card_signing_events', 'clause_comparisons_history', 'clc_api_config', 'cms_blocks',
  'cms_navigation_menus', 'comparative_analyses', 'data_anonymization_log', 'data_processing_records',
  'data_residency_configs', 'data_retention_policies', 'dsr_requests', 'employer_responses',
  'employment_history', 'event_check_ins', 'event_registrations', 'event_reminders',
  'field_notes', 'field_organizer_activities', 'user_sessions', 'journal_entries',
  'mfa_configurations', 'mobile_app_config', 'nlrb_clrb_filings', 'organizer_impacts',
  'organizing_contacts', 'outreach_enrollments', 'outreach_sequences', 'outreach_steps_log',
  'pack_download_log', 'pci_dss_cardholder_data_flow', 'program_enrollments', 'public_events',
  'report_delivery_history', 'report_executions', 'report_shares', 'room_bookings',
  'scheduled_reports', 'scim_configurations', 'scim_events_log', 'segment_exports',
  'social_engagement', 'social_feeds', 'sso_sessions', 'task_comments',
  'website_settings', 'ab_test_assignments', 'ab_test_events', 'alert_actions',
  'alert_conditions', 'automation_execution_log', 'automation_schedules', 'bank_transactions',
  'benchmark_categories', 'benchmark_data', 'conflict_training', 'dsr_activity_log',
  'federation_executives', 'federation_meetings', 'federation_resources', 'journal_entry_lines',
  'lrb_employers', 'lrb_unions', 'pack_verification_log', 'segment_executions',
  'wcag_success_criteria',
]);


function listDjangoAppDirs(): string[] {
  return readdirSync(BACKEND_ROOT).filter((name) => {
    const full = join(BACKEND_ROOT, name);
    if (!statSync(full).isDirectory()) return false;
    try {
      statSync(join(full, 'urls.py'));
      statSync(join(full, 'views.py'));
      statSync(join(full, 'models.py'));
      return true;
    } catch {
      return false;
    }
  });
}

/** router.register(r'some-route', views.SomeViewSet) -> Map<ViewSetClassName, routePath> */
function parseRouterRegistrations(urlsSource: string): Map<string, string> {
  const registrations = new Map<string, string>();
  const re = /router\.register\(\s*r?["']([^"']+)["']\s*,\s*views\.(\w+)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(urlsSource)) !== null) {
    registrations.set(m[2], m[1]);
  }
  return registrations;
}

/** class SomeViewSet(viewsets.ModelViewSet): ... queryset = SomeModel.objects... -> Map<ViewSetClassName, ModelClassName> */
function parseViewSetToModel(viewsSource: string): Map<string, string> {
  const mapping = new Map<string, string>();
  const classBlocks = viewsSource.split(/\nclass /).slice(1);
  for (const block of classBlocks) {
    const nameMatch = block.match(/^(\w+)/);
    const queryMatch = block.match(/queryset\s*=\s*(\w+)\.objects/);
    if (nameMatch && queryMatch) {
      mapping.set(nameMatch[1], queryMatch[1]);
    }
  }
  return mapping;
}

/** class SomeModel(BaseModel): ... db_table = 'some_table' -> Map<ModelClassName, physicalTableName> */
function parseModelToTable(modelsSource: string): Map<string, string> {
  const mapping = new Map<string, string>();
  const classBlocks = modelsSource.split(/\nclass /).slice(1);
  for (const block of classBlocks) {
    const nameMatch = block.match(/^(\w+)/);
    const tableMatch = block.match(/db_table\s*=\s*['"]([\w]+)['"]/);
    if (nameMatch && tableMatch) {
      mapping.set(nameMatch[1], tableMatch[1]);
    }
  }
  return mapping;
}

/** Physical table names with a live, router-mounted Django ModelViewSet, per Django app. */
function liveDjangoTablesByApp(): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const app of listDjangoAppDirs()) {
    const urlsSource = readFileSync(join(BACKEND_ROOT, app, 'urls.py'), 'utf8');
    const viewsSource = readFileSync(join(BACKEND_ROOT, app, 'views.py'), 'utf8');
    const modelsSource = readFileSync(join(BACKEND_ROOT, app, 'models.py'), 'utf8');

    const registrations = parseRouterRegistrations(urlsSource);
    const viewSetToModel = parseViewSetToModel(viewsSource);
    const modelToTable = parseModelToTable(modelsSource);

    const tables = new Set<string>();
    for (const viewSetName of registrations.keys()) {
      const modelName = viewSetToModel.get(viewSetName);
      if (!modelName) continue;
      const table = modelToTable.get(modelName);
      if (table) tables.add(table);
    }
    result.set(app, tables);
  }
  return result;
}

describe('Django billing/etc. backend router reachability vs storageAuthorityManifest', () => {
  it('sanity check: the scanner finds a substantial number of Django apps and live router-registered tables (catches a silently-broken scanner)', () => {
    const byApp = liveDjangoTablesByApp();
    expect(byApp.size).toBeGreaterThanOrEqual(10);
    const totalTables = [...byApp.values()].reduce((sum, set) => sum + set.size, 0);
    expect(totalTables).toBeGreaterThan(100);
  });

  it('NO manifest entry classified LATENT_UNREACHABLE corresponds to a table with a live, router-registered Django ModelViewSet, other than the tracked pre-existing baseline', () => {
    const byApp = liveDjangoTablesByApp();
    const allLiveDjangoTables = new Map<string, string>(); // table -> app
    for (const [app, tables] of byApp) {
      for (const table of tables) {
        if (!allLiveDjangoTables.has(table)) allLiveDjangoTables.set(table, app);
      }
    }

    const violations = storageAuthorityManifest
      .filter((entry) => entry.classification === 'LATENT_UNREACHABLE')
      .filter((entry) => allLiveDjangoTables.has(entry.table))
      .map((entry) => entry.table);

    const newViolations = violations
      .filter((table) => !KNOWN_PRE_EXISTING_VIOLATIONS.has(table))
      .map((table) => `${table} (Django app: ${allLiveDjangoTables.get(table)})`);

    expect(
      newViolations,
      `NEW table(s) classified LATENT_UNREACHABLE despite a live, router-registered ` +
        `Django ModelViewSet (apps/union-eyes/backend) — these were not in the tracked ` +
        `pre-existing baseline and must be reclassified: ${newViolations.join(', ')}`,
    ).toEqual([]);
  });

  it('the tracked pre-existing-violations baseline has not grown (ratchet: only shrink it as domain files get reclassified)', () => {
    const byApp = liveDjangoTablesByApp();
    const allLiveDjangoTables = new Set<string>();
    for (const tables of byApp.values()) {
      for (const table of tables) allLiveDjangoTables.add(table);
    }

    const currentViolationCount = storageAuthorityManifest
      .filter((entry) => entry.classification === 'LATENT_UNREACHABLE')
      .filter((entry) => allLiveDjangoTables.has(entry.table)).length;

    expect(currentViolationCount).toBeLessThanOrEqual(KNOWN_PRE_EXISTING_VIOLATIONS.size);
  });

  it('REGRESSION FIXTURE: parseRouterRegistrations/parseViewSetToModel/parseModelToTable correctly resolve billing.urls\' strike-fund-disbursements route to the physical strike_fund_disbursements table', () => {
    const urlsSource = readFileSync(join(BACKEND_ROOT, 'billing', 'urls.py'), 'utf8');
    const viewsSource = readFileSync(join(BACKEND_ROOT, 'billing', 'views.py'), 'utf8');
    const modelsSource = readFileSync(join(BACKEND_ROOT, 'billing', 'models.py'), 'utf8');

    const registrations = parseRouterRegistrations(urlsSource);
    expect(registrations.get('StrikeFundDisbursementsViewSet')).toBe('strike-fund-disbursements');

    const viewSetToModel = parseViewSetToModel(viewsSource);
    expect(viewSetToModel.get('StrikeFundDisbursementsViewSet')).toBe('StrikeFundDisbursements');

    const modelToTable = parseModelToTable(modelsSource);
    expect(modelToTable.get('StrikeFundDisbursements')).toBe('strike_fund_disbursements');
  });
});
