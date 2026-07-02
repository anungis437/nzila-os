import { PublicIntakeForm } from './PublicIntakeForm';
import { isValidTenantSlug, resolveTenantSlug, TenantNotFoundError } from '@/modules/tenants/tenant-resolver';

/**
 * CourtLens public intake page — Phase 2F.
 *
 * Public/unauthenticated route: /[locale]/courtlens/t/[tenantSlug]/intake
 *
 * - Reads tenantSlug from route params.
 * - Server-side pre-check: if the slug is malformed or unknown, renders a
 *   safe generic unavailable state (no existence leak).
 * - Renders the PublicIntakeForm client component with the tenantSlug.
 * - Never claims to provide legal advice.
 * - Never renders AI output, review packet content, tenant internals, or
 *   internal orgId.
 * - Route is exempt from auth in proxy.ts (see isPublicRoute matcher).
 */
export default async function PublicIntakePage({
  params,
}: {
  params: Promise<{ locale: string; tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  if (!isValidTenantSlug(tenantSlug)) {
    return <IntakeUnavailable />;
  }

  try {
    await resolveTenantSlug(tenantSlug);
  } catch (err) {
    if (err instanceof TenantNotFoundError) {
      return <IntakeUnavailable />;
    }
    throw err;
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-2xl p-6">
          <p className="text-xs uppercase tracking-wide text-slate-500">CourtLens Access</p>
          <h1 className="mt-1 font-poppins text-2xl font-bold text-navy">Start your intake</h1>
          <p className="mt-2 text-sm text-slate-700">
            Share a bit about your situation so a qualified reviewer can look at it.
            This is not legal advice. It is a way to get supervised help started.
          </p>
        </div>
      </header>
      <PublicIntakeForm tenantSlug={tenantSlug} />
    </div>
  );
}

function IntakeUnavailable() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl space-y-4 p-6 text-sm text-slate-800" data-testid="intake-unavailable">
        <h1 className="font-poppins text-2xl font-bold text-navy">Intake unavailable</h1>
        <p>This intake is not available at the moment. Please check the link you followed, or contact the organisation directly.</p>
        <p className="text-xs text-slate-500">This is not legal advice.</p>
      </div>
    </div>
  );
}
