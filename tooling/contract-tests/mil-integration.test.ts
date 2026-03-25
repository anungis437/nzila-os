/**
 * MIL Integration Contract Tests
 *
 * Validates that billing/commerce routes, dashboards, and API handlers
 * use the canonical Monetization Infrastructure Layer (MIL) — not legacy tables.
 *
 * @contract MIL-INT-001 through MIL-INT-005
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const UE = join(ROOT, 'apps', 'union-eyes');
const API = join(UE, 'app', 'api');
const DASHBOARD = join(UE, 'app', '[locale]', 'dashboard');
const PE_SVC = join(UE, 'services', 'platform-economics');

function read(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : '';
}

function collectFiles(dir: string, ext = '.ts'): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(full, ext));
    } else if (entry.name.endsWith(ext) || entry.name.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

// ============================================================================
// MIL-INT-001 — Billing Admin Dashboard uses MIL service layer
// ============================================================================

describe('MIL-INT-001 — Billing admin dashboard uses MIL services', () => {
  const page = read(join(DASHBOARD, 'billing-admin', 'page.tsx'));

  it('billing-admin page exists', () => {
    expect(page.length).toBeGreaterThan(0);
  });

  it('imports from platform-economics service barrel', () => {
    expect(page).toMatch(/from\s+['"]@\/services\/platform-economics['"]/);
  });

  it('does NOT use raw SQL on legacy billing tables', () => {
    expect(page).not.toContain('billing_subscriptions');
    expect(page).not.toContain('billing_invoices');
    expect(page).not.toContain('billing_payments');
  });

  it('does NOT import db or sql directly', () => {
    expect(page).not.toMatch(/from\s+['"]@\/db\/db['"]/);
    expect(page).not.toMatch(/from\s+['"]drizzle-orm['"]/);
  });

  it('uses canonical MIL query functions', () => {
    expect(page).toContain('getAdminSubscriptions');
    expect(page).toContain('getAdminInvoices');
    expect(page).toContain('getAdminPayments');
  });
});

// ============================================================================
// MIL-INT-002 — Billing service exports admin query functions
// ============================================================================

describe('MIL-INT-002 — Billing service admin functions present', () => {
  const svc = read(join(PE_SVC, 'billing-service.ts'));

  it('exports getAdminSubscriptions()', () => {
    expect(svc).toMatch(/export\s+async\s+function\s+getAdminSubscriptions/);
  });

  it('exports getAdminInvoices()', () => {
    expect(svc).toMatch(/export\s+async\s+function\s+getAdminInvoices/);
  });

  it('exports getAdminPayments()', () => {
    expect(svc).toMatch(/export\s+async\s+function\s+getAdminPayments/);
  });

  it('admin queries JOIN organizations for org name', () => {
    expect(svc).toContain('organizations.name');
  });

  it('admin queries use canonical MIL tables', () => {
    expect(svc).toContain('orgSubscriptions');
    expect(svc).toContain('platformInvoices');
    expect(svc).toContain('platformPayments');
    expect(svc).toContain('subscriptionPlans');
  });
});

// ============================================================================
// MIL-INT-003 — Billing/dues API routes do NOT use legacy crudRoutes stubs
// ============================================================================

describe('MIL-INT-003 — Core billing API routes avoid crudRoutes stubs', () => {
  const billingRoutes = [
    'billing/subscriptions/[id]/route.ts',
    'billing/credits/check-expired/route.ts',
    'dues/remittances/route.ts',
    'dues/remittances/[id]/route.ts',
    'dues/receipt/[id]/route.ts',
    'dues/arrears/calculate/route.ts',
    'dues/balance/route.ts',
    'dues/late-fees/route.ts',
    'dues/ledger/route.ts',
    'dues/payment-plans/route.ts',
    'dues/reconcile/route.ts',
  ];

  for (const route of billingRoutes) {
    const file = read(join(API, route));
    const label = route.replace(/\/route\.ts$/, '');

    it(`${label} uses withApi, not crudRoutes`, () => {
      if (file.length === 0) return; // skip if file doesn't exist
      expect(file).toContain('withApi');
      expect(file).not.toMatch(/crudRoutes\s*\(/);
    });
  }
});

// ============================================================================
// MIL-INT-004 — Entitlement enforcement wired on commerce API routes
// ============================================================================

describe('MIL-INT-004 — Entitlement enforcement on commerce routes', () => {
  const entitledRoutes = [
    'contracts/route.ts',
    'billing/send-invoice/route.ts',
    'billing/subscriptions/route.ts',
    'dues/late-fees/route.ts',
    'dues/balance/route.ts',
    'dues/ledger/route.ts',
    'dues/payment-plans/route.ts',
    'dues/reconcile/route.ts',
    'reconciliation/process/route.ts',
  ];

  for (const route of entitledRoutes) {
    const file = read(join(API, route));
    const label = route.replace(/\/route\.ts$/, '');

    it(`${label} has entitlement enforcement`, () => {
      if (file.length === 0) return;
      const hasEntitlement =
        file.includes('entitlement:') ||
        file.includes('requireEntitlement') ||
        file.includes('withEntitlement');
      expect(hasEntitlement).toBe(true);
    });
  }
});

// ============================================================================
// MIL-INT-005 — Webhook routes use structured logger, not console.*
// ============================================================================

describe('MIL-INT-005 — Webhook routes use structured logger', () => {
  const webhookRoutes = [
    'stripe/webhooks/route.ts',
    'payments/webhooks/stripe/route.ts',
  ];

  for (const route of webhookRoutes) {
    const file = read(join(API, route));
    const label = route.replace(/\/route\.ts$/, '');

    it(`${label} imports logger`, () => {
      if (file.length === 0) return;
      expect(file).toMatch(/from\s+['"]@\/lib\/logger['"]/);
    });

    it(`${label} has no console.log/warn/error`, () => {
      if (file.length === 0) return;
      const lines = file.split('\n');
      const consoleLines = lines.filter(
        (l) => /console\.(log|warn|error|info)\s*\(/.test(l) && !l.trimStart().startsWith('//')
      );
      expect(consoleLines).toEqual([]);
    });
  }
});
