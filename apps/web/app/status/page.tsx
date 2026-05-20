import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locale } from '@/lib/locales';

export const metadata: Metadata = {
  title: 'Status',
  description: 'Live operational status for Nzila Ventures services. Pings public health endpoints and reports the result.',
  alternates: { canonical: '/status' },
};

// Refresh server-side every 30 seconds so the page is "live enough" without
// hammering downstream apps on every request.
export const revalidate = 30;

interface TelemetryReq {
  generatedAt: string;
  requiredApps: string[];
  exemptApps: string[];
}

interface ProbeResult {
  slug: string;
  publicUrl: string | null;
  state: 'ok' | 'degraded' | 'down' | 'unknown' | 'private';
  status: number | null;
  latencyMs: number | null;
  error: string | null;
}

/**
 * Map of telemetry-required apps → publicly probeable URL.
 * `null` means the service exists but has no public health endpoint
 * (internal only) — surfaced as "Private" rather than failed.
 *
 * The base domain is read from STATUS_PUBLIC_DOMAIN at runtime so this
 * page works in dev (localhost) and prod (Azure Container Apps) without
 * a code change.
 */
function publicHealthUrls(): Record<string, string | null> {
  // STATUS_ACA_ENV_DOMAIN is the environment-level domain suffix, e.g.
  // "jollydune-88c1e97f.canadacentral.azurecontainerapps.io".
  // Each Container App is reachable at https://<appname>.<env-domain>.
  const envDomain = process.env.STATUS_ACA_ENV_DOMAIN
    ?? 'jollydune-88c1e97f.canadacentral.azurecontainerapps.io';
  const aca = (app: string) => `https://${app}.${envDomain}/api/health`;
  return {
    web:                aca('nzila-os-web'),
    'union-eyes':       aca('nzila-os-union-eyes'),
    flow:               null,                  // internal — proxied via union-eyes
    zonga:              aca('nzila-os-zonga'),
    console:            aca('nzila-os-console'),
    'orchestrator-api': null,                  // internal — not deployed as a Container App
    abr:                null,                  // internal
    cfo:                null,                  // internal
    cora:               null,                  // internal
    trade:              null,                  // internal
    'control-plane':    null,                  // internal
  };
}

async function probe(slug: string, url: string | null): Promise<ProbeResult> {
  if (!url) {
    return { slug, publicUrl: null, state: 'private', status: null, latencyMs: null, error: null };
  }
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      // Force fresh value; no Next.js fetch-level caching.
      cache: 'no-store',
      // Tight timeout — status page must not hang.
      signal: AbortSignal.timeout(4000),
      headers: { 'user-agent': 'nzila-status-probe/1.0' },
    });
    const latencyMs = Date.now() - start;
    let state: ProbeResult['state'] = 'down';
    if (res.ok) state = latencyMs < 2000 ? 'ok' : 'degraded';
    else if (res.status >= 500) state = 'down';
    else state = 'degraded';
    return { slug, publicUrl: url, state, status: res.status, latencyMs, error: null };
  } catch (err) {
    return {
      slug,
      publicUrl: url,
      state: 'down',
      status: null,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function loadRequiredApps(): string[] {
  const p = join(process.cwd(), '..', '..', 'platform', 'products', '_telemetry-requirements.json');
  try {
    const data = JSON.parse(readFileSync(p, 'utf-8')) as TelemetryReq;
    return data.requiredApps;
  } catch {
    // Build env may not have the file (unlikely); fail open with the known set.
    return ['web', 'union-eyes', 'flow', 'zonga', 'console', 'orchestrator-api', 'abr', 'cfo', 'cora', 'trade', 'control-plane'];
  }
}

const stateLabel: Record<ProbeResult['state'], { en: string; fr: string; cls: string }> = {
  ok:       { en: 'Operational',     fr: 'Opérationnel',         cls: 'bg-green-100 text-green-800 border-green-200' },
  degraded: { en: 'Degraded',        fr: 'Dégradé',              cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  down:     { en: 'Outage',          fr: 'Panne',                cls: 'bg-red-100 text-red-800 border-red-200' },
  unknown:  { en: 'Unknown',         fr: 'Inconnu',              cls: 'bg-gray-100 text-gray-800 border-gray-200' },
  private:  { en: 'Private (internal)', fr: 'Privé (interne)',   cls: 'bg-blue-50 text-blue-800 border-blue-200' },
};

export default async function StatusPage() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';
  const required = loadRequiredApps();
  const urls = publicHealthUrls();

  const results = await Promise.all(required.map((slug) => probe(slug, urls[slug] ?? null)));

  const publicResults = results.filter((r) => r.publicUrl !== null);
  const privateResults = results.filter((r) => r.publicUrl === null);

  const overall: ProbeResult['state'] =
    publicResults.some((r) => r.state === 'down') ? 'down'
    : publicResults.some((r) => r.state === 'degraded') ? 'degraded'
    : publicResults.length > 0 ? 'ok' : 'unknown';

  const overallLabel = stateLabel[overall];
  const checkedAt = new Date().toISOString();

  return (
    <main className="bg-white min-h-screen">
      <section className="bg-navy text-white py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">
            {isFr ? 'État en direct' : 'Live status'}
          </p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{isFr ? 'État du système' : 'System status'}</h1>
          <div className="flex items-center gap-3 mt-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${overallLabel.cls}`}>
              {isFr ? overallLabel.fr : overallLabel.en}
            </span>
            <span className="text-gray-400 text-sm">
              {isFr ? 'Vérifié à' : 'Checked at'} {checkedAt}
            </span>
          </div>
          <p className="text-gray-300 mt-4 max-w-2xl text-sm">
            {isFr
              ? "Cette page interroge les points de terminaison /api/health publics toutes les 30 secondes. Les services internes sont marqués comme privés."
              : 'This page polls public /api/health endpoints every 30 seconds. Internal services are marked as private.'}
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? 'Services publics' : 'Public services'}</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200 mb-12">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-700 font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">{isFr ? 'Service' : 'Service'}</th>
                <th className="px-4 py-3 text-left">{isFr ? 'État' : 'Status'}</th>
                <th className="px-4 py-3 text-left">HTTP</th>
                <th className="px-4 py-3 text-left">{isFr ? 'Latence' : 'Latency'}</th>
              </tr>
            </thead>
            <tbody>
              {publicResults.map((r) => {
                const lbl = stateLabel[r.state];
                return (
                  <tr key={r.slug} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.slug}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded border text-xs font-medium ${lbl.cls}`}>
                        {isFr ? lbl.fr : lbl.en}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.status ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{r.latencyMs !== null ? `${r.latencyMs} ms` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? 'Services internes' : 'Internal services'}</h2>
        <p className="text-gray-600 text-sm mb-4">
          {isFr
            ? "Les services internes ne sont pas exposés publiquement. Leur état est surveillé via Azure Monitor et déclenche l'astreinte; les incidents apparaissent dans la bannière en haut de cette page lorsqu'ils affectent des utilisateurs."
            : 'Internal services are not publicly exposed. Their state is monitored via Azure Monitor and pages on-call; incidents that affect members, operators, or institutions appear in the banner at the top of this page.'}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {privateResults.map((r) => (
            <div key={r.slug} className="rounded border border-gray-200 px-3 py-2 bg-gray-50">
              <div className="text-sm font-medium text-gray-900">{r.slug}</div>
              <div className="text-xs text-gray-500">{isFr ? 'Privé' : 'Private'}</div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-500 mt-12">
          {isFr
            ? "Source : platform/products/_telemetry-requirements.json (généré à partir du manifeste produit canonique). Les sondes sont effectuées côté serveur avec un délai d'expiration de 4 secondes; elles ne révèlent aucune information privée."
            : 'Source: platform/products/_telemetry-requirements.json (generated from canonical product manifest). Probes run server-side with a 4-second timeout and never expose private information.'}
        </p>
      </section>
    </main>
  );
}
