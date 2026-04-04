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

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Linkedin, Twitter, Github, Mail } from 'lucide-react';

const NZILA_URL = process.env.NEXT_PUBLIC_NZILA_URL ?? 'https://nzilaventures.com';

/* ────────────────── Link Data ────────────────── */

const footerLinks = {
  Platform: [
    { name: 'Grievance Tracking',    href: '/features/grievance-tracking' },
    { name: 'Member Portal',         href: '/features/member-portal' },
    { name: 'AI Workbench',          href: '/features/ai-workbench' },
    { name: 'Analytics & Reporting', href: '/features/analytics' },
    { name: 'Pricing',              href: '/pricing' },
    { name: 'System Status',        href: '/en-CA/trust#system-status' },
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
    { name: 'Security',          href: '/legal/security' },
    { name: 'Accessibility',     href: '/legal/accessibility' },
  ],
};

const socials = [
  { name: 'LinkedIn', href: 'https://linkedin.com/company/union-eyes', icon: Linkedin },
  { name: 'X (Twitter)', href: 'https://x.com/unioneyes', icon: Twitter },
  { name: 'GitHub', href: 'https://github.com/nzila-ventures', icon: Github },
  { name: 'Email', href: 'mailto:hello@unioneyes.com', icon: Mail },
];

/* ────────────────── Component ────────────────── */

export default function SiteFooter() {
  return (
    <footer className="bg-navy text-gray-200">
      {/* ─── Pre-footer CTA ─── */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="text-center lg:text-left max-w-xl">
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Interested in piloting Union Eyes?
            </h3>
            <p className="text-gray-200 text-lg">
              We&apos;re working with unions like CUPE and CAPE to shape the platform.
              Apply for early access — no commitment, no credit card.
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
              Learn More
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Main Footer ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">
          {/* Brand Column (spans 2) */}
          <div className="lg:col-span-2 space-y-6">
            <Link href="/" className="flex items-center gap-3 group">
              <Image
                src="/images/brand/icon.png"
                alt="Union Eyes"
                width={40}
                height={40}
                className="w-10 h-10 rounded-lg shadow-lg shadow-electric/20 group-hover:shadow-electric/40 transition-shadow"
              />
              <span className="text-2xl font-bold text-white">Union Eyes</span>
            </Link>

            <p className="text-gray-200 max-w-sm leading-relaxed">
              AI-powered union management co-designed with organizers, not for them.
              Grievance tracking, member engagement, and operational excellence
              — now in pilot with leading Canadian unions.
            </p>

            {/* Trust Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full bg-emerald/20 text-emerald">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald mr-1.5 animate-pulse" />
                Pilot Active
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
                  className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-300 hover:text-white transition-all"
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
                      className="text-gray-300 hover:text-white transition-colors text-sm leading-relaxed"
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

      {/* ─── Bottom Bar ─── */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} Union Eyes. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm text-gray-400 flex-wrap justify-center">
            <span>
              A{' '}
              <a
                href={NZILA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white transition-colors font-medium"
              >
                Nzila Ventures
              </a>
              {' '}product
            </span>
            <span className="text-gray-500">·</span>
            <Link href="/legal/privacy" className="hover:text-gray-200 transition-colors">Privacy</Link>
            <span className="text-gray-500">·</span>
            <Link href="/legal/terms" className="hover:text-gray-200 transition-colors">Terms</Link>
            <span className="text-gray-500">·</span>
            <Link href="/contact" className="hover:text-gray-200 transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
