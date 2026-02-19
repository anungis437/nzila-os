import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'IP Governance Policy',
  description: 'Nzila Ventures Intellectual Property Governance — how we protect, manage, and license our IP across all verticals.',
  alternates: { canonical: '/legal/ip-governance' },
};

export default function IPGovernance() {
  const lastUpdated = 'February 19, 2026';

  return (
    <main className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-navy text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">Legal</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">IP Governance Policy</h1>
          <p className="text-gray-400 text-sm">Last updated: {lastUpdated}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Overview</h2>
          <p className="text-gray-600 leading-relaxed">
            Nzila Ventures Inc. is an ethical IP-holding company. All intellectual property developed by Nzila, its subsidiaries, portfolio companies, and contractors is centrally governed through this policy. This ensures consistent protection, licensing, and responsible commercialization of all innovations across our multi-vertical platform.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Ownership</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Unless otherwise agreed in writing, the following are owned exclusively by Nzila Ventures Inc.:
          </p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>All software, code, algorithms, and technical architectures developed on company time or with company resources</li>
            <li>All AI/ML models, training data pipelines, and inference systems built within the Nzila ecosystem</li>
            <li>All trademarks, service marks, trade names, logos, and brand assets</li>
            <li>All product concepts, designs, UX patterns, and documentation created for Nzila projects</li>
            <li>All domain names, social media handles, and digital assets registered under Nzila</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Contributor IP Assignment</h2>
          <p className="text-gray-600 leading-relaxed">
            All employees, contractors, and partners contributing to Nzila products are required to execute an IP Assignment Agreement prior to commencing work. This agreement assigns all work-for-hire IP to Nzila Ventures Inc. and ensures there are no conflicting claims from prior employers or third parties.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Open Source Policy</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Nzila uses open source software responsibly and gives back to the open source community where appropriate. Our standards:
          </p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>All open source dependencies must be vetted for license compatibility before integration</li>
            <li>GPL and AGPL licensed code requires explicit legal review before use in commercial products</li>
            <li>MIT, Apache 2.0, and BSD licensed dependencies are generally approved for use</li>
            <li>Any Nzila code released as open source requires CTO and legal sign-off</li>
            <li>Open source contributions on behalf of Nzila must be made through official channels only</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">5. AI & Model Governance</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            All AI systems developed at Nzila are subject to additional governance requirements:
          </p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>Training data provenance must be documented and verified as legally sourced</li>
            <li>Models trained on proprietary or sensitive data are classified as Nzila Confidential IP</li>
            <li>AI outputs used in regulated verticals (health, legal, finance) must pass bias audits before deployment</li>
            <li>The Companion Engine and all derivative AI systems are registered as core Nzila IP</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Licensing</h2>
          <p className="text-gray-600 leading-relaxed">
            Nzila IP may be licensed to third parties only under a formal licensing agreement reviewed and signed by authorized representatives. Licensing terms vary by product vertical and intended use. All licensing inquiries should be directed to{' '}
            <a href="mailto:ip@nzilaventures.com" className="text-electric underline">ip@nzilaventures.com</a>.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Trademark Use</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Use of Nzila&apos;s trademarks, logos, and brand assets by external parties requires explicit written permission. Unauthorized use of Nzila&apos;s trademarks including &ldquo;Nzila,&rdquo; &ldquo;Nzila Ventures,&rdquo; &ldquo;Nzila OS,&rdquo; and associated logos is prohibited. For press, partnership, or referential use, submit a request to{' '}
            <a href="mailto:brand@nzilaventures.com" className="text-electric underline">brand@nzilaventures.com</a>.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Confidentiality</h2>
          <p className="text-gray-600 leading-relaxed">
            Proprietary technology, architecture documents, business strategies, financial projections, and unreleased product plans are classified as Nzila Confidential. Access is restricted to team members on a need-to-know basis, and all external parties receiving confidential information must sign a Non-Disclosure Agreement (NDA) before access is granted.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Reporting IP Concerns</h2>
          <p className="text-gray-600 leading-relaxed">
            If you believe Nzila IP is being infringed, misused, or that you have discovered an IP conflict, please report it immediately to{' '}
            <a href="mailto:ip@nzilaventures.com" className="text-electric underline">ip@nzilaventures.com</a>. We take all IP concerns seriously and investigate promptly.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Contact</h2>
          <div className="mt-4 p-6 bg-gray-50 rounded-xl text-gray-700">
            <p className="font-semibold">Nzila Ventures Inc.</p>
            <p>Intellectual Property Office</p>
            <p>Email: <a href="mailto:ip@nzilaventures.com" className="text-electric underline">ip@nzilaventures.com</a></p>
          </div>
        </section>

        <div className="pt-8 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
          <Link href="/legal/privacy" className="hover:text-electric transition-colors">Privacy Policy</Link>
          <span>·</span>
          <Link href="/legal/terms" className="hover:text-electric transition-colors">Terms of Service</Link>
          <span>·</span>
          <Link href="/" className="hover:text-electric transition-colors">Back to Home</Link>
        </div>
      </div>
    </main>
  );
}
