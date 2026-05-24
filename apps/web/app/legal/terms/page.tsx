import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import type { Locale } from '@/lib/locales';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Nzila Ventures Terms of Service — the rules and guidelines governing use of our platform and services.',
  alternates: { canonical: '/legal/terms' },
};

export default async function TermsOfService() {
  const copyByLocale: Record<Locale, {
    legal: string
    title: string
    lastUpdatedLabel: string
    sections: Array<{ title: string; body?: string; bullets?: string[] }>
    contactLabel: string
    privacy: string
    ipGovernance: string
    backHome: string
  }> = {
    'en-CA': {
      legal: 'Legal',
      title: 'Terms of Service',
      lastUpdatedLabel: 'Last updated',
      sections: [
        { title: '1. Acceptance of Terms', body: 'By accessing or using any website, platform, or service operated by Nzila Ventures Inc. ("Nzila," "we," "our," or "us"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.' },
        { title: '2. Description of Services', body: 'Nzila Ventures operates Nzila OS and related continuity infrastructure for trust-sensitive organizations. Services include governed operational applications, Union Eyes, partner portals, public-facing information, procurement materials, and organizational continuity resources.' },
        { title: '3. Eligibility', body: 'You must be at least 16 years of age to use our services. By using the platform, you represent that you have the legal capacity to enter into a binding agreement. If you are using the platform on behalf of an organization, you represent that you have authority to bind that organization to these terms.' },
        { title: '4. User Accounts', bullets: ['You are responsible for maintaining the confidentiality of your account credentials', 'You are responsible for all activity that occurs under your account', 'You must notify us immediately of any unauthorized use of your account', 'We reserve the right to suspend or terminate accounts that violate these terms'] },
        { title: '5. Acceptable Use', bullets: ['Use the platform for any unlawful, harmful, or fraudulent purpose', 'Reverse-engineer, decompile, or attempt to extract source code from our services', 'Interfere with or disrupt the integrity or performance of our systems', 'Transmit malware, viruses, or any other malicious code', 'Scrape, crawl, or harvest data from our platforms without explicit written consent', 'Use our branding, trademarks, or intellectual property without authorization', 'Impersonate any person or entity, or falsely represent your affiliation with any person or entity'] },
        { title: '5A. Anti-Surveillance Boundary', body: 'Nzila services are not worker surveillance systems. The services may not be used to measure individual productivity, build hidden behavioral profiles, conduct covert monitoring, generate opaque individual scores, or automate punitive actions against people. Governance systems must remain visible to the parties they govern, and human review remains required for decisions affecting a person\'s standing, employment, membership, or access.' },
        { title: '6. Intellectual Property', body: 'All content, software, technology, designs, trademarks, and other materials on our platforms are the exclusive property of Nzila Ventures Inc. or its licensors. Nothing in these Terms grants you any right to use Nzila intellectual property without prior written permission.' },
        { title: '7. Third-Party Services', body: 'Our platform may integrate with or link to third-party services. We are not responsible for the content, privacy practices, or terms of such third parties. Your use of third-party services is at your own risk and subject to their respective terms.' },
        { title: '8. Disclaimers', body: 'Our services are provided "as is" and "as available" without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.' },
        { title: '9. Limitation of Liability', body: 'To the fullest extent permitted by applicable law, Nzila Ventures shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use our services.' },
        { title: '10. Governing Law', body: 'These Terms shall be governed by and construed in accordance with the laws of the Province of Ontario, Canada. Any disputes shall be resolved in the courts of Ontario.' },
        { title: '11. Changes to Terms', body: 'We reserve the right to modify these Terms at any time. Material changes will be communicated via email or prominent notice on our platform. Continued use after the effective date constitutes acceptance of the revised Terms.' },
        { title: '12. Contact', body: 'For questions about these Terms, please contact:' },
      ],
      contactLabel: 'Legal Department',
      privacy: 'Privacy Policy',
      ipGovernance: 'IP Governance',
      backHome: 'Back to Home',
    },
    'fr-CA': {
      legal: 'Juridique',
      title: "Conditions d'utilisation",
      lastUpdatedLabel: 'Dernière mise à jour',
      sections: [
        { title: '1. Acceptation des conditions', body: "En accedant a un site, une plateforme ou un service exploite par Nzila Ventures Inc., vous acceptez d etre lie par les presentes conditions d'utilisation." },
        { title: '2. Description des services', body: 'Nzila Ventures exploite Nzila OS et une infrastructure de continuité pour les organisations sensibles à la confiance. Les services incluent des applications opérationnelles gouvernées, Union Eyes, portails partenaires, informations publiques, matériaux procurement et ressources de continuité institutionnelle.' },
        { title: '3. Admissibilite', body: 'Vous devez avoir au moins 16 ans pour utiliser nos services et disposer de la capacite legale de conclure un accord contraignant.' },
        { title: '4. Comptes utilisateur', bullets: ['Vous étés responsable de la confidentialité de vos identifiants', 'Vous étés responsable de toute activite sur votre compte', 'Vous devez nous signaler immediatement toute utilisation non autorisee', 'Nous pouvons suspendre ou resilier les comptes qui violent ces conditions'] },
        { title: '5. Utilisation acceptable', bullets: ['Utiliser la plateforme a des fins illicites, nuisibles ou frauduleuses', 'Retro-ingénierie ou tentative d extraction du code source', 'Perturber l integrite ou la performance de nos systemes', 'Transmettre des logiciels malveillants ou des virus', 'Aspirer ou collecter des données sans consentement ecrit', 'Utiliser notre marque ou notre propriété intellectuelle sans autorisation', 'Usurper l identite d une personne ou d une entite'] },
        { title: '5A. Limite anti-surveillance', body: 'Les services Nzila ne sont pas des systèmes de surveillance des travailleurs. Les services ne peuvent pas servir à mesurer la productivité individuelle, créer des profils comportementaux cachés, surveiller de façon invisible, produire des scores individuels opaques ou automatiser des actions punitives contre des personnes. Les systèmes de gouvernance doivent rester visibles aux parties gouvernées, et la revue humaine demeure requise pour les décisions affectant le statut, l emploi, l adhésion ou l accès d une personne.' },
        { title: '6. Propriété intellectuelle', body: 'Tout contenu, logiciel, technologie, design et marque de nos plateformes est la propriété exclusive de Nzila Ventures Inc. ou de ses conc edants.' },
        { title: '7. Services tiers', body: 'Notre plateforme peut integrer des services tiers. Nous ne sommes pas responsables de leur contenu, politique de confidentialité ou conditions.' },
        { title: '8. Exclusions de garantie', body: 'Nos services sont fournis tels quels et selon disponibilité, sans garantie expresse ou implicite.' },
        { title: '9. Limitation de responsabilite', body: 'Dans les limites permises par la loi, Nzila Ventures ne pourra etre tenue responsable des dommages indirects ou consequents lies a l utilisation des services.' },
        { title: '10. Droit applicable', body: 'Ces conditions sont regies par les lois de la province de l Ontario, Canada, et tout litige releve des tribunaux de l Ontario.' },
        { title: '11. Modifications', body: 'Nous pouvons modifier ces conditions a tout moment. Les changements importants seront communiques par courriel ou avis visible sur la plateforme.' },
        { title: '12. Contact', body: 'Pour toute question sur ces conditions, veuillez contacter :' },
      ],
      contactLabel: 'Service juridique',
      privacy: 'Politique de confidentialité',
      ipGovernance: 'Gouvernance PI',
      backHome: "Retour à l'accueil",
    },
  };

  const locale = (await getLocale()) as Locale;
  const copy = copyByLocale[locale] ?? copyByLocale['en-CA'];
  const lastUpdated = 'February 19, 2026';

  return (
    <main className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-navy text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">{copy.legal}</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{copy.title}</h1>
          <p className="text-gray-400 text-sm">{copy.lastUpdatedLabel}: {lastUpdated}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {copy.sections.map((section) => (
          <section key={section.title} className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{section.title}</h2>
            {section.body ? <p className="text-gray-600 leading-relaxed">{section.body}</p> : null}
            {section.bullets ? (
              <ul className="list-disc pl-6 text-gray-600 space-y-2">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
            {section.title.startsWith('12.') ? (
              <div className="mt-4 p-6 bg-gray-50 rounded-xl text-gray-700">
                <p className="font-semibold">Nzila Ventures Inc.</p>
                <p>{copy.contactLabel}</p>
                <p>Email: <a href="mailto:legal@nzilaventures.com" className="text-electric underline">legal@nzilaventures.com</a></p>
              </div>
            ) : null}
            {section.title.startsWith('6.') ? (
              <p className="text-gray-600 leading-relaxed mt-3">
                <Link href="/legal/ip-governance" className="text-electric underline">{copy.ipGovernance}</Link>
              </p>
            ) : null}
          </section>
        ))}

        <div className="pt-8 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
          <Link href="/legal/privacy" className="hover:text-electric transition-colors">{copy.privacy}</Link>
          <span>·</span>
          <Link href="/legal/ip-governance" className="hover:text-electric transition-colors">{copy.ipGovernance}</Link>
          <span>·</span>
          <Link href="/" className="hover:text-electric transition-colors">{copy.backHome}</Link>
        </div>
      </div>
    </main>
  );
}








