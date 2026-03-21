import type { Metadata } from 'next';
import ScrollReveal from '@/components/public/scroll-reveal';

export const metadata: Metadata = {
  title: 'Privacy Policy — Zonga',
  description: 'How Zonga collects, uses, and protects your personal data.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen">
      <section className="relative py-32 bg-navy overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-40" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Privacy Policy</h1>
            <p className="text-gray-400">Last updated: March 20, 2026</p>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 prose prose-gray prose-headings:text-navy">
          <ScrollReveal>
            <h2>1. Information We Collect</h2>
            <p>
              When you create an account, upload content, or use our services, we collect information you provide directly — including your name, email address, payment details, and uploaded media. We also collect usage data such as pages visited, features used, and device information through standard web technologies.
            </p>

            <h2>2. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul>
              <li>Provide, maintain, and improve the Zonga platform</li>
              <li>Process payments and royalty disbursements</li>
              <li>Communicate with you about your account and platform updates</li>
              <li>Detect and prevent fraud, abuse, and security incidents</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h2>3. Data Sharing</h2>
            <p>
              We do not sell your personal data. We share information only with service providers necessary to operate the platform (payment processors, cloud infrastructure, authentication) and when required by law.
            </p>

            <h2>4. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active or as needed to provide services. Financial records are retained for the period required by applicable tax and accounting regulations. You may request deletion of your account and associated data at any time.
            </p>

            <h2>5. Security</h2>
            <p>
              We implement industry-standard security measures including encryption in transit (TLS), encryption at rest, access controls, and regular security audits. Audio content is protected by our fingerprinting and integrity verification systems.
            </p>

            <h2>6. Your Rights</h2>
            <p>
              Depending on your jurisdiction, you may have the right to access, correct, delete, or export your personal data. You may also object to or restrict certain processing activities. To exercise these rights, contact us at <a href="mailto:privacy@zonga.app">privacy@zonga.app</a>.
            </p>

            <h2>7. International Transfers</h2>
            <p>
              Zonga operates across multiple regions. Your data may be processed in Canada, the United States, or other countries where our infrastructure partners operate. We ensure appropriate safeguards are in place for cross-border transfers.
            </p>

            <h2>8. Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. Material changes will be communicated via email or an in-app notification. Continued use of the platform after changes constitutes acceptance.
            </p>

            <h2>9. Contact</h2>
            <p>
              For privacy-related inquiries, contact us at <a href="mailto:privacy@zonga.app">privacy@zonga.app</a>.
            </p>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
