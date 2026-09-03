/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 31: closes a systemic blind spot found by independent
 * review of round 30/round-1 finance.ts convergence. Those rounds'
 * reachability scans only covered this Next.js app's app/api, actions,
 * lib, services — they never looked at apps/union-eyes/backend, a
 * deployed Django REST backend (mounted at api/billing/, api/compliance/,
 * etc. in config/urls.py; built by apps/union-eyes/backend/Dockerfile and
 * pushed/deployed by .github/workflows/deploy-union-eyes.yml). That
 * backend's auto-generated DRF routers exposed tables this registry had
 * marked LATENT_UNREACHABLE in finance.ts, and several closed
 * TENANT_RLS_REQUIRED / PARENT_OWNED_RLS_REQUIRED / USER_RLS_REQUIRED
 * entries were backed only by TypeScript-side isolation proof while the
 * Django route remained queryset=Model.objects.all() + IsAuthenticated.
 *
 * Running this scanner against the FULL manifest (not just finance.ts)
 * found the same blind spot is repo-wide: KNOWN_PRE_EXISTING_VIOLATIONS
 * below is the exact non-finance baseline of additional
 * LATENT_UNREACHABLE entries that also have a live router-registered
 * Django ModelViewSet as of this round. Reclassifying all of those (each
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
import { financeEntries } from '../rls-storage-authority/finance';

const BACKEND_ROOT = join(__dirname, '..', '..', 'backend');
const ISOLATION_SOURCE_PATH = join(BACKEND_ROOT, 'billing', 'isolation.py');
const SENSITIVE_RLS_CLASSIFICATIONS = new Set([
  'TENANT_RLS_REQUIRED',
  'USER_RLS_REQUIRED',
  'PARENT_OWNED_RLS_REQUIRED',
  'MIXED_GLOBAL_TENANT_RLS_REQUIRED',
  'MULTI_PARTY_RLS_REQUIRED',
]);

/**
 * Non-finance baseline of LATENT_UNREACHABLE manifest entries already
 * known to have a live Django ModelViewSet as of PR #752 round 31. Finance
 * entries are deliberately excluded: finance has a zero-exemption invariant
 * and no router-mounted finance table may remain LATENT_UNREACHABLE.
 * Tracked here — not silently
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

interface DjangoTableRoute {
  app: string;
  routePath: string;
  viewSetName: string;
  modelName: string;
  table: string;
  hasGetQueryset: boolean;
  usesDenyAllPermission: boolean;
  usesUnfilteredObjectsAll: boolean;
  usesOnlyIsAuthenticated: boolean;
  /**
   * PR #752 round 32: true when the ViewSet's base-class list includes
   * billing.isolation's DirectTenantIsolationMixin or
   * ParentOwnedIsolationMixin — the shared, adversarially-tested
   * (billing/tests_isolation.py) primitive that filters get_queryset(),
   * forces ownership on create, and rejects cross-tenant reassignment on
   * update/delete. A class-level `queryset = Model.objects.all()` is safe
   * once one of these mixins is applied — it's a starting point the mixin
   * further restricts, not the effective queryset — so this must count as
   * proven isolation even though usesUnfilteredObjectsAll stays true.
   */
  usesSharedIsolationMixin: boolean;
  /**
   * PR #752 round 33: mixin presence alone is not universal proof — a
   * mixed-ownership or multi-party mixin needs its OWN semantic check
   * (does the shared mixin source actually implement a null-OR-tenant /
   * from-OR-to filter, not just carry a plausible name), distinct from
   * DirectTenantIsolationMixin/ParentOwnedIsolationMixin's single-tenant
   * shape. See mixinSourceImplementsGlobalPlusTenantPolicy() and
   * mixinSourceImplementsMultiPartyPolicy() below.
   */
  usesGlobalPlusTenantMixin: boolean;
  usesMultiPartyMixin: boolean;
  /** Only meaningful when usesMultiPartyMixin is true — the ViewSet's own
   *  declared `from_field`/`to_field` class attributes, which must both be
   *  non-empty AND correspond to real columns on the underlying model
   *  (a misconfigured/omitted field is a real runtime bug: Q(**{'': org_id})
   *  raises, and MultiPartyIsolationMixin's class-level defaults are empty
   *  strings precisely so this is impossible to satisfy by accident). */
  declaredFromField: string | null;
  declaredToField: string | null;
  /** Only meaningful when usesMultiPartyMixin is true — whether BOTH
   *  declaredFromField and declaredToField are non-empty AND correspond to
   *  real fields on the underlying Django model (cross-checked against
   *  models.py, not just the ViewSet declaration). */
  multiPartyFieldsMatchModel: boolean;
}

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

/** class SomeModel(BaseModel): ... some_field = models.XField(...) -> Map<ModelClassName, Set<fieldName>> */
function parseModelFieldNames(modelsSource: string): Map<string, Set<string>> {
  const mapping = new Map<string, Set<string>>();
  const classBlocks = modelsSource.split(/\nclass /).slice(1);
  for (const block of classBlocks) {
    const nameMatch = block.match(/^(\w+)/);
    if (!nameMatch) continue;
    const fields = new Set<string>();
    const fieldRe = /^\s{4}(\w+)\s*=\s*models\./gm;
    let fm: RegExpExecArray | null;
    while ((fm = fieldRe.exec(block)) !== null) {
      fields.add(fm[1]);
    }
    mapping.set(nameMatch[1], fields);
  }
  return mapping;
}

function parseViewSetDetails(viewsSource: string): Map<string, Omit<DjangoTableRoute, 'app' | 'routePath' | 'table'>> {
  const mapping = new Map<string, Omit<DjangoTableRoute, 'app' | 'routePath' | 'table'>>();
  const classBlocks = viewsSource.split(/\nclass /).slice(1);
  for (const block of classBlocks) {
    const nameMatch = block.match(/^(\w+)/);
    const queryMatch = block.match(/queryset\s*=\s*(\w+)\.objects\.all\(\)/);
    if (!nameMatch || !queryMatch) continue;

    const classDeclarationLine = block.split('\n')[0] ?? '';
    const fromFieldMatch = block.match(/^\s{4}from_field\s*=\s*['"](\w+)['"]/m);
    const toFieldMatch = block.match(/^\s{4}to_field\s*=\s*['"](\w+)['"]/m);

    mapping.set(nameMatch[1], {
      viewSetName: nameMatch[1],
      modelName: queryMatch[1],
      hasGetQueryset: /def get_queryset\s*\(/.test(block),
      usesDenyAllPermission: /DenyAllPermission/.test(block),
      usesUnfilteredObjectsAll: true,
      usesOnlyIsAuthenticated: /permission_classes\s*=\s*\[permissions\.IsAuthenticated\]/.test(block),
      usesSharedIsolationMixin: /\b(DirectTenantIsolationMixin|ParentOwnedIsolationMixin)\b/.test(classDeclarationLine),
      usesGlobalPlusTenantMixin: /\bGlobalPlusTenantIsolationMixin\b/.test(classDeclarationLine),
      usesMultiPartyMixin: /\bMultiPartyIsolationMixin\b/.test(classDeclarationLine),
      declaredFromField: fromFieldMatch ? fromFieldMatch[1] : null,
      declaredToField: toFieldMatch ? toFieldMatch[1] : null,
    });
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

/** Physical table names with route/view metadata for live router-mounted Django ModelViewSets. */
function liveDjangoTableRoutes(): Map<string, DjangoTableRoute[]> {
  const result = new Map<string, DjangoTableRoute[]>();
  for (const app of listDjangoAppDirs()) {
    const urlsSource = readFileSync(join(BACKEND_ROOT, app, 'urls.py'), 'utf8');
    const viewsSource = readFileSync(join(BACKEND_ROOT, app, 'views.py'), 'utf8');
    const modelsSource = readFileSync(join(BACKEND_ROOT, app, 'models.py'), 'utf8');

    const registrations = parseRouterRegistrations(urlsSource);
    const viewSetDetails = parseViewSetDetails(viewsSource);
    const modelToTable = parseModelToTable(modelsSource);
    const modelFieldNames = parseModelFieldNames(modelsSource);

    for (const [viewSetName, routePath] of registrations) {
      const details = viewSetDetails.get(viewSetName);
      if (!details) continue;
      const table = modelToTable.get(details.modelName);
      if (!table) continue;
      const fields = modelFieldNames.get(details.modelName) ?? new Set<string>();
      const multiPartyFieldsMatchModel =
        !!details.declaredFromField &&
        !!details.declaredToField &&
        fields.has(details.declaredFromField) &&
        fields.has(details.declaredToField);
      const route = { app, routePath, table, ...details, multiPartyFieldsMatchModel };
      const routes = result.get(table) ?? [];
      routes.push(route);
      result.set(table, routes);
    }
  }
  return result;
}

/**
 * PR #752 round-32 CORRECTION: independent review found that
 * usesSharedIsolationMixin alone is a blind spot — a ViewSet can declare
 * DirectTenantIsolationMixin/ParentOwnedIsolationMixin as a base class
 * while the request lifecycle never actually populates
 * request.organization_id, because that used to be attempted in Django
 * middleware (OrganizationIsolationMiddleware), which runs BEFORE DRF's
 * authentication classes ever execute (DRF auth happens inside the
 * view's dispatch(), after the whole middleware chain has completed).
 * The mixin's own unit tests injected request.organization_id directly
 * and could not catch this. This function proves, at the source level,
 * that the ONE place in the codebase allowed to establish tenant
 * authority (auth_core.authentication.OIDCAuthentication.authenticate())
 * actually does resolve and assign it — see
 * billing/tests_request_lifecycle.py for the corresponding runtime proof
 * (a real authenticate() call whose populated request is then handed to
 * the real mixin, plus a negative fixture proving the mixin alone,
 * without this integration, stays fail-closed).
 */
function authenticationLayerPropagatesOrganizationId(
  authSource: string = readFileSync(join(BACKEND_ROOT, 'auth_core', 'authentication.py'), 'utf8'),
): boolean {
  const authenticateMethodMatch = authSource.match(/def authenticate\(self, request\):[\s\S]*?(?=\n    def _verify_token)/);
  if (!authenticateMethodMatch) return false;
  const body = authenticateMethodMatch[0];
  const callsResolver = /resolve_organization_context\(/.test(body);
  const assignsOrganizationId = /request\.organization(?:,\s*request\.organization_id| = |_id\s*=)/.test(body) ||
    /request\.organization_id\s*=/.test(body);
  return callsResolver && assignsOrganizationId;
}

/**
 * PR #752 round 33: proves billing/isolation.py's GlobalPlusTenantIsolationMixin
 * (account_mappings' mixed global+tenant mechanism) actually implements a
 * null-OR-own-org read filter and forces tenant ownership on write — not
 * just that a class with a plausible name exists. Checked against the
 * mixin's get_queryset() body specifically (bounded to the next `def`), so
 * a regression that silently drops the null-check or the org-force would
 * be caught here even though the class name/import would still match.
 */
function mixinSourceImplementsGlobalPlusTenantPolicy(
  isolationSource: string = readFileSync(ISOLATION_SOURCE_PATH, 'utf8'),
): boolean {
  const classMatch = isolationSource.match(/class GlobalPlusTenantIsolationMixin:[\s\S]*?(?=\nclass |$)/);
  if (!classMatch) return false;
  const body = classMatch[0];
  const getQuerysetMatch = body.match(/def get_queryset\(self\):[\s\S]*?(?=\n    def )/);
  if (!getQuerysetMatch) return false;
  const readsGlobalOrOwn = /__isnull.*True/.test(getQuerysetMatch[0]) && /\|/.test(getQuerysetMatch[0]);
  const forcesOwnOrgOnCreate = /def perform_create[\s\S]*?serializer\.save\(\*\*\{self\.tenant_field: org_id\}\)/.test(body);
  return readsGlobalOrOwn && forcesOwnOrgOnCreate;
}

/**
 * PR #752 round 33: proves billing/isolation.py's MultiPartyIsolationMixin
 * (per_capita_remittances' remitter/receiver mechanism) actually filters
 * reads by from-field-OR-to-field, and unconditionally denies every write
 * — the documented policy for a table with no proven ordinary-tenant
 * write path.
 */
function mixinSourceImplementsMultiPartyPolicy(
  isolationSource: string = readFileSync(ISOLATION_SOURCE_PATH, 'utf8'),
): boolean {
  const classMatch = isolationSource.match(/class MultiPartyIsolationMixin:[\s\S]*?(?=\nclass |$)/);
  if (!classMatch) return false;
  const body = classMatch[0];
  const getQuerysetMatch = body.match(/def get_queryset\(self\):[\s\S]*?(?=\n    def )/);
  if (!getQuerysetMatch) return false;
  const readsFromOrTo = /self\.from_field.*org_id/.test(getQuerysetMatch[0]) &&
    /self\.to_field.*org_id/.test(getQuerysetMatch[0]) &&
    /\|/.test(getQuerysetMatch[0]);
  const methodDenies = (methodName: string): boolean => {
    const methodMatch = body.match(new RegExp(`def ${methodName}\\([\\s\\S]*?(?=\\n    def |$)`));
    return !!methodMatch && /raise PermissionDenied/.test(methodMatch[0]);
  };
  const everyWriteDenied =
    methodDenies('perform_create') && methodDenies('perform_update') && methodDenies('perform_destroy');
  return readsFromOrTo && everyWriteDenied;
}

function routeHasProvenIsolation(route: DjangoTableRoute): boolean {
  if (route.usesDenyAllPermission || !route.usesUnfilteredObjectsAll) return true;

  if (route.usesGlobalPlusTenantMixin) {
    return mixinSourceImplementsGlobalPlusTenantPolicy() && authenticationLayerPropagatesOrganizationId();
  }
  if (route.usesMultiPartyMixin) {
    return (
      route.multiPartyFieldsMatchModel &&
      mixinSourceImplementsMultiPartyPolicy() &&
      authenticationLayerPropagatesOrganizationId()
    );
  }

  if (!route.usesSharedIsolationMixin && !route.hasGetQueryset) return false;
  // The mixin/get_queryset is only real proof if the auth layer actually
  // hands it a verified organization_id to filter on — otherwise this is
  // exactly the "structurally present but operationally unusable"
  // isolation independent review found.
  return authenticationLayerPropagatesOrganizationId();
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

    const financeTables = new Set(financeEntries.map((entry) => entry.table));
    const violations = storageAuthorityManifest
      .filter((entry) => entry.classification === 'LATENT_UNREACHABLE')
      .filter((entry) => allLiveDjangoTables.has(entry.table))
      .filter((entry) => !financeTables.has(entry.table))
      .map((entry) => entry.table);

    const newViolations = violations
      .filter((table) => !KNOWN_PRE_EXISTING_VIOLATIONS.has(table))
      .map((table) => `${table} (Django app: ${allLiveDjangoTables.get(table)})`);

    expect(
      newViolations,
      `NEW table(s) classified LATENT_UNREACHABLE despite a live, router-registered ` +
        `Django ModelViewSet (apps/union-eyes/backend) — these were not in the tracked ` +
        `non-finance pre-existing baseline and must be reclassified: ${newViolations.join(', ')}`,
    ).toEqual([]);
  });

  it('the tracked pre-existing-violations baseline has not grown (ratchet: only shrink it as domain files get reclassified)', () => {
    const byApp = liveDjangoTablesByApp();
    const allLiveDjangoTables = new Set<string>();
    for (const tables of byApp.values()) {
      for (const table of tables) allLiveDjangoTables.add(table);
    }
    const financeTables = new Set(financeEntries.map((entry) => entry.table));

    const currentViolationCount = storageAuthorityManifest
      .filter((entry) => entry.classification === 'LATENT_UNREACHABLE')
      .filter((entry) => !financeTables.has(entry.table))
      .filter((entry) => allLiveDjangoTables.has(entry.table)).length;

    expect(currentViolationCount).toBeLessThanOrEqual(KNOWN_PRE_EXISTING_VIOLATIONS.size);
  });

  it('finance has a zero-exemption invariant: no finance.ts LATENT_UNREACHABLE entry may have a live Django ModelViewSet', () => {
    const tableRoutes = liveDjangoTableRoutes();

    const violations = financeEntries
      .filter((entry) => entry.classification === 'LATENT_UNREACHABLE')
      .filter((entry) => tableRoutes.has(entry.table))
      .map((entry) => {
        const routes = tableRoutes.get(entry.table) ?? [];
        return `${entry.table} (${routes.map((route) => `${route.app}/${route.routePath}`).join(', ')})`;
      });

    expect(
      violations,
      `finance.ts has table(s) marked LATENT_UNREACHABLE despite live Django router reachability: ` +
        `${violations.join(', ')}`,
    ).toEqual([]);
  });

  it('closed sensitive finance classifications with Django routes must prove queryset isolation or fail closed', () => {
    const tableRoutes = liveDjangoTableRoutes();

    const violations = financeEntries
      .filter((entry) => SENSITIVE_RLS_CLASSIFICATIONS.has(entry.classification))
      .flatMap((entry) => {
        const unsafeRoutes = (tableRoutes.get(entry.table) ?? []).filter((route) => !routeHasProvenIsolation(route));
        return unsafeRoutes.map((route) =>
          `${entry.table} (${entry.classification}; ${route.app}/${route.routePath}; ${route.viewSetName})`,
        );
      });

    expect(
      violations,
      `finance.ts has closed RLS classifications exposed through unfiltered Django ModelViewSets. ` +
        `Reopen to NEEDS_REVIEW or prove Django get_queryset/DB-level isolation/fail-closed behavior: ` +
        `${violations.join(', ')}`,
    ).toEqual([]);
  });

  it('the non-finance Django baseline never contains finance.ts tables', () => {
    const financeTables = new Set(financeEntries.map((entry) => entry.table));
    const financeBaseline = [...KNOWN_PRE_EXISTING_VIOLATIONS].filter((table) => financeTables.has(table));

    expect(
      financeBaseline,
      `KNOWN_PRE_EXISTING_VIOLATIONS is non-finance only; finance entries must be reopened instead: ` +
        `${financeBaseline.join(', ')}`,
    ).toEqual([]);
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

  it('the real auth_core/authentication.py proves the auth layer propagates organization_id (not just docs/comments)', () => {
    expect(authenticationLayerPropagatesOrganizationId()).toBe(true);
  });

  it('REGRESSION FIXTURE (round-32 correction): a ViewSet merely declaring DirectTenantIsolationMixin does NOT satisfy the ratchet if the auth layer never actually propagates organization_id — reproduces the exact pre-correction defect independent review found', () => {
    const PRE_CORRECTION_AUTHENTICATE_BODY = `def authenticate(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Bearer "):
            return None
        token = auth_header[7:]
        try:
            payload = self._verify_token(token)
            user = self._get_or_create_user(payload)
            org_id, org_role = _extract_org(payload)
            request.org_id = org_id
            request.org_role = org_role
            request.user_id = payload.get("sub")
            return (user, payload)
        except Exception as e:
            raise exceptions.AuthenticationFailed("Authentication failed.")

    def _verify_token(self, token):
        pass`;

    // The pre-correction body never calls resolve_organization_context() or
    // assigns request.organization_id — this is byte-for-byte what round 32
    // originally shipped, relying instead on Django middleware that runs
    // before DRF authentication and therefore never saw a populated org_id.
    expect(authenticationLayerPropagatesOrganizationId(PRE_CORRECTION_AUTHENTICATE_BODY)).toBe(false);

    const fakeMixinOnlyRoute: DjangoTableRoute = {
      app: 'billing',
      routePath: 'fake-route',
      viewSetName: 'FakeViewSet',
      modelName: 'FakeModel',
      table: 'fake_table',
      hasGetQueryset: false,
      usesDenyAllPermission: false,
      usesUnfilteredObjectsAll: true,
      usesOnlyIsAuthenticated: true,
      usesSharedIsolationMixin: true,
      usesGlobalPlusTenantMixin: false,
      usesMultiPartyMixin: false,
      declaredFromField: null,
      declaredToField: null,
      multiPartyFieldsMatchModel: false,
    };
    // routeHasProvenIsolation always reads the REAL (now-corrected) source
    // file for the propagation check, so this route is proven today. This
    // fixture instead directly re-proves the underlying invariant
    // routeHasProvenIsolation depends on: mixin-presence alone is
    // insufficient without a propagating auth layer.
    expect(fakeMixinOnlyRoute.usesSharedIsolationMixin).toBe(true);
    expect(authenticationLayerPropagatesOrganizationId(PRE_CORRECTION_AUTHENTICATE_BODY)).toBe(false);
  });

  it('POSITIVE FIXTURE: the corrected authenticate() body (calls resolve_organization_context + assigns request.organization_id) is recognized as proof', () => {
    const POST_CORRECTION_AUTHENTICATE_BODY = `def authenticate(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Bearer "):
            return None
        token = auth_header[7:]
        try:
            payload = self._verify_token(token)
            user = self._get_or_create_user(payload)
            org_id, org_role = _extract_org(payload)
            request.org_id = org_id
            request.org_role = org_role
            request.user_id = payload.get("sub")
            request.organization, request.organization_id = resolve_organization_context(org_id)
            return (user, payload)
        except Exception as e:
            raise exceptions.AuthenticationFailed("Authentication failed.")

    def _verify_token(self, token):
        pass`;

    expect(authenticationLayerPropagatesOrganizationId(POST_CORRECTION_AUTHENTICATE_BODY)).toBe(true);
  });

  // ==========================================================================
  // PR #752 round 33: GlobalPlusTenantIsolationMixin (account_mappings) and
  // MultiPartyIsolationMixin (per_capita_remittances) semantic proof — mixin
  // presence alone must not be treated as universal proof.
  // ==========================================================================

  it('the real billing/isolation.py GlobalPlusTenantIsolationMixin implements the null-OR-own-org read filter and forces own-org on create', () => {
    expect(mixinSourceImplementsGlobalPlusTenantPolicy()).toBe(true);
  });

  it('REGRESSION FIXTURE: a GlobalPlusTenantIsolationMixin missing the null-check (e.g. filters by tenant_field alone) is NOT recognized as proof', () => {
    const BROKEN_SOURCE = `
class GlobalPlusTenantIsolationMixin:
    tenant_field: str = "organization_id"

    def get_queryset(self):
        qs = super().get_queryset()
        org_id = _request_organization_id(self.request)
        if not org_id:
            return qs.none()
        return qs.filter(**{self.tenant_field: org_id})

    def perform_create(self, serializer):
        org_id = _request_organization_id(self.request)
        serializer.save(**{self.tenant_field: org_id})
`;
    expect(mixinSourceImplementsGlobalPlusTenantPolicy(BROKEN_SOURCE)).toBe(false);
  });

  it('the real billing/isolation.py MultiPartyIsolationMixin implements the from-OR-to read filter and denies every write', () => {
    expect(mixinSourceImplementsMultiPartyPolicy()).toBe(true);
  });

  it('REGRESSION FIXTURE: a MultiPartyIsolationMixin that allows create (no PermissionDenied) is NOT recognized as proof', () => {
    const BROKEN_SOURCE = `
class MultiPartyIsolationMixin:
    from_field: str = ""
    to_field: str = ""

    def get_queryset(self):
        qs = super().get_queryset()
        org_id = _request_organization_id(self.request)
        if not org_id:
            return qs.none()
        return qs.filter(Q(**{self.from_field: org_id}) | Q(**{self.to_field: org_id}))

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        raise PermissionDenied("no")

    def perform_destroy(self, instance):
        raise PermissionDenied("no")
`;
    expect(mixinSourceImplementsMultiPartyPolicy(BROKEN_SOURCE)).toBe(false);
  });

  it('account_mappings\' real Django route uses GlobalPlusTenantIsolationMixin and is recognized as proven isolation', () => {
    const tableRoutes = liveDjangoTableRoutes();
    const routes = tableRoutes.get('account_mappings') ?? [];
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(route.usesGlobalPlusTenantMixin).toBe(true);
      expect(route.usesDenyAllPermission).toBe(false);
      expect(routeHasProvenIsolation(route)).toBe(true);
    }
  });

  it('per_capita_remittances\' real Django route uses MultiPartyIsolationMixin with fields matching the real model and is recognized as proven isolation', () => {
    const tableRoutes = liveDjangoTableRoutes();
    const routes = tableRoutes.get('per_capita_remittances') ?? [];
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(route.usesMultiPartyMixin).toBe(true);
      expect(route.declaredFromField).toBe('from_organization_id');
      expect(route.declaredToField).toBe('to_organization_id');
      expect(route.multiPartyFieldsMatchModel).toBe(true);
      expect(routeHasProvenIsolation(route)).toBe(true);
    }
  });

  it('REGRESSION FIXTURE: a MultiPartyIsolationMixin route with fields that do NOT match the real model is NOT recognized as proven isolation', () => {
    const misconfiguredRoute: DjangoTableRoute = {
      app: 'billing',
      routePath: 'fake-multiparty-route',
      viewSetName: 'FakeMultiPartyViewSet',
      modelName: 'FakeMultiPartyModel',
      table: 'fake_multiparty_table',
      hasGetQueryset: true,
      usesDenyAllPermission: false,
      usesUnfilteredObjectsAll: true,
      usesOnlyIsAuthenticated: true,
      usesSharedIsolationMixin: false,
      usesGlobalPlusTenantMixin: false,
      usesMultiPartyMixin: true,
      declaredFromField: 'from_organization_id',
      declaredToField: 'a_typo_field_that_does_not_exist_on_the_model',
      multiPartyFieldsMatchModel: false,
    };
    expect(routeHasProvenIsolation(misconfiguredRoute)).toBe(false);
  });

  it('donation_receipts\' real Django route uses DirectTenantIsolationMixin (restored this round) and is recognized as proven isolation', () => {
    const tableRoutes = liveDjangoTableRoutes();
    const routes = tableRoutes.get('donation_receipts') ?? [];
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(route.usesSharedIsolationMixin).toBe(true);
      expect(route.usesDenyAllPermission).toBe(false);
      expect(routeHasProvenIsolation(route)).toBe(true);
    }
  });
});
