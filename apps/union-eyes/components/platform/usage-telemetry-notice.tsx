import { getTranslations } from 'next-intl/server';

/**
 * Says, on a page whose figures would come from usage telemetry (page views, sign-ins, feature adoption), that nothing collects it.
 * Capability UE-PLATFORM-USAGE-TELEMETRY, lib/reality/capability-registry.ts.
 */
export async function UsageTelemetryNotice() {
  const t = await getTranslations('platformUsageTelemetry');
  return (
    <div role="note" className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-medium">{t('title')}</p>
      <p className="mt-1">{t('body')}</p>
    </div>
  );
}
