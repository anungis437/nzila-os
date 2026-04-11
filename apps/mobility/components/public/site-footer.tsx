/**
 * SiteFooter — Flagship marketing footer for Global Mobility OS
 * ──────────────────────────────────────────────────────────────
 * World-class footer with:
 *  - Pre-footer CTA strip  (drive conversions on every page)
 *  - 6-column link grid    (Brand · Platform · Programs · Resources · Legal · Ecosystem)
 *  - Trust badges with live-pulse indicator
 *  - Polished bottom bar with legal links
 *
 * Aligned with apps/union-eyes SiteFooter and the broader Nzila portfolio.
 */
"use client";

import Link from "next/link";
import { ArrowRight, Linkedin, Twitter, Github, Mail, Globe } from "lucide-react";

const NZILA_URL = process.env.NEXT_PUBLIC_NZILA_URL ?? "https://nzilaventures.com";
const CONSOLE_URL = process.env.NEXT_PUBLIC_CONSOLE_URL ?? "https://console.nzilaventures.com";
const PARTNERS_URL = process.env.NEXT_PUBLIC_PARTNERS_URL ?? "https://partners.nzilaventures.com";
const UE_URL = process.env.NEXT_PUBLIC_UE_URL ?? "https://unioneyes.nzilaventures.com";

const footerLinks = {
  Platform: [
    { name: "Case Management", href: "/#features" },
    { name: "Compliance Engine", href: "/#features" },
    { name: "AI Advisory Copilot", href: "/#features" },
    { name: "Client Portal", href: "/#features" },
    { name: "Analytics", href: "/#features" },
  ],
  Programs: [
    { name: "Portugal Golden Visa", href: "/#programs" },
    { name: "Malta Citizenship", href: "/#programs" },
    { name: "Grenada CBI", href: "/#programs" },
    { name: "UAE Residency", href: "/#programs" },
    { name: "All 40+ Programs", href: "/#programs" },
  ],
  Resources: [
    { name: "Documentation", href: "/docs" },
    { name: "API Reference", href: "/api" },
    { name: "Blog", href: "/blog" },
    { name: "Changelog", href: "/changelog" },
  ],
  Legal: [
    { name: "Privacy Policy", href: "/legal/privacy" },
    { name: "Terms of Service", href: "/legal/terms" },
    { name: "GDPR Compliance", href: "/legal/privacy" },
    { name: "Data Processing", href: "/legal/privacy" },
    { name: "Security", href: "/legal/security" },
  ],
};

const ecosystemLinks = [
  { name: "Nzila Ventures", href: NZILA_URL, desc: "Parent company" },
  { name: "Console", href: CONSOLE_URL, desc: "Admin portal" },
  { name: "Partner Hub", href: PARTNERS_URL, desc: "Integration portal" },
  { name: "UnionEyes", href: UE_URL, desc: "Union management" },
];

const socials = [
  { name: "LinkedIn", href: "https://linkedin.com/company/nzila-ventures", icon: Linkedin },
  { name: "X (Twitter)", href: "https://x.com/nzilaventures", icon: Twitter },
  { name: "GitHub", href: "https://github.com/nzila-ventures", icon: Github },
  { name: "Email", href: "mailto:mobility@nzilaventures.com", icon: Mail },
];

export function SiteFooter() {
  return (
    <footer className="bg-navy text-gray-300">
      {/* ─── Pre-footer CTA ─── */}
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-4 py-14 sm:px-6 lg:flex-row lg:px-8">
          <div className="max-w-xl text-center lg:text-left">
            <h3 className="mb-2 text-2xl font-bold text-white md:text-3xl">
              Ready to transform your migration practice?
            </h3>
            <p className="text-lg text-gray-400">
              Launch a pilot with your team in under one week — no commitment,
              no credit card.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="btn-press inline-flex items-center justify-center gap-2 rounded-xl bg-amber px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-amber/25 transition-all hover:bg-amber-light"
            >
              Start Free Pilot <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/sign-in"
              className="btn-press inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white transition-all hover:bg-white/20"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Main Footer ─── */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-6 lg:gap-8">
          {/* Brand Column (spans 2) */}
          <div className="space-y-6 lg:col-span-2">
            <Link href="/" className="group flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-amber to-gold shadow-lg shadow-amber/20 transition-shadow group-hover:shadow-amber/40">
                <span className="text-sm font-bold text-white">GM</span>
              </div>
              <span className="text-2xl font-bold text-white">
                Global<span className="text-gold-light">Mobility</span>
              </span>
            </Link>

            <p className="max-w-sm leading-relaxed text-gray-400">
              The operating system for investment migration advisory firms.
              Program intelligence, compliance automation, and end-to-end
              case management — all on one platform.
            </p>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-emerald/20 px-3 py-1.5 text-xs font-semibold text-emerald">
                <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald" />
                40+ Programs
              </span>
              <span className="inline-flex items-center rounded-full bg-gold/20 px-3 py-1.5 text-xs font-semibold text-gold">
                25+ Countries
              </span>
              <span className="inline-flex items-center rounded-full bg-violet/20 px-3 py-1.5 text-xs font-semibold text-violet">
                GDPR Compliant
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
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-gray-400 transition-all hover:bg-white/15 hover:text-white"
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="mb-5 text-xs font-semibold uppercase tracking-[0.15em] text-white">
                {category}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm leading-relaxed text-gray-400 transition-colors hover:text-white"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Ecosystem row — below main columns on large screens */}
        <div className="mt-12 border-t border-white/10 pt-8">
          <h4 className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-white">
            <Globe className="h-3.5 w-3.5 text-gray-500" />
            Nzila Ecosystem
          </h4>
          <div className="flex flex-wrap gap-6">
            {ecosystemLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group text-sm"
              >
                <span className="inline-flex items-center gap-1 text-gray-400 transition-colors group-hover:text-white">
                  {link.name}
                  <span className="text-xs text-gray-600">↗</span>
                </span>
                <span className="mt-0.5 block text-xs text-gray-600">
                  {link.desc}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Bottom Bar ─── */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 sm:px-6 md:flex-row lg:px-8">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Global Mobility OS. All rights
            reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500">
            <span>
              A{" "}
              <a
                href={NZILA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-gray-400 transition-colors hover:text-white"
              >
                Nzila Ventures
              </a>{" "}
              product
            </span>
            <span className="text-gray-700">·</span>
            <Link
              href="/legal/privacy"
              className="transition-colors hover:text-gray-300"
            >
              Privacy
            </Link>
            <span className="text-gray-700">·</span>
            <Link
              href="/legal/terms"
              className="transition-colors hover:text-gray-300"
            >
              Terms
            </Link>
            <span className="text-gray-700">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald" />
              </span>
              All Systems Operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
