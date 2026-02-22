/**
 * SiteFooter — Flagship marketing footer for Union Eyes
 * ──────────────────────────────────────────────────────────
 * World-class footer with:
 *  - Pre-footer CTA strip  (drive conversions on every page)
 *  - 6-column link grid    (Brand · Platform · Resources · Legal · Ecosystem)
 *  - Social media links
 *  - Trust badges with live-pulse indicator
 *  - Polished bottom bar with legal links
 *
 * Design-aligned with apps/web Footer and the broader Nzila portfolio.
 */
'use client';

import Link from 'next/link';
import { ArrowRight, Linkedin, Twitter, Github, Mail, Globe } from 'lucide-react';

const NZILA_URL   = process.env.NEXT_PUBLIC_NZILA_URL     ?? 'https://nzilaventures.com';
const CONSOLE_URL = process.env.NEXT_PUBLIC_CONSOLE_URL   ?? 'https://console.nzilaventures.com';
const PARTNERS_URL = process.env.NEXT_PUBLIC_PARTNERS_URL ?? 'https://partners.nzilaventures.com';
const ABR_URL     = process.env.NEXT_PUBLIC_ABR_URL       ?? 'https://abr.nzilaventures.com';

/* ────────────────── Link Data ────────────────── */

const footerLinks = {
  Platform: [
    { name: 'Grievance Tracking',   href: '/story' },
    { name: 'Member Portal',        href: '/story' },
    { name: 'AI Workbench',         href: '/story' },
    { name: 'Analytics & Reporting', href: '/story' },
    { name: 'Pricing',              href: '/pricing' },
    { name: 'System Status',        href: '/status' },
  ],
  Resources: [
    { name: 'Case Studies',   href: '/case-studies' },
    { name: 'Our Story',      href: '/story' },
    { name: 'Pilot Program',  href: '/pilot-request' },
    { name: 'Contact Us',     href: '/contact' },
  ],
  Legal: [
    { name: 'Privacy Policy',    href: '/legal/privacy' },
    { name: 'Terms of Service',  href: '/legal/terms' },
    { name: 'PIPEDA Compliance', href: '/legal/privacy' },
    { name: 'Data Sovereignty',  href: '/legal/privacy' },
    { name: 'Accessibility',     href: '/legal/accessibility' },
  ],
};

const ecosystemLinks = [
  { name: 'Nzila Ventures', href: NZILA_URL,   desc: 'Parent company' },
  { name: 'Console',        href: CONSOLE_URL,  desc: 'Admin portal' },
  { name: 'Partner Hub',    href: PARTNERS_URL, desc: 'Integration portal' },
  { name: 'ABR Insights',   href: ABR_URL,      desc: 'Analytics engine' },
];

const socials = [
  { name: 'LinkedIn', href: 'https://linkedin.com/company/union-eyes', icon: Linkedin },
  { name: 'X (Twitter)', href: 'https://x.com/unioneyes', icon: Twitter },
  { name: 'GitHub', href: 'https://github.com/nzila-ventures', icon: Github },
  { name: 'Email', href: 'mailto:hello@unioneyes.com', icon: Mail },
];

/* ────────────────── Component ────────────────── */

export default function SiteFooter() {
  return (
    <footer className="bg-navy text-gray-300">
      {/* ─── Pre-footer CTA ─── */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="text-center lg:text-left max-w-xl">
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Ready to see Union Eyes in action?
            </h3>
            <p className="text-gray-400 text-lg">
              Start a pilot with your local in under 48 hours — no commitment,
              no credit card.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/pilot-request"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-electric text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/25 btn-press text-sm"
            >
              Request a Pilot <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/10 text-white font-semibold rounded-xl border border-white/20 hover:bg-white/20 transition-all text-sm btn-press"
            >
              Talk to Us
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Main Footer ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12 lg:gap-8">
          {/* Brand Column (spans 2) */}
          <div className="lg:col-span-2 space-y-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-lg bg-linear-to-br from-electric to-violet flex items-center justify-center shadow-lg shadow-electric/20 group-hover:shadow-electric/40 transition-shadow">
                <span className="text-white font-bold text-sm">UE</span>
              </div>
              <span className="text-2xl font-bold text-white">Union Eyes</span>
            </Link>

            <p className="text-gray-400 max-w-sm leading-relaxed">
              AI-powered union management built with organizers, not for them.
              Grievance tracking, member engagement, and operational excellence
              — all on one platform.
            </p>

            {/* Trust Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full bg-emerald/20 text-emerald">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald mr-1.5 animate-pulse" />
                4,773 Entities
              </span>
              <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full bg-gold/20 text-gold">
                Canadian Made
              </span>
              <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full bg-electric/20 text-electric-light">
                PIPEDA Compliant
              </span>
            </div>

            {/* Social Links */}
            <div className="flex items-center gap-3 pt-2">
              {socials.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name}
                  className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center text-gray-400 hover:text-white transition-all"
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-white font-semibold mb-5 text-xs tracking-[0.15em] uppercase">
                {category}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-gray-400 hover:text-white transition-colors text-sm leading-relaxed"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Ecosystem Column */}
          <div>
            <h4 className="text-white font-semibold mb-5 text-xs tracking-[0.15em] uppercase flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-gray-500" />
              Ecosystem
            </h4>
            <ul className="space-y-4">
              {ecosystemLinks.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group text-sm"
                  >
                    <span className="text-gray-400 group-hover:text-white transition-colors inline-flex items-center gap-1">
                      {link.name}
                      <span className="text-gray-600 text-xs">↗</span>
                    </span>
                    <span className="block text-xs text-gray-600 mt-0.5">
                      {link.desc}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ─── Bottom Bar ─── */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Union Eyes. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap justify-center">
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
