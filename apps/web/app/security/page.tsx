import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import type { Locale } from '@/lib/locales';

export const metadata: Metadata = {
  title: 'Security',
  description: 'Nzila Ventures security posture: authentication, encryption, secrets management, audit logging, and incident response.',
  alternates: { canonical: '/security' },
};

const controls = [
  { en: 'Single sign-on via Microsoft Entra ID + Argon2id email/password fallback', fr: 'SSO via Microsoft Entra ID et bascule mot de passe Argon2id' },
  { en: 'All secrets resolved at runtime from Azure Key Vault — no plaintext in CI', fr: 'Secrets résolus depuis Azure Key Vault — aucun texte clair en CI' },
  { en: 'Per-organization row-level isolation enforced at the DAL layer', fr: 'Isolation par organisation appliquée au niveau de la couche DAL' },
  { en: 'Mandatory hash-chained audit trail on every mutation', fr: 'Journal d audit en chaîne hachée obligatoire sur chaque mutation' },
  { en: 'Container images scanned with Trivy (CRITICAL gate) on every build', fr: 'Images conteneurs scannées avec Trivy (porte CRITICAL) à chaque build' },
  { en: 'Dependency audit + Snyk + secret-scan workflows on every PR', fr: 'Audit des dépendances + Snyk + scan des secrets sur chaque PR' },
  { en: 'Account lockout after 5 failed attempts (15-minute window)', fr: 'Verrouillage de compte après 5 tentatives échouées (fenêtre de 15 min)' },
  { en: 'Privilege escalation, RLS and cross-org breach contract tests', fr: 'Tests contractuels d escalade de privilèges, RLS et fuite inter-organisations' },
];

export default async function SecurityPage() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';

  return (
    <main className="bg-white min-h-screen">
      <section className="bg-navy text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">{isFr ? 'Confiance' : 'Trust'}</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{isFr ? 'Sécurité' : 'Security'}</h1>
          <p className="text-gray-300 max-w-2xl">
            {isFr ? 'Posture de sécurité de Nzila : contrôles, journaux d audit et réponse aux incidents.' : 'Nzila security posture: controls, audit logs, and incident response.'}
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 prose prose-slate">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{isFr ? 'Contrôles' : 'Controls'}</h2>
        <ul className="list-disc pl-6 text-gray-700 space-y-3">
          {controls.map((c) => <li key={c.en}>{isFr ? c.fr : c.en}</li>)}
        </ul>

        <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-4">{isFr ? 'Audits & certifications' : 'Audits & certifications'}</h2>
        <p className="text-gray-700">
          {isFr
            ? 'Nzila vise SOC 2 Type II en 2026. La feuille de route et les contrôles intermédiaires sont publiés sur demande.'
            : 'Nzila is targeting SOC 2 Type II in 2026. Roadmap and interim controls available on request.'}
        </p>

        <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-4">{isFr ? 'Signaler une vulnérabilité' : 'Report a vulnerability'}</h2>
        <p className="text-gray-700">
          {isFr ? 'Voir' : 'See'} <a className="text-electric underline" href="https://github.com/anungis437/nzila-os/security">SECURITY.md</a>.
        </p>
      </section>
    </main>
  );
}
