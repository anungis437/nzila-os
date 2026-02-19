import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Nzila Ventures Terms of Service — the rules and guidelines governing use of our platform and services.',
  alternates: { canonical: '/legal/terms' },
};

export default function TermsOfService() {
  const lastUpdated = 'February 19, 2026';

  return (
    <main className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-navy text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">Legal</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
          <p className="text-gray-400 text-sm">Last updated: {lastUpdated}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Acceptance of Terms</h2>
          <p className="text-gray-600 leading-relaxed">
            By accessing or using any website, platform, or service operated by Nzila Ventures Inc. (&ldquo;Nzila,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Description of Services</h2>
          <p className="text-gray-600 leading-relaxed">
            Nzila Ventures operates a multi-vertical venture studio platform providing AI-powered SaaS products across healthcare, finance, agriculture, legal, labor, cybersecurity, education, and social justice sectors. Services include, but are not limited to, the Nzila OS console, partner portals, and public-facing information and investor resources.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Eligibility</h2>
          <p className="text-gray-600 leading-relaxed">
            You must be at least 16 years of age to use our services. By using the platform, you represent that you have the legal capacity to enter into a binding agreement. If you are using the platform on behalf of an organization, you represent that you have authority to bind that organization to these terms.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">4. User Accounts</h2>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>You are responsible for maintaining the confidentiality of your account credentials</li>
            <li>You are responsible for all activity that occurs under your account</li>
            <li>You must notify us immediately of any unauthorized use of your account</li>
            <li>We reserve the right to suspend or terminate accounts that violate these terms</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Acceptable Use</h2>
          <p className="text-gray-600 leading-relaxed mb-4">You agree not to:</p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>Use the platform for any unlawful, harmful, or fraudulent purpose</li>
            <li>Reverse-engineer, decompile, or attempt to extract source code from our services</li>
            <li>Interfere with or disrupt the integrity or performance of our systems</li>
            <li>Transmit malware, viruses, or any other malicious code</li>
            <li>Scrape, crawl, or harvest data from our platforms without explicit written consent</li>
            <li>Use our branding, trademarks, or intellectual property without authorization</li>
            <li>Impersonate any person or entity, or falsely represent your affiliation with any person or entity</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Intellectual Property</h2>
          <p className="text-gray-600 leading-relaxed">
            All content, software, technology, designs, trademarks, and other materials on our platforms are the exclusive property of Nzila Ventures Inc. or its licensors. Nothing in these Terms grants you any right to use Nzila&apos;s intellectual property without prior written permission. See our{' '}
            <Link href="/legal/ip-governance" className="text-electric underline">IP Governance Policy</Link>{' '}
            for full details.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Third-Party Services</h2>
          <p className="text-gray-600 leading-relaxed">
            Our platform may integrate with or link to third-party services. We are not responsible for the content, privacy practices, or terms of such third parties. Your use of third-party services is at your own risk and subject to their respective terms.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Disclaimers</h2>
          <p className="text-gray-600 leading-relaxed">
            Our services are provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not warrant that our services will be uninterrupted, error-free, or secure.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Limitation of Liability</h2>
          <p className="text-gray-600 leading-relaxed">
            To the fullest extent permitted by applicable law, Nzila Ventures shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use our services, even if advised of the possibility of such damages. Our total liability to you shall not exceed the amount you paid to us in the twelve months preceding the claim.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Governing Law</h2>
          <p className="text-gray-600 leading-relaxed">
            These Terms shall be governed by and construed in accordance with the laws of the Province of Ontario, Canada, without regard to its conflict of law principles. Any disputes shall be resolved in the courts of Ontario, and you consent to the exclusive jurisdiction of those courts.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Changes to Terms</h2>
          <p className="text-gray-600 leading-relaxed">
            We reserve the right to modify these Terms at any time. Material changes will be communicated via email or prominent notice on our platform. Continued use after the effective date constitutes acceptance of the revised Terms.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Contact</h2>
          <p className="text-gray-600 leading-relaxed">For questions about these Terms, please contact:</p>
          <div className="mt-4 p-6 bg-gray-50 rounded-xl text-gray-700">
            <p className="font-semibold">Nzila Ventures Inc.</p>
            <p>Legal Department</p>
            <p>Email: <a href="mailto:legal@nzilaventures.com" className="text-electric underline">legal@nzilaventures.com</a></p>
          </div>
        </section>

        <div className="pt-8 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
          <Link href="/legal/privacy" className="hover:text-electric transition-colors">Privacy Policy</Link>
          <span>·</span>
          <Link href="/legal/ip-governance" className="hover:text-electric transition-colors">IP Governance</Link>
          <span>·</span>
          <Link href="/" className="hover:text-electric transition-colors">Back to Home</Link>
        </div>
      </div>
    </main>
  );
}
