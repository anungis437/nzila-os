import type { Metadata } from 'next';
import ScrollReveal from '@/components/public/scroll-reveal';

export const metadata: Metadata = {
  title: 'Cookie Policy — Zonga',
  description: 'How Zonga uses cookies and similar technologies.',
};

export default function CookiePolicyPage() {
  return (
    <main className="min-h-screen">
      <section className="relative py-32 bg-navy overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-40" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Cookie Policy</h1>
            <p className="text-gray-400">Last updated: March 20, 2026</p>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 prose prose-gray prose-headings:text-navy">
          <ScrollReveal>
            <h2>1. What Are Cookies</h2>
            <p>
              Cookies are small text files stored on your device when you visit a website. They help the site remember your preferences and understand how you interact with the platform.
            </p>

            <h2>2. Cookies We Use</h2>

            <h3>Essential Cookies</h3>
            <p>
              Required for the platform to function. These handle authentication (Clerk session cookies), security tokens, and basic navigation. They cannot be disabled.
            </p>

            <h3>Functional Cookies</h3>
            <p>
              Remember your preferences such as language, theme, and playback settings. These improve your experience but are not strictly necessary.
            </p>

            <h3>Analytics Cookies</h3>
            <p>
              Help us understand how users interact with the platform — which pages are visited, how long sessions last, and where errors occur. We use this data to improve the platform. No personally identifiable information is shared with third-party analytics providers.
            </p>

            <h2>3. Third-Party Cookies</h2>
            <p>
              Our authentication provider (Clerk) and payment processor (Stripe) may set their own cookies necessary for their services to function. These are governed by their respective privacy policies.
            </p>

            <h2>4. Managing Cookies</h2>
            <p>
              You can control cookies through your browser settings. Note that disabling essential cookies will prevent you from using authenticated features of the platform.
            </p>

            <h2>5. Contact</h2>
            <p>
              For questions about our use of cookies, contact us at <a href="mailto:privacy@zonga.app">privacy@zonga.app</a>.
            </p>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
