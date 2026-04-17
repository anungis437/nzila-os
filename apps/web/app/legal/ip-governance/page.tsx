import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import type { Locale } from '@/lib/locales';

export const metadata: Metadata = {
  title: 'IP Governance Policy',
  description: 'Nzila Ventures Intellectual Property Governance — how we protect, manage, and license our IP across all verticals.',
  alternates: { canonical: '/legal/ip-governance' },
};

export default async function IPGovernance() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';
  const lastUpdated = 'February 19, 2026';

  return (
    <main className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-navy text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">{isFr ? 'Juridique' : 'Legal'}</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{isFr ? 'Politique de gouvernance PI' : 'IP Governance Policy'}</h1>
          <p className="text-gray-400 text-sm">{isFr ? 'Dernière mise à jour' : 'Last updated'}: {lastUpdated}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? '1. Vue d ensemble' : '1. Overview'}</h2>
          <p className="text-gray-600 leading-relaxed">
            {isFr ? 'Nzila Ventures Inc. est une entreprise de déténtion de propriété intellectuelle orientee vers une gouvernance responsable. Toute PI developpee par Nzila, ses filiales, ses entreprises de portefeuille et ses contractuels est geree de façon centralisee par cette politique.' : 'Nzila Ventures Inc. is an ethical IP-holding company. All intellectual property developed by Nzila, its subsidiaries, portfolio companies, and contractors is centrally governed through this policy. This ensures consistent protection, licensing, and responsible commercialization of all innovations across our multi-vertical platform.'}
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? '2. Propriété' : '2. Ownership'}</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            {isFr ? 'Sauf accord ecrit contraire, les elements suivants appartiennent exclusivement a Nzila Ventures Inc. :' : 'Unless otherwise agreed in writing, the following are owned exclusively by Nzila Ventures Inc.:'}
          </p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>{isFr ? "Tous les logiciels, codes, algorithmes et architectures techniques developpes avec les ressources de l'entreprise" : 'All software, code, algorithms, and technical architectures developed on company time or with company resources'}</li>
            <li>{isFr ? 'Tous les modèles IA/ML, pipelines de données d entrainement et systemes d inference de l écosystème Nzila' : 'All AI/ML models, training data pipelines, and inference systems built within the Nzila ecosystem'}</li>
            <li>{isFr ? 'Toutes les marques, noms commerciaux, logos et actifs de marque' : 'All trademarks, service marks, trade names, logos, and brand assets'}</li>
            <li>{isFr ? 'Tous les concepts produits, designs, patrons UX et documentations créees pour les projets Nzila' : 'All product concepts, designs, UX patterns, and documentation created for Nzila projects'}</li>
            <li>{isFr ? 'Tous les noms de domaine, comptes réseaux sociaux et actifs numeriques enregistres sous Nzila' : 'All domain names, social media handles, and digital assets registered under Nzila'}</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? '3. Cession de PI des contributeurs' : '3. Contributor IP Assignment'}</h2>
          <p className="text-gray-600 leading-relaxed">
            {isFr ? 'Tous les employes, contractuels et partenaires contribuant aux produits Nzila doivent signer un accord de cession de PI avant le debut des travaux.' : 'All employees, contractors, and partners contributing to Nzila products are required to execute an IP Assignment Agreement prior to commencing work. This agreement assigns all work-for-hire IP to Nzila Ventures Inc. and ensures there are no conflicting claims from prior employers or third parties.'}
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? '4. Politique open source' : '4. Open Source Policy'}</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            {isFr ? 'Nzila utilise les logiciels open source de maniere responsable. Nos standards :' : 'Nzila uses open source software responsibly and gives back to the open source community where appropriate. Our standards:'}
          </p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>{isFr ? 'Toutes les dependances open source doivent etre verifiees pour la compatibilite de licence' : 'All open source dependencies must be vetted for license compatibility before intégration'}</li>
            <li>{isFr ? 'Le code GPL et AGPL exige une revue juridique explicite avant usage commercial' : 'GPL and AGPL licensed code requires explicit legal review before use in commercial products'}</li>
            <li>{isFr ? 'Les licences MIT, Apache 2.0 et BSD sont generalement approuvees' : 'MIT, Apache 2.0, and BSD licensed dependencies are generally approved for use'}</li>
            <li>{isFr ? 'Tout code Nzila publie en open source requiert l approbation du CTO et du juridique' : 'Any Nzila code released as open source requires CTO and legal sign-off'}</li>
            <li>{isFr ? 'Les contributions open source au nom de Nzila doivent passer par des canaux officiels' : 'Open source contributions on behalf of Nzila must be made through official channels only'}</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? '5. Gouvernance IA et modèles' : '5. AI & Model Governance'}</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            {isFr ? 'Tous les systemes IA developpes chez Nzila sont soumis a des exigences de gouvernance supplementaires :' : 'All AI systems developed at Nzila are subject to additional governance requirements:'}
          </p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>{isFr ? 'La provenance des données d entrainement doit etre documentee et legalement verifiee' : 'Training data provenance must be documented and verified as legally sourced'}</li>
            <li>{isFr ? 'Les modèles entraines sur des données proprietaires ou sensibles sont classes comme PI confidentielle Nzila' : 'Models trained on proprietary or sensitive data are classified as Nzila Confidential IP'}</li>
            <li>{isFr ? 'Les sorties IA utilisees dans les verticales réglementées doivent passer des audits de biais avant déploiement' : 'AI outputs used in regulated verticals (health, legal, finance) must pass bias audits before deployment'}</li>
            <li>{isFr ? 'Le Companion Engine et les systemes IA derives sont enregistres comme PI coeur de Nzila' : 'The Companion Engine and all derivative AI systems are registered as core Nzila IP'}</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? '6. Licences' : '6. Licensing'}</h2>
          <p className="text-gray-600 leading-relaxed">
            {isFr ? 'La PI de Nzila peut etre accordee a des tiers uniquement via un contrat de licence formel examine et signe par des representants autorises. Les demandes de licence doivent etre envoyees a ' : 'Nzila IP may be licensed to third parties only under a formal licensing agreement reviewed and signed by authorized representatives. Licensing terms vary by product vertical and intended use. All licensing inquiries should be directed to '}
            <a href="mailto:ip@nzilaventures.com" className="text-electric underline">ip@nzilaventures.com</a>.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? '7. Utilisation des marques' : '7. Trademark Use'}</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            {isFr ? 'L utilisation des marques, logos et actifs de marque Nzila par des tiers exige une autorisation ecrite explicite. Pour toute demande presse, partenariat ou usage referentiel, contactez ' : 'Use of Nzila trademarks, logos, and brand assets by external parties requires explicit written permission. Unauthorized use of Nzila trademarks including "Nzila," "Nzila Ventures," "Nzila OS," and associated logos is prohibited. For press, partnership, or referential use, submit a request to '}
            <a href="mailto:brand@nzilaventures.com" className="text-electric underline">brand@nzilaventures.com</a>.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? '8. Confidentialité' : '8. Confidentiality'}</h2>
          <p className="text-gray-600 leading-relaxed">
            {isFr ? 'La technologie proprietaire, les documents d architecture, les strategies d entreprise, les projections financieres et les plans produits non publies sont classes confidentiels. L accès est limite au besoin de savoir et les tiers doivent signer une NDA.' : 'Proprietary technology, architecture documents, business strategies, financial projections, and unreleased product plans are classified as Nzila Confidential. Access is restricted to team members on a need-to-know basis, and all external parties receiving confidential information must sign a Non-Disclosure Agreement (NDA) before access is granted.'}
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? '9. Signalement des enjeux PI' : '9. Reporting IP Concerns'}</h2>
          <p className="text-gray-600 leading-relaxed">
            {isFr ? "Si vous pensez que la PI de Nzila est enfreinte, mal utilisee ou qu'un conflit de PI existe, signalez-le immediatement a " : 'If you believe Nzila IP is being infringed, misused, or that you have discovered an IP conflict, please report it immediately to '}
            <a href="mailto:ip@nzilaventures.com" className="text-electric underline">ip@nzilaventures.com</a>. We take all IP concerns seriously and investigate promptly.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? '10. Contact' : '10. Contact'}</h2>
          <div className="mt-4 p-6 bg-gray-50 rounded-xl text-gray-700">
            <p className="font-semibold">Nzila Ventures Inc.</p>
            <p>{isFr ? 'Bureau de propriété intellectuelle' : 'Intellectual Property Office'}</p>
            <p>Email: <a href="mailto:ip@nzilaventures.com" className="text-electric underline">ip@nzilaventures.com</a></p>
          </div>
        </section>

        <div className="pt-8 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
          <Link href="/legal/privacy" className="hover:text-electric transition-colors">{isFr ? 'Politique de confidentialité' : 'Privacy Policy'}</Link>
          <span>·</span>
          <Link href="/legal/terms" className="hover:text-electric transition-colors">{isFr ? "Conditions d'utilisation" : 'Terms of Service'}</Link>
          <span>·</span>
          <Link href="/" className="hover:text-electric transition-colors">{isFr ? "Retour à l'accueil" : 'Back to Home'}</Link>
        </div>
      </div>
    </main>
  );
}








