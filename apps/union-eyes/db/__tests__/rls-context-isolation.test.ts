/**
 * RLS context isolation — the AsyncLocalStorage propagation the claimed-workbook
 * authority boundary (lib/workbook/access-control.ts) relies on so that PDF
 * child loaders reading through the module-level `db` inherit the ACTIVE
 * context and cannot leak it across the boundary or between concurrent requests.
 *
 * withClaimedWorkbookAccess runs each protected callback inside
 * withExplicitUserContext (tenantContextStorage) or withSystemContext
 * (systemContextStorage). generateWorkbookPdf + loadWorkbookContext read
 * protected child rows through the module-level `db`, which resolves to the
 * active store. These tests prove that resolution is scoped and isolated.
 */
import { describe, expect, it } from 'vitest';
import { tenantContextStorage, getActiveTenantDb } from '../tenant-context-storage';
import { systemContextStorage, getActiveSystemDb } from '../system-context-storage';

// Simulates a PDF child loader that reads through the module-level `db`.
function activeTenantHandle() {
  return getActiveTenantDb();
}

describe('RLS context isolation (AsyncLocalStorage) — authority boundary propagation', () => {
  it('exposes the scoped handle only inside the boundary and clears it after', async () => {
    expect(getActiveTenantDb()).toBeUndefined();

    const handleA = { id: 'txA' } as never;
    const seenInside = await tenantContextStorage.run(handleA, async () => {
      // A loader invoked inside the boundary — even after an await — sees the
      // scoped handle...
      await Promise.resolve();
      return activeTenantHandle();
    });

    expect(seenInside).toBe(handleA);
    // ...and once the boundary callback returns, the context is gone.
    expect(getActiveTenantDb()).toBeUndefined();
  });

  it('a loader invoked AFTER the boundary cannot retain the prior authority', async () => {
    const handleA = { id: 'txA' } as never;
    let laterLoader!: () => ReturnType<typeof getActiveTenantDb>;

    await tenantContextStorage.run(handleA, async () => {
      laterLoader = () => getActiveTenantDb();
      expect(laterLoader()).toBe(handleA);
    });

    // The very same closure, invoked outside the run scope, sees no context.
    expect(laterLoader()).toBeUndefined();
  });

  it('concurrent boundaries A and B do not bleed across awaits', async () => {
    const handleA = { id: 'A' } as never;
    const handleB = { id: 'B' } as never;

    const runA = tenantContextStorage.run(handleA, async () => {
      await new Promise((r) => setTimeout(r, 5));
      return getActiveTenantDb();
    });
    const runB = tenantContextStorage.run(handleB, async () => {
      await new Promise((r) => setTimeout(r, 1));
      return getActiveTenantDb();
    });

    const [a, b] = await Promise.all([runA, runB]);
    expect(a).toBe(handleA);
    expect(b).toBe(handleB);
  });

  it('tenant and system stores are independent', async () => {
    const tenant = { id: 'tenant' } as never;
    const system = { id: 'system' } as never;

    await tenantContextStorage.run(tenant, async () => {
      expect(getActiveTenantDb()).toBe(tenant);
      await systemContextStorage.run(system, async () => {
        expect(getActiveSystemDb()).toBe(system);
        expect(getActiveTenantDb()).toBe(tenant);
      });
      expect(getActiveSystemDb()).toBeUndefined();
      expect(getActiveTenantDb()).toBe(tenant);
    });
  });
});
