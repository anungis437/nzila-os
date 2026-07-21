import { notFound } from 'next/navigation';
import { isCupe4373DemoRuntime } from '@/lib/dashboard/role-experience';

/**
 * Demo route-group gate.
 *
 * This layout wraps every dashboard route whose implementation depends
 * on the `apps/union-eyes/lib/demo/**` or `apps/union-eyes/components/demo/**`
 * modules. When the runtime feature profile is not the recognised
 * CUPE 4373 demo profile, every child route MUST return 404 — the
 * demo data is not surfaced under production, pilot, or executive
 * runtimes.
 *
 * The gate is defence-in-depth:
 *
 *   1. The boot-time guard in `apps/union-eyes/instrumentation.ts`
 *      already refuses to start the Node runtime when the demo
 *      profile is combined with a production target environment.
 *
 *   2. The anti-theatre scanner (rule R-3) forbids production code
 *      from importing demo/fixtures modules unless the importer lives
 *      inside a demo scope. Placement under `(demo)/` route groups
 *      satisfies the scanner and this layout is what makes that
 *      placement honest at runtime.
 *
 *   3. This layout is the SERVER-SIDE gate. It runs before any child
 *      page — including client components — hydrates, so demo data
 *      cannot leak through client-side navigation transitions.
 *
 * Programme state: `PARTIALLY_IMPLEMENTED` (Wave 0 §10 R-3 driver).
 */
export default async function DashboardDemoGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isCupe4373DemoRuntime()) {
    // Do NOT include a redirect or a friendly error. In non-demo
    // runtimes these routes simply do not exist. `notFound()`
    // triggers the app's `not-found.tsx` renderer.
    notFound();
  }
  return <>{children}</>;
}
