/**
 * SiteFooter — Consistent marketing footer for Union Eyes
 * Aligned with apps/web Footer design: navy background, 5-column grid,
 * trust badges, bottom bar with legal links.
 */
'use client';

import Link from 'next/link';

const NZILA_URL = process.env.NEXT_PUBLIC_NZILA_URL ?? 'https://nzilaventures.com';

const footerLinks = {
  Platform: [
    { name: 'Grievance Management', href: '/dashboard' },
    { name: 'Member Portal', href: '/portal' },
    { name: 'AI Workbench', href: '/dashboard' },
    { name: 'Analytics', href: '/dashboard' },
    { name: 'Pricing', href: '/pricing' },
  ],
  Resources: [
    { name: 'Case Studies', href: '/case-studies' },
    { name: 'Our Story', href: '/story' },
    { name: 'Pilot Program', href: '/pilot-request' },
    { name: 'Documentation', href: '/api-docs' },
    { name: 'System Status', href: '/status' },
  ],
  Legal: [
    { name: 'Privacy Policy', href: '/legal/privacy' },
    { name: 'Terms of Service', href: '/legal/terms' },
    { name: 'PIPEDA Compliance', href: '/legal/privacy' },
    { name: 'Data Sovereignty', href: '/legal/privacy' },
  ],
};

export default function SiteFooter() {
  return (
    <footer className="bg-navy text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-linear-to-br from-electric to-violet flex items-center justify-center">
                <span className="text-white font-bold text-sm">UE</span>
              </div>
              <span className="text-2xl font-bold text-white">Union Eyes</span>
            </div>
            <p className="text-gray-400 mb-6 max-w-sm leading-relaxed">
              AI-powered union management built with organizers, not for them.
              Grievance tracking, member engagement, and operational excellence
              — all on one platform.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-emerald/20 text-emerald">
                4,773 Entities
              </span>
              <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-gold/20 text-gold">
                Canadian Made
              </span>
              <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-electric/20 text-electric-light">
                PIPEDA Compliant
              </span>
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-white font-semibold mb-4 text-sm tracking-wider uppercase">
                {category}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-gray-400 hover:text-white transition-colors text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Union Eyes. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>
              A{' '}
              <a
                href={NZILA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors font-medium"
              >
                Nzila Ventures
              </a>
              {' '}product
            </span>
            <span className="text-gray-700">·</span>
            <Link href="/legal/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
            <span className="text-gray-700">·</span>
            <Link href="/legal/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
            <span className="text-gray-700">·</span>
            <Link href="/contact" className="hover:text-gray-300 transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
