import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * UE-CONV-D-002: the kernel financial workflow (lib/authority/store/finance-route-adapter.ts, ue_authority_financial_steps)
 * is the one canonical place a union payment is prepared, approved, executed and reconciled. services/financial-service
 * is a separate Express service with its own approval functions (stipend disbursements, remittances, arrears jobs). No
 * route or library of this application may reach it, so none of those approvals can be reached from a live route.
 */
const ROOT = join(__dirname, '..', '..', '..');
const SOURCE_ROOTS = ['app', 'lib', 'actions', 'components', 'hooks'];

function sourceFiles(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true, recursive: true })
      .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name))
      .map((entry) => join((entry as unknown as { parentPath?: string; path: string }).parentPath ?? (entry as unknown as { path: string }).path, entry.name))
      .filter((file) => !file.split(sep).includes('__tests__') && !file.split(sep).includes('node_modules'));
  } catch {
    return [];
  }
}

// What still touches financial-service, and why it is not an approval path. Anything else is a regression.
const REMAINING = new Map<string, string>([
  ['lib/dues-calculation-engine.ts', 'reads financial-service table definitions to calculate dues; approves and pays nothing'],
  ['app/api/employer-execution/_lib.ts', 'imports the pure payroll, compliance, replay and remittance-generation engines; approves and pays nothing'],
]);
// Mentions only: the capability register describes the service, it does not import it.
const DESCRIPTIVE = new Set(['lib/reality/capability-registry.ts', 'lib/api/authorization-denial.ts', 'lib/authority/store/finance-route-adapter.ts', 'lib/auth/identity-provider-residuals.ts']);

describe('financial-service is not a financial approval path of this application', () => {
  const references = SOURCE_ROOTS.flatMap((root) => sourceFiles(join(ROOT, root)))
    .map((file) => ({ file: relative(ROOT, file).split(sep).join('/'), text: readFileSync(file, 'utf8') }))
    .filter(({ text }) => /services\/financial-service|FINANCIAL_SERVICE_URL/.test(text));

  it('only the recorded calculation-only imports remain', () => {
    const unexpected = references.filter(({ file }) => !DESCRIPTIVE.has(file) && !REMAINING.has(file)).map(({ file }) => file);
    expect(unexpected).toEqual([]);
    expect(references.map(({ file }) => file)).toEqual(expect.arrayContaining([...REMAINING.keys()]));
  });

  it('the recorded imports reach no approval, disbursement or payment function', () => {
    for (const { file, text } of references.filter(({ file }) => REMAINING.has(file))) {
      const imported = [...text.matchAll(/import[\s\S]*?from\s+['"]@\/services\/financial-service[^'"]*['"]/g)].map((match) => match[0]).join('\n');
      expect(imported, file).not.toMatch(/approve|disburse|StipendService|payment-processing|PaymentProcessing|remittances|strike-funds/i);
    }
  });

  it('the kernel financial workflow is the canonical path and never calls the service', () => {
    const adapter = readFileSync(join(ROOT, 'lib/authority/store/finance-route-adapter.ts'), 'utf8');
    expect(adapter).toContain('recordFinancialStep');
    expect(adapter).not.toMatch(/from\s+['"][^'"]*financial-service|FINANCIAL_SERVICE_URL/);
  });
});
