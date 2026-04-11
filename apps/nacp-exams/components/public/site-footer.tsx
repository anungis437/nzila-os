/**
 * SiteFooter — Six-column footer matching NzilaOS design language.
 * Pre-footer CTA strip + columns + social links + trust badges + bottom bar.
 */
import Link from 'next/link';

const footerLinks = {
  platform: {
    title: 'Platform',
    links: [
      { label: 'Exam Sessions', href: '/about#sessions' },
      { label: 'Candidate Tracking', href: '/about#candidates' },
      { label: 'Integrity Checks', href: '/about#integrity' },
      { label: 'Result Compilation', href: '/about#results' },
      { label: 'Analytics', href: '/about#analytics' },
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
      { label: 'Data Processing', href: '/legal/dpa' },
    ],
  },
  ecosystem: {
    title: 'Ecosystem',
    links: [
      { label: 'NzilaOS', href: 'https://nzila.app' },
      { label: 'UnionEyes', href: 'https://union-eyes.nzila.app' },
      { label: 'Zonga', href: 'https://zonga.nzila.app' },
      { label: 'Console', href: 'https://console.nzila.app' },
    ],
  },
};

export default function SiteFooter() {
  return (
    <footer className="bg-navy text-gray-300 relative overflow-hidden">
      {/* Pre-footer CTA */}
      <div className="relative border-b border-white/10">
        <div className="absolute inset-0 bg-mesh opacity-20" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold text-white">
                Ready to get started?
              </h3>
              <p className="text-gray-400 mt-1">
                Request a demo and see NACP Exams in action.
              </p>
            </div>
            <Link
              href="/demo-request"
              className="inline-flex items-center px-8 py-3.5 bg-electric text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/25 btn-press"
            >
              Request a Demo
            </Link>
          </div>
        </div>
      </div>

      {/* Footer columns */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          {/* Brand column (spans 2) */}
          <div className="col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-lg bg-electric flex items-center justify-center shadow-lg shadow-electric/30">
                <span className="text-white font-bold text-xs">NE</span>
              </div>
              <span className="text-white font-bold text-lg">NACP Exams</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed mb-6 max-w-xs">
              Secure, auditable national examination management.
              Session scheduling, integrity verification, and
              tamper-proof result compilation.
            </p>
            {/* Social links */}
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

          {/* Link columns */}
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

      {/* Trust badges */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'SHA-256 Verified', status: 'live' },
                { label: 'SOC 2 Compliant', status: 'live' },
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
              &copy; {new Date().getFullYear()} NACP Exams — A NzilaOS Application. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
