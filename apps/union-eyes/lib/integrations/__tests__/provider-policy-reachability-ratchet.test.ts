/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * Transitive-reachability ratchet (round 40 structural correction).
 *
 * Round 40 originally used IntegrationRegistry.isAvailable() — a
 * product/catalog flag — as the control-plane's security authorization
 * decision, and separately reclassified ~20 storage-authority manifest
 * entries by hand based on that (flawed) premise. This test mechanically
 * ties the three layers together so that class of drift is caught by CI
 * instead of rediscovered by manual code review:
 *
 *   IntegrationRegistry.isAvailable(provider)         (catalog: "should this
 *                                                       show up in the UI")
 *        ↕ must be explicitly reconciled with ↕
 *   CONTROL_PLANE_PROVIDER_POLICY[provider]           (security: "is this
 *                                                       approved to run
 *                                                       against tenant data")
 *        ↕ must be backed by ↕
 *   IntegrationFactory's switch-case for that provider (capability: "can a
 *                                                       real adapter even be
 *                                                       constructed")
 *
 * If ANY of these three shifts without the others being updated, a table's
 * real reachability silently changes without a corresponding
 * db/rls-storage-authority/*.ts review. This test fails loudly instead.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IntegrationRegistry } from '../registry';
import { IntegrationProvider } from '../types';
import { CONTROL_PLANE_PROVIDER_POLICY, isProviderApprovedForControlPlane } from '../provider-policy';

const APP_ROOT = resolve(__dirname, '..', '..', '..');

/**
 * Providers that ARE catalog-available (registry.isAvailable() === true)
 * but are deliberately EXCLUDED from CONTROL_PLANE_PROVIDER_POLICY, with a
 * mechanically-checked reason for each. Adding a provider here without a
 * verified reason is exactly the drift this ratchet exists to prevent —
 * do not add an entry without also adding an assertion below proving why
 * it's still safe to exclude.
 */
const KNOWN_CATALOG_AVAILABLE_BUT_NOT_CONTROL_PLANE_APPROVED = new Set<string>([
  IntegrationProvider.OTPP, // factory.ts throws NOT_IMPLEMENTED — no real adapter exists yet.
]);

function source(path: string): string {
  return readFileSync(resolve(APP_ROOT, path), 'utf8');
}

describe('provider-policy reachability ratchet', () => {
  const registry = IntegrationRegistry.getInstance();
  const allProviders = Object.values(IntegrationProvider);

  it('every control-plane-approved provider is catalog-available in IntegrationRegistry', () => {
    // A provider must never be MORE approved in the control plane than it
    // is in the catalog — that would mean tenant-facing config/sync routes
    // accept a provider the product doesn't even list.
    for (const provider of Object.keys(CONTROL_PLANE_PROVIDER_POLICY)) {
      expect(
        registry.isAvailable(provider as IntegrationProvider),
        `${provider}: control-plane-approved but IntegrationRegistry.isAvailable() is false`,
      ).toBe(true);
    }
  });

  it('every catalog-available provider is either control-plane-approved or explicitly, verifiably excluded', () => {
    const unaccountedFor: string[] = [];
    for (const provider of allProviders) {
      if (!registry.isAvailable(provider)) continue;
      if (isProviderApprovedForControlPlane(provider)) continue;
      if (KNOWN_CATALOG_AVAILABLE_BUT_NOT_CONTROL_PLANE_APPROVED.has(provider)) continue;
      unaccountedFor.push(provider);
    }
    expect(
      unaccountedFor,
      `these providers became catalog-available without a control-plane approval decision — add them to CONTROL_PLANE_PROVIDER_POLICY (with adapter org-scoping verified) or to the documented exclusion set above: ${unaccountedFor.join(', ')}`,
    ).toEqual([]);
  });

  it('OTPP is excluded because its factory case still throws NOT_IMPLEMENTED (re-review if this ever changes)', () => {
    const factorySrc = source('lib/integrations/factory.ts');
    const otppCaseStart = factorySrc.indexOf('case IntegrationProvider.OTPP:');
    expect(otppCaseStart, 'OTPP case not found in factory.ts').toBeGreaterThan(-1);
    const nextCaseStart = factorySrc.indexOf('\n\n', otppCaseStart);
    const otppCaseBlock = factorySrc.slice(otppCaseStart, nextCaseStart === -1 ? undefined : nextCaseStart);
    expect(
      otppCaseBlock,
      'OTPP factory case no longer throws NOT_IMPLEMENTED — it has a real adapter now, so it must be reviewed for control-plane approval (org-scoping verified, provider-policy.ts entry added) rather than left excluded',
    ).toMatch(/NOT_IMPLEMENTED/);
  });

  it('SHAREPOINT has no control-plane policy entry, matching its unreachable manifest classification', () => {
    expect(isProviderApprovedForControlPlane(IntegrationProvider.SHAREPOINT)).toBe(false);
  });

  it('every control-plane-approved provider has a real (non-throwing-stub) factory case', () => {
    const factorySrc = source('lib/integrations/factory.ts');
    for (const provider of Object.keys(CONTROL_PLANE_PROVIDER_POLICY)) {
      const enumKey = Object.keys(IntegrationProvider).find(
        (key) => IntegrationProvider[key as keyof typeof IntegrationProvider] === provider,
      );
      expect(enumKey, `${provider}: no IntegrationProvider enum key found`).toBeTruthy();
      const caseStart = factorySrc.indexOf(`case IntegrationProvider.${enumKey}:`);
      expect(caseStart, `${provider}: no factory.ts case found for IntegrationProvider.${enumKey}`).toBeGreaterThan(-1);
      const nextBoundary = factorySrc.indexOf('\n\n', caseStart);
      const caseBlock = factorySrc.slice(caseStart, nextBoundary === -1 ? undefined : nextBoundary);
      expect(caseBlock, `${provider}: factory case appears to be a stub, not a real adapter construction`).toMatch(/return new \w+Adapter\(/);
    }
  });
});
