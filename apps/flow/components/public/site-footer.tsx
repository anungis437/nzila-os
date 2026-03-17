import Link from "next/link";
import { SHOPMOICA_BRANDING } from '@nzila/platform-commerce-org/defaults'

const footerSections = [
  {
    title: "Platform",
    links: [
      { label: "Smart Quoting", href: "/features" },
      { label: "AI Pricing", href: "/features" },
      { label: "Margin Analytics", href: "/features" },
      { label: "Bulk Import", href: "/features" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "/resources" },
      { label: "API Reference", href: "/resources" },
      { label: "Changelog", href: "/resources" },
      { label: "System Status", href: "/resources" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "Terms of Service", href: "/legal/terms" },
      { label: "Security", href: "/legal/security" },
      { label: "DPA", href: "/legal/dpa" },
    ],
  },
  {
    title: "Ecosystem",
    links: [
      { label: "NzilaOS Platform", href: "https://nzilaventures.com" },
      { label: "Union Eyes", href: "https://unioneyes.ca" },
      { label: "ABR Insights", href: "#" },
      { label: "Zonga", href: "#" },
    ],
  },
];

const trustBadges = [
  { label: "SOC 2 Compliant" },
  { label: "GDPR Ready" },
  { label: "PIPEDA Compliant" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      {/* Pre-footer CTA */}
      <div className="bg-navy">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div>
            <h3 className="font-poppins text-lg font-semibold text-white">
              Ready to streamline your quoting?
            </h3>
            <p className="text-sm text-slate-400">
              Start creating professional proposals in minutes.
            </p>
          </div>
          <Link
            href="/sign-up"
            className="rounded-lg bg-electric px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-electric/90 hover:shadow-lg"
          >
            Get Started Free
          </Link>
        </div>
      </div>

      {/* Main footer */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          <div className="col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-electric font-poppins text-sm font-bold text-white">
                {SHOPMOICA_BRANDING.logoInitials}
              </div>
              <span className="font-poppins text-lg font-semibold text-navy">
                Flow
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
              Professional quoting and proposal tool for gift box businesses.
              AI-assisted pricing with evidence-first audit trails.
            </p>
            <div className="mt-6 flex gap-3">
              {["LinkedIn", "GitHub"].map((label) => (
                <span
                  key={label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-xs font-medium text-slate-500 transition-colors hover:bg-electric hover:text-white"
                >
                  {label[0]}
                </span>
              ))}
            </div>
          </div>

          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="font-poppins text-sm font-semibold text-navy">
                {section.title}
              </h4>
              <ul className="mt-4 space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-500 transition-colors hover:text-electric"
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

      <div className="border-t border-slate-100">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row">
          <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} {SHOPMOICA_BRANDING.companyLegalName}. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-3">
            {trustBadges.map((badge) => (
              <span
                key={badge.label}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-500"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald" />
                </span>
                {badge.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
