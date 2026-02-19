import type { Metadata } from 'next';
import Link from 'next/link';


export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Nzila Ventures Privacy Policy — how we collect, use, and protect your personal information.',
  alternates: { canonical: '/legal/privacy' },
};

export default function PrivacyPolicy() {
  const lastUpdated = 'February 19, 2026';

  return (
    <main className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-navy text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">Legal</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-gray-400 text-sm">Last updated: {lastUpdated}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 prose prose-slate max-w-none">
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Introduction</h2>
          <p className="text-gray-600 leading-relaxed">
            Nzila Ventures Inc. (&ldquo;Nzila,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) respects your privacy and is committed to protecting the personal information you share with us. This Privacy Policy describes how we collect, use, disclose, and safeguard your information when you visit our website or use our services.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Information We Collect</h2>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Information You Provide</h3>
          <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
            <li>Name, email address, and contact details when you reach out via our contact form or investor portal</li>
            <li>Account credentials if you register for access to our console or partner tools</li>
            <li>Communications and correspondence you send to us</li>
          </ul>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Information Collected Automatically</h3>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>Log data including IP address, browser type, pages visited, and time spent</li>
            <li>Device information and operating system</li>
            <li>Cookies and similar tracking technologies (see Section 6)</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">3. How We Use Your Information</h2>
          <p className="text-gray-600 leading-relaxed mb-4">We use the information we collect to:</p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>Respond to inquiries and provide customer support</li>
            <li>Send updates about our products, services, and investment opportunities (with your consent)</li>
            <li>Analyze and improve our website and platform performance</li>
            <li>Comply with legal obligations and enforce our policies</li>
            <li>Protect against fraud, abuse, and security threats</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Sharing of Information</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            We do not sell your personal information. We may share it with:
          </p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li><strong>Service providers</strong> who process data on our behalf (hosting, analytics, authentication) under strict confidentiality agreements</li>
            <li><strong>Legal authorities</strong> when required by law, court order, or to protect the rights and safety of Nzila and its users</li>
            <li><strong>Business transfers</strong> in connection with a merger, acquisition, or sale of assets, with notice provided to you</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Data Retention</h2>
          <p className="text-gray-600 leading-relaxed">
            We retain personal information for as long as necessary to fulfill the purposes described in this policy, comply with legal obligations, resolve disputes, and enforce our agreements. When data is no longer needed, we securely delete or anonymize it.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Cookies</h2>
          <p className="text-gray-600 leading-relaxed">
            We use cookies and similar technologies to enhance your experience, analyze traffic, and support authentication. You can control cookies through your browser settings. Disabling cookies may limit some functionality of our site.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Your Rights</h2>
          <p className="text-gray-600 leading-relaxed mb-4">Depending on your location, you may have the right to:</p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data (&ldquo;right to be forgotten&rdquo;)</li>
            <li>Object to or restrict certain processing</li>
            <li>Data portability — receive your data in a structured, machine-readable format</li>
            <li>Withdraw consent at any time where processing is based on consent</li>
          </ul>
          <p className="text-gray-600 leading-relaxed mt-4">
            To exercise any of these rights, contact us at <a href="mailto:privacy@nzilaventures.com" className="text-electric underline">privacy@nzilaventures.com</a>.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Security</h2>
          <p className="text-gray-600 leading-relaxed">
            We implement industry-standard security measures including encryption in transit (TLS), encryption at rest, access controls, and regular security audits. No method of transmission over the internet is 100% secure; we strive to use commercially acceptable means to protect your data.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Children&apos;s Privacy</h2>
          <p className="text-gray-600 leading-relaxed">
            Our services are not directed to individuals under the age of 16. We do not knowingly collect personal information from children. If you believe we have inadvertently collected such information, please contact us immediately.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Changes to This Policy</h2>
          <p className="text-gray-600 leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of material changes by updating the &ldquo;Last updated&rdquo; date and, where appropriate, by sending a notification. Continued use of our services after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Contact Us</h2>
          <p className="text-gray-600 leading-relaxed">
            If you have questions or concerns about this Privacy Policy, please contact:
          </p>
          <div className="mt-4 p-6 bg-gray-50 rounded-xl text-gray-700">
            <p className="font-semibold">Nzila Ventures Inc.</p>
            <p>Privacy Officer</p>
            <p>Email: <a href="mailto:privacy@nzilaventures.com" className="text-electric underline">privacy@nzilaventures.com</a></p>
          </div>
        </section>

        <div className="pt-8 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
          <Link href="/legal/terms" className="hover:text-electric transition-colors">Terms of Service</Link>
          <span>·</span>
          <Link href="/legal/ip-governance" className="hover:text-electric transition-colors">IP Governance</Link>
          <span>·</span>
          <Link href="/" className="hover:text-electric transition-colors">Back to Home</Link>
        </div>
      </div>
    </main>
  );
}
