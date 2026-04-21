import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import type { Locale } from '@/lib/locales';

export const metadata: Metadata = {
  title: 'Reliability',
  description: 'Nzila Ventures reliability commitments — uptime targets, SLOs, incident response, and change management.',
  alternates: { canonical: '/reliability' },
};

const slos = [
  { service: 'Web (apps/web)', target: '99.9%', window: '30 days' },
  { service: 'Union Eyes', target: '99.5%', window: '30 days' },
  { service: 'Flow', target: '99.5%', window: '30 days' },
  { service: 'Orchestrator API', target: '99.9%', window: '30 days' },
  { service: 'Console (internal)', target: '99.0%', window: '30 days' },
];

export default async function ReliabilityPage() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';

  return (
    <main className="bg-white min-h-screen">
      <section className="bg-navy text-white py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">{isFr ? 'Confiance' : 'Trust'}</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{isFr ? 'Fiabilité' : 'Reliability'}</h1>
          <p className="text-gray-300 max-w-2xl">
            {isFr ? 'Cibles SLO, réponse aux incidents et gestion du changement.' : 'SLO targets, incident response, and change management.'}
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{isFr ? 'Cibles SLO actives' : 'Active SLO targets'}</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-700 font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">{isFr ? 'Service' : 'Service'}</th>
                <th className="px-4 py-3 text-left">{isFr ? 'Cible' : 'Target'}</th>
                <th className="px-4 py-3 text-left">{isFr ? 'Fenêtre' : 'Window'}</th>
              </tr>
            </thead>
            <tbody>
              {slos.map((s) => (
                <tr key={s.service} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.service}</td>
                  <td className="px-4 py-3 text-gray-700">{s.target}</td>
                  <td className="px-4 py-3 text-gray-600">{s.window}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-4">{isFr ? 'Réponse aux incidents' : 'Incident response'}</h2>
        <ul className="list-disc pl-6 text-gray-700 space-y-2">
          <li>{isFr ? 'Détection automatique via Sentry + alertes Azure Monitor' : 'Automated detection via Sentry + Azure Monitor alerts'}</li>
          <li>{isFr ? 'Astreinte rotative avec runbooks par service' : 'Rotating on-call with per-service runbooks'}</li>
          <li>{isFr ? 'Post-mortem publié dans les 5 jours ouvrés' : 'Post-mortem published within 5 business days'}</li>
        </ul>

        <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-4">{isFr ? 'Gestion du changement' : 'Change management'}</h2>
        <ul className="list-disc pl-6 text-gray-700 space-y-2">
          <li>{isFr ? 'Gates CI obligatoires : typecheck, tests, contrats, gouvernance' : 'Mandatory CI gates: typecheck, tests, contracts, governance'}</li>
          <li>{isFr ? 'Déploiement canari sur staging avant production' : 'Canary deploys on staging before production'}</li>
          <li>{isFr ? 'Fenêtres de changement publiées et bloquées par script' : 'Change windows published and script-enforced'}</li>
        </ul>
      </section>
    </main>
  );
}
