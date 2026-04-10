/**
 * SiteFooter — Six-column footer (Zonga / Music Platform)
 */
import Link from 'next/link';
import { ZongaBrandMark, PartnershipAttribution } from '@/components/branding';
import { getClientBrand, getPartnerBrand } from '@/lib/branding/brand-config';

const footerLinks = {
  platform: {
    title: 'Platform',
    links: [
      { label: 'Catalog', href: '/about#catalog' },
      { label: 'Distribution', href: '/about#distribution' },
      { label: 'Analytics', href: '/about#analytics' },
      { label: 'Payouts', href: '/about#payouts' },
      { label: 'Audio Fingerprinting', href: '/about#integrity' },
    ],
  },
  resources: {
    title: 'Resources',
    links: [
      { label: 'Documentation', href: '/docs' },
      { label: 'API Reference', href: '/docs/api' },
      { label: 'Status', href: '/status' },
      { label: 'Support', href: '/contact' },
    ],
  },
  legal: {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/legal/privacy' },
      { label: 'Terms of Service', href: '/legal/terms' },
      { label: 'Cookie Policy', href: '/legal/cookies' },
      { label: 'Royalty Policy', href: '/legal/royalties' },
    ],
  },
  ecosystem: {
    title: 'Ecosystem',
    links: [
      { label: 'NzilaOS', href: 'https://nzila.app' },
      { label: 'Union Eyes', href: 'https://union-eyes.nzila.app' },
      { label: 'NACP Exams', href: 'https://nacp-exams.nzila.app' },
      { label: 'Console', href: 'https://console.nzila.app' },
    ],
  },
};

export default function SiteFooter() {
  const client = getClientBrand();
  const partner = getPartnerBrand();

  return (
    <footer className="bg-navy text-gray-300 relative overflow-hidden">
      {/* Pre-footer CTA */}
      <div className="relative border-b border-white/10">
        <div className="absolute inset-0 bg-mesh opacity-20" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold text-white">
                Ready to share your music?
              </h3>
              <p className="text-gray-400 mt-1">
                Join thousands of African creators on Zonga.
              </p>
            </div>
            <Link
              href="/sign-up"
              className="inline-flex items-center px-8 py-3.5 bg-electric text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/25 btn-press"
            >
              Start Free
            </Link>
          </div>
        </div>
      </div>

      {/* Footer columns */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          <div className="col-span-2">
            <div className="mb-6">
              <ZongaBrandMark placement="footer" size="md" />
            </div>
            <p className="text-sm text-gray-400 leading-relaxed mb-4 max-w-xs">
              The fair-share music platform — transparent royalties,
              instant payouts, and full creative ownership for African
              artists and creators.
            </p>
            <PartnershipAttribution placement="footer" client={client} partner={partner} variant="inline" className="mb-6" />
            <div className="flex gap-3">
              {['LinkedIn', 'GitHub', 'X'].map((social) => (
                <a
                  key={social}
                  href="#"
                  className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                  aria-label={social}
                >
                  <span className="text-xs text-gray-400">{social[0]}</span>
                </a>
              ))}
            </div>
          </div>

          {Object.values(footerLinks).map((section) => (
            <div key={section.title}>
              <h4 className="text-white font-semibold text-sm mb-4 tracking-wider uppercase">
                {section.title}
              </h4>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Trust badges + copyright */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Fair Revenue', status: 'live' },
                { label: 'Audio Verified', status: 'live' },
                { label: 'GDPR Ready', status: 'live' },
              ].map((badge) => (
                <div
                  key={badge.label}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 text-xs"
                >
                  <div className="relative w-1.5 h-1.5 rounded-full bg-emerald-400">
                    <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />
                  </div>
                  <span className="text-gray-400">{badge.label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              &copy; {new Date().getFullYear()} Zonga — A NzilaOS Application. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
