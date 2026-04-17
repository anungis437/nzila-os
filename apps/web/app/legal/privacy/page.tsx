import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import type { Locale } from '@/lib/locales';


export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Nzila Ventures Privacy Policy — how we collect, use, and protect your personal information.',
  alternates: { canonical: '/legal/privacy' },
};

export default async function PrivacyPolicy() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';
  const lastUpdated = 'February 19, 2026';

  return (
    <main className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-navy text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">{isFr ? 'Juridique' : 'Legal'}</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{isFr ? 'Politique de confidentialité' : 'Privacy Policy'}</h1>
          <p className="text-gray-400 text-sm">{isFr ? 'Dernière mise à jour' : 'Last updated'}: {lastUpdated}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 prose prose-slate">
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? '1. Introduction' : '1. Introduction'}</h2>
          <p className="text-gray-600 leading-relaxed">
            {isFr
              ? 'Nzila Ventures Inc. respecte votre vie privée et protège les renseignements personnels que vous partagez avec nous. Cette politique explique comment nous collectons, utilisons, divulguons et protègeons vos informations lorsque vous utilisez notre site ou nos services.'
              : 'Nzila Ventures Inc. ("Nzila," "we," "our," or "us") respects your privacy and is committed to protecting the personal information you share with us. This Privacy Policy describes how we collect, use, disclose, and safeguard your information when you visit our website or use our services.'}
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? '2. Renseignements collectées' : '2. Information We Collect'}</h2>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">{isFr ? 'Informations fournies par vous' : 'Information You Provide'}</h3>
          <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
            <li>{isFr ? 'Nom, courriel et coordonnées via notre formulaire de contact ou portail investisseur' : 'Name, email address, and contact details when you reach out via our contact form or investor portal'}</li>
            <li>{isFr ? 'Identifiants de compte pour l accès a la console ou aux outils partenaires' : 'Account credentials if you register for access to our console or partner tools'}</li>
            <li>{isFr ? 'Communications et correspondances que vous nous envoyez' : 'Communications and correspondence you send to us'}</li>
          </ul>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">{isFr ? 'Informations collectées automatiquement' : 'Information Collected Automatically'}</h3>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>{isFr ? 'Données de journal: adresse IP, navigateur, pages visitees et duree' : 'Log data including IP address, browser type, pages visited, and time spent'}</li>
            <li>{isFr ? 'Informations sur l appareil et systeme d exploitation' : 'Device information and operating system'}</li>
            <li>{isFr ? 'Temoins et technologies similaires (voir section 6)' : 'Cookies and similar tracking technologies (see Section 6)'}</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? '3. Utilisation des informations' : '3. How We Use Your Information'}</h2>
          <p className="text-gray-600 leading-relaxed mb-4">{isFr ? 'Nous utilisons les informations collectées pour :' : 'We use the information we collect to:'}</p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>{isFr ? 'Repondre aux demandes et offrir un soutien client' : 'Respond to inquiries and provide customer support'}</li>
            <li>{isFr ? "Envoyer des mises a jour sur nos produits, services et opportunites d'investissement (avec consentement)" : 'Send updates about our products, services, and investment opportunities (with your consent)'}</li>
            <li>{isFr ? 'Analyser et ameliorer les performances de notre site et plateforme' : 'Analyze and improve our website and platform performance'}</li>
            <li>{isFr ? 'Respecter les obligations légales et appliquer nos politiques' : 'Comply with legal obligations and enforce our policies'}</li>
            <li>{isFr ? 'Se protèger contre la fraude, les abus et les menaces de sécurité' : 'Protect against fraud, abuse, and security threats'}</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? '4. Partage des informations' : '4. Sharing of Information'}</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            {isFr ? 'Nous ne vendons pas vos informations personnelles. Nous pouvons les partager avec :' : 'We do not sell your personal information. We may share it with:'}
          </p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li><strong>{isFr ? 'Fournisseurs de services' : 'Service providers'}</strong> {isFr ? 'traitant les données pour notre compte sous ententes strictes de confidentialité' : 'who process data on our behalf (hosting, analytics, authentication) under strict confidentiality agreements'}</li>
            <li><strong>{isFr ? 'Autorites légales' : 'Legal authorities'}</strong> {isFr ? 'lorsque requis par la loi ou pour protèger les droits et la sécurité des utilisateurs' : 'when required by law, court order, or to protect the rights and safety of Nzila and its users'}</li>
            <li><strong>{isFr ? 'Transactions d entreprise' : 'Business transfers'}</strong> {isFr ? 'dans le cadre d une fusion, acquisition ou vente d actifs' : 'in connection with a merger, acquisition, or sale of assets, with notice provided to you'}</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? '5. Conservation des données' : '5. Data Retention'}</h2>
          <p className="text-gray-600 leading-relaxed">
            {isFr ? 'Nous conservons les informations personnelles aussi longtemps que nécessaire pour remplir les objectifs de cette politique, respecter nos obligations légales, resoudre les differends et appliquer nos accords. Lorsqu elles ne sont plus nécessaires, nous les supprimons ou anonymisons de façon securisee.' : 'We retain personal information for as long as necessary to fulfill the purposes described in this policy, comply with legal obligations, resolve disputes, and enforce our agreements. When data is no longer needed, we securely delete or anonymize it.'}
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? '6. Temoins' : '6. Cookies'}</h2>
          <p className="text-gray-600 leading-relaxed">
            {isFr ? 'Nous utilisons des temoins et technologies similaires pour ameliorer votre experience, analyser le trafic et soutenir l authentification. Vous pouvez les contrôler dans votre navigateur.' : 'We use cookies and similar technologies to enhance your experience, analyze traffic, and support authentication. You can control cookies through your browser settings. Disabling cookies may limit some functionality of our site.'}
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? '7. Vos droits' : '7. Your Rights'}</h2>
          <p className="text-gray-600 leading-relaxed mb-4">{isFr ? 'Selon votre lieu de residence, vous pouvez avoir le droit de :' : 'Depending on your location, you may have the right to:'}</p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>{isFr ? 'Acceder aux données personnelles que nous déténons sur vous' : 'Access the personal data we hold about you'}</li>
            <li>{isFr ? 'Demander la correction de données inexactes' : 'Request correction of inaccurate data'}</li>
            <li>{isFr ? 'Demander la suppression de vos données' : 'Request deletion of your data ("right to be forgotten")'}</li>
            <li>{isFr ? 'Vous opposer a certains traitements ou les restreindre' : 'Object to or restrict certain processing'}</li>
            <li>{isFr ? 'Recevoir vos données dans un format structure et lisible par machine' : 'Data portability — receive your data in a structured, machine-readable format'}</li>
            <li>{isFr ? 'Retirer votre consentement a tout moment lorsque le traitement en depend' : 'Withdraw consent at any time where processing is based on consent'}</li>
          </ul>
          <p className="text-gray-600 leading-relaxed mt-4">
            {isFr ? 'Pour exercer ces droits, contactez-nous a ' : 'To exercise any of these rights, contact us at '}<a href="mailto:privacy@nzilaventures.com" className="text-electric underline">privacy@nzilaventures.com</a>.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? '8. Securite' : '8. Security'}</h2>
          <p className="text-gray-600 leading-relaxed">
            {isFr ? 'Nous appliquons des mesures de sécurité conformes aux normes de l industrie, notamment le chiffrement en transit et au repos, les contrôles d accès et des audits reguliers.' : 'We implement industry-standard security measures including encryption in transit (TLS), encryption at rest, access controls, and regular security audits. No method of transmission over the internet is 100% secure; we strive to use commercially acceptable means to protect your data.'}
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? '9. Confidentialité des enfants' : '9. Children\'s Privacy'}</h2>
          <p className="text-gray-600 leading-relaxed">
            {isFr ? 'Nos services ne s adressent pas aux personnes de moins de 16 ans. Si vous pensez que nous avons collecte des informations de mineurs, contactez-nous immediatement.' : 'Our services are not directed to individuals under the age of 16. We do not knowingly collect personal information from children. If you believe we have inadvertently collected such information, please contact us immediately.'}
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? '10. Modifications de cette politique' : '10. Changes to This Policy'}</h2>
          <p className="text-gray-600 leading-relaxed">
            {isFr ? 'Nous pouvons mettre a jour cette politique. Les changements importants seront communiques en mettant a jour la date de derniere mise a jour et, au besoin, par notification.' : 'We may update this Privacy Policy from time to time. We will notify you of material changes by updating the “Last updated” date and, where appropriate, by sending a notification. Continued use of our services after changes constitutes acceptance of the updated policy.'}
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{isFr ? '11. Nous contacter' : '11. Contact Us'}</h2>
          <p className="text-gray-600 leading-relaxed">
            {isFr ? 'Si vous avez des questions concernant cette politique, veuillez contacter :' : 'If you have questions or concerns about this Privacy Policy, please contact:'}
          </p>
          <div className="mt-4 p-6 bg-gray-50 rounded-xl text-gray-700">
            <p className="font-semibold">Nzila Ventures Inc.</p>
            <p>{isFr ? 'Responsable de la confidentialité' : 'Privacy Officer'}</p>
            <p>Email: <a href="mailto:privacy@nzilaventures.com" className="text-electric underline">privacy@nzilaventures.com</a></p>
          </div>
        </section>

        <div className="pt-8 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
          <Link href="/legal/terms" className="hover:text-electric transition-colors">{isFr ? "Conditions d'utilisation" : 'Terms of Service'}</Link>
          <span>·</span>
          <Link href="/legal/ip-governance" className="hover:text-electric transition-colors">{isFr ? 'Gouvernance PI' : 'IP Governance'}</Link>
          <span>·</span>
          <Link href="/" className="hover:text-electric transition-colors">{isFr ? "Retour à l'accueil" : 'Back to Home'}</Link>
        </div>
      </div>
    </main>
  );
}








