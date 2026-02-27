import Link from "next/link";

const platformLinks = [
  { href: "/platform#dashboard", label: "Client Dashboard" },
  { href: "/platform#ledger", label: "General Ledger" },
  { href: "/platform#reports", label: "Advisory Reports" },
  { href: "/platform#compliance", label: "Compliance Engine" },
  { href: "/platform#workflows", label: "Workflow Automation" },
];

const resourceLinks = [
  { href: "/docs", label: "Documentation" },
  { href: "/blog", label: "Blog" },
  { href: "/guides", label: "Guides" },
  { href: "/webinars", label: "Webinars" },
  { href: "/changelog", label: "Changelog" },
];

const companyLinks = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/careers", label: "Careers" },
  { href: "/partners", label: "Partners" },
];

const legalLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/security", label: "Security" },
  { href: "/sla", label: "SLA" },
];

const trustBadges = [
  { label: "SOC 2 Type II — In Progress", icon: "🛡️" },
  { label: "CPA Canada Aligned", icon: "📋" },
  { label: "PIPEDA Committed", icon: "🔒" },
  { label: "ISO 27001 — Planned", icon: "✅" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      {/* Pre-footer CTA */}
      <div className="border-b border-slate-200 bg-gradient-to-r from-navy to-navy/90">
        <div className="mx-auto max-w-7xl px-6 py-16 text-center">
          <h2 className="font-poppins text-3xl font-bold text-white sm:text-4xl">
            Ready to transform your advisory practice?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
            See how LedgerIQ helps accounting firms deliver AI-powered
            virtual CFO services with confidence and precision.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/sign-up"
              className="rounded-lg bg-electric px-8 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-electric/90 hover:shadow-xl"
            >
              Start Free Trial
            </Link>
            <Link
              href="/contact"
              className="rounded-lg border border-white/20 px-8 py-3 text-sm font-semibold text-white transition-all hover:border-white/40 hover:bg-white/10"
            >
              Book a Demo
            </Link>
          </div>
        </div>
      </div>

      {/* Main footer links */}
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand column */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-electric font-poppins text-sm font-bold text-white">
                LQ
              </div>
              <span className="font-poppins text-lg font-semibold text-navy">
                LedgerIQ
              </span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-slate-500">
              AI-powered virtual CFO platform for modern accounting and advisory
              firms. Automate financial operations, deliver strategic insights,
              and scale your practice.
            </p>

            {/* Trust badges */}
            <div className="mt-6 flex flex-wrap gap-3">
              {trustBadges.map((badge) => (
                <div
                  key={badge.label}
                  className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                  title={badge.label}
                >
                  <span>{badge.icon}</span>
                  <span>{badge.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Platform */}
          <nav>
            <h3 className="font-poppins text-sm font-semibold text-navy">
              Platform
            </h3>
            <ul className="mt-4 space-y-3">
              {platformLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 transition-colors hover:text-electric"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Resources */}
          <nav>
            <h3 className="font-poppins text-sm font-semibold text-navy">
              Resources
            </h3>
            <ul className="mt-4 space-y-3">
              {resourceLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 transition-colors hover:text-electric"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Company */}
          <nav>
            <h3 className="font-poppins text-sm font-semibold text-navy">
              Company
            </h3>
            <ul className="mt-4 space-y-3">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 transition-colors hover:text-electric"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Legal */}
          <nav>
            <h3 className="font-poppins text-sm font-semibold text-navy">
              Legal
            </h3>
            <ul className="mt-4 space-y-3">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-500 transition-colors hover:text-electric"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-slate-200">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row">
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} LedgerIQ. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              All Systems Operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
